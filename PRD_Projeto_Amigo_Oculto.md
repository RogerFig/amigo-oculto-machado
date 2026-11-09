# PRD — Evolução do Sistema Amigo Oculto

**Versão:** 1.0  
**Data:** 07/11/2026  
**Status:** Proposta para execução incremental  
**Base:** revisão estática fornecida pelo responsável pelo projeto. Os achados ainda devem ser confirmados no repositório e em testes.

## 1. Resumo executivo

Evoluir o sistema atual de amigo oculto, utilizado por uma família, sem reescrevê-lo e sem exigir contas ou senhas dos participantes. O organizador continuará cadastrando pessoas, configurando restrições, executando o sorteio e enviando individualmente os links dos resultados. As prioridades são: **proteger as operações administrativas e os resultados**, **garantir um sorteio válido e atômico** e **corrigir falhas de integridade e tratamento de erros**.

Este PRD combina requisitos de produto com um plano técnico de implementação por marcos. **Não autoriza mudanças em produção ou perda de dados sem aprovação explícita.**

## 2. Contexto e problema

O sistema já atende ao fluxo familiar, mas a análise estática apontou riscos nas rotas de API, tokens de resultado, montagem do DOM, sorteio, transações, validação e inicialização do banco. Alguns podem comprometer a confidencialidade dos resultados; outros podem gerar sorteios incorretos ou persistência parcial.

**Premissas a verificar no Marco 0:** stack e versões reais (Express/Sequelize/banco), ambiente de hospedagem e HTTPS, deploy separado ou conjunto de frontend/backend, estrutura de dados, endpoints existentes, regras atuais de restrição, número típico de participantes, forma de distribuição dos links e existência de dados de sorteios em andamento.

## 3. Objetivos e resultados esperados

1. Apenas o administrador autenticado pode ler dados administrativos e cadastrar, alterar, excluir, limpar restrições, reiniciar ou executar sorteios.
2. Cada participante consulta apenas o seu resultado por meio de um link individual não adivinhável, sem login.
3. Um sorteio concluído é sempre uma atribuição válida: ninguém tira a si mesmo, todos tiram exatamente uma pessoa, cada pessoa é tirada exatamente uma vez, e todas as restrições são respeitadas.
4. Uma falha não deixa resultados ou restrições parcialmente persistidos, nem devolve resposta de sucesso indevida.
5. O fluxo atual da família é preservado, com mensagens de erro compreensíveis e testes automatizados nos comportamentos críticos.

**Indicadores de aceite:** zero rotas administrativas acessíveis sem autenticação; zero tokens nas respostas públicas de listagem; 100% dos cenários automatizados críticos passando; falhas simuladas de persistência sem gravação parcial; sorteio impossível rejeitado sem alterar dados anteriores.

## 4. Público e fluxos

**Administrador (organizador):** acessa uma área autenticada; gerencia participantes e restrições; revisa o estado do evento; realiza ou refaz sorteio mediante confirmação explícita; copia/gera links individuais e envia aos familiares.

**Participante:** recebe um link individual diretamente do organizador; abre o link e vê somente o seu resultado. Não cria conta nem precisa de senha.

**Fluxo de estado mínimo:** `preparação → sorteado → finalizado` (o último estado pode ser apenas visual nesta versão). Edições que invalidam o resultado devem ser bloqueadas após o sorteio; reabertura/reset exige ação administrativa explícita. Não criar uma plataforma multi-eventos apenas para viabilizar essa regra.

## 5. Escopo

### Incluído nesta versão

- Proteção de rotas e dados administrativos; configuração adequada de CORS; gestão segura de configuração e credenciais.
- Token individual aleatório e único; substituição do hash previsível; acesso ao resultado limitado ao portador do token.
- Eliminação de interpolação insegura de dados de usuários no DOM.
- Sorteio com validação completa, verificação de viabilidade, persistência atômica, proteção contra execução concorrente e tratamento de impossibilidade.
- Correção das transações de restrições, validações da API, tratamento centralizado de erros e inicialização confiável do banco.
- Correção dos bugs de JavaScript relatados; testes automatizados e documentação operacional.

### Fora do escopo (backlog)

- Cadastro e login de todos os familiares; autenticação social.
- Suporte a múltiplas famílias, múltiplos eventos por conta, convite por e-mail/WhatsApp automático.
- Histórico complexo de sorteios, notificações, dashboard analítico e otimização prematura para milhares de participantes.
- Reescrita completa do frontend/backend, migração de framework ou mudança de infraestrutura sem necessidade demonstrada.

## 6. Requisitos funcionais e de qualidade

| ID | Requisito | Prioridade | Evidência de conclusão |
|---|---|---|---|
| RF-01 | Autenticar o administrador e autorizar cada operação administrativa no backend | P0 | Requisições sem credencial válida recebem `401` ou `403`; com credencial funcionam |
| RF-02 | Impedir exposição pública de participantes, restrições, pares e tokens | P0 | Inspeção das respostas de todas as rotas públicas |
| RF-03 | Gerar token individual imprevisível, com unicidade garantida | P0 | Token gerado com `crypto.randomBytes` (recomendação: 32 bytes); teste de unicidade e rota |
| RF-04 | Exibir apenas o próprio resultado a quem possui token válido | P0 | Token A não permite descobrir resultado B; token inválido retorna `404` sem dados sensíveis |
| RF-05 | Proteger renderização contra XSS armazenado | P0 | Dados não confiáveis apresentados como texto, sem execução de HTML/JS |
| RF-06 | Gerar atribuição completa, sem autoescolha e respeitando restrições | P0 | Testes com casos válidos, inviáveis e adversariais |
| RF-07 | Persistir sorteio em uma única transação e impedir duplicidade concorrente | P0 | Falha injetada faz rollback completo; duas solicitações simultâneas não geram sorteios diferentes |
| RF-08 | Salvar/limpar restrições de forma atômica e validar lista vazia | P0 | Sucesso apenas após commit; vazio limpa restrições do participante correto |
| RF-09 | Validar entradas e IDs no servidor | P1 | Erros de validação retornam `400`/`422`; operações ausentes retornam `404` |
| RF-10 | Tratar falhas assíncronas e inicializar banco antes de ouvir conexões | P1 | Sem rejeições não tratadas; falha de conexão impede início normal |
| RF-11 | Impedir mudanças incompatíveis com evento já sorteado | P1 | Alteração bloqueada até reset explícito e confirmado |
| RF-12 | Corrigir redirecionamento indevido e configuração de domínio do frontend | P1 | Interface só redireciona após `response.ok`; modo local funciona |
| RNF-01 | Preservar experiência simples para participantes | P0 | Abrir link individual não exige login |
| RNF-02 | Não registrar tokens/segredos em logs ou mensagens de erro | P0 | Inspeção dos logs em testes |
| RNF-03 | Disponibilizar testes reproduzíveis e instruções de configuração | P1 | Comando de testes documentado e executável |
| RNF-04 | Evitar regressões e perda de dados | P0 | Backup antes da migração; procedimento de rollback documentado |

**Matriz mínima de acesso a confirmar e implementar:**

| Recurso | Público sem token | Participante com token | Administrador |
|---|---|---|---|
| Consultar seu resultado (`GET /u/:token` ou equivalente) | Não | Sim, somente o resultado associado | Conforme necessidade administrativa |
| Listar pessoas/restrições/links | Não | Não | Sim |
| Criar, editar, excluir, resetar, sortear | Não | Não | Sim |
| Ver dados técnicos, hashes, tokens de outras pessoas | Não | Não | Apenas o mínimo necessário; nunca em respostas públicas |

**Decisão técnica a tomar no Marco 0:** como frontend e API estão hospedados (mesma origem/site ou origens distintas). Preferir sessão administrativa segura com cookie `HttpOnly`, `Secure` em produção, política `SameSite` compatível com o deploy e proteção contra CSRF nas operações mutáveis. Se a arquitetura exigir outro modelo, documentar a escolha e suas proteções. Segredo/senha administrativa deve ser configurado de forma segura no ambiente, não codificado no frontend. CORS deve usar origens permitidas, **mas não substituir autenticação**.

**Política de tokens desta versão:** usar valores aleatórios fortes, índice único no banco e exposição somente em operações autenticadas de gestão de links. Se optar por armazenar apenas hash de token, o painel deve permitir **reemitir** link em vez de recuperar o valor antigo. Documentar a decisão e não imprimir tokens em logs. Tokens legados derivados de nomes devem ser substituídos; a migração exigirá distribuição de novos links aos participantes afetados.

## 7. Plano de execução por marcos

Cada marco só é considerado concluído quando todas as verificações de aceite passaram. O agente deve entregar alteração de código, testes e um relatório curto por marco. **Não iniciar o marco seguinte sobre uma base com testes falhando sem explicar e corrigir a causa.**

### Marco 0 — Diagnóstico, linha de base e segurança de execução

**Objetivo:** confirmar os achados, entender o sistema real e permitir mudanças reversíveis.

**Tarefas:**
- Inspecionar `amigo-oculto-back/app.js`, `amigo-oculto-back/api/index.js`, `models/pessoa.js`, arquivos JS do frontend, rotas e configuração de deploy.
- Identificar endpoints e classificá-los como públicos, administrativos ou acesso por token; verificar versões de Express/Sequelize e regras de restrição atuais.
- Confirmar existência de sorteio ativo e impacto da rotação de links; inspecionar migrações/schema e configuração de ambiente.
- Registrar como executar frontend, backend e banco em desenvolvimento; adicionar `.env.example` sem segredos e comandos de teste.
- Criar backup verificável dos dados antes de qualquer alteração de esquema ou tokens; definir restauração e ambiente de homologação.
- Registrar a linha de base: testes existentes, bugs reproduzidos, limitações e decisões de arquitetura.

**Entregáveis:** `docs/diagnostico.md`, `docs/implantacao.md` (rascunho), inventário de endpoints, backup/rollback documentado.

**Critério de aceite:** cada achado da revisão está marcado como confirmado, refutado ou pendente com evidência; é possível executar o sistema e restaurar dados de teste; nenhuma alteração destrutiva foi feita em produção.

### Marco 1 — Isolamento e proteção da administração

**Objetivo:** fechar operações administrativas e dados não públicos.

**Tarefas:**
- Implantar autenticação simples de **um administrador**, com autorização verificada no backend para todo endpoint administrativo (inclusive leitura, reset, sorteio e gestão de links).
- Revisar `GET /` e demais listagens para impedir acesso anônimo a participantes, restrições, hashes, tokens e pares.
- Configurar CORS conforme origens reais e HTTPS em produção; configurar cookies/sessão e mitigação de CSRF conforme arquitetura aprovada.
- Validar credenciais/configuração no startup; não permitir segredos hardcoded ou expostos no bundle/frontend.
- Adicionar testes de `401`/`403`, acesso autorizado e prevenção de acesso entre áreas.

**Entregáveis:** middleware de autenticação/autorização, fluxo de login administrativo, proteção das rotas e testes.

**Critério de aceite:** nenhuma rota administrativa lê/altera dados sem autenticação; o link individual continua acessível sem login; CORS restritivo não é usado como único controle de acesso.

### Marco 2 — Privacidade dos links e XSS

**Objetivo:** preservar o segredo dos resultados e impedir execução de dados enviados pelos usuários.

**Tarefas:**
- Substituir hash MD5 truncado do nome por token aleatório criptograficamente seguro, único e desvinculado do nome/ID.
- Implementar migração/rotação dos tokens existentes, sem invalidar links ativos sem aviso e aprovação; permitir ao administrador copiar/emitir novos links.
- Garantir que a rota por token não devolva informações de outros participantes; tratar token inválido, ausente e resultado ainda não sorteado.
- Substituir `innerHTML`/`innerHTML +=` com dados de `nome_completo`, `nick` ou outros campos não confiáveis por `createElement`/`textContent`, nos arquivos `get-users.js`, `get-simple-list.js`, `restricoes.js` e demais pontos equivalentes.
- Acrescentar testes com nomes contendo caracteres especiais e payloads HTML/JS, sem execução de código.

**Entregáveis:** tokens seguros, migração controlada, telas sem XSS e testes.

**Critério de aceite:** nenhuma lista pública revela tokens; IDs/nomes não permitem inferi-los; os links antigos são tratados por plano de rotação aprovado; payload de XSS aparece somente como texto.

### Marco 3 — Integridade da API, restrições e inicialização

**Objetivo:** corrigir gravação parcial e respostas enganosas antes de mudar o sorteio.

**Tarefas:**
- Corrigir `Restricao.destroy` para passar `transaction` no objeto de opções junto com `where`, ou preferir transação gerenciada; garantir rollback e status de erro correto.
- Definir contrato explícito para substituir/limpar restrições: identificar `id_retira` separadamente e aceitar lista vazia para apagar restrições da pessoa correta.
- Validar estrutura, IDs, campos obrigatórios, duplicações, referências inexistentes e transições de estado em toda operação de escrita; não confiar em `escolheu`/`escolhido` recebidos do navegador.
- Remover cálculo manual de `MAX(id) + 1`; usar `autoIncrement` do banco e conferir unicidade.
- Centralizar tratamento de exceções async adequado à versão do Express; validar `null` em consultas, inclusive `GET /u/:token`.
- Aguardar conexão/validação do banco antes de iniciar o servidor; retornar códigos HTTP consistentes.

**Entregáveis:** contrato de API documentado, validações, transações corrigidas e testes de integração.

**Critério de aceite:** lista vazia limpa corretamente; erros não retornam `201`/sucesso; falhas no banco provocam rollback; registros inexistentes não derrubam a aplicação; inicialização falha de forma controlada.

### Marco 4 — Sorteio correto, atômico e previsível operacionalmente

**Objetivo:** nunca persistir um sorteio incompleto ou inválido.

**Tarefas:**
- Carregar participantes e restrições em lote; validar ao menos 2 participantes e consistência das relações.
- Construir uma atribuição completa em memória usando matching/backtracking com busca de alternativas; proibir autoescolha, duplicatas e violações de restrição.
- Randomizar a ordem de exploração de candidatos com Fisher–Yates (não usar `sort(() => Math.random() - 0.5)`); **não alegar uniformidade entre todas as soluções válidas** sem demonstração.
- Caso não haja solução, responder erro de domínio compreensível sem modificar registros existentes.
- Persistir todos os pares e a mudança de estado em uma transação; prevenir duas execuções simultâneas (bloqueio/controle de concorrência compatível com o banco).
- Bloquear edição de participantes/restrições após sorteio, exceto por reset administrativo com confirmação e sem apagar resultados silenciosamente.
- Cobrir casos: 1 participante, 2 participantes, restrições simples/cruzadas, solução única, muitas restrições, impossibilidade, falha de commit/rollback e requisições simultâneas.

**Entregáveis:** algoritmo isolado e testável, persistência transacional, testes unitários e integração.

**Critério de aceite:** todo sorteio salvo é válido; impossibilidade e falha de gravação não alteram o estado anterior; requisições concorrentes não criam resultados conflitantes.

### Marco 5 — Ajustes da interface, testes completos e homologação

**Objetivo:** finalizar a experiência sem regressões e preparar uma publicação controlada.

**Tarefas:**
- Corrigir atribuição em condicional de `util.js` (`=` no lugar de comparação) e basear navegação em `response.ok`/status adequado.
- Corrigir reatribuição de `const domain` em `geral.js`; centralizar a escolha da URL da API por ambiente.
- Melhorar feedback de carregamento, erro, restrição inviável, resultado ainda indisponível e confirmação de reset/refazer sorteio.
- Rodar testes automatizados e revisão manual do fluxo real em celular e desktop: cadastrar → restringir → sortear → distribuir link → visualizar resultado.
- Revisar configuração de produção, HTTPS, cabeçalhos, logs sem segredos, backup, procedimento de publicação e rollback.
- Preparar a comunicação e reenvio de links caso haja rotação de tokens; obter aprovação explícita antes de migrar produção.

**Entregáveis:** interface revisada, suíte de testes verde, checklist de homologação e `docs/implantacao.md` final.

**Critério de aceite:** fluxo ponta a ponta funciona em homologação; nenhuma requisição com falha redireciona como sucesso; administrador consegue distribuir links; publicação tem procedimento de backup, migração e rollback aprovado.

## 8. Matriz mínima de testes (obrigatória)

| ID | Cenário | Resultado esperado |
|---|---|---|
| T01 | Acessar/cadastrar/editar/apagar sem login admin | `401`/`403`, sem alteração |
| T02 | Usar link/token inválido | `404` sem revelar pessoas/pares |
| T03 | Consultar link individual válido | Apenas resultado vinculado ao token |
| T04 | Abrir listagem ou API pública | Nenhuma informação administrativa/token exposto |
| T05 | Nome contém `<script>` ou HTML | Conteúdo exibido como texto, sem executar |
| T06 | Sorteio comum sem restrições | Atribuição completa, única e sem autoescolha |
| T07 | Sorteio com restrições viáveis | Todas respeitadas |
| T08 | Restrições tornam sorteio impossível | Erro claro; nenhum dado alterado |
| T09 | Falha forçada durante gravação | Rollback integral |
| T10 | Dois sorteios concorrentes | Sem sobrescrita ou resultados conflitantes |
| T11 | Salvar lista vazia de restrições | Remove apenas as restrições do participante informado |
| T12 | Restrição inválida ou pessoa inexistente | `400`/`422`/`404` apropriado; sem sucesso falso |
| T13 | Banco indisponível na inicialização | Servidor não atende normalmente |
| T14 | API retorna erro para o frontend | Mensagem de erro sem redirecionamento de sucesso |
| T15 | Tentativa de editar após sorteio | Bloqueada, até ação administrativa explícita |
| T16 | Migração/rotação de token | Link antigo segue política aprovada; novo funciona |

Usar banco de teste isolado; não executar cenários destrutivos em produção. Para sorteios, separar lógica pura de cálculo da camada de persistência para facilitar testes.

## 9. Ordem, dependências e definição de pronto

**Sequência obrigatória:** `M0 → M1 → M2 → M3 → M4 → M5`. Se houver ajuste pontual de ordem para desbloquear a implementação, o agente deve registrar o motivo e preservar os critérios de aceite.

**Definição de pronto de cada marco:**
- Código entregue sem reescrita desnecessária; alterações pequenas e revisáveis.
- Testes novos/alterados executados; resultados e limitações registrados.
- Contratos/endpoints e eventuais migrações documentados.
- Critérios de aceite verificados e evidências anexadas ao relatório.
- Riscos residuais e impacto para links/dados atuais informados.
- Nenhum segredo ou dado familiar real incluído no repositório, logs ou fixtures.

**Política de aprovação:** o agente pode implementar e testar localmente/homologação. Deve **solicitar autorização antes de**: resetar sorteio real; apagar/alterar dados de produção; invalidar links já distribuídos; executar migração destrutiva; realizar deploy público; alterar a experiência de acesso dos familiares.

## 10. Instruções de execução para o agente

> Você é o agente responsável por implementar este PRD no repositório existente. Execute **um marco por vez**, começando pelo Marco 0. Antes de editar, inspecione o código e confirme os achados da revisão estática; não presuma que nomes de arquivos, linhas ou versões continuam iguais. Preserve a stack e o fluxo familiar, prefira a menor mudança segura e não implemente itens fora de escopo sem justificar. Para cada marco: (1) descreva alterações propostas e arquivos afetados; (2) implemente; (3) crie/atualize testes; (4) execute os testes; (5) reporte arquivos alterados, decisões, evidências de aceite, riscos e próximos passos. Não modifique produção, não invalide links distribuídos e não faça operações destrutivas sem autorização. Se um bloqueio depender de credenciais, infraestrutura ou decisão do responsável, documente-o e avance apenas no que puder ser validado sem risco.

**Formato do relatório por marco:**

```md
## Relatório — Marco X
- Status: concluído | parcial | bloqueado
- Achados confirmados/refutados:
- Arquivos alterados:
- Decisões técnicas e justificativas:
- Testes executados e resultado:
- Critérios de aceite atendidos / não atendidos:
- Migrações ou impacto nos links/dados:
- Riscos pendentes:
- Próxima ação recomendada:
```

## 11. Riscos e decisões em aberto

1. **Links ativos:** se já há resultados distribuídos, a rotação de tokens pode interromper o acesso; preparar novo envio e janela de implantação.
2. **Hospedagem:** domínio/cookies/CORS/CSRF dependem da topologia real; decidir após mapear infraestrutura.
3. **Banco:** estratégia de transação, locking e migração deve respeitar o dialeto utilizado.
4. **Autenticação:** decidir forma simples, mas segura, de acesso administrativo antes de codificar a UI.
5. **Restrições:** confirmar semântica atual (direcionais ou recíprocas, permissões e regras de casal/família), para não mudar regras silenciosamente.
6. **Estado de sorteio:** verificar se há modelo de evento ou apenas uma edição global; implementar proteção mínima compatível, sem criar gestão multi-eventos nesta entrega.

## 12. Backlog posterior (não bloqueia a entrega)

- Suporte a múltiplas edições e famílias.
- Reenvio automatizado de links por canais escolhidos pelo organizador.
- Melhorias visuais de acessibilidade e usabilidade.
- Otimizações de consultas/renderização, somente se medições mostrarem necessidade.
- Avaliação de critérios de aleatoriedade e distribuição uniforme entre soluções válidas, se isso se tornar requisito explícito.

---

**Marco de sucesso final:** o administrador executa o sorteio familiar com segurança, distribui links individuais, cada participante vê somente seu resultado, e o sistema nunca informa sucesso para operações falhas nem grava sorteios inválidos ou parciais.
