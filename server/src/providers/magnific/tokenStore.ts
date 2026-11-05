import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Fica em data/, que está no .gitignore — nunca commitar este arquivo.
const STORE_PATH = join(__dirname, "..", "..", "..", "..", "data", "magnific-tokens.json");

interface StoredTokens {
  [accountId: string]: { refreshToken: string; clientId: string };
}

function readStore(): StoredTokens {
  if (!existsSync(STORE_PATH)) return {};
  return JSON.parse(readFileSync(STORE_PATH, "utf-8")) as StoredTokens;
}

export function saveRefreshToken(accountId: string, refreshToken: string, clientId: string): void {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  const store = readStore();
  store[accountId] = { refreshToken, clientId };
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export function getRefreshToken(accountId: string): { refreshToken: string; clientId: string } | undefined {
  const fromEnv = process.env[`MAGNIFIC_REFRESH_TOKEN_${accountId.toUpperCase()}`];
  const clientId = process.env.MAGNIFIC_OAUTH_CLIENT_ID;
  if (fromEnv && clientId) return { refreshToken: fromEnv, clientId };
  return readStore()[accountId];
}
