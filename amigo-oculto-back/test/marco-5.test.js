const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");

const frontend = join(__dirname, "../../amigo-oculto-front");

function load(file, apiFetch) {
  const status = { textContent: "Carregando..." };
  const table = { cleared: 0, replaceChildren() { this.cleared++; }, addEventListener() {} };
  const document = {
    querySelector: (selector) => selector === "#listStatus" ? status : table,
    querySelectorAll: () => [],
  };
  const context = {
    document,
    domain: "http://localhost:3000",
    window: { apiDomain: "http://localhost:3000", apiFetch },
  };
  runInNewContext(readFileSync(join(frontend, "js", file), "utf8"), context);
  return { context, status, table };
}

test("each admin listing shows a helpful error when the API fails", async () => {
  for (const [file, method] of [
    ["get-users.js", "consultaPessoas"],
    ["get-simple-list.js", "consultaLista"],
    ["restricoes.js", "consultaPessoas"],
  ]) {
    const { context, status, table } = load(file, async () => { throw Error("network offline"); });
    await assert.rejects(context[method](), /network offline/);
    assert.match(status.textContent, /Verifique a conexão e recarregue/);
    assert.ok(table.cleared >= 1);
  }
});

test("HTTP errors in either restrictions request or other listings clear stale content", async () => {
  for (const [file, method] of [
    ["get-users.js", "consultaPessoas"],
    ["get-simple-list.js", "consultaLista"],
    ["restricoes.js", "consultaPessoas"],
  ]) {
    const { context, status, table } = load(file, async (url) => {
      return file === "restricoes.js" && !url.endsWith("/restricao")
        ? { ok: true, json: async () => [] }
        : { ok: false, status: 503 };
    });
    await assert.rejects(context[method](), /Falha ao carregar/);
    assert.match(status.textContent, /Não foi possível carregar/);
    assert.ok(table.cleared >= 1);
  }
});

test("admin pages show an empty state instead of placeholder participants", async () => {
  for (const [file, method] of [
    ["get-users.js", "consultaPessoas"],
    ["get-simple-list.js", "consultaLista"],
    ["restricoes.js", "consultaPessoas"],
  ]) {
    const { context, status } = load(file, async () => ({ ok: true, json: async () => [] }));
    await context[method]();
    assert.match(status.textContent, /Nenhum/);
  }
  const html = readFileSync(join(frontend, "restricoes.html"), "utf8");
  assert.doesNotMatch(html, /Jerry|Sheet1|All Sheets/);
});
