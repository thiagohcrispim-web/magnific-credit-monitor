export interface AccountConfig {
  id: string;
  label: string;
  renewalDay?: number;
}

function parseAccounts(): AccountConfig[] {
  const raw = process.env.ACCOUNTS;
  if (raw) {
    try {
      return JSON.parse(raw) as AccountConfig[];
    } catch {
      console.warn("[config] ACCOUNTS inválido, usando padrão");
    }
  }
  return [{ id: "nucleo01", label: "nucleo01 (trabalho)", renewalDay: 6 }];
}

export const config = {
  mock: process.env.MOCK === "true",
  port: Number(process.env.PORT ?? 8787),
  snapshotIntervalMinutes: Number(process.env.SNAPSHOT_INTERVAL_MINUTES ?? 15),
  accounts: parseAccounts(),
  magnific: {
    mcpUrl: process.env.MAGNIFIC_MCP_URL ?? "https://mcp.magnific.com",
    oauthIssuer: process.env.MAGNIFIC_OAUTH_ISSUER ?? "https://auth.magnific.com/realms/mcp",
    clientId: process.env.MAGNIFIC_OAUTH_CLIENT_ID,
    clientSecret: process.env.MAGNIFIC_OAUTH_CLIENT_SECRET,
    refreshTokenEnvPrefix: "MAGNIFIC_REFRESH_TOKEN_", // + account id em maiúsculas
  },
};
