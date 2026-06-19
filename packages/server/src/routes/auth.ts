import type { FastifyInstance } from "fastify";
import * as client from "../owox/client";
import { createSession, getSession, dropSession } from "../auth/session";

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { apiKey: string } }>("/api/auth/connect", async (req, reply) => {
    try {
      const parts = client.parseApiKey(req.body.apiKey);
      const token = await client.exchangeToken(parts);
      const info = client.decodeProjectFromToken(token);
      const sid = createSession({ origin: parts.apiOrigin, token, keyId: parts.apiKeyId, projectTitle: info.projectTitle, fullName: info.fullName });
      reply.setCookie("mc_sid", sid, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
      return { projectTitle: info.projectTitle, fullName: info.fullName };
    } catch (e) { return reply.code(400).send({ error: (e as Error).message }); }
  });
  app.get("/api/me", async (req, reply) => {
    const s = getSession(req.cookies.mc_sid);
    if (!s) return reply.code(401).send({ error: "Not connected" });
    return { projectTitle: s.projectTitle, fullName: s.fullName };
  });
  app.post("/api/auth/signout", async (req, reply) => {
    dropSession(req.cookies.mc_sid); reply.clearCookie("mc_sid", { path: "/" }); return { ok: true };
  });
}
