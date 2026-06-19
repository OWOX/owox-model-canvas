import type { FastifyInstance } from "fastify";
import { getSession, clientFor } from "../auth/session";
function need(req: any, reply: any) { const s = getSession(req.cookies.mc_sid); if (!s) { reply.code(401).send({ error: "Not connected" }); return null; } return s; }
export async function dataMartRoutes(app: FastifyInstance) {
  app.get("/api/data-marts", async (req, reply) => { const s = need(req, reply); if (!s) return; return clientFor(s).listDataMarts(); });
  app.post("/api/data-marts", async (req, reply) => { const s = need(req, reply); if (!s) return; return clientFor(s).createDataMart(req.body as any); });
  app.put<{ Params: { id: string; field: string } }>("/api/data-marts/:id/:field", async (req, reply) => {
    const s = need(req, reply); if (!s) return; const c = clientFor(s); const { id, field } = req.params; const b = req.body as any;
    if (field === "title") return c.updateTitle(id, b.title);
    if (field === "description") return c.updateDescription(id, b.description);
    if (field === "schema") return c.updateSchema(id, b);
    if (field === "definition") return c.updateDefinition(id, b);
    return reply.code(404).send({ error: "unknown field" });
  });
  app.post<{ Params: { id: string } }>("/api/data-marts/:id/relationships", async (req, reply) => { const s = need(req, reply); if (!s) return; return clientFor(s).createRelationship(req.params.id, req.body as any); });
  app.delete<{ Params: { id: string } }>("/api/data-marts/:id", async (req, reply) => { const s = need(req, reply); if (!s) return; return clientFor(s).deleteDataMart(req.params.id); });
}
