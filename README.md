# Magnific Credit Monitor

Dashboard de monitoramento de créditos do Magnific: mostra onde você está gastando seus
créditos por ciclo de renovação (não por mês do calendário), com gráficos de pizza por
tipo de geração, ferramenta, modelo e projeto, comparação entre ciclos, drill-down até a
criação individual, previsão de esgotamento e alertas.

Veja `docs/mcp-findings.md` para o levantamento técnico completo (formato real do MCP do
Magnific, o que `simulate_cost` aceita/retorna, e como funciona a autenticação OAuth fora
do claude.ai).

## Por que os números são estimativas (leia antes de desconfiar de um valor)

O Magnific **não expõe o custo de cada geração individual**. O app sabe duas coisas com
certeza: (1) o saldo gasto total em cada instante (via snapshots periódicos de
`account_balance`) e (2) quais criações existem e quando foram feitas. Para saber *quanto*
cada criação custou, o app:

1. Tenta `simulate_cost` com os parâmetros reais da criação (modelo, resolução, duração).
2. Se falhar, usa uma tabela manual por modelo (editável em Configurações).
3. Se o modelo não estiver na tabela, usa um valor por ferramenta.
4. Em último caso, usa um valor médio por tipo de arquivo.

O total desses custos estimados é então **ajustado proporcionalmente** para bater
exatamente com a diferença real de saldo gasto naquele intervalo de snapshot — então a
soma por ciclo sempre bate com o saldo real, mas a divisão entre itens é uma aproximação.
O card "Confiança da atribuição" mostra que fração do gasto real tem alguma criação
associada; o que sobra fica marcado como "não atribuído" e nunca é descartado.

## Stack

- **Backend**: Node 20 + TypeScript, Fastify, `@modelcontextprotocol/sdk` (cliente MCP),
  `@libsql/client` (SQLite local em dev, [Turso](https://turso.tech) em produção).
- **Frontend**: Vite + React, gráficos em SVG próprio (sem biblioteca pesada).
- **Coleta**: snapshot de saldo + sync incremental de criações, com retry/backoff e fila
  de concorrência baixa, isolados atrás de uma interface `Provider` (pensada para caber
  outros provedores de IA no futuro, e para depois virar um módulo de um app Electron).

## Rodando localmente (modo mock — sem credenciais)

```bash
npm install
npm run mock
```

Abre em `http://localhost:8787` com dados simulados realistas (duas contas, dois ciclos
cada). Use isso para conhecer o dashboard antes de configurar o acesso real.

## Rodando com dados reais (sem Docker, localmente)

### 1. Autenticação com o Magnific

O MCP do Magnific usa OAuth 2.0 (não API key). Da primeira vez:

```bash
cd server
npm run login:magnific -- nucleo01
```

Isso abre uma URL para você logar no navegador com a conta Magnific. Depois de
autenticar, o refresh token fica salvo em `data/magnific-tokens.json` (fora do git,
nunca comite esse arquivo). Repita para cada conta (`npm run login:magnific -- pessoal`).

> Se o registro automático de client (DCR) for recusado pelo servidor do Magnific, você
> vai precisar de um `client_id` obtido manualmente — nesse caso me avise que ajusto o
> fluxo.

### 2. Rodar

```bash
cp .env.example .env   # configure ACCOUNTS, SNAPSHOT_INTERVAL_MINUTES etc.
npm run build
npm start
```

## Deploy online gratuito (Render + Turso + cron-job.org)

Essa é a forma pensada pra você acessar o dashboard de qualquer navegador, sem deixar o
PC ligado. Nenhum dos três serviços abaixo pede cartão de crédito no free tier.

### 1. Banco (Turso)

1. Crie conta grátis em [turso.tech](https://turso.tech).
2. Crie um banco: `turso db create magnific-monitor`.
3. Pegue a URL de conexão: `turso db show magnific-monitor --url` → vira `DATABASE_URL`.
4. Gere um token: `turso db tokens create magnific-monitor` → vira `DATABASE_AUTH_TOKEN`.

### 2. App (Render)

1. Crie conta grátis em [render.com](https://render.com), conecte seu GitHub.
2. "New +" → "Blueprint" → aponte para este repositório (ele lê o `render.yaml`).
3. Preencha as env vars pedidas: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`,
   `MAGNIFIC_OAUTH_CLIENT_ID`, `MAGNIFIC_REFRESH_TOKEN_NUCLEO01` (o client_id e refresh
   token vêm do passo de login — rode `npm run login:magnific` localmente primeiro e
   copie os valores de `data/magnific-tokens.json`).
4. Deploy. O free tier do Render "dorme" depois de ~15 min sem requisição — é por isso
   que o passo 3 (cron-job.org) existe: ele também mantém o serviço acordado.

### 3. Gatilho de coleta (cron-job.org)

O free tier do Render não tem cron job nem disco persistente — por isso a coleta roda
*dentro* do processo do app (a cada `SNAPSHOT_INTERVAL_MINUTES`), mas só enquanto o app
está acordado. Para garantir coleta regular mesmo com o app dormindo:

1. Crie conta grátis em [cron-job.org](https://cron-job.org).
2. Crie um job: URL = `https://<seu-app>.onrender.com/api/accounts`, intervalo = 15 min.
3. Isso mantém o Render acordado, o que mantém o agendador interno de coleta rodando.

## Configuração de múltiplas contas

```json
ACCOUNTS=[{"id":"nucleo01","label":"nucleo01 (trabalho)","renewalDay":6},{"id":"pessoal","label":"pessoal","renewalDay":12}]
```

Cada conta precisa do seu próprio login (`npm run login:magnific -- <id>`) e sua própria
env var `MAGNIFIC_REFRESH_TOKEN_<ID_EM_MAIÚSCULAS>`.

## Rodando no Windows (desenvolvimento local)

1. Instale [Node.js 20+](https://nodejs.org) (LTS).
2. Abra o PowerShell na pasta do projeto.
3. `npm install`, depois `npm run mock` (ou siga "Rodando com dados reais" acima).
4. O app abre em `http://localhost:8787` no navegador.

O código já está estruturado atrás da interface `Provider` (`server/src/providers/`)
para que, mais pra frente, isso vire um módulo de um app Electron com ícone na bandeja —
sem precisar reescrever a coleta ou o cálculo.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run mock` | Sobe o servidor com dados simulados |
| `npm run dev` | Sobe o servidor com dados reais (requer login feito) |
| `npm run build` | Builda frontend e backend para produção |
| `npm start` | Roda a build de produção |
| `npm test` | Roda os testes (Vitest) |
| `npm run login:magnific -- <accountId>` | Fluxo OAuth de login numa conta Magnific |

## Estrutura

```
server/src/
  providers/           interface Provider + implementação Magnific (mock e real)
  collectors/           snapshot de saldo + sync incremental, retry, fila
  calc/                 rateio por intervalo, detecção de ciclo, previsão, tabela de custo
  routes/                endpoints do dashboard e configurações
  db/                    schema SQL + migrator
  mock/                  gerador de dados simulados
web/src/
  components/            gráficos (pizza, linha, barras) e drill-down
  pages/                 Dashboard e Configurações
docs/mcp-findings.md      investigação do MCP real (leia antes de mexer na atribuição de custo)
```
