import type { ModelGraph, ModelNode, ModelEdge } from "@mc/okf";
let counter = 0; const uid = (p: string) => `${p}${++counter}`;
export function createModelStore(initial?: Partial<ModelGraph>) {
  let g: ModelGraph = { storageId: null, nodes: [], edges: [], ...initial } as ModelGraph;
  const subs = new Set<() => void>(); const emit = () => subs.forEach(f => f());
  return {
    get: () => g,
    subscribe: (f: () => void) => { subs.add(f); return () => subs.delete(f); },
    set: (next: ModelGraph) => { g = next; emit(); },
    addNode(position: { x: number; y: number }): ModelNode {
      const n: ModelNode = { key: uid("n"), title: "New object", inputSource: "SQL", schema: [], position, status: "pending", owoxId: null };
      g = { ...g, nodes: [...g.nodes, n] }; emit(); return n;
    },
    updateNode(key: string, patch: Partial<ModelNode>) { g = { ...g, nodes: g.nodes.map(n => n.key === key ? { ...n, ...patch } : n) }; emit(); },
    removeNode(key: string) { g = { ...g, nodes: g.nodes.filter(n => n.key !== key), edges: g.edges.filter(e => e.from !== key && e.to !== key) }; emit(); },
    addEdge(from: string, to: string): ModelEdge | null {
      if (from === to) return null;
      const pair = [from, to].sort().join("|");
      const existing = g.edges.find(e => [e.from, e.to].sort().join("|") === pair);
      if (existing) { g = { ...g, edges: g.edges.map(e => e === existing ? { ...e, bidirectional: true } : e) }; emit(); return existing; }
      const e: ModelEdge = { id: uid("e"), from, to, keys: [{ left: "", right: "" }], bidirectional: false };
      g = { ...g, edges: [...g.edges, e] }; emit(); return e;
    },
    updateEdge(id: string, patch: Partial<ModelEdge>) { g = { ...g, edges: g.edges.map(e => e.id === id ? { ...e, ...patch } : e) }; emit(); },
    removeEdge(id: string) { g = { ...g, edges: g.edges.filter(e => e.id !== id) }; emit(); },
  };
}
export type ModelStore = ReturnType<typeof createModelStore>;
