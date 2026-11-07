import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";

/** Origens liberadas por padrão: previews e apps publicados do Lovable. */
const DEFAULT_ORIGIN_PATTERNS = [/^https:\/\/[a-z0-9-]+\.lovable\.app$/, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/];

function isAllowedOrigin(origin: string): boolean {
  const extra = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (extra.includes(origin)) return true;
  return DEFAULT_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * CORS para o front do Lovable + senha da API.
 * Se API_TOKEN estiver definida, toda rota /api/* (exceto /api/health) exige
 * o header "Authorization: Bearer <API_TOKEN>".
 */
export function registerSecurity(app: FastifyInstance): void {
  app.get("/api/health", async () => ({ ok: true }));

  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
      reply.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
      reply.header("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
      reply.header("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") return reply.code(204).send();

    const url = req.raw.url ?? "";
    if (!url.startsWith("/api/") || url.startsWith("/api/health")) return;

    const expected = process.env.API_TOKEN;
    if (!expected) return; // sem senha configurada (uso local)

    const header = req.headers.authorization ?? "";
    // Links de download (CSV) não mandam header: aceita também ?token=
    const queryToken = new URL(url, "http://x").searchParams.get("token") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7) : queryToken;
    if (!tokenMatches(given, expected)) return reply.code(401).send({ error: "senha da API inválida ou ausente" });
  });
}
