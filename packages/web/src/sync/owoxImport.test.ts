import { describe, it, expect } from "vitest";
import { selectMartIds, payloadToGraph, mergeGraphs, type ImportPayload } from "./owoxImport";
import type { ModelGraph } from "@mc/okf";

const mart = (id: string, status: string) => ({ id, title: id, status, schema: [], inputSource: "SQL" as const, definition: null });
const base: ImportPayload = {
  storageId: "st_1", total: 3, truncated: false,
  marts: [mart("a", "PUBLISHED"), mart("b", "DRAFT"), mart("c", "DRAFT")],
  relationships: [
    { sourceId: "a", targetId: "b", joinConditions: [{ sourceFieldName: "bid", targetFieldName: "id" }] },
    { sourceId: "b", targetId: "a", joinConditions: [{ sourceFieldName: "id", targetFieldName: "bid" }] },
  ],
};

describe("selectMartIds", () => {
  it("all → every mart", () => expect(selectMartIds(base, "all")).toEqual(new Set(["a", "b", "c"])));
  it("published → only published, then pulls related partners", () =>
    // "a" is published; it relates to "b", so pull-partner adds "b". "c" stays out.
    expect(selectMartIds(base, "published")).toEqual(new Set(["a", "b"])));
  it("with-relationships → only marts that have a relationship", () =>
    expect(selectMartIds(base, "with-relationships")).toEqual(new Set(["a", "b"])));
});

describe("payloadToGraph", () => {
  it("marts become created nodes with owoxId", () => {
    const g = payloadToGraph(base, "all");
    const a = g.nodes.find(n => n.owoxId === "a")!;
    expect(a.status).toBe("created");
    expect(g.storageId).toBe("st_1");
  });
  it("collapses A→B and B→A into one bidirectional edge", () => {
    const g = payloadToGraph(base, "all");
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].bidirectional).toBe(true);
  });
  it("drops edges to marts outside the selection", () => {
    const g = payloadToGraph(base, "published"); // a,b selected; both rel ends in set → 1 edge
    expect(g.nodes.map(n => n.owoxId).sort()).toEqual(["a", "b"]);
    expect(g.edges).toHaveLength(1);
  });
  it("drops a relationship whose target mart is excluded from the payload (dangling endpoint)", () => {
    // "c" is referenced by a relationship but never appears in payload.marts, so
    // pull-partner (gated on `present.has(...)`) cannot re-include it — the edge
    // lookup in payloadToGraph finds no key for "c" and must hit `if (!from || !to) continue`.
    const danglingPayload: ImportPayload = {
      storageId: "st_2", total: 1, truncated: false,
      marts: [mart("a", "PUBLISHED")],
      relationships: [
        { sourceId: "a", targetId: "c", joinConditions: [{ sourceFieldName: "cid", targetFieldName: "id" }] },
      ],
    };
    const g = payloadToGraph(danglingPayload, "all");
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes.some(n => n.owoxId === "c")).toBe(false);
    expect(g.edges).toHaveLength(0);
  });
});

describe("mergeGraphs", () => {
  it("updates a node with a matching owoxId in place (keeps position) and adds new ones", () => {
    const current: ModelGraph = { storageId: "st_1", nodes: [
      { key: "n1", title: "old", inputSource: "SQL", schema: [], position: { x: 50, y: 60 }, status: "created", owoxId: "a" },
    ], edges: [] };
    const incoming = payloadToGraph(base, "all");
    const { graph, newKeys } = mergeGraphs(current, incoming);
    const a = graph.nodes.find(n => n.owoxId === "a")!;
    expect(a.key).toBe("n1");                 // kept the existing node
    expect(a.position).toEqual({ x: 50, y: 60 }); // kept its position
    expect(graph.nodes.some(n => n.owoxId === "b")).toBe(true); // new node added
    expect(newKeys.has(a.key)).toBe(false);
    const b = graph.nodes.find(n => n.owoxId === "b")!;
    expect(newKeys.has(b.key)).toBe(true); // genuinely new node's key is reported
  });

  it("merges edges: skips a duplicate node-pair and appends a genuinely new one", () => {
    const current: ModelGraph = { storageId: "st_1", nodes: [
      { key: "n1", title: "old-a", inputSource: "SQL", schema: [], position: { x: 0, y: 0 }, status: "created", owoxId: "a" },
      { key: "n2", title: "old-b", inputSource: "SQL", schema: [], position: { x: 0, y: 0 }, status: "created", owoxId: "b" },
    ], edges: [
      { id: "e1", from: "n1", to: "n2", keys: [{ left: "bid", right: "id" }], bidirectional: false },
    ] };
    // Incoming payload: a→b duplicates the existing pair (must be skipped, not duplicated);
    // a→c is a new pair (c is a brand-new node) and must be appended with a fresh eN id.
    const incomingPayload: ImportPayload = {
      storageId: "st_1", total: 3, truncated: false,
      marts: [mart("a", "PUBLISHED"), mart("b", "DRAFT"), mart("c", "DRAFT")],
      relationships: [
        { sourceId: "a", targetId: "b", joinConditions: [{ sourceFieldName: "bid", targetFieldName: "id" }] },
        { sourceId: "a", targetId: "c", joinConditions: [{ sourceFieldName: "cid", targetFieldName: "id" }] },
      ],
    };
    const incoming = payloadToGraph(incomingPayload, "all");
    const { graph } = mergeGraphs(current, incoming);

    expect(graph.edges).toHaveLength(2); // duplicate a-b skipped, a-c appended
    const c = graph.nodes.find(n => n.owoxId === "c")!;
    const newEdge = graph.edges.find(e => e.id !== "e1")!;
    expect(newEdge.id).toBe("e2");
    expect([newEdge.from, newEdge.to].sort()).toEqual(["n1", c.key].sort());
  });
});
