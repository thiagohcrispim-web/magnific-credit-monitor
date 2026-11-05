import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { config } from "../../config.js";

interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  obtainedAt: number;
}

interface OidcMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
}

async function discoverMetadata(): Promise<OidcMetadata> {
  const res = await fetch(`${config.magnific.oauthIssuer}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`Falha ao descobrir metadata OIDC: ${res.status}`);
  return (await res.json()) as OidcMetadata;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Registra um client público via Dynamic Client Registration (RFC 7591),
 * usando um redirect_uri local. Necessário na primeira vez; o client_id
 * resultante deve ser salvo em MAGNIFIC_OAUTH_CLIENT_ID para não registrar de novo.
 */
export async function registerClient(redirectUri: string): Promise<{ clientId: string; clientSecret?: string }> {
  const metadata = await discoverMetadata();
  if (!metadata.registration_endpoint) throw new Error("Servidor não expõe registration_endpoint");
  const res = await fetch(metadata.registration_endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "magnific-credit-monitor",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!res.ok) throw new Error(`DCR falhou: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { client_id: string; client_secret?: string };
  return { clientId: body.client_id, clientSecret: body.client_secret };
}

/**
 * Fluxo Authorization Code + PKCE, de uso único e manual: abre um servidor HTTP
 * local temporário para receber o redirect, imprime a URL de login para o usuário
 * abrir no navegador, e devolve o refresh token obtido (pedindo scope offline_access).
 * Rode via `npm run login:magnific -- <accountId>`.
 */
export async function runManualLoginFlow(clientId: string): Promise<TokenSet> {
  const metadata = await discoverMetadata();
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname !== "/callback") {
          res.writeHead(404).end();
          return;
        }
        const returnedState = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        if (returnedState !== state || !code) {
          res.writeHead(400).end("state inválido ou code ausente");
          server.close();
          reject(new Error("Resposta de callback inválida"));
          return;
        }
        const redirectUri = `http://localhost:${port}/callback`;
        const tokenRes = await fetch(metadata.token_endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            code_verifier: verifier,
          }),
        });
        if (!tokenRes.ok) throw new Error(`Troca de token falhou: ${tokenRes.status} ${await tokenRes.text()}`);
        const body = (await tokenRes.json()) as { access_token: string; refresh_token?: string; expires_in: number };
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end("<html><body>Login concluído. Pode fechar esta aba e voltar ao terminal.</body></html>");
        server.close();
        resolve({ ...body, obtainedAt: Date.now() });
      } catch (err) {
        res.writeHead(500).end(String(err));
        server.close();
        reject(err);
      }
    });

    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const redirectUri = `http://localhost:${port}/callback`;
      const authUrl = new URL(metadata.authorization_endpoint);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", "openid profile email offline_access mcp:custom-audience");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", challenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      console.log("\nAbra esta URL no navegador e faça login com a conta Magnific:\n");
      console.log(authUrl.toString());
      console.log(`\nAguardando callback em ${redirectUri} ...\n`);
    });
  });
}

export async function refreshAccessToken(clientId: string, refreshToken: string): Promise<TokenSet> {
  const metadata = await discoverMetadata();
  const res = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });
  if (!res.ok) throw new Error(`Refresh falhou: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { ...body, obtainedAt: Date.now() };
}
