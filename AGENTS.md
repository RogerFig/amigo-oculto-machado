# AGENTS.md

- This repo has two independent apps and no root scripts/workspace: `amigo-oculto-back/` is the Node API; `amigo-oculto-front/` is static HTML/CSS/JS with no build tooling.
- Backend commands run from `amigo-oculto-back/`: `npm ci`, `npm run dev` (nodemon), `npm run prod` (node), and `npm test` (`node --test`, Node 18.1+). No lint/typecheck/migration tooling is configured.
- Backend entrypoint is `app.js`; routes are in `api/index.js`, Sequelize models in `models/`, config in `config/`. `GET /u/:hash` renders `views/resultado.ejs`.
- Backend local config lives in ignored `amigo-oculto-back/.env` (copy `.env.example` if missing); never put production values there. Render production config is supplied through that service's environment variables. Keep local and production databases separate. It runs `sequelize.sync()` at startup; there is no migration workflow.
- Local development uses Homebrew MySQL 8.4 on `127.0.0.1:3306`, database `amigo_oculto_dev`, and restricted user `amigo_oculto_local`; MySQL service is `brew services start/stop mysql@8.4`.
- All API routes except `POST /auth/login` and `GET /u/:hash` require an admin session; writes (and legacy `GET /sorteia`) also require exact Origin + CSRF. Local admin cookies are `HttpOnly`/`SameSite=Lax`; secure cross-site Render cookies use `SameSite=None; Secure` and still require exact Origin + CSRF.
- `amigo-oculto-front/js/geral.js` uses port 3000 on localhost and maps `amigo-oculto-frong.onrender.com` to the Render API `amigo-oculto-back.onrender.com`; Render's exact frontend origin must be configured in the backend environment.
