const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { Pessoa, Par, Restricao, sequelize } = require("../models");
const routes = require("../api");

const create = routes.stack.find((layer) => layer.route?.path === "/" && layer.route.methods.post).route.stack[0].handle;
const replace = routes.stack.find((layer) => layer.route?.path === "/restricao" && layer.route.methods.post).route.stack[0].handle;

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function withMocks(stubs, run) {
  const guards = [
    [Pessoa, "findAll", async () => []],
    [Par, "count", async () => 0],
    [sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } })],
  ];
  const saved = [...guards, ...stubs].map(([target, name, replacement]) => {
    const previous = target[name];
    target[name] = replacement;
    return [target, name, previous];
  });
  try { await run(); }
  finally { for (const [target, name, previous] of saved.reverse()) target[name] = previous; }
}

test("registration validates required data and relies on autoIncrement, not MAX(id)", async () => {
  const saved = [];
  await withMocks([
    [Pessoa, "max", async () => { throw Error("MAX(id) is unsafe"); }],
    [Pessoa, "create", async (values) => { saved.push(values); return values; }],
  ], async () => {
    for (const body of [{}, { nome_completo: "", nick: "Apelido" }, { nome_completo: "Nome", nick: "" }]) {
      const invalid = response();
      await create({ body }, invalid);
      assert.equal(invalid.statusCode, 400);
    }
    assert.equal(saved.length, 0);
    const valid = response();
    await create({ body: { nome_completo: " Nome ", nick: " Apelido ", escolheu: true } }, valid);
    assert.equal(valid.statusCode, 201);
    assert.equal(saved[0].id, undefined);
    assert.equal(saved[0].nome_completo, "Nome");
    assert.equal(saved[0].nick, "Apelido");
    assert.equal(saved[0].escolheu, false);
    assert.match(saved[0].hash, /^[a-f0-9]{64}$/);
  });
});

test("restriction replacement clears an empty selection in the same transaction", async () => {
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  const events = [];
  await withMocks([
    [sequelize, "transaction", async (callback) => {
      events.push("begin");
      const result = await callback(tx);
      events.push("commit");
      return result;
    }],
    [Pessoa, "findByPk", async (id, options) => {
      assert.equal(id, 3);
      assert.equal(options.transaction, tx);
      events.push("lock");
      return { id };
    }],
    [Pessoa, "count", async ({ transaction }) => { assert.equal(transaction, tx); return 2; }],
    [Restricao, "destroy", async (options) => {
      assert.deepEqual(options.where, { id_retira: 3 });
      assert.equal(options.transaction, tx);
      events.push("delete");
    }],
    [Restricao, "bulkCreate", async (rows, options) => {
      assert.equal(options.transaction, tx);
      assert.deepEqual(rows, [
        { id_retira: 3, id_escolhido: 1 },
        { id_retira: 3, id_escolhido: 2 },
      ]);
      events.push("insert");
    }],
  ], async () => {
    const saved = response();
    await replace({ body: { id_retira: 3, id_escolhidos: [1, 2] } }, saved);
    assert.equal(saved.statusCode, 200);
    assert.deepEqual(events, ["begin", "lock", "delete", "insert", "commit"]);

    events.length = 0;
    const cleared = response();
    await replace({ body: { id_retira: 3, id_escolhidos: [] } }, cleared);
    assert.equal(cleared.statusCode, 200);
    assert.deepEqual(events, ["begin", "lock", "delete", "commit"]);
  });
});

test("invalid restrictions and missing participants never delete existing rows", async () => {
  let changes = 0;
  let recipientCount = 0;
  await withMocks([
    [sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } })],
    [Pessoa, "findByPk", async (id) => id === 3 ? { id } : null],
    [Pessoa, "count", async () => recipientCount],
    [Restricao, "destroy", async () => { changes++; }],
  ], async () => {
    for (const body of [
      [], { id_retira: 3, id_escolhidos: [3] },
      { id_retira: 3, id_escolhidos: [1, 1] },
      { id_retira: "3", id_escolhidos: [] },
      { id_retira: 3, id_escolhidos: [0] },
      { id_retira: 3, id_escolhidos: [1.5] },
    ]) {
      const invalid = response();
      await replace({ body }, invalid);
      assert.equal(invalid.statusCode, 400);
    }
    const absentGiver = response();
    await replace({ body: { id_retira: 99, id_escolhidos: [] } }, absentGiver);
    assert.equal(absentGiver.statusCode, 404);
    const absentRecipient = response();
    await replace({ body: { id_retira: 3, id_escolhidos: [1] } }, absentRecipient);
    assert.equal(absentRecipient.statusCode, 404);
    assert.equal(changes, 0);
  });
});

test("database failure returns an error instead of a false success", async () => {
  await withMocks([
    [sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } })],
    [Pessoa, "findByPk", async () => ({ id: 3 })],
    [Pessoa, "count", async () => 1],
    [Restricao, "destroy", async () => { throw Error("database secret"); }],
  ], async () => {
    const failed = response();
    await replace({ body: { id_retira: 3, id_escolhidos: [1] } }, failed);
    assert.equal(failed.statusCode, 500);
    assert.doesNotMatch(JSON.stringify(failed.body), /database secret/);
  });
});

test("admin sends giver ID even when all restrictions are unchecked", async () => {
  const calls = [];
  let handler;
  const dropdown = {
    getAttribute: () => "3",
    querySelectorAll: () => [],
  };
  const button = {
    parentElement: dropdown,
    addEventListener(_name, callback) { handler = callback; },
  };
  const table = { replaceChildren() {} };
  const document = {
    querySelector: () => table,
    querySelectorAll: () => [button],
  };
  const context = {
    document, domain: "http://localhost:3000", alert: () => { throw Error("unexpected alert"); },
    window: { apiFetch: async (url, options) => {
      if (options?.method === "POST") {
        calls.push(JSON.parse(options.body));
        return { ok: true };
      }
      return { ok: true, json: async () => [] };
    } },
  };
  runInNewContext(readFileSync(join(__dirname, "../../amigo-oculto-front/js/restricoes.js"), "utf8"), context);
  context.addEventOnDropdowns();
  await handler({ target: button });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id_retira, 3);
  assert.deepEqual(calls[0].id_escolhidos, []);
});
