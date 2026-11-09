# Desenvolvimento local e produção (Render)

Este projeto mantém o mesmo código nos dois ambientes, mas usa configurações e bancos distintos. O frontend e o backend são serviços Render separados, ligados ao Git para deploy automático após alterações na branch configurada. Os domínios abaixo foram informados pelo responsável; o hostname `frong` está preservado exatamente como fornecido.

| Ambiente | Frontend | Backend/API | Configuração |
| --- | --- | --- | --- |
| Local | `http://localhost:8080` | `http://localhost:3000` | `amigo-oculto-back/.env` |
| Produção | `https://amigo-oculto-frong.onrender.com` | `https://amigo-oculto-back.onrender.com` | Environment do serviço backend no Render |

O `.env` local é ignorado pelo Git. Não copie segredos do Render para ele nem versione credenciais. Use uma base de desenvolvimento separada: apontar a API local para o banco de produção pode alterar dados reais. MySQL 8.4.13 foi instalado via Homebrew e está configurado para ouvir apenas em `127.0.0.1`; a base `amigo_oculto_dev` e o usuário local restrito `amigo_oculto_local` já foram criados. A senha desse usuário fica somente no `.env` ignorado pelo Git.

## Variáveis necessárias

- Node.js 18.1+ e npm.
- Banco MySQL acessível configurado para Sequelize (`mysql2`).
- O próprio banco indicado em `DATABASE` deve existir antes da aplicação iniciar. `sequelize.sync()` pode criar tabelas, mas não cria o banco nem substitui migrações versionadas.
- O backend exige `ADMIN_PASSWORD` (mínimo 16 caracteres), `SESSION_SECRET` (mínimo 32 bytes), `FRONTEND_ORIGIN` (origem exata) e `AUTH_COOKIE_SECURE`. Para origens HTTPS, `AUTH_COOKIE_SECURE=true`; a aplicação falha no startup se essas configurações forem inválidas.

## Backend local

Para iniciar o serviço MySQL (ele foi configurado para iniciar no login):

```sh
brew services start mysql@8.4
```

Para pará-lo quando não estiver desenvolvendo: `brew services stop mysql@8.4`.

Na primeira configuração, crie `.env` apenas se ainda não existir. O arquivo preparado já aponta para a base local exclusiva:

```sh
cd amigo-oculto-back
test -f .env || cp .env.example .env
npm ci
npm run dev
```

O `.env` local preparado já tem `NODE_ENV=development`, `FRONTEND_ORIGIN=http://localhost:8080`, `AUTH_COOKIE_SECURE=false`, segredos locais aleatórios e a senha do usuário do banco. Não use valores de produção. `npm run dev` executa a API em modo de desenvolvimento. `npm run prod` executa `node app.js`, mas não é um comando de migração. `npm test` roda os testes de autenticação.

## Frontend local

Sirva `amigo-oculto-front/` por HTTP (em vez de abrir diretamente via `file://`):

```sh
python3 -m http.server 8080
```

Abra `http://localhost:8080`. `js/geral.js` aponta para `http://localhost:3000` em `localhost`/`127.0.0.1`. O CORS local deve permitir exatamente `http://localhost:8080`.

## Render (produção)

Configure os valores de produção no Environment do serviço backend no Render, não em arquivos do repositório. Mantenha os valores de banco (`DB_DIALECT`, `DB_HOST`, `DB_PORT`, `DATABASE`, `DB_USER`, `DB_PASSWORD`) e os segredos (`ADMIN_PASSWORD`, `SESSION_SECRET`) de produção que já estão configurados. Confirme também:

- `FRONTEND_ORIGIN=https://amigo-oculto-frong.onrender.com` (origem exata, sem barra ou caminho);
- `AUTH_COOKIE_SECURE=true`;
- `NODE_ENV=production` (marcador do ambiente; o backend obtém os demais valores das variáveis do Render).

O Render fornece `PORT` para o backend. O frontend publicado em `amigo-oculto-frong.onrender.com` chama a API em `amigo-oculto-back.onrender.com`; o backend permite a origem do frontend por `FRONTEND_ORIGIN` e o frontend envia cookies com credenciais. Como os domínios Render são sites diferentes para o navegador, o cookie de produção usa `SameSite=None; Secure`; as verificações de Origin exata e CSRF continuam obrigatórias. Depois de salvar as variáveis, faça um deploy e valide login, sessão e operações protegidas nos dois ambientes.

Alguns navegadores podem bloquear cookies de terceiros mesmo com essa configuração. Para compatibilidade mais ampla, use domínios próprios sob o mesmo domínio registrável para frontend e API, ou publique a API sob a mesma origem do frontend via proxy.

O responsável confirmou deploy automático após push para a branch configurada nos dois serviços Render. **Não faça commit/push ou altere o Environment sem aprovação explícita para publicar.** Nenhuma credencial de produção deve ser colocada em commit ou reutilizada no `.env` local.

## Backup/restauração local — verificado em 2026-11-08

Fonte local isolada `amigo_oculto_dev` (três tabelas, vazias): `mysqldump` com `--single-transaction --no-tablespaces --set-gtid-purged=OFF` gerou dump não vazio (3247 bytes). A restauração em **schema temporário local diferente** reproduziu as três tabelas; depois schema e dump temporários foram removidos. Um segundo teste inseriu **fixtures fictícias somente num schema temporário**, gerou dump desse schema (3490 bytes) e restaurou em outro: `pessoas` 2/2, `pares` 2/2, `restritos` 1/1, sem tocar na origem local. Schemas/dumps de teste foram removidos. O procedimento abaixo reproduz o teste básico do schema, sem usar segredos em parâmetros ou gravar dumps no repositório. Requer MySQL local, usuário com acesso de leitura à base de desenvolvimento e acesso de administração **apenas local** para criar o schema temporário:

```sh
BACKUP_DIR=$(mktemp -d)
chmod 700 "$BACKUP_DIR"
RESTORE_DATABASE="amigo_oculto_restore_$(openssl rand -hex 5)"
mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF \
  -h 127.0.0.1 -P 3306 -u amigo_oculto_local -p amigo_oculto_dev > "$BACKUP_DIR/backup.sql"
test -s "$BACKUP_DIR/backup.sql"
mysql -u root -e "CREATE DATABASE \`$RESTORE_DATABASE\`"
mysql -u root "$RESTORE_DATABASE" < "$BACKUP_DIR/backup.sql"
mysql -u root -e "SHOW TABLES FROM \`$RESTORE_DATABASE\`"
```

`-p` solicita a senha local interativamente. Após conferir conteúdo e contagens no banco **temporário**, remova somente o schema criado neste teste e o dump temporário; nunca execute `DROP DATABASE` contra uma base existente/compartilhada. O backup de **produção** não foi criado nem restaurado: antes de esquema/tokens em produção, obter autorização explícita, backup verificável e plano de rollback próprios do ambiente Render.

## Verificações atuais

- `npm test` executa `node --test`, com testes unitários e HTTP isolados de autenticação em `amigo-oculto-back/test/`; os 13 testes passaram em 2026-11-08. Os testes HTTP não conectam ao banco nem executam sorteios.
- Consulta somente leitura via `mysql2` confirmou conexão à base local, MySQL 8.4.13 e três tabelas vazias; a criação anterior das tabelas por `sequelize.sync()` consta da configuração local, mas **não foi repetida** nesta verificação.
- Não há lint/typecheck, migrações versionadas nem rollback automatizado configurados.
