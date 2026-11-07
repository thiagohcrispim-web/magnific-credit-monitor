# Status do projeto — Magnific Credit Monitor

_Atualizado em 2026-11-07._

## Objetivo

App web para monitorar o consumo de créditos do Magnific por ciclo de renovação (não por
mês do calendário), mostrando onde o gasto pesa mais (tipo de geração, ferramenta,
modelo, projeto), com gráficos de pizza, comparação entre ciclos e drill-down até a
criação individual.

Repositório: [github.com/thiagohcrispim-web/magnific-credit-monitor](https://github.com/thiagohcrispim-web/magnific-credit-monitor)
(branch `main`, commit `e1a55f9`).

## O que já está pronto

### 1. Investigação do MCP real (`docs/mcp-findings.md`)

- `creations_search` com `full=true` traz `createdAt`, modelo (`metadata.mode`),
  resolução, projeto, `webUrl` — mas **nenhum campo de custo**.
- `simulate_cost` só retorna um valor quando chamado com os parâmetros reais da geração;
  não existe tabela de preço estática em nenhum catálogo do Magnific.
- Autenticação fora do claude.ai é **OAuth 2.0 + PKCE direto no MCP**
  (`mcp.magnific.com`, via `auth.magnific.com/realms/mcp`), não API key REST — a API
  REST pública não tem endpoint de saldo/histórico. "Any Magnific account works. MCP
  tools share the same credit balance as the in-app product."

### 2. Backend (Node 20 + TypeScript + Fastify)

- **Banco**: SQLite via `@libsql/client` (compatível com Turso, para persistência
  gratuita em produção; arquivo local em dev), com migrations versionadas.
- **Provider isolado** (`server/src/providers/`): interface `Provider` genérica +
  `MagnificProvider` real (OAuth/PKCE/DCR + cliente MCP via
  `@modelcontextprotocol/sdk`) — pensada para caber outros provedores de IA depois e
  para virar um módulo de um app Electron sem reescrever a coleta.
- **Coletor** (`server/src/collectors/`): snapshot de saldo periódico + sync
  incremental de criações, retry com backoff exponencial, fila de concorrência baixa,
  detecção de ciclo (por dia de renovação configurado **ou** queda de saldo).
- **Cálculo** (`server/src/calc/`): custo em camadas (`simulate_cost` → tabela manual
  por modelo → por ferramenta → por tipo de arquivo), rateio do gasto real por
  intervalo de snapshot, indicador de confiança, previsão de esgotamento de saldo.
- **Rotas**: KPIs, séries, rankings (pizza) por tipo/ferramenta/modelo/projeto,
  drill-down, configurações, export CSV.

### 3. Frontend (Vite + React, dashboard escuro)

- Seletor de conta e ciclo, KPIs (gasto, média diária, previsão de esgotamento, item
  mais pesado, confiança da atribuição).
- Gráficos próprios em SVG (paleta validada contra daltonismo): pizza por
  tipo/ferramenta/modelo/projeto, consumo acumulado vs. linha ideal, barras empilhadas
  por dia, comparação entre ciclos.
- Drill-down: clicar numa fatia abre a lista de criações daquele grupo, com link direto
  pro Magnific.
- Tela de configurações (tabela de custo editável, dia de renovação, intervalo de
  coleta) e export CSV do ciclo.

### 4. Testes

16 testes Vitest cobrindo rateio por intervalo, detecção de ciclo, previsão de
esgotamento e camadas de custo — todos passando.

### 5. Modo mock validado ponta a ponta

`npm run mock` sobe o dashboard completo com dados simulados que batem com a referência
real do brief: ciclo 6/out–5/nov da conta nucleo01 com 1.883 imagens, 205 vídeos, 100
áudios, terminando em 299.997 de 300.000 créditos gastos.

### 6. Deploy gratuito documentado (não executado ainda)

README com passo a passo para **Render** (app) + **Turso** (banco persistente) +
**cron-job.org** (mantém o app acordado e dispara a coleta), tudo sem custo.

## O que falta (ação do usuário)

1. **Testar o login OAuth real** — rodar `npm run login:magnific -- nucleo01` no
   próprio PC (abre o navegador para autenticar). Implementado mas nunca validado contra
   o servidor real do Magnific; pode precisar de ajuste se o registro automático de
   client (DCR) for recusado.
2. **Criar conta no Turso** e gerar `DATABASE_URL` / `DATABASE_AUTH_TOKEN`.
3. **Criar conta no Render**, publicar via Blueprint (`render.yaml` já está no repo) e
   preencher as variáveis de ambiente (incluindo o refresh token do passo 1).
4. **Criar conta no cron-job.org** para manter o app acordado.

## Decisões técnicas relevantes

- **SQLite via libSQL/Turso em vez de `better-sqlite3`** (sugestão original do brief):
  o free tier do Render tem disco efêmero, então trocamos por um SQLite hospedado e
  persistente, mantendo a mesma linguagem SQL e a mesma lógica de migrations.
- **Gasto real sempre vem da diferença de saldo entre snapshots** — a atribuição por
  criação é sempre uma estimativa rateada, nunca o contrário; intervalos sem criações
  mas com gasto real ficam marcados como "não atribuído", nunca descartados.
- **Uma conta (nucleo01) priorizada para coleta real** nesta primeira versão; suporte a
  múltiplas contas já existe no código (`ACCOUNTS` no `.env`) e no modo mock (duas
  contas simuladas), só falta o login da segunda conta quando quiser ativá-la.
