# Marco 5 — interface, testes e homologação

**Estado:** publicação do Marco 5 em `main` autorizada pelo responsável para testar a interface no celular. Critério de aceite completo **pendente** de homologação manual; o deploy não aprova reset, rotação de links nem migração. Nenhuma operação de escrita/reset/sorteio foi executada em produção nesta etapa.

## Mudanças e evidências

- `amigo-oculto-front/index.html`, `listagem.html`, `restricoes.html` e scripts `js/get-users.js`, `js/get-simple-list.js`, `js/restricoes.js`: estados de carregamento, lista vazia e falha de conexão/HTTP; limpeza da tabela após erro para não exibir links ou restrições desatualizados. Removida a linha fictícia de restrições. A página de links esclarece o estado anterior ao sorteio. Cópia em `amigo-oculto-back/admin/` sincronizada via `npm run sync:admin`.
- Correções de navegação por `response.ok` em `util.js` e seleção da origem da API em `geral.js` já estavam no código publicado; não foram repetidas. Falha no sorteio mostra mensagem sem navegar para os links; reset só recarrega em sucesso e exige frase de confirmação.
- `amigo-oculto-back/test/marco-5.test.js`: simula falha de conexão, erro HTTP (inclusive na segunda consulta de restrições) e lista vazia na interface, sem dados familiares reais. `npm test`: **41/41 passaram**. Testes automatizados usam mocks e **não** provam renderização ou compatibilidade de navegador.
- Homologação HTTP adicional (local, 2026-11-10): frontend `http://localhost:8080/` respondeu `200`, API local `localhost:3000` respondeu `401` à sessão anônima. Em **schema MySQL temporário** com API isolada em porta efêmera, login, cadastro de três pessoas fictícias, edição, restrições, sorteio impossível (`422`, zero pares), sorteio viável, link individual válido (`200`) e inválido (`404`), bloqueio de edição após sorteio (`409`), reset sem confirmação (`400`), reset confirmado (`200`) e exclusão passaram. Schema temporário removido; a API normal `localhost:3000` e o banco habitual não foram usados para escritas. Esse ensaio exercita HTTP e templates, **não** cliques ou layout em navegador.
- Implantação: `docs/implantacao.md` descreve verificação de configuração, HTTPS, logs, backup recente, publicação autorizada, reversão do código e limite do rollback dos dados. O backup histórico não é um snapshot válido para uma futura publicação sem nova verificação.

## Checklist de homologação (base isolada, participantes fictícios)

Marcar somente depois de executar em **desktop e celular** (anotar navegador/versão, data e resultado):

- [ ] Confirmar que a API de homologação aponta para banco isolado; login admin, sessão, logout e bloqueio de acesso anônimo. Conferir HTTPS/cookies e ausência de tokens em logs/rotas públicas.
- [ ] Cadastrar participantes fictícios; validar lista vazia, inclusão, edição e exclusão, feedback de falha de rede/HTTP sem indicação de sucesso, e nomes contendo HTML exibidos apenas como texto.
- [ ] Configurar restrições possíveis e impossíveis; checar gravação/remoção e mensagem de erro no sorteio impossível **sem alterar resultados**.
- [ ] Sortear caso viável, conferir unicidade e restrições; acessar listagem administrativa, copiar **link de teste**, abrir `/u/:hash` válido e inválido em navegador anônimo, verificar resultado individual e ausência de dados de outras pessoas.
- [ ] Verificar bloqueio de edição/cadastro/restrições após sorteio; testar confirmação e cancelamento do reset **somente na base isolada**, refazer sorteio e verificar que links de teste permanecem estáveis.
- [ ] Conferir layout, foco, dropdowns, mensagens de erro e cópia de links em celular e desktop; repetir cenário de API indisponível em cada página. Registrar capturas sem hashes/nomes reais.
- [ ] Revisar plano de backup atual, janela de deploy e reversão com o responsável; se houver rotação futura, aprovar separadamente a comunicação/reenvio dos links e a migração.

**Matriz PRD T01–T16:** testes anteriores cobrem autenticação (T01), links/visibilidade (T02–T05), sorteio e restrições (T06–T12), startup (T13) e bloqueio após sorteio (T15); testes de interface simulados cobrem feedback de leitura em T14, mas o fluxo real de T14 ainda exige navegador. T16 (rotação de tokens) permanece fora deste marco até plano e autorização específicos. Não declarar o fluxo ponta a ponta aceito sem executar o checklist em homologação isolada.

**Riscos restantes:** homologação manual não executada; resultado de copiar links depende das permissões do navegador. Produção já contém participantes e sorteio: nela, validar somente a interface e os links existentes, **sem** refazer sorteio, resetar ou cadastrar participantes para o teste. Fluxos destrutivos completos devem continuar em banco isolado. Rotação de links requer aprovação própria.
