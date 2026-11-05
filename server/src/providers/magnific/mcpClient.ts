import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../../config.js";
import { refreshAccessToken } from "./oauth.js";
import { getRefreshToken } from "./tokenStore.js";

interface CachedAuth {
  accessToken: string;
  expiresAt: number;
}

const authCache = new Map<string, CachedAuth>();

async function getAccessToken(accountId: string): Promise<string> {
  const cached = authCache.get(accountId);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.accessToken;

  const stored = getRefreshToken(accountId);
  if (!stored) {
    throw new Error(
      `Nenhum refresh token para a conta "${accountId}". Rode: npm run login:magnific -- ${accountId}`
    );
  }
  const tokens = await refreshAccessToken(stored.clientId, stored.refreshToken);
  authCache.set(accountId, { accessToken: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 });
  // Token mudou: descarta o client MCP em cache para reconectar com o header novo.
  clients.delete(accountId);
  return tokens.access_token;
}

const clients = new Map<string, Client>();

/** Cliente MCP autenticado para uma conta Magnific específica, com token sob demanda. */
export async function getMcpClient(accountId: string): Promise<Client> {
  const existing = clients.get(accountId);
  if (existing) return existing;

  const accessToken = await getAccessToken(accountId);
  const transport = new StreamableHTTPClientTransport(new URL(config.magnific.mcpUrl), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const client = new Client({ name: "magnific-credit-monitor", version: "0.1.0" });
  await client.connect(transport);
  clients.set(accountId, client);
  return client;
}

export async function callTool<T = unknown>(
  accountId: string,
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  const client = await getMcpClient(accountId);
  const result = await client.callTool({ name, arguments: args });
  const content = (result.content as { type: string; text?: string }[] | undefined)?.[0];
  if (!content?.text) return result as T;
  try {
    return JSON.parse(content.text) as T;
  } catch {
    return content.text as T;
  }
}
