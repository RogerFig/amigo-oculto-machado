const test = require("node:test");
const assert = require("node:assert/strict");
const { createAdminAuth } = require("../auth/admin-auth");

const config = {
  adminPassword: "correct-horse-battery-staple",
  sessionSecret: "test-session-secret-that-is-at-least-32-bytes-long",
  frontendOrigin: "http://localhost:8080",
  secureCookie: false,
  sessionTtlSeconds: 3600,
};

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function request({ method = "GET", path = "/", origin, cookie, csrfToken, body } = {}) {
  const headers = {};
  if (origin) headers.origin = origin;
  if (cookie) headers.cookie = cookie;
  if (csrfToken) headers["x-csrf-token"] = csrfToken;
  return { method, path, headers, body };
}

function createLoggedInSession(auth) {
  const res = createResponse();
  auth.login(
    request({
      method: "POST",
      path: "/auth/login",
      origin: config.frontendOrigin,
      body: { password: config.adminPassword },
    }),
    res
  );
  return {
    cookie: res.headers["Set-Cookie"].split(";", 1)[0],
    csrfToken: res.body.csrfToken,
  };
}

test("requires a strong admin password, signing secret and exact frontend origin", () => {
  assert.throws(() => createAdminAuth({ ...config, adminPassword: "short" }));
  assert.throws(() => createAdminAuth({ ...config, sessionSecret: "too-short" }));
  assert.throws(() => createAdminAuth({ ...config, frontendOrigin: "*" }));
  assert.throws(() =>
    createAdminAuth({ ...config, frontendOrigin: "http://family.example" })
  );
  assert.throws(() =>
    createAdminAuth({ ...config, frontendOrigin: "https://example.test", secureCookie: false })
  );
});

test("login rejects invalid credentials and foreign origins", () => {
  const auth = createAdminAuth(config);
  const wrongPassword = createResponse();
  auth.login(
    request({
      method: "POST",
      origin: config.frontendOrigin,
      body: { password: "wrong-password" },
    }),
    wrongPassword
  );
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(wrongPassword.headers["Set-Cookie"], undefined);

  const foreignOrigin = createResponse();
  auth.login(
    request({ method: "POST", origin: "https://attacker.test", body: { password: config.adminPassword } }),
    foreignOrigin
  );
  assert.equal(foreignOrigin.statusCode, 403);
});

test("valid login issues an HttpOnly signed cookie and CSRF token accepted by protected routes", () => {
  const auth = createAdminAuth({ ...config, secureCookie: true, frontendOrigin: "https://family.example" });
  const res = createResponse();
  auth.login(
    request({
      method: "POST",
      origin: "https://family.example",
      body: { password: config.adminPassword },
    }),
    res
  );

  const cookie = res.headers["Set-Cookie"];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=None/);
  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.csrfToken, "string");

  const sessionCookie = cookie.split(";", 1)[0];
  const adminRequest = request({ method: "POST", path: "/", origin: "https://family.example", cookie: sessionCookie, csrfToken: res.body.csrfToken });
  const authResponse = createResponse();
  let authenticated = false;
  auth.requireAdmin(adminRequest, authResponse, () => {
    authenticated = true;
  });
  assert.equal(authenticated, true);

  let csrfAccepted = false;
  auth.requireCsrf(adminRequest, authResponse, () => {
    csrfAccepted = true;
  });
  assert.equal(csrfAccepted, true);
});

test("backend-hosted admin UI can log in from the API origin without trusting arbitrary origins", () => {
  const auth = createAdminAuth({
    ...config,
    frontendOrigin: "https://amigo-oculto-frong.onrender.com",
    adminOrigin: "https://amigo-oculto-back.onrender.com",
    secureCookie: true,
  });
  const res = createResponse();
  auth.login(request({
    method: "POST", origin: "https://amigo-oculto-back.onrender.com",
    body: { password: config.adminPassword },
  }), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["Set-Cookie"], /SameSite=None; Max-Age/);

  const denied = createResponse();
  auth.login(request({
    method: "POST", origin: "https://other.onrender.com",
    body: { password: config.adminPassword },
  }), denied);
  assert.equal(denied.statusCode, 403);
});

test("local login cookies use SameSite=Lax without Secure", () => {
  const auth = createAdminAuth(config);
  const res = createResponse();
  auth.login(
    request({
      method: "POST",
      origin: config.frontendOrigin,
      body: { password: config.adminPassword },
    }),
    res
  );

  const cookie = res.headers["Set-Cookie"];
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /; Secure(?:;|$)/);
});

test("administrative routes deny missing or tampered cookies; only result GET bypasses admin auth", () => {
  const auth = createAdminAuth(config);
  for (const [method, path] of [
    ["GET", "/"],
    ["POST", "/"],
    ["PUT", "/1"],
    ["DELETE", "/1"],
    ["GET", "/restricao"],
    ["GET", "/sorteia"],
    ["POST", "/auth/logout"],
  ]) {
    const response = createResponse();
    auth.requireAdminExceptResult(request({ method, path }), response, () => {});
    assert.equal(response.statusCode, 401, `${method} ${path} deve exigir admin`);
  }

  let publicResultPassed = false;
  auth.requireAdminExceptResult(request({ method: "GET", path: "/u/participant-token" }), createResponse(), () => {
    publicResultPassed = true;
  });
  assert.equal(publicResultPassed, true);

  const nonGetResultResponse = createResponse();
  auth.requireAdminExceptResult(
    request({ method: "POST", path: "/u/participant-token" }),
    nonGetResultResponse,
    () => {}
  );
  assert.equal(nonGetResultResponse.statusCode, 401);

  const { cookie } = createLoggedInSession(auth);
  const [name, value] = cookie.split("=");
  const [payload, signature] = value.split(".");
  const changedSignature = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
  const tampered = `${name}=${payload}.${changedSignature}`;
  const tamperedResponse = createResponse();
  auth.requireAdmin(request({ method: "GET", cookie: tampered }), tamperedResponse, () => {});
  assert.equal(tamperedResponse.statusCode, 401);
});

test("expired admin sessions are rejected", () => {
  let currentTime = 1000;
  const auth = createAdminAuth({
    ...config,
    sessionTtlSeconds: 300,
    now: () => currentTime,
  });
  const { cookie } = createLoggedInSession(auth);
  currentTime += 301 * 1000;

  const response = createResponse();
  auth.requireAdmin(request({ cookie }), response, () => {});
  assert.equal(response.statusCode, 401);
});

test("state-changing requests require matching origin and CSRF token", () => {
  const auth = createAdminAuth(config);
  const { cookie, csrfToken } = createLoggedInSession(auth);

  const missingCsrfResponse = createResponse();
  const missingCsrfRequest = request({ method: "POST", origin: config.frontendOrigin, cookie });
  auth.requireAdmin(missingCsrfRequest, missingCsrfResponse, () => {});
  auth.requireCsrf(missingCsrfRequest, missingCsrfResponse, () => {});
  assert.equal(missingCsrfResponse.statusCode, 403);

  const invalidCsrfResponse = createResponse();
  const invalidCsrfRequest = request({
    method: "POST",
    origin: config.frontendOrigin,
    cookie,
    csrfToken: "incorrect-token",
  });
  auth.requireAdmin(invalidCsrfRequest, invalidCsrfResponse, () => {});
  auth.requireCsrf(invalidCsrfRequest, invalidCsrfResponse, () => {});
  assert.equal(invalidCsrfResponse.statusCode, 403);

  const foreignOriginResponse = createResponse();
  const foreignOriginRequest = request({ method: "POST", origin: "https://attacker.test", cookie, csrfToken });
  auth.requireAdmin(foreignOriginRequest, foreignOriginResponse, () => {});
  auth.requireCsrf(foreignOriginRequest, foreignOriginResponse, () => {});
  assert.equal(foreignOriginResponse.statusCode, 403);

  let safeGetPassed = false;
  auth.requireCsrfForMutation(request({ method: "GET" }), createResponse(), () => {
    safeGetPassed = true;
  });
  assert.equal(safeGetPassed, true);

  const drawResponse = createResponse();
  const drawRequest = request({ method: "GET", path: "/sorteia", origin: config.frontendOrigin, cookie });
  auth.requireAdmin(drawRequest, drawResponse, () => {});
  auth.requireCsrfForMutation(drawRequest, drawResponse, () => {});
  assert.equal(drawResponse.statusCode, 403);

  const drawSlashResponse = createResponse();
  const drawSlashRequest = request({ method: "GET", path: "/sorteia/", origin: config.frontendOrigin, cookie });
  auth.requireAdmin(drawSlashRequest, drawSlashResponse, () => {});
  auth.requireCsrfForMutation(drawSlashRequest, drawSlashResponse, () => {});
  assert.equal(drawSlashResponse.statusCode, 403);
});

test("logout expires the cookie", () => {
  const auth = createAdminAuth(config);
  const res = createResponse();
  auth.logout({}, res);
  assert.match(res.headers["Set-Cookie"], /Max-Age=0/);
  assert.match(res.headers["Set-Cookie"], /HttpOnly/);
  assert.equal(res.statusCode, 204);
});
