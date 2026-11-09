const crypto = require("crypto");

const COOKIE_NAME = "amigo_admin";
const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;

function digest(value) {
  return crypto.createHash("sha256").update(value).digest();
}

function safeEqual(left, right) {
  return crypto.timingSafeEqual(digest(left), digest(right));
}

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;

  const prefix = `${name}=`;
  const entry = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

function createAdminAuth({
  adminPassword,
  sessionSecret,
  frontendOrigin,
  secureCookie,
  sessionTtlSeconds = DEFAULT_SESSION_TTL_SECONDS,
  now = () => Date.now(),
}) {
  if (typeof adminPassword !== "string" || adminPassword.length < 16) {
    throw new Error("ADMIN_PASSWORD precisa ter pelo menos 16 caracteres.");
  }
  if (typeof sessionSecret !== "string" || Buffer.byteLength(sessionSecret) < 32) {
    throw new Error("SESSION_SECRET precisa ter pelo menos 32 bytes.");
  }
  if (typeof frontendOrigin !== "string") {
    throw new Error("FRONTEND_ORIGIN é obrigatória.");
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(frontendOrigin);
  } catch {
    throw new Error("FRONTEND_ORIGIN precisa ser uma origem HTTP(S) válida.");
  }
  if (
    !["http:", "https:"].includes(parsedOrigin.protocol) ||
    parsedOrigin.origin !== frontendOrigin
  ) {
    throw new Error("FRONTEND_ORIGIN deve conter somente esquema, host e porta.");
  }
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];
  if (parsedOrigin.protocol !== "https:" && !localHosts.includes(parsedOrigin.hostname)) {
    throw new Error("HTTPS é obrigatório fora de localhost.");
  }
  if (typeof secureCookie !== "boolean") {
    throw new Error("AUTH_COOKIE_SECURE deve ser true ou false.");
  }
  if (parsedOrigin.protocol === "https:" && !secureCookie) {
    throw new Error("AUTH_COOKIE_SECURE=true é obrigatório para origens HTTPS.");
  }
  if (
    !Number.isInteger(sessionTtlSeconds) ||
    sessionTtlSeconds < 300 ||
    sessionTtlSeconds > 24 * 60 * 60
  ) {
    throw new Error("ADMIN_SESSION_TTL_SECONDS deve estar entre 300 e 86400.");
  }

  function allowedOrigin(req) {
    return req.headers.origin === frontendOrigin;
  }

  function sign(payload) {
    return crypto
      .createHmac("sha256", sessionSecret)
      .update(payload)
      .digest("base64url");
  }

  function issueSession(csrfToken) {
    const payload = Buffer.from(
      JSON.stringify({
        version: 1,
        expiresAt: now() + sessionTtlSeconds * 1000,
        csrfToken,
      })
    ).toString("base64url");

    return `${payload}.${sign(payload)}`;
  }

  function readSession(req) {
    const token = getCookieValue(req.headers.cookie, COOKIE_NAME);
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;

    const expectedSignature = Buffer.from(sign(parts[0]), "base64url");
    const suppliedSignature = Buffer.from(parts[1], "base64url");
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      return null;
    }

    try {
      const session = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
      if (
        session.version !== 1 ||
        !Number.isFinite(session.expiresAt) ||
        session.expiresAt <= now() ||
        typeof session.csrfToken !== "string"
      ) {
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function setSessionCookie(res, value, maxAge) {
    const attributes = [
      `${COOKIE_NAME}=${value}`,
      "Path=/",
      "HttpOnly",
      `SameSite=${secureCookie ? "None" : "Lax"}`,
      `Max-Age=${maxAge}`,
    ];
    if (secureCookie) attributes.push("Secure");
    res.setHeader("Set-Cookie", attributes.join("; "));
    res.setHeader("Cache-Control", "no-store");
  }

  function deny(res, status, message) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(status).json({ erro: message });
  }

  function requireAdmin(req, res, next) {
    res.setHeader("Cache-Control", "no-store");
    const session = readSession(req);
    if (!session) return deny(res, 401, "Autenticação necessária.");
    req.adminSession = session;
    return next();
  }

  function requireAdminExceptResult(req, res, next) {
    if (req.method === "GET" && /^\/u\/[^/]+\/?$/.test(req.path)) {
      res.setHeader("Cache-Control", "no-store");
      return next();
    }
    return requireAdmin(req, res, next);
  }

  function requireCsrf(req, res, next) {
    const session = req.adminSession || readSession(req);
    const csrfToken = req.headers["x-csrf-token"];
    if (
      !allowedOrigin(req) ||
      !session ||
      typeof csrfToken !== "string" ||
      !safeEqual(csrfToken, session.csrfToken)
    ) {
      return deny(res, 403, "Requisição não autorizada.");
    }
    req.adminSession = session;
    return next();
  }

  function requireCsrfForMutation(req, res, next) {
    const mutatingMethod = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    const legacyDrawGet = req.method === "GET" && /^\/sorteia\/?$/.test(req.path);
    if (!mutatingMethod && !legacyDrawGet) return next();
    return requireCsrf(req, res, next);
  }

  function login(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (!allowedOrigin(req)) return deny(res, 403, "Origem não autorizada.");

    const password = req.body && req.body.password;
    if (
      typeof password !== "string" ||
      !safeEqual(password, adminPassword)
    ) {
      return deny(res, 401, "Credenciais inválidas.");
    }

    const csrfToken = crypto.randomBytes(32).toString("base64url");
    setSessionCookie(res, issueSession(csrfToken), sessionTtlSeconds);
    return res.status(200).json({ csrfToken });
  }

  function getSession(req, res) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ csrfToken: req.adminSession.csrfToken });
  }

  function logout(req, res) {
    const attributes = [
      `${COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      `SameSite=${secureCookie ? "None" : "Lax"}`,
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ];
    if (secureCookie) attributes.push("Secure");
    res.setHeader("Set-Cookie", attributes.join("; "));
    res.setHeader("Cache-Control", "no-store");
    return res.status(204).end();
  }

  return {
    frontendOrigin,
    login,
    getSession,
    logout,
    requireAdmin,
    requireAdminExceptResult,
    requireCsrf,
    requireCsrfForMutation,
  };
}

module.exports = { createAdminAuth };
