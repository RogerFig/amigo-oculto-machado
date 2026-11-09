const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const ejs = require("ejs");
const { Pessoa, Par, Restricao, sequelize } = require("../models");
const router = require("../api");
const { assignPairs } = require("../draw/assign");

const draw = router.stack.find((layer) => layer.route?.path === "/sorteia").route.stack[0].handle;
const result = router.stack.find((layer) => layer.route?.path === "/u/:hash").route.stack[0].handle;

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    render(view, locals) {
      this.body = ejs.render(readFileSync(join(__dirname, "../views", `${view}.ejs`), "utf8"), locals);
      return this;
    },
  };
}

async function withMocks(stubs, run) {
  const saved = [];
  for (const [object, name, replacement] of stubs) {
    saved.push([object, name, object[name]]);
    object[name] = replacement;
  }
  try { await run(); }
  finally { for (const [object, name, original] of saved) object[name] = original; }
}

test("matching assigns everyone exactly once, respects exclusions and rejects impossible cases", () => {
  const ids = [1, 2, 3, 4];
  const restrictions = [{ id_retira: 1, id_escolhido: 2 }, { id_retira: 1, id_escolhido: 3 }];
  const pairs = assignPairs(ids, restrictions, () => 0);
  assert.equal(pairs.length, 4);
  assert.deepEqual(new Set(pairs.map((pair) => pair.id_retira)), new Set(ids));
  assert.deepEqual(new Set(pairs.map((pair) => pair.id_escolhido)), new Set(ids));
  for (const pair of pairs) {
    assert.notEqual(pair.id_retira, pair.id_escolhido);
    assert.ok(!restrictions.some((r) => r.id_retira === pair.id_retira && r.id_escolhido === pair.id_escolhido));
  }
  assert.equal(assignPairs([1], [], () => 0), null);
  assert.equal(assignPairs([1, 2], [{ id_retira: 1, id_escolhido: 2 }], () => 0), null);
  assert.equal(assignPairs([1, 2], [], () => 0).length, 2);
});

test("matching finds a solution if one exists for every restriction set among three people", () => {
  const ids = [1, 2, 3];
  const edges = ids.flatMap((giver) => ids.filter((recipient) => recipient !== giver)
    .map((recipient) => ({ id_retira: giver, id_escolhido: recipient })));
  const validCycles = [
    [[1, 2], [2, 3], [3, 1]],
    [[1, 3], [2, 1], [3, 2]],
  ];
  for (let mask = 0; mask < 2 ** edges.length; mask++) {
    const restrictions = edges.filter((_edge, index) => mask & (1 << index));
    const expected = validCycles.some((cycle) => cycle.every(([giver, recipient]) =>
      !restrictions.some((r) => r.id_retira === giver && r.id_escolhido === recipient)));
    const pairs = assignPairs(ids, restrictions, () => 0);
    assert.equal(pairs !== null, expected, `restriction mask ${mask}`);
    if (pairs) {
      assert.deepEqual(new Set(pairs.map((pair) => pair.id_retira)), new Set(ids));
      assert.deepEqual(new Set(pairs.map((pair) => pair.id_escolhido)), new Set(ids));
      assert.ok(pairs.every((pair) => pair.id_retira !== pair.id_escolhido));
    }
  }
});

test("draw writes one complete matching within the transaction and refuses another draw", async () => {
  const people = [1, 2, 3].map((id) => ({ id, escolheu: false, escolhido: false }));
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  const events = [];
  let alreadyDrawn = false;
  await withMocks([
    [sequelize, "transaction", async (callback) => { events.push("begin"); const value = await callback(tx); events.push("commit"); return value; }],
    [Pessoa, "findAll", async (options) => { assert.equal(options.lock, "UPDATE"); assert.equal(options.transaction, tx); return people; }],
    [Par, "count", async ({ transaction }) => { assert.equal(transaction, tx); return alreadyDrawn ? 3 : 0; }],
    [Restricao, "findAll", async ({ transaction }) => { assert.equal(transaction, tx); return []; }],
    [Par, "bulkCreate", async (pairs, { transaction }) => {
      assert.equal(transaction, tx);
      assert.equal(pairs.length, 3);
      assert.deepEqual(new Set(pairs.map((pair) => pair.id_retira)), new Set([1, 2, 3]));
      assert.deepEqual(new Set(pairs.map((pair) => pair.id_escolhido)), new Set([1, 2, 3]));
      events.push("pairs");
    }],
    [Pessoa, "update", async (values, options) => {
      assert.deepEqual(values, { escolheu: true, escolhido: true });
      assert.equal(options.transaction, tx);
      events.push("flags");
    }],
  ], async () => {
    const first = response();
    await draw({}, first);
    assert.equal(first.statusCode, 200);
    assert.deepEqual(events, ["begin", "pairs", "flags", "commit"]);
    alreadyDrawn = true;
    const again = response();
    await draw({}, again);
    assert.equal(again.statusCode, 409);
    assert.deepEqual(events, ["begin", "pairs", "flags", "commit", "begin"]);
  });
});

test("impossible constraints and DB errors never report success or persist partial pairs", async () => {
  const people = [1, 2].map((id) => ({ id, escolheu: false, escolhido: false }));
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  let created = 0;
  let updated = 0;
  let restrictions = [{ id_retira: 1, id_escolhido: 2 }];
  await withMocks([
    [sequelize, "transaction", async (callback) => callback(tx)],
    [Pessoa, "findAll", async () => people],
    [Par, "count", async () => 0],
    [Restricao, "findAll", async () => restrictions],
    [Par, "bulkCreate", async () => { created++; throw Error("database failed"); }],
    [Pessoa, "update", async () => { updated++; }],
  ], async () => {
    const impossible = response();
    await draw({}, impossible);
    assert.equal(impossible.statusCode, 422);
    assert.equal(created, 0);
    assert.equal(updated, 0);
    restrictions = [];
    const failure = response();
    await draw({}, failure);
    assert.equal(failure.statusCode, 500);
    assert.equal(created, 1);
    assert.equal(updated, 0);
    assert.doesNotMatch(JSON.stringify(failure.body), /database failed/);
  });
});

test("public results handle unknown links, pending drawings and completed drawings safely", async () => {
  let person = null;
  let pair = null;
  let recipient = null;
  await withMocks([
    [Pessoa, "findOne", async ({ where }) => where.hash ? person : recipient],
    [Par, "findOne", async () => pair],
  ], async () => {
    const unknown = response();
    await result({ params: { hash: "missing" } }, unknown);
    assert.equal(unknown.statusCode, 404);
    person = { id: 1, nome_completo: "<script>alert(1)</script>" };
    const pending = response();
    await result({ params: { hash: "valid" } }, pending);
    assert.equal(pending.statusCode, 200);
    assert.match(pending.body, /sorteio ainda não foi realizado/);
    assert.doesNotMatch(pending.body, /Revelar amigo oculto!/);
    assert.doesNotMatch(pending.body, /<script>alert/);
    pair = { id_escolhido: 2 };
    recipient = { nome_completo: "Destinatário" };
    const complete = response();
    await result({ params: { hash: "valid" } }, complete);
    assert.equal(complete.statusCode, 200);
    assert.match(complete.body, /Revelar amigo oculto!/);
    assert.match(complete.body, /Destinatário/);
    recipient = null;
    const broken = response();
    await result({ params: { hash: "valid" } }, broken);
    assert.equal(broken.statusCode, 404);
  });
});

test("admin draw button shows a useful error and does not navigate after an impossible draw", async () => {
  const buttons = new Map();
  const messages = [];
  const window = { location: { href: "index.html" }, apiFetch: async () => ({
    ok: false, json: async () => ({ mensagem: "Não há sorteio possível com as restrições atuais." }),
  }) };
  const document = { querySelector(selector) {
    if (!buttons.has(selector)) buttons.set(selector, { addEventListener(_event, callback) { this.click = callback; } });
    return buttons.get(selector);
  } };
  runInNewContext(readFileSync(join(__dirname, "../../amigo-oculto-front/js/util.js"), "utf8"), {
    window, document, domain: "http://localhost:3000", alert: (message) => messages.push(message), console,
  });
  const button = buttons.get("#btnSortear");
  await button.click({});
  assert.deepEqual(messages, ["Não há sorteio possível com as restrições atuais."]);
  assert.equal(window.location.href, "index.html");
  assert.equal(button.disabled, false);
});
