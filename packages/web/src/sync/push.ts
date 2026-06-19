import type { ModelStore } from "../state/model";
import { api as defaultApi } from "../lib/api";
import { slugify } from "@mc/okf";

type Api = typeof defaultApi;

export interface PushResult {
  created: number;
  updated: number;
  failed: number;
  relationshipsCreated: number;
  relationshipsFailed: number;
  errors: string[];
}

export async function pushModel(store: ModelStore, api: Api = defaultApi): Promise<PushResult> {
  const res: PushResult = { created: 0, updated: 0, failed: 0, relationshipsCreated: 0, relationshipsFailed: 0, errors: [] };

  const storageId = store.get().storageId;
  if (!storageId) {
    const pending = store.get().nodes.filter(n => n.status !== "created");
    pending.forEach(n => store.updateNode(n.key, { status: "error", error: "No storage selected" }));
    res.failed = pending.length;
    res.errors.push("No storage selected — pick a storage in the top bar before pushing.");
    return res;
  }

  // ── 1. Create pending marts ────────────────────────────────────────────────
  for (const n of store.get().nodes) {
    if (n.status === "created") continue;
    store.updateNode(n.key, { status: "creating", error: null });
    try {
      // Minimal create: only { title, storageId } is required; schema is optional.
      const body: Record<string, unknown> = { title: n.title, storageId };
      if (n.description) body.description = n.description;
      if (n.schema.length) body.schema = { fields: n.schema.map(f => ({ name: f.name, type: f.type, isPrimaryKey: f.pk })) };
      const out = await api<{ id: string }>("/api/data-marts", { method: "POST", body: JSON.stringify(body) });
      store.updateNode(n.key, { status: "created", owoxId: out.id, createdAt: new Date().toISOString() });
      res.created++;
    } catch (e) {
      const msg = (e as Error).message;
      store.updateNode(n.key, { status: "error", error: msg });
      res.failed++;
      res.errors.push(`"${n.title}": ${msg}`);
    }
  }

  // ── 2. Create joinable relationships (depends on both marts existing) ───────
  // Contract (confirmed live): POST /api/data-marts/{sourceId}/relationships
  //   { targetDataMartId, targetAlias, joinConditions:[{sourceFieldName,targetFieldName}] }
  const g = store.get();
  const owoxIdByKey = new Map(g.nodes.map(n => [n.key, n.owoxId]));
  const titleByKey = new Map(g.nodes.map(n => [n.key, n.title]));

  for (const e of g.edges) {
    const keys = e.keys.filter(k => k.left && k.right);
    const directions: Array<[string, string, { left: string; right: string }[]]> = e.bidirectional
      ? [[e.from, e.to, keys], [e.to, e.from, keys.map(k => ({ left: k.right, right: k.left }))]]
      : [[e.from, e.to, keys]];

    for (const [fromKey, toKey, ks] of directions) {
      const fromId = owoxIdByKey.get(fromKey);
      const toId = owoxIdByKey.get(toKey);
      // Skip until both ends exist in OWOX and at least one complete join key is set.
      if (!fromId || !toId || ks.length === 0) {
        res.relationshipsFailed++;
        const why = ks.length === 0 ? "join keys are empty" : "both marts must be created first";
        res.errors.push(`Link ${titleByKey.get(fromKey)} → ${titleByKey.get(toKey)}: ${why}`);
        continue;
      }
      try {
        await api(`/api/data-marts/${fromId}/relationships`, {
          method: "POST",
          body: JSON.stringify({
            targetDataMartId: toId,
            targetAlias: slugify(titleByKey.get(toKey) || toKey, toKey),
            joinConditions: ks.map(k => ({ sourceFieldName: k.left, targetFieldName: k.right })),
          }),
        });
        res.relationshipsCreated++;
      } catch (e) {
        res.relationshipsFailed++;
        res.errors.push(`Link ${titleByKey.get(fromKey)} → ${titleByKey.get(toKey)}: ${(e as Error).message}`);
      }
    }
  }

  return res;
}
