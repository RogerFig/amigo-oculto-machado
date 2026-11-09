require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const rotas = require("./api");
const { sequelize } = require("./models");
const { createAdminAuth } = require("./auth/admin-auth");

function createApp({ routes = rotas, settings = process.env } = {}) {
  if (!["true", "false"].includes(settings.AUTH_COOKIE_SECURE)) {
    throw new Error("AUTH_COOKIE_SECURE deve ser configurada como true ou false.");
  }

  const auth = createAdminAuth({
    adminPassword: settings.ADMIN_PASSWORD,
    sessionSecret: settings.SESSION_SECRET,
    frontendOrigin: settings.FRONTEND_ORIGIN,
    adminOrigin: settings.ADMIN_ORIGIN || (
      settings.FRONTEND_ORIGIN === "https://amigo-oculto-frong.onrender.com"
        ? "https://amigo-oculto-back.onrender.com"
        : settings.FRONTEND_ORIGIN && settings.FRONTEND_ORIGIN.startsWith("http://localhost:")
          ? `http://localhost:${settings.PORT || 3000}`
          : settings.FRONTEND_ORIGIN
    ),
    secureCookie: settings.AUTH_COOKIE_SECURE === "true",
    sessionTtlSeconds: Number(settings.ADMIN_SESSION_TTL_SECONDS || 8 * 60 * 60),
  });

  const app = express();
  app.use(cors({
    origin: auth.frontendOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  }));
  app.use(express.json({ limit: "100kb" }));

  // Only the static admin UI is public; all data still passes through authenticated API routes.
  app.get(["/admin", "/admin/"], (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, "/admin/login.html");
  });
  app.use("/admin", express.static(path.join(__dirname, "admin"), { index: false }));

  app.set("view engine", "ejs");
  app.set("views", "./views");

  const authRoutes = express.Router();
  authRoutes.post("/login", auth.login);
  authRoutes.get("/session", auth.requireAdmin, auth.getSession);
  authRoutes.post("/logout", auth.requireAdmin, auth.requireCsrf, auth.logout);
  app.use("/auth", authRoutes);

  app.use(auth.requireAdminExceptResult);
  app.use(auth.requireCsrfForMutation);
  app.use("/", routes);

  return app;
}

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3000;
  sequelize.sync().then(() => {
    console.log("Conectado no DB com sucesso!");
  });
  app.listen(PORT, () => console.log(`Aplicação rodando na porta ${PORT}`));
}

module.exports = { createApp };
