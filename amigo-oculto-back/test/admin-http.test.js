const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const { createApp } = require("../app");

const ORIGIN = "http://localhost:8080";
const PASSWORD = "test-admin-password-not-real";

async function withServer(run, overrides = {}) {
  const routes = express.Router();
  let writes = 0;
  routes.get("/", (_req, res) => res.json([{ id: 1, hash: "private-test-hash" }]));
  routes.get("/restricao", (_req, res) => res.json([]));
  routes.get("/sorteia", (_req, res) => { writes++; res.json({ ok: true }); });
  routes.post("/restricao", (_req, res) => { writes++; res.sendStatus(201); });
  routes.post("/", (_req, res) => { writes++; res.sendStatus(201); });
  routes.put("/", (_req, res) => { writes++; res.sendStatus(200); });
  routes.put("/:id", (_req, res) => { writes++; res.sendStatus(200); });
  routes.delete("/:id", (_req, res) => { writes++; res.sendStatus(204); });
  routes.get("/u/:hash", (req, res) => res.json({ result: req.params.hash }));

  const settings = {
    ADMIN_PASSWORD: PASSWORD,
    SESSION_SECRET: "random-test-session-secret-not-for-production-0123456789",
    FRONTEND_ORIGIN: ORIGIN,
    AUTH_COOKIE_SECURE: "false",
    ...overrides,
  };
  const app = createApp({ routes, settings });
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const url = `http://127.0.0.1:${server.address().port}`;
    await run({ url, writes: () => writes });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("HTTP: anonymous admin endpoints deny access before any route is executed; result remains public", async () => {
  await withServer(async ({ url, writes }) => {
    for (const [method, path] of [
      ["GET", "/"], ["GET", "/?id=1"], ["GET", "/restricao"],
      ["GET", "/sorteia"], ["POST", "/"], ["PUT", "/"],
      ["PUT", "/1"], ["DELETE", "/1"], ["POST", "/restricao"],
      ["GET", "/auth/session"], ["POST", "/auth/logout"],
    ]) {
      const response = await fetch(url + path, { method });
      assert.equal(response.status, 401, `${method} ${path}`);
      assert.doesNotMatch(await response.text(), /private-test-hash/);
    }
    assert.equal(writes(), 0);
    const result = await fetch(url + "/u/individual-link");
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { result: "individual-link" });
  });
});

test("HTTP: login, session, CSRF, allowed and foreign origins, logout", async () => {
  await withServer(async ({ url, writes }) => {
    const wrong = await fetch(url + "/auth/login", {
      method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.headers.get("set-cookie"), null);

    const foreign = await fetch(url + "/auth/login", {
      method: "POST", headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    assert.equal(foreign.status, 403);

    const login = await fetch(url + "/auth/login", {
      method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    assert.equal(login.status, 200);
    assert.equal(login.headers.get("access-control-allow-origin"), ORIGIN);
    assert.equal(login.headers.get("access-control-allow-credentials"), "true");
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    const { csrfToken } = await login.json();

    const session = await fetch(url + "/auth/session", { headers: { Cookie: cookie } });
    assert.equal(session.status, 200);
    assert.deepEqual(await session.json(), { csrfToken });
    const listing = await fetch(url + "/", { headers: { Cookie: cookie } });
    assert.equal(listing.status, 200);
    assert.equal((await listing.json())[0].hash, "private-test-hash");

    for (const headers of [
      { Cookie: cookie, Origin: ORIGIN },
      { Cookie: cookie, Origin: "https://attacker.example", "X-CSRF-Token": csrfToken },
      { Cookie: cookie, Origin: ORIGIN, "X-CSRF-Token": "incorrect" },
    ]) {
      const denied = await fetch(url + "/", { method: "PUT", headers });
      assert.equal(denied.status, 403);
    }
    assert.equal(writes(), 0);

    for (const path of ["/sorteia", "/sorteia/"]) {
      const drawDenied = await fetch(url + path, { headers: { Cookie: cookie, Origin: ORIGIN } });
      assert.equal(drawDenied.status, 403, path);
    }
    assert.equal(writes(), 0);

    const allowedHeaders = { Cookie: cookie, Origin: ORIGIN, "X-CSRF-Token": csrfToken };
    const saved = await fetch(url + "/", { method: "POST", headers: allowedHeaders });
    assert.equal(saved.status, 201);
    assert.equal(writes(), 1);

    const preflight = await fetch(url + "/", {
      method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-csrf-token" },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), ORIGIN);

    const logout = await fetch(url + "/auth/logout", { method: "POST", headers: allowedHeaders });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  });
});

test("HTTP: Render-style HTTPS frontend receives cross-site Secure cookie", async () => {
  const frontend = "https://amigo-oculto-frong.onrender.com";
  await withServer(async ({ url }) => {
    const response = await fetch(url + "/auth/login", {
      method: "POST", headers: { Origin: frontend, "Content-Type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), frontend);
    assert.match(response.headers.get("set-cookie"), /SameSite=None/);
    assert.match(response.headers.get("set-cookie"), /Secure/);
  }, { FRONTEND_ORIGIN: frontend, AUTH_COOKIE_SECURE: "true" });
});
