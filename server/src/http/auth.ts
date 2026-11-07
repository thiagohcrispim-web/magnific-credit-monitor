import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { sendEmail } from "../alerts/alerts.js";

/**
 * Login simples de um usuário só, conferido no servidor.
 * LOGIN_EMAIL e LOGIN_PASSWORD ficam nas variáveis de ambiente (nunca no código do front).
 * Login certo devolve o API_TOKEN, que o front passa a usar em "Authorization: Bearer".
 */

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Limite simples de tentativas por IP, em memória.
const hits = new Map<string, number[]>();
function tooMany(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

function creds() {
  return {
    email: (process.env.LOGIN_EMAIL ?? "").trim().toLowerCase(),
    password: process.env.LOGIN_PASSWORD ?? "",
    token: process.env.API_TOKEN ?? "",
  };
}

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post<{ Body: { email?: string; password?: string } }>("/api/login", async (req, reply) => {
    if (tooMany(`login:${req.ip}`, 10, 15 * 60_000)) {
      return reply.code(429).send({ error: "Muitas tentativas. Aguarde alguns minutos." });
    }
    const { email, password, token } = creds();
    if (!email || !password || !token) {
      return reply.code(503).send({ error: "Login não configurado no servidor." });
    }
    const givenEmail = (req.body?.email ?? "").trim().toLowerCase();
    const givenPassword = req.body?.password ?? "";
    if (!same(givenEmail, email) || !same(givenPassword, password)) {
      return reply.code(401).send({ error: "E-mail ou senha incorretos." });
    }
    return { token, email };
  });

  // Sempre responde igual, para não revelar se o e-mail existe.
  app.post<{ Body: { email?: string } }>("/api/forgot-password", async (req, reply) => {
    if (tooMany(`forgot:${req.ip}`, 3, 60 * 60_000)) {
      return reply.code(429).send({ error: "Muitas solicitações. Tente novamente mais tarde." });
    }
    const { email, password } = creds();
    const givenEmail = (req.body?.email ?? "").trim().toLowerCase();
    if (email && password && same(givenEmail, email)) {
      try {
        await sendEmail({
          to: [email],
          subject: "[Magnific Monitor] Sua senha de acesso",
          html: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#111">
  <p>Você pediu para recuperar o acesso ao painel de créditos Magnific.</p>
  <p>Sua senha é: <b style="font-size:17px">${password.replace(/[<>&"]/g, "")}</b></p>
  <p style="color:#666;font-size:13px">Se não foi você, ignore este e-mail.</p>
</div>`,
        });
      } catch (err) {
        req.log.error({ err }, "falha ao enviar e-mail de recuperação");
      }
    }
    return { ok: true, message: "Se o e-mail estiver cadastrado, você receberá a senha em instantes." };
  });
}
