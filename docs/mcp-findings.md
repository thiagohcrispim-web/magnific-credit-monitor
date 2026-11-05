# Investigação do MCP do Magnific

Investigação feita em 2026-11-05 com credenciais reais (conta `nucleo01`), via sessão com o MCP do Magnific conectado.

## `account_balance`

Retorna snapshot atual, sem histórico:

```json
{
  "plan": { "tier": "pro", "productName": "Pro", "isPaidPlan": true },
  "credits": { "available": 3, "totalPlan": 300000, "spent": 299997, "scope": "personal" }
}
```

Confirma o que o brief já previa: só dá o valor atual de `spent`/`available`. Para ter série histórica
é obrigatório tirar snapshots periódicos e guardar.

## `creations_search` com `full=true`

Campos confirmados em itens de imagem (amostra de 3 criações reais):

| Campo | Exemplo | Observação |
|---|---|---|
| `identifier` | uuid | id da criação |
| `name` | string | nome do arquivo |
| `tool` | `"text-to-image"` | slug da ferramenta |
| `status` | `"completed"` | |
| `createdAt` | `"2026-11-05T15:23:42+00:00"` | **existe**, ISO 8601 — permite atribuir ao intervalo de snapshot certo |
| `fileReference` / `folderReference` / `projectReference` | uuid | referência de pasta/projeto |
| `webUrl` | url | link direto pro Magnific — usado no drill-down |
| `metadata.mode` / `metadata.slug` | `"imagen-nano-banana-2-flash"` | **modelo usado** |
| `metadata.modelName` | `"Google Nano Banana 2"` | nome legível do modelo |
| `metadata.width` / `height` / `resolution` | `"2k"` | |
| `metadata.prompt`, `metadata.seed`, `metadata.previous` | — | `previous` encadeia variações da mesma geração base |

**Campos ausentes (confirmado):**
- Nenhum campo de custo/créditos em nenhum nível (`cost`, `credits`, `price` não existem).
- Nenhuma contagem explícita de "número de variações" — precisa ser inferida agrupando por `family`/`previous`/prompt+seed.
- Duração/fps de vídeo não foi testado nesta amostra (só veio imagem); a estrutura de `metadata` sugere que, se existir, viria também dentro de `metadata`, mas isso precisa confirmação com uma amostra de vídeo antes de codar o parser de vídeo.

Isso confirma a restrição central do brief: **nenhuma criação individual expõe seu custo**.

## `simulate_cost`

- Assinatura: `{ tool: "<nome real da tool>", arguments: {...mesmos args da tool alvo...} }`.
- Chamado com `arguments: {}` **não retorna preço** — retorna só a lista de campos `required`/`optional`
  esperados e um `exampleArguments` (ex. para `video_generate`: `{"slug":"kling-2.1","duration":5}`).
- Para obter um valor de custo em créditos é necessário montar os argumentos reais da geração (modelo,
  resolução, duração se vídeo, contagem) e chamar de novo. Isso faz dele a **única fonte de preço
  dinâmico** disponível — mas é sempre um custo *estimado*, não o valor real cobrado.

## Catálogos de modelo (`images_models_list`, `video_models_list`)

- `images_models_list`: traz `slug`, `name`, `family`, `aspectRatios`, `resolutions`, `qualities`,
  `expectedGenerationTime`, `requiresPremium`, `agentRecommendation`. **Sem preço por modelo.**
- `video_models_list`: alguns parâmetros trazem flag `affectsCost: true` (indica que aquele parâmetro
  influencia o preço), mas também **sem valor numérico fixo por modelo**.
- Conclusão: **não existe tabela de preço estática em nenhum lugar do MCP.** `simulate_cost` é a única
  fonte de preço, calculado por geração.

## Estratégia de atribuição de custo (decidida com base nisso)

1. **Gasto real** = diferença de `credits.spent` entre snapshots consecutivos de `account_balance`. Fonte da verdade.
2. **Atribuição por criação** = chamar `simulate_cost` com os parâmetros reais extraídos de `metadata`
   (modelo, resolução, duração) para cada criação do intervalo. Isso dá um peso relativo por item.
3. **Rateio**: o total estimado (soma dos `simulate_cost` do intervalo) raramente bate exatamente com o
   gasto real do snapshot — por isso o gasto real é distribuído proporcionalmente ao peso estimado de
   cada criação, por **intervalo de snapshot** (não pelo ciclo inteiro, para manter a atribuição mais fina).
4. Quando não há criações num intervalo com gasto > 0, ou quando `simulate_cost` falha para um item,
   aquele valor fica marcado como **"não atribuído"** — nunca é descartado.
5. Camadas de custo por criação, em ordem de preferência: (1) `simulate_cost` com parâmetros reais,
   (2) tabela manual por modelo (fallback se a chamada falhar ou o modelo não for aceito), (3) por
   ferramenta, (4) por tipo de arquivo.

## Autenticação fora do claude.ai

Investigado em `docs.magnific.com` (quickstart, authentication, modelcontextprotocol, ratelimits,
webhooks) e nos metadados OAuth reais do servidor MCP.

**A API REST pública (`api.magnific.com`, autenticada por `x-magnific-api-key`) não tem endpoint de
saldo/balance, nem de histórico de criações com filtro, nem `simulate_cost`.** Ela só expõe
geração por modelo (um endpoint por modelo). Além disso, gerar uma API key exige ir ao dashboard do
usuário — a doc não afirma claramente qual o plano mínimo, mas o foco da API key é a REST API, não o MCP.

**O MCP do Magnific é o único lugar com `account_balance`, `creations_search` e `simulate_cost`** — e
ele pode ser usado fora do claude.ai, direto:

- Servidor: `https://mcp.magnific.com` (HTTP "streamable", sem bridge local necessário).
- Autenticação: OAuth 2.0 (OpenID Connect via Keycloak), **não usa API key**. Confirmado nos metadados:
  - Issuer: `https://auth.magnific.com/realms/mcp`
  - `authorization_endpoint`: `.../protocol/openid-connect/auth`
  - `token_endpoint`: `.../protocol/openid-connect/token`
  - `registration_endpoint` (Dynamic Client Registration, RFC 7591): `.../clients-registrations/openid-connect`
  - `revocation_endpoint`: `.../protocol/openid-connect/revoke`
  - PKCE suportado (`S256`/`plain`); token usado como `Authorization: Bearer` (`bearer_methods_supported: ["header"]`).
  - Scopes do protected resource: `openid`, `profile`, `email`, `mcp:custom-audience`. O authorization
    server também oferece `offline_access` (necessário para obter **refresh token**) e `basic`.
- **"Any Magnific account works. MCP tools share the same credit balance as the in-app product."** —
  ou seja, o plano Pro atual serve, e o saldo visto pelo MCP é o mesmo saldo real da conta (não um pool separado).
- Não há exemplo oficial de cliente Node/curl para esse fluxo fora de Claude/Cursor — a estratégia
  implementada aqui é: registrar um client via DCR com um `redirect_uri` local (`http://localhost:<porta>/callback`),
  rodar o fluxo Authorization Code + PKCE abrindo o navegador uma vez (login manual do usuário), trocar o
  `code` por `access_token`/`refresh_token` (pedindo `offline_access`), e guardar o refresh token fora do
  repositório. Isso precisa ser validado na prática — o registration_endpoint pode rejeitar client
  público sem client_secret, o que exigiria ajuste.

## Pendências a confirmar durante a implementação

- Formato de `metadata` para criações de vídeo e áudio (duração, fps) — confirmar com amostra real
  assim que a sincronização de vídeo/áudio estiver implementada.
- Como `simulate_cost` se comporta para modelos descontinuados ou criações antigas cujo `metadata.mode`
  não existe mais no catálogo atual (provável fallback para camada 2/3/4).
