# Diagnóstico — Marco 0

**Atualizado:** 2026-11-08. **Status:** concluído para a linha de base local; publicação e banco de produção não verificados.

## Sistema e execução

- Aplicações independentes: backend Node/Express/Sequelize (`amigo-oculto-back/app.js`, `api/index.js`, `models/`) e frontend HTML/JS estático (`amigo-oculto-front/`). Sem migrações ou CI. O backend executa `sequelize.sync()` ao iniciar, sem esperar sua conclusão antes de escutar.
- Lockfile: Express 4.18.2, Sequelize 6.35.1, mysql2 3.6.5. Em 2026-11-08, Node 22.23.4, npm 10.9.9 e MySQL **local** 8.4.13. Backend: `npm ci`, `npm run dev` (ou `npm run prod`), `npm test` dentro de `amigo-oculto-back/`; frontend: `python3 -m http.server 8080` dentro de `amigo-oculto-front/`. Detalhes e salvaguardas em `docs/implantacao.md`.
- O responsável confirmou dois serviços Render, frontend `https://amigo-oculto-frong.onrender.com` e API `https://amigo-oculto-back.onrender.com`: **origens distintas**. Há deploy automático após push para a branch configurada; não houve push/deploy nesta sessão. O frontend mapeia esses hosts em `js/geral.js`. Não foi verificada configuração do painel Render ou comportamento real de cookies no navegador.
- O responsável confirmou que **nenhum link individual foi distribuído ou precisa ser preservado**. Isso não foi checado no banco de produção; não rotacionar links sem aprovação na etapa combinada.

## Inventário de endpoints (classificação do Marco 1)

| Endpoint | Função | Acesso esperado |
| --- | --- | --- |
| `GET /` (opcional `?id=`) | Lista dados de participantes, inclusive hashes legados | Administrador |
| `POST /`, `PUT /:id`, `DELETE /:id` | Cadastro/edição/exclusão | Administrador + CSRF |
| `PUT /` | Reset de participantes/pares | Administrador + CSRF |
| `GET /restricao`, `POST /restricao` | Consulta/atualização de restrições | Administrador (escrita com CSRF) |
| `GET /sorteia` | Executa e persiste sorteio (legado: GET com efeito colateral) | Administrador + CSRF |
| `GET /u/:hash` | Página de resultado individual | Público com hash do link |
| `POST /auth/login` | Login administrador | Público, exige Origin exata |
| `GET /auth/session`, `POST /auth/logout` | Sessão administrativa | Administrador (logout com CSRF) |

## Achados da revisão estática (evidência)

- **Confirmado, mitigado parcialmente no Marco 1:** `app.js` e `api/index.js` não exigiam autenticação e `cors()` era aberto; agora há middleware de sessão, CSRF e CORS por origem. Validação de integração em navegador/Render ainda pendente.
- **Confirmado, pendente de próximo marco:** `api/index.js` gera MD5 truncado do nome e `GET /` inclui o hash; `get-users.js`, `get-simple-list.js` e `restricoes.js` interpolam dados não confiáveis em `innerHTML` (XSS).
- **Confirmado, pendente:** `GET /sorteia` em `api/index.js` pode selecionar a própria pessoa, usa escolha gulosa/comparador aleatório e grava sem transação/controle de concorrência. Algoritmo não garante solução válida nem rollback.
- **Confirmado, pendente:** `POST /restricao` passa `transaction` em argumento incorreto no `destroy`, falha com array vazio e retorna sucesso mesmo no `catch`; `POST /` usa `MAX(id)+1` apesar de `autoIncrement` no modelo; rotas async não tratam uniformemente falhas nem resultados ausentes.
- **Confirmado, mitigado em parte no Marco 1:** `util.js` atribuía `200` em condição (redirecionamento incorreto) e `geral.js` tentava reatribuir `const`; ajustes antecipados por segurança de execução local. O restante da experiência de erro ainda requer homologação.
- **Pendente por falta de acesso autorizado à produção:** versão/schema/dados do MySQL de produção, variáveis do painel Render, backup/restore de produção e compatibilidade real do cookie cross-site. A inexistência de links ativos foi confirmada pelo responsável, não por inspeção de dados.

## Linha de base verificada sem produção

- `npm test`: **8/8 passaram** (autenticação; ainda não há testes automatizados do sorteio, transações e interface). Dependências locais já presentes; não houve instalação nem alteração de código para esta validação.
- `.env` local ignorado pelo Git: conferidos dialeto, host, nome do banco e variáveis administrativas sem imprimir segredos. Consulta somente leitura com usuário restrito confirmou `amigo_oculto_dev` e as tabelas `pessoas`, `pares`, `restritos`, **0 registros em cada**.
- Dump com `mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF`: 3247 bytes. Restauração em **schema temporário local isolado** confirmou as três tabelas vazias. Também foi criado um segundo schema temporário com fixtures fictícias, feito dump (3490 bytes) e restaurado em um terceiro schema temporário: contagens conferidas (`pessoas` 2, `pares` 2, `restritos` 1). Schemas temporários e dumps foram removidos. Nenhum dado da base de desenvolvimento de origem foi alterado. Procedimento base em `docs/implantacao.md`.
- **Nenhuma conexão, migração, backup, reset, sorteio, alteração, commit ou deploy em produção.** O dump local não substitui backup/rollback de produção antes de futuras mudanças.

## Riscos operacionais a tratar antes de publicar o Marco 1

- Render usa origens/sites separados; cookie administrativo precisa de `SameSite=None; Secure`, `FRONTEND_ORIGIN` exata e CORS com credenciais. Mesmo assim bloqueadores de cookies de terceiros podem impedir login: testar em navegadores reais e considerar domínio próprio compartilhado/proxy se necessário.
- Validar o Environment do backend, credenciais administrativas e procedimento de backup/restauração **de produção**, sem gravar segredos no Git. Push na branch configurada dispara publicação automática; somente realizar com autorização explícita.
- Tokens legados permanecem previsíveis até a rotação aprovada; endpoints de sorteio/restrições permanecem sujeitos a falhas de integridade até marcos seguintes. Ver `docs/relatorio-marco-1.md` para o estado do código já implementado.
