const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { join } = require("node:path");

const scripts = join(__dirname, "../../amigo-oculto-front/js");

function load(location, fetch) {
  const url = new URL(location);
  const window = { location: { hostname: url.hostname, protocol: url.protocol, origin: url.origin, href: url.href, replace() {} } };
  const context = { window, document: { querySelector: () => null }, fetch, Headers, URL, console };
  runInNewContext(readFileSync(join(scripts, "geral.js"), "utf8"), context);
  runInNewContext(readFileSync(join(scripts, "auth-client.js"), "utf8"), context);
  return window;
}

test("frontend routes localhost to the local API, not Render", async () => {
  const calls = [];
  const window = load("http://localhost:8080/index.html", async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/session")) return { status: 200, ok: true, json: async () => ({ csrfToken: "local-csrf" }) };
    return { status: 200, ok: true };
  });
  assert.equal(window.apiDomain, "http://localhost:3000");
  await window.apiFetch(`${window.apiDomain}/sorteia`);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.credentials, "include");
  assert.equal(calls[1].options.headers.get("X-CSRF-Token"), "local-csrf");
});

test("Render frontend calls the separate Render API with credentials and CSRF", async () => {
  const calls = [];
  const window = load("https://amigo-oculto-frong.onrender.com/index.html", async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/session")) return { status: 200, ok: true, json: async () => ({ csrfToken: "csrf-test" }) };
    return { status: 201, ok: true };
  });
  assert.equal(window.apiDomain, "https://amigo-oculto-back.onrender.com");
  await window.apiFetch(window.apiDomain, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(calls[0].url, "https://amigo-oculto-back.onrender.com/auth/session");
  assert.equal(calls[1].url, window.apiDomain);
  assert.equal(calls[1].options.credentials, "include");
  assert.equal(calls[1].options.headers.get("X-CSRF-Token"), "csrf-test");
  assert.equal(calls[1].options.headers.get("Content-Type"), "application/json");
});

test("public Render admin pages redirect to first-party backend admin pages", () => {
  for (const page of ["login.html", "index.html", "listagem.html", "restricoes.html"]) {
    const url = new URL(`https://amigo-oculto-frong.onrender.com/${page}`);
    let destination;
    const window = { location: {
      hostname: url.hostname, pathname: url.pathname, search: url.search, hash: url.hash,
      replace(next) { destination = next; },
    } };
    runInNewContext(readFileSync(join(scripts, "admin-entry.js"), "utf8"), { window });
    assert.equal(destination, `https://amigo-oculto-back.onrender.com/admin/${page}`);
    assert.equal(window.adminRedirecting, true);
  }
});

test("admin pages already on the API origin do not redirect", () => {
  const window = { location: {
    hostname: "amigo-oculto-back.onrender.com", pathname: "/admin/login.html",
    search: "", hash: "", replace() { throw Error("unexpected redirect"); },
  } };
  runInNewContext(readFileSync(join(scripts, "admin-entry.js"), "utf8"), { window });
  assert.equal(window.adminRedirecting, undefined);
});
