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

O `.env` local preparado já tem `NODE_ENV=development`, `FRONTEND_ORIGIN=http://localhost:8080`, `AUTH_COOKIE_SECURE=false`, segredos locais aleatórios e a senha do usuário do banco. Não use valores de produção. `npm run dev` executa a API em modo de desenvolvimento. `npm run prod` executa `node app.js`, mas não é um comando de migração. A API só escuta conexões depois de `sequelize.authenticate()` e `sequelize.sync()` concluírem; se o banco estiver indisponível, falha sem atender requisições. `npm test` roda os testes automatizados.

## Frontend local

Sirva `amigo-oculto-front/` por HTTP (em vez de abrir diretamente via `file://`):

```sh
python3 -m http.server 8080
```

Abra `http://localhost:8080`. `js/geral.js` aponta para `http://localhost:3000` em `localhost`/`127.0.0.1`. O CORS local deve permitir exatamente `http://localhost:8080`.

## Área administrativa sem cookies de terceiros

Para evitar que o navegador descarte a sessão entre os dois serviços Render, a API serve uma cópia dos arquivos estáticos do painel em `/admin/`. Em produção, `https://amigo-oculto-frong.onrender.com/` e `/login.html` redirecionam para `https://amigo-oculto-back.onrender.com/admin/login.html`; as demais páginas administrativas apontam para suas equivalentes no backend. Mesmo ao acessar `/admin` ou `/admin/` diretamente, o backend redireciona para `/admin/login.html`. O login, os arquivos do painel e as chamadas da API ficam, assim, na **mesma origem do backend**; os links individuais `/u/:hash` continuam inalterados. As páginas estáticas não contêm dados do banco, que permanecem protegidos nas rotas da API.

Como os serviços podem ter diretórios-raiz distintos no Render, o painel é empacotado em `amigo-oculto-back/admin/`. **Após qualquer mudança em `amigo-oculto-front/`, execute `npm run sync:admin` dentro de `amigo-oculto-back/`** e inclua os arquivos copiados no mesmo commit. `npm test` verifica se o pacote está sincronizado. A cópia não exige acesso à pasta irmã quando o backend inicia no Render.

Localmente, a interface original em `http://localhost:8080/login.html` continua funcionando. A cópia também pode ser aberta diretamente em `http://localhost:3000/admin/login.html` com o mesmo `.env` local. `ADMIN_ORIGIN` é opcional e permite configurar uma origem própria da API; por padrão, o backend reconhece as origens conhecidas de desenvolvimento/Render. Não inclua senha no frontend.

## Render (produção)

Configure os valores de produção no Environment do serviço backend no Render, não em arquivos do repositório. Mantenha os valores de banco (`DB_DIALECT`, `DB_HOST`, `DB_PORT`, `DATABASE`, `DB_USER`, `DB_PASSWORD`) e os segredos (`ADMIN_PASSWORD`, `SESSION_SECRET`) de produção que já estão configurados. Confirme também:

- `FRONTEND_ORIGIN=https://amigo-oculto-frong.onrender.com` (origem exata, sem barra ou caminho);
- `AUTH_COOKIE_SECURE=true`;
- `NODE_ENV=production` (marcador do ambiente; o backend obtém os demais valores das variáveis do Render).

O Render fornece `PORT` para o backend. O frontend publicado em `amigo-oculto-frong.onrender.com` chama a API em `amigo-oculto-back.onrender.com`; o backend permite a origem do frontend por `FRONTEND_ORIGIN` e o frontend envia cookies com credenciais. Como os domínios Render são sites diferentes para o navegador, o cookie de produção usa `SameSite=None; Secure`; as verificações de Origin exata e CSRF continuam obrigatórias. Depois de salvar as variáveis, faça um deploy e valide login, sessão e operações protegidas nos dois ambientes.

Cookies de terceiros podem ser bloqueados na interface antiga do serviço frontend; o redirecionamento para `/admin/login.html` no backend evita essa dependência. Domínios próprios compartilhados ou proxy continuam alternativas futuras.

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

`-p` solicita a senha local interativamente. Após conferir conteúdo e contagens no banco **temporário**, remova somente o schema criado neste teste e o dump temporário; nunca execute `DROP DATABASE` contra uma base existente/compartilhada. O backup de **produção** para publicar os Marcos 2 e 3 foi criado e restaurado apenas em schema local temporário, como registrado em `docs/relatorio-marco-3.md`. Não restaurar sobre o JawsDB ativo sem autorização específica, coordenação das escritas e plano de recuperação; manter o dump em local protegido fora do repositório.

## Verificações atuais

- `npm test` executa `node --test`, com testes unitários e HTTP isolados de autenticação em `amigo-oculto-back/test/`, incluindo o pacote estático de `/admin/`. Os testes HTTP não conectam ao banco nem executam sorteios.
- Consulta somente leitura via `mysql2` confirmou conexão à base local, MySQL 8.4.13 e três tabelas vazias; a criação anterior das tabelas por `sequelize.sync()` consta da configuração local, mas **não foi repetida** nesta verificação.
- Não há lint/typecheck, migrações versionadas nem rollback automatizado configurados.

## Publicação e rollback controlados (Marco 5)

**Não publicar por rotina:** push para `main` aciona deploy automático nos dois serviços. Obter autorização explícita antes de publicar; para rotação de tokens, alteração de esquema/dados ou reset de sorteio real, obter também aprovação específica do plano de migração e do impacto aos links. O Marco 5 não exige migração nem reset e não substitui essa aprovação.

1. Antes do deploy, verificar `git diff --check`, executar `npm run sync:admin` e `npm test` no backend; conferir configuração exata de `FRONTEND_ORIGIN`, cookies HTTPS, segredos somente no Render, conexão a banco **de produção somente no serviço publicado**, e ausência de tokens/segredos em logs. Confirmar status e backup **recente**, criptografado/restrito fora do repositório, checksum e restauração ensaiada em schema isolado; o backup de 2026-11-09 descrito em `docs/relatorio-marco-3.md` é histórico, não um snapshot atual.
2. Coordenar janela de publicação com o responsável, registrar commit, horário, versão da API e estado dos links; publicar apenas após aprovação. Verificar login e sessão admin, acesso não autenticado (`401`), páginas estáticas, criação/cópia de links **somente em homologação isolada**, e resposta do link individual de teste. Não sortear nem resetar o evento real para testar deploy.
3. Se a interface/API falhar, suspender distribuição e novas gravações; identificar último commit estável e coordenar reversão de código via novo commit/redeploy aprovado, verificando também ambos os serviços Render. **Rollback de código não reverte dados**. Se houve alteração de dados, congelar escritas e combinar restauração do backup recente com o responsável; nunca restaurar por cima do JawsDB ativo sem autorização e sem validar a perda de alterações posteriores ao snapshot.
4. Se no futuro houver rotação de hashes/índice único, preparar antes inventário dos links distribuídos, comunicação e reenvio, backup verificável, ensaio em cópia isolada e rollback de dados compatível. Não aplicar esquema via `sequelize.sync()` como migração improvisada nem invalidar links antigos sem autorização específica.
