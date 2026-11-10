# Rotação dos links legados — executada em 2026-11-10

O responsável autorizou substituir **todos os links antigos**, informou que nenhum foi enviado a participantes e exigiu preservar os demais campos. A rotação foi executada em produção **somente em `pessoas.hash`**, sem excluir pessoas, resetar ou sortear. O backup atual está fora do repositório, protegido no Mac; não registrar tokens nem credenciais aqui.

## Pré-condições operacionais

1. Combinar janela sem gravações administrativas e confirmar que nenhum link foi distribuído **até o instante da execução**. Verificar contagem atual de participantes e estado do sorteio, sem copiar nomes ou hashes para logs.
2. Criar **backup atual** do JawsDB via TLS com verificação de certificado, fora do repositório e com acesso restrito. Calcular SHA-256 e ensaiar restauração em schema local isolado, conferindo contagens das três tabelas. O backup de 2026-11-09 não é suficiente para esta operação após o reset e novo sorteio.
3. Como o plano Render não dá acesso a Shell, usar **conexão externa via TLS** a partir do Mac, como no backup anterior. Salvar temporariamente a string do JawsDB em arquivo fora do repositório com modo `600`; informar ao operador **somente o caminho** do arquivo. `DB_URL_FILE` aponta para esse arquivo e `DB_CA_FILE` para uma cópia privada (`600`) do certificado CA oficial. Não colocar a string no `.env` local, Git, histórico do terminal ou conversa. Conferir host, banco e quantidade esperada antes de executar.
4. Testar a versão do script com dump recente em schema isolado; o ensaio com fixtures legadas já passou. Não usar `sequelize.sync({ alter: true })` ou `force: true`.

## Execução e garantia de integridade

`amigo-oculto-back/scripts/rotate-links.js` é um comando único, **não executado no startup ou deploy**. Lê `DB_URL_FILE` e `DB_CA_FILE` privados, conecta por TLS verificando o certificado e exige `NODE_ENV=production`, `CONFIRM_ROTATE_LINKS=ROTACIONAR TODOS OS LINKS`, `CONFIRM_HOST`/`CONFIRM_DATABASE` iguais aos valores da URL, `EXPECTED_PARTICIPANTS`, `BACKUP_FILE` restrito (`600`) criado nas últimas 24 horas e `BACKUP_SHA256` conferido contra o arquivo. **O script verifica o checksum, mas não cria nem testa a restauração do backup:** realizar essas etapas separadamente antes de rodar `node scripts/rotate-links.js`. Não registrar tokens nem dados pessoais em stdout.

O script rejeita contagem inesperada, tokens ausentes/duplicados e índice incompatível **antes** de alterar dados. Cria índice único em `pessoas.hash` se necessário **antes** da rotação; esse DDL pode persistir mesmo se a transação posterior falhar, mas não invalida links. Bloqueia participantes na transação, confere que nada mudou desde a inspeção e atualiza apenas `hash` com 32 bytes aleatórios para cada pessoa; falha de escrita reverte todos os tokens. O modelo impede `hash` vazio para novos cadastros e define unicidade para novas instalações. **Impedir escritas concorrentes durante a janela**: o bloqueio só começa depois da criação do índice e a confirmação prévia.

## Verificação e retorno

- Após sucesso, conferir a contagem de pessoas, pares e restrições contra o estado anterior; cada token deve ter 64 caracteres hexadecimais, ser diferente dos anteriores e único. Conferir que um link antigo de teste devolve `404`, um novo abre o resultado esperado e o administrador consegue copiar links novos. Não incluir tokens reais na documentação.
- Se a rotação falhar durante a transação, os hashes anteriores permanecem válidos; o índice único pode continuar instalado. Se já houve commit e for preciso retornar, **não fazer rollback de código como substituto da restauração de dados**: interromper acessos/escritas, avaliar links eventualmente enviados e restaurar apenas hashes por ID a partir do backup atual em uma transação planejada, com validação de contagem e unicidade. Não restaurar o dump inteiro sobre produção sem avaliar mudanças posteriores e obter aprovação específica.
- A publicação do script/código e o acesso de execução no Render precisam de coordenação separada; não acoplar rotação automática ao deploy.

## Resultado e evidências

- Backup novo do JawsDB criado por `mysqldump --single-transaction` via TLS `VERIFY_IDENTITY`, em pasta `700` e arquivo `600` fora do Git; SHA-256 `75d7dcf0b598f99a76ecb0e329ecaf96dd9c839f97958c4707b7357d9faf15e5`. Restaurado em schema local temporário: 16 pessoas, 0 pares e 30 restrições, iguais à leitura de produção; schema de restauração removido.
- Ensaio com **esse backup atual** em outro schema local: 16 tokens aleatórios novos, índice único criado; IDs, nomes, flags, datas, pares e restrições inalterados. Schema removido. `npm test`: **46/46** passaram (inclusive rollback simulado e recusa de arquivo de credenciais inseguro).
- O responsável confirmou que o estado atual esperado era **16 pessoas, 0 pares, 30 restrições** antes da execução. A rotação de produção concluiu para as 16 pessoas. Leitura posterior verificou todos os tokens diferentes, únicos e com 64 caracteres hexadecimais, índice único presente, demais campos/pares/restrições idênticos ao estado pré-operação. Um link público anterior retornou `404` e seu substituto `200`; verificação sem publicar valores.
- A credencial originalmente fornecida em arquivo RTF foi exposta em um erro de parsing **antes de qualquer acesso ao banco**. O operador foi alertado, trocou a senha e atualizou o arquivo privado em texto puro; o script agora recusa formato inválido sem revelar seu conteúdo. A conexão posterior por TLS e o backup usaram a credencial atualizada. **Não reutilizar a senha anterior.**
- O arquivo de backup atual deve permanecer protegido fora do Git; não restaurar em produção automaticamente. O script não é executado no deploy. Nenhum commit/push dos arquivos locais desta operação foi feito até aprovação específica de publicação.
