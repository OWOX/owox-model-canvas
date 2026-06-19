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

// OWOX validates the output schema with a storage-specific discriminator, e.g.
// GOOGLE_BIGQUERY → "bigquery-data-mart-schema", SNOWFLAKE → "snowflake-data-mart-schema".
function schemaDiscriminator(storageType: string): string {
  const base = storageType.replace(/^GOOGLE_/, "").replace(/^AWS_/, "").toLowerCase();
  return `${base}-data-mart-schema`;
}

export async function pushModel(store: ModelStore, api: Api = defaultApi, storageType?: string): Promise<PushResult> {
  const res: PushResult = { created: 0, updated: 0, failed: 0, relationshipsCreated: 0, relationshipsFailed: 0, errors: [] };

  const storageId = store.get().storageId;
  if (!storageId) {
    const pending = store.get().nodes.filter(n => n.status !== "created");
    pending.forEach(n => store.updateNode(n.key, { status: "error", error: "No storage selected" }));
    res.failed = pending.length;
    res.errors.push("No storage selected — pick a storage in the top bar before pushing.");
    return res;
  }

  // ── 0. Ensure every join-key field exists in its mart's output schema ───────
  // Joining on a field that isn't defined is meaningless, so auto-add missing
  // ones (default STRING) before we push schemas.
  for (const e of store.get().edges) {
    for (const k of e.keys) {
      if (k.left) ensureField(store, e.from, k.left);
      if (k.right) ensureField(store, e.to, k.right);
    }
  }

  // ── 1. Create pending marts, then push their output schema ──────────────────
  for (const n of store.get().nodes) {
    if (n.status === "created") continue;
    store.updateNode(n.key, { status: "creating", error: null });
    try {
      // Create a draft with just { title, storageId } — confirmed to always 201.
      const out = await api<{ id: string }>("/api/data-marts", {
        method: "POST",
        body: JSON.stringify({ title: n.title, storageId }),
      });
      if (n.description) {
        await api(`/api/data-marts/${out.id}/description`, { method: "PUT", body: JSON.stringify({ description: n.description }) }).catch(() => {});
      }
      // Best-effort: push the optional source definition (format unconfirmed → swallow).
      if (n.definition && n.definition.trim()) {
        await api(`/api/data-marts/${out.id}/definition`, { method: "PUT", body: JSON.stringify({ definition: n.definition }) }).catch(() => {});
      }
      // Push the output schema (fields + types + PK). Best-effort: a schema error
      // doesn't fail the mart itself, but it's surfaced in the result.
      const fields = n.schema.filter(f => f.name.trim());
      if (fields.length && storageType) {
        try {
          await api(`/api/data-marts/${out.id}/schema`, {
            method: "PUT",
            body: JSON.stringify({
              schema: {
                type: schemaDiscriminator(storageType),
                fields: fields.map(f => ({
                  name: f.name, type: f.type, mode: "NULLABLE",
                  status: "CONNECTED", description: "", isPrimaryKey: f.pk,
                })),
              },
            }),
          });
        } catch (e) {
          res.errors.push(`Schema for "${n.title}": ${(e as Error).message}`);
        }
      }
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

// Add a field to a node's output schema if it isn't there yet (default STRING).
function ensureField(store: ModelStore, nodeKey: string, fieldName: string) {
  const node = store.get().nodes.find(n => n.key === nodeKey);
  if (!node) return;
  if (node.schema.some(f => f.name === fieldName)) return;
  store.updateNode(nodeKey, { schema: [...node.schema, { name: fieldName, type: "STRING", pk: false }] });
}
