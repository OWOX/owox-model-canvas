import type { ModelGraph, ModelNode } from "./types";
import { slugify, renderFrontmatter } from "./slug";

export interface OkfBundle { files: Record<string, string>; }

export function serializeBundle(graph: ModelGraph, projectTitle = "Data Marts"): OkfBundle {
  const folder = slugify(projectTitle, "data-marts");
  const slugByKey = new Map(graph.nodes.map(n => [n.key, slugify(n.title, n.key)]));
  const files: Record<string, string> = {};
  for (const n of graph.nodes) files[`${folder}/${slugByKey.get(n.key)}.md`] = renderNode(n, graph, slugByKey);
  const rows = graph.nodes.map(n => `| [${n.title}](./${slugByKey.get(n.key)}.md) | ${n.inputSource} |`).join("\n");
  files[`${folder}/index.md`] =
    `---\n${renderFrontmatter({ type: "index", title: projectTitle, tags: ["owox", "index"] })}\n---\n\n# ${projectTitle}\n\n| Data Mart | Input source |\n|-----------|------|\n${rows}\n`;
  return { files };
}

function renderNode(n: ModelNode, g: ModelGraph, slugByKey: Map<string, string>): string {
  const fm = renderFrontmatter({
    type: "OWOX Data Mart", title: n.title, description: n.description || undefined,
    tags: ["owox", n.inputSource.toLowerCase()],
    owox: { key: n.key, inputSource: n.inputSource, storageId: g.storageId ?? undefined,
      status: n.status === "created" ? "PUBLISHED" : "DRAFT", id: n.owoxId ?? null, position: n.position },
  });
  const schema = n.schema.length
    ? "\n## Schema\n\n| Column | Type | PK |\n|--------|------|----|\n" +
      n.schema.map(f => `| \`${f.name}\` | ${f.type} | ${f.pk ? "✓" : ""} |`).join("\n") + "\n"
    : "";
  const definition = n.definition && n.definition.trim()
    ? `\n## Definition\n\n\`\`\`${n.inputSource === "SQL" ? "sql" : "text"}\n${n.definition.trim()}\n\`\`\`\n`
    : "";
  const outgoing = g.edges.filter(e => e.from === n.key || (e.bidirectional && e.to === n.key));
  const joins = outgoing.length
    ? "\n## Joins\n\n" + outgoing.map(e => {
        const otherKey = e.from === n.key ? e.to : e.from;
        const other = g.nodes.find(x => x.key === otherKey)!;
        const keys = (e.from === n.key ? e.keys : e.keys.map(k => ({ left: k.right, right: k.left })));
        const cond = keys.map(k => `\`${k.left} = ${k.right}\``).join(", ");
        return `- [${other.title}](./${slugByKey.get(otherKey)}.md) — ${cond}`;
      }).join("\n") + "\n"
    : "";
  return `---\n${fm}\n---\n\n# ${n.title}\n${n.description ? "\n" + n.description + "\n" : ""}${schema}${definition}${joins}`;
}
