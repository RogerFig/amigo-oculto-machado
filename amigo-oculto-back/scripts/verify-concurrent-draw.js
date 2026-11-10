// Opt-in MySQL integration test. Uses a disposable LOCAL schema and fictitious data only.
require("dotenv").config();
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mysql = require("mysql2/promise");

async function main() {
  if (!["127.0.0.1", "localhost"].includes(process.env.DB_HOST) || process.env.DATABASE !== "amigo_oculto_dev") {
    throw new Error("Recusado: requer .env da base de desenvolvimento local.");
  }
  const schema = `amigo_oculto_concurrency_${crypto.randomBytes(5).toString("hex")}`;
  let root, db, server, created = false;
  try {
    root = await mysql.createConnection({ host: "127.0.0.1", user: "root" });
    await root.query("CREATE DATABASE ??", [schema]);
    created = true;
    Object.assign(process.env, { DATABASE: schema, DB_USER: "root", DB_PASSWORD: "", DB_HOST: "127.0.0.1" });
    const { sequelize, Pessoa, Par, Restricao } = require("../models");
    db = sequelize;
    await db.sync();
    const ids = [];
    for (let i = 0; i < 8; i++) {
      const person = await Pessoa.create({
        nick: `Fictício ${i}`, nome_completo: `Participante fictício ${i}`,
        hash: crypto.randomBytes(32).toString("hex"), escolheu: false, escolhido: false,
      });
      ids.push(person.id);
    }
    await Restricao.create({ id_retira: ids[0], id_escolhido: ids[1] });

    const origin = "http://localhost:8080";
    const password = "only-for-disposable-schema-test";
    const { createApp } = require("../app");
    server = createApp({ settings: {
      ADMIN_PASSWORD: password,
      SESSION_SECRET: "temporary-test-session-secret-0123456789-abcdefghijk",
      FRONTEND_ORIGIN: origin,
      AUTH_COOKIE_SECURE: "false",
    } }).listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${base}/auth/login`, {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const { csrfToken } = await login.json();
    const headers = { Origin: origin, Cookie: cookie, "X-CSRF-Token": csrfToken };

    for (let attempt = 0; attempt < 10; attempt++) {
      const reset = await fetch(base, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ confirmacao: "RESETAR SORTEIO" }) });
      assert.equal(reset.status, 200);
      const results = await Promise.all([
        fetch(`${base}/sorteia`, { method: "POST", headers }),
        fetch(`${base}/sorteia`, { method: "POST", headers }),
      ]);
      assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
      const pairs = await Par.findAll({ raw: true });
      assert.equal(pairs.length, ids.length);
      assert.equal(new Set(pairs.map((pair) => pair.id_retira)).size, ids.length);
      assert.equal(new Set(pairs.map((pair) => pair.id_escolhido)).size, ids.length);
      assert.ok(pairs.every((pair) => pair.id_retira !== pair.id_escolhido));
      assert.ok(!pairs.some((pair) => pair.id_retira === ids[0] && pair.id_escolhido === ids[1]));
      assert.ok((await Pessoa.findAll()).every((person) => person.escolheu && person.escolhido));
    }
    console.log("10 pares de sorteios concorrentes: um 200, outro 409; resultados completos, únicos e sem violar restrições.");
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.close();
    if (created) {
      await root.query("DROP DATABASE ??", [schema]);
      console.log("Schema temporário removido.");
    }
    if (root) await root.end();
  }
}

main().catch((error) => {
  console.error("Teste de concorrência falhou:", error instanceof assert.AssertionError ? error.message : error.name);
  process.exitCode = 1;
});
