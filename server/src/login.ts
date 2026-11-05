import { registerClient, runManualLoginFlow } from "./providers/magnific/oauth.js";
import { saveRefreshToken } from "./providers/magnific/tokenStore.js";

async function main() {
  const accountId = process.argv[2];
  if (!accountId) {
    console.error("Uso: npm run login:magnific -- <accountId>");
    process.exit(1);
  }

  let clientId = process.env.MAGNIFIC_OAUTH_CLIENT_ID;
  if (!clientId) {
    console.log("Nenhum MAGNIFIC_OAUTH_CLIENT_ID configurado — registrando um client novo via DCR...");
    const registered = await registerClient("http://localhost:0/callback");
    clientId = registered.clientId;
    console.log(`client_id obtido: ${clientId}`);
    console.log("Salve este valor em MAGNIFIC_OAUTH_CLIENT_ID (.env) para reusar em todas as contas.");
  }

  const tokens = await runManualLoginFlow(clientId);
  if (!tokens.refresh_token) {
    throw new Error("Servidor não retornou refresh_token — confirme se o scope offline_access foi aceito.");
  }
  saveRefreshToken(accountId, tokens.refresh_token, clientId);
  console.log(`\nLogin ok para a conta "${accountId}". Refresh token salvo em data/magnific-tokens.json.`);
}

main().catch((err) => {
  console.error("Login falhou:", err);
  process.exit(1);
});
