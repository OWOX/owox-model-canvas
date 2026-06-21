import type { ModelGraph, ModelNode, ModelEdge, InputSource, Cardinality } from "./types";
import { parseFrontmatter } from "./slug";

const FLIP_CARDINALITY: Record<Cardinality, Cardinality> = { "1:1": "1:1", "N:N": "N:N", "1:N": "N:1", "N:1": "1:N" };

export function parseBundle(files: Record<string, string>): ModelGraph {
  const docs = Object.entries(files).filter(([p]) => p.endsWith(".md") && !p.endsWith("index.md"));
  const nodes: ModelNode[] = []; const slugToKey = new Map<string, string>();
  const pkByKey = new Map<string, string | undefined>();
  for (const [path, text] of docs) {
    const { data, body } = parseFrontmatter(text);
    const owox = data.owox || {};
    const ov = parseOverview(body);
    const title = data.title || "Untitled";
    const fileSlug = path.split("/").pop()!.replace(/\.md$/, "");
    const key = owox.key || fileSlug;
    slugToKey.set(fileSlug, key);
    const schema = parseSchema(body);
    pkByKey.set(key, schema.find(f => f.pk)?.name);
    const inputSource = (owox.inputSource || ov.definitionType || inferSource(data.tags) || "SQL") as InputSource;
    const owoxId = owox.id ?? (ov.id && ov.id !== "—" ? ov.id : null);
    nodes.push({
      key, title, inputSource,
      description: data.description || undefined, definition: parseDefinition(body), schema,
      position: owox.position || { x: 0, y: 0 },
      status: owoxId || ov.status === "PUBLISHED" ? "created" : "pending", owoxId,
    });
  }

  const raw: { from: string; to: string; keys: { left: string; right: string }[]; cardinality?: Cardinality }[] = [];
  for (const [path, text] of docs) {
    const { data, body } = parseFrontmatter(text);
    const fromSlug = path.split("/").pop()!.replace(/\.md$/, "");
    const fromKey = (data.owox && data.owox.key) || fromSlug;
    const fromSchema = parseSchema(body);
    for (const ln of body.split("\n")) {
      const m = ln.match(/^- \[.*?\]\(\.\/(.+?)\.md\)\s*(?:—|--)?\s*(.*)$/);
      if (!m) continue;
      const toKey = slugToKey.get(m[1]); if (!toKey) continue;
      let keys = [...m[2].matchAll(/`([^`]+?)\s*=\s*([^`]+?)`/g)].map(g => ({ left: g[1].trim(), right: g[2].trim() }));
      if (keys.length === 0) {
        // Faithful-OWOX join: recover from a `FK to [Target]` note + target PK.
        const targetTitle = nodes.find(n => n.key === toKey)?.title ?? "";
        const fkCol = fromSchema.find(f => (f.description || "").includes(`FK to [${targetTitle}]`));
        const rightPk = pkByKey.get(toKey);
        if (fkCol && rightPk) keys = [{ left: fkCol.name, right: rightPk }];
      }
      const cm = m[2].match(/\[(1:1|1:N|N:1|N:N)\]/);
      const cardinality = cm ? (cm[1] as Cardinality) : undefined;
      raw.push({ from: fromKey, to: toKey, keys, cardinality });
    }
  }
  const edges: ModelEdge[] = []; const seen = new Map<string, ModelEdge>();
  for (const r of raw) {
    const pairKey = [r.from, r.to].sort().join("|");
    const ex = seen.get(pairKey);
    if (ex) {
      ex.bidirectional = true;
      if (!ex.cardinality && r.cardinality) {
        ex.cardinality = ex.from === r.from ? r.cardinality : FLIP_CARDINALITY[r.cardinality];
      }
      continue;
    }
    const e: ModelEdge = { id: `e${edges.length + 1}`, from: r.from, to: r.to, keys: r.keys, bidirectional: false };
    if (r.cardinality) e.cardinality = r.cardinality;
    seen.set(pairKey, e); edges.push(e);
  }
  const storageId = (docs[0] && (parseFrontmatter(docs[0][1]).data.owox || {}).storageId) || null;
  return { storageId, nodes, edges };
}

function inferSource(tags: unknown): InputSource | undefined {
  const list = (Array.isArray(tags) ? tags : []).map(t => String(t).toUpperCase());
  return (["SQL", "CONNECTOR", "VIEW", "TABLE"] as const).find(s => list.includes(s));
}

function parseOverview(body: string): { id?: string; status?: string; definitionType?: string } {
  const out: { id?: string; status?: string; definitionType?: string } = {};
  const grab = (label: string) => {
    const m = body.match(new RegExp(`^- \\*\\*${label}:\\*\\*\\s*\`?([^\`\\n]+?)\`?\\s*$`, "im"));
    return m ? m[1].trim() : undefined;
  };
  out.id = grab("ID"); out.status = grab("Status"); out.definitionType = grab("Definition type");
  return out;
}

function parseSchema(body: string): import("./types").SchemaField[] {
  const out: import("./types").SchemaField[] = [];
  const lines = body.split("\n"); let inSchema = false; let legacy = false;
  for (const ln of lines) {
    if (/^##?\s+Schema/i.test(ln)) { inSchema = true; continue; }
    if (!inSchema) continue;
    if (/^##?\s+/.test(ln)) break;
    if (!/^\s*\|/.test(ln)) continue;
    const cells = ln.split("|").slice(1, -1).map(c => c.trim());
    if (cells.length < 2) continue;
    const name = cells[0].replace(/`/g, "").trim();
    if (!name || name === "Column") {
      legacy = cells.some(c => /^pk$/i.test(c) || /^alias$/i.test(c)); // header row
      continue;
    }
    if (/^:?-+:?$/.test(name)) continue; // separator
    const type = (cells[1] || "STRING").replace(/`/g, "").trim() || "STRING";
    const field: import("./types").SchemaField = { name, type, pk: false };
    if (legacy) {
      field.pk = /^(✓|x|X)$/.test((cells[2] || "").trim());
      const alias = (cells[3] || "").trim(); const desc = (cells[4] || "").trim();
      if (alias) field.alias = alias;
      if (desc) field.description = desc;
    } else {
      let desc = (cells[2] || "").trim();
      if (/^PK\.\s*/.test(desc)) { field.pk = true; desc = desc.replace(/^PK\.\s*/, "").trim(); }
      if (desc) field.description = desc;
    }
    out.push(field);
  }
  return out;
}

function parseDefinition(body: string): string | null {
  const m = body.match(/^##?\s+Definition\s*\n+```[^\n]*\n([\s\S]*?)\n```/im);
  return m ? m[1].trim() : null;
}
