import type { ModelGraph } from "@mc/okf";

// Drop all OWOX-bound identity so the model becomes unpushed drafts again. Used
// on sign-out: a mart created/imported under one project must not look "already
// in OWOX" after switching projects. Preserves the actual model (titles, schema,
// positions, relationship keys) — only the push/created state is reset.
export function detachFromOwox(graph: ModelGraph): ModelGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(n => ({
      ...n, status: "pending", owoxId: null, owoxStorageId: null, createdAt: null, error: null,
    })),
    edges: graph.edges.map(e => ({ ...e, existing: false })),
  };
}
