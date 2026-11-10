const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { Pessoa, Par, Restricao, sequelize } = require("../models");
const router = require("../api");
const { startServer } = require("../app");

function route(method, path) {
  return router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle;
}

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

async function withMocks(stubs, run) {
  const saved = stubs.map(([object, name, replacement]) => {
    const previous = object[name];
    object[name] = replacement;
    return [object, name, previous];
  });
  try { await run(); }
  finally { for (const [object, name, previous] of saved.reverse()) object[name] = previous; }
}

test("all participant and restriction writes refuse an existing draw, without changing data", async () => {
  let writes = 0;
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  await withMocks([
    [sequelize, "transaction", async (callback) => callback(tx)],
    [Pessoa, "findAll", async (options) => {
      assert.equal(options.lock, "UPDATE");
      assert.equal(options.transaction, tx);
      return [{ id: 1, escolheu: true, escolhido: true }];
    }],
    [Par, "count", async () => 1],
    [Pessoa, "create", async () => { writes++; }],
    [Pessoa, "update", async () => { writes++; }],
    [Pessoa, "destroy", async () => { writes++; }],
    [Restricao, "destroy", async () => { writes++; }],
  ], async () => {
    for (const [handler, request] of [
      [route("post", "/"), { body: { nome_completo: "Novo", nick: "N" } }],
      [route("put", "/:id"), { params: { id: "1" }, body: { nome_completo: "Editado", nick: "E" } }],
      [route("delete", "/:id"), { params: { id: "1" } }],
      [route("post", "/restricao"), { body: { id_retira: 1, id_escolhidos: [] } }],
    ]) {
      const res = response();
      await handler(request, res);
      assert.equal(res.statusCode, 409);
    }
    assert.equal(writes, 0);
  });
});

test("reset requires an explicit phrase and uses transactional DELETE, not TRUNCATE", async () => {
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  const events = [];
  await withMocks([
    [sequelize, "transaction", async (callback) => {
      events.push("begin");
      const value = await callback(tx);
      events.push("commit");
      return value;
    }],
    [Pessoa, "findAll", async (options) => {
      assert.equal(options.transaction, tx);
      assert.equal(options.lock, "UPDATE");
      events.push("lock");
      return [];
    }],
    [Par, "destroy", async (options) => {
      assert.equal(options.transaction, tx);
      assert.deepEqual(options.where, {});
      assert.equal(options.truncate, undefined);
      events.push("pairs");
    }],
    [Pessoa, "update", async (values, options) => {
      assert.deepEqual(values, { escolhido: false, escolheu: false, data: null });
      assert.equal(options.transaction, tx);
      events.push("flags");
    }],
  ], async () => {
    const denied = response();
    await route("put", "/")({ body: {} }, denied);
    assert.equal(denied.statusCode, 400);
    assert.deepEqual(events, []);

    const confirmed = response();
    await route("put", "/")({ body: { confirmacao: "RESETAR SORTEIO" } }, confirmed);
    assert.equal(confirmed.statusCode, 200);
    assert.deepEqual(events, ["begin", "lock", "pairs", "flags", "commit"]);
  });
});

test("missing/invalid IDs and database errors return useful statuses without leaking errors", async () => {
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  await withMocks([
    [sequelize, "transaction", async (callback) => callback(tx)],
    [Pessoa, "findAll", async () => []],
    [Par, "count", async () => 0],
    [Pessoa, "findByPk", async () => null],
  ], async () => {
    for (const method of ["put", "delete"]) {
      const missing = response();
      await route(method, "/:id")({ params: { id: "7" }, body: { nome_completo: "Nome", nick: "N" } }, missing);
      assert.equal(missing.statusCode, 404);
      const invalid = response();
      await route(method, "/:id")({ params: { id: "not-an-id" }, body: {} }, invalid);
      assert.equal(invalid.statusCode, 400);
    }
    const invalidQuery = response();
    await route("get", "/")({ query: { id: "bad" } }, invalidQuery);
    assert.equal(invalidQuery.statusCode, 400);
  });
  await withMocks([
    [Pessoa, "findAll", async () => { throw Error("internal database credential"); }],
  ], async () => {
    const failure = response();
    await route("get", "/")({ query: {} }, failure);
    assert.equal(failure.statusCode, 500);
    assert.doesNotMatch(JSON.stringify(failure.body), /credential/);
  });
});

test("server waits for database authentication and sync, never listening when either fails", async () => {
  const events = [];
  const app = { listen(_port, callback) { events.push("listen"); const server = { address: () => ({ port: 3000 }), once() {} }; queueMicrotask(callback); return server; } };
  await assert.rejects(startServer({ app, db: { authenticate: async () => { throw Error("unavailable"); } } }), /unavailable/);
  assert.deepEqual(events, []);
  await assert.rejects(startServer({ app, db: {
    authenticate: async () => events.push("authenticate"),
    sync: async () => { throw Error("sync failed"); },
  } }), /sync failed/);
  assert.deepEqual(events, ["authenticate"]);
  await startServer({ app, db: {
    authenticate: async () => events.push("authenticate"),
    sync: async () => events.push("sync"),
  } });
  assert.deepEqual(events, ["authenticate", "authenticate", "sync", "listen"]);
});

test("admin reset sends a confirmed JSON request and does nothing when phrase is incorrect", async () => {
  const buttons = new Map();
  const sent = [];
  let typed = "não";
  let reloads = 0;
  const document = { querySelector(key) {
    if (!buttons.has(key)) buttons.set(key, { addEventListener(_event, callback) { this.click = callback; } });
    return buttons.get(key);
  } };
  const window = { location: { reload() { reloads++; } }, apiFetch: async (_url, options) => {
    sent.push(options);
    return { ok: true };
  } };
  runInNewContext(readFileSync(join(__dirname, "../../amigo-oculto-front/js/util.js"), "utf8"), {
    document, window, domain: "http://localhost:3000", prompt: () => typed,
    alert() { throw Error("Unexpected alert"); },
  });
  await buttons.get("#btnReset").click({});
  assert.equal(sent.length, 0);
  typed = "RESETAR SORTEIO";
  await buttons.get("#btnReset").click({});
  assert.equal(sent.length, 1);
  assert.equal(sent[0].method, "PUT");
  assert.equal(JSON.parse(sent[0].body).confirmacao, "RESETAR SORTEIO");
  assert.equal(reloads, 1);
});
