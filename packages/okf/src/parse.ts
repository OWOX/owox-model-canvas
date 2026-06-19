import type { ModelGraph, ModelNode, ModelEdge, InputSource } from "./types";
import { parseFrontmatter, slugify } from "./slug";

export function parseBundle(files: Record<string, string>): ModelGraph {
  const docs = Object.entries(files).filter(([p]) => p.endsWith(".md") && !p.endsWith("index.md"));
  const nodes: ModelNode[] = []; const slugToKey = new Map<string, string>();
  for (const [path, text] of docs) {
    const { data, body } = parseFrontmatter(text);
    const owox = data.owox || {};
    const title = data.title || "Untitled";
    const key = owox.key || slugify(title, path);
    const fileSlug = path.split("/").pop()!.replace(/\.md$/, "");
    slugToKey.set(fileSlug, key);
    nodes.push({
      key, title, inputSource: (owox.inputSource || "SQL") as InputSource,
      description: data.description || undefined, definition: parseDefinition(body), schema: parseSchema(body),
      position: owox.position || { x: 0, y: 0 },
      status: owox.id ? "created" : "pending", owoxId: owox.id ?? null,
    });
  }
  const raw: { from: string; to: string; keys: { left: string; right: string }[] }[] = [];
  for (const [path, text] of docs) {
    const { data, body } = parseFrontmatter(text);
    const fromKey = (data.owox && data.owox.key) || slugify(data.title || "", path);
    for (const ln of body.split("\n")) {
      const m = ln.match(/^- \[.*?\]\(\.\/(.+?)\.md\)\s*(?:—|--)?\s*(.*)$/);
      if (!m) continue;
      const toKey = slugToKey.get(m[1]); if (!toKey) continue;
      const keys = [...m[2].matchAll(/`([^`]+?)\s*=\s*([^`]+?)`/g)].map(g => ({ left: g[1].trim(), right: g[2].trim() }));
      raw.push({ from: fromKey, to: toKey, keys });
    }
  }
  const edges: ModelEdge[] = []; const seen = new Map<string, ModelEdge>();
  for (const r of raw) {
    const pairKey = [r.from, r.to].sort().join("|");
    const ex = seen.get(pairKey);
    if (ex) { ex.bidirectional = true; continue; }
    const e: ModelEdge = { id: `e${edges.length + 1}`, from: r.from, to: r.to, keys: r.keys, bidirectional: false };
    seen.set(pairKey, e); edges.push(e);
  }
  const storageId = (docs[0] && (parseFrontmatter(docs[0][1]).data.owox || {}).storageId) || null;
  return { storageId, nodes, edges };
}

function parseSchema(body: string): { name: string; type: string; pk: boolean }[] {
  const out: { name: string; type: string; pk: boolean }[] = [];
  const lines = body.split("\n"); let inSchema = false;
  for (const ln of lines) {
    if (/^##?\s+Schema/i.test(ln)) { inSchema = true; continue; }
    if (inSchema && /^##?\s+/.test(ln)) break;
    const m = ln.match(/^\|\s*`?([\w.]+)`?\s*\|\s*([\w]+)\s*\|\s*(✓|x|X)?\s*\|/);
    if (inSchema && m && m[1] !== "Column") out.push({ name: m[1], type: m[2], pk: !!m[3] });
  }
  return out;
}

// Extract the fenced code block under a "## Definition" heading, if present.
function parseDefinition(body: string): string | null {
  const m = body.match(/^##?\s+Definition\s*\n+```[^\n]*\n([\s\S]*?)\n```/im);
  return m ? m[1].trim() : null;
}
