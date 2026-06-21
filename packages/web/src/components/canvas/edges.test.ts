import { describe, it, expect } from "vitest";
import type { ModelNode, ModelEdge } from "@mc/okf";
import { buildRfEdges, isEdgeReconnectable } from "./edges";

const field = (name: string) => ({ name, type: "STRING", pk: false });
const node = (key: string, fields: string[]): ModelNode => ({
  key, title: key, inputSource: "VIEW", schema: fields.map(field),
  position: { x: 0, y: 0 }, status: "created", owoxId: null,
});

const nodes = [node("a", ["id", "x"]), node("b", ["a_id", "y"])];

function edge(keys: { left: string; right: string }[]): ModelEdge {
  return { id: "e1", from: "a", to: "b", keys, bidirectional: false, sourceHandle: "right", targetHandle: "left" };
}

describe("buildRfEdges", () => {
  it("compact: one edge per model edge using the stored handles", () => {
    const out = buildRfEdges([edge([{ left: "id", right: "a_id" }])], nodes, "compact");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("e1");
    expect(out[0].sourceHandle).toBe("right");
    expect(out[0].targetHandle).toBe("left");
  });

  it("erd: one edge per join key anchored to the field handles", () => {
    const out = buildRfEdges(
      [edge([{ left: "id", right: "a_id" }, { left: "x", right: "y" }])],
      nodes, "erd",
    );
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("e1::0");
    expect(out[0].sourceHandle).toBe("fr:id");
    expect(out[0].targetHandle).toBe("fl:a_id");
    expect(out[1].sourceHandle).toBe("fr:x");
    expect(out[1].targetHandle).toBe("fl:y");
  });

  it("erd: keeps the stored handle side (left source / right target) instead of forcing fr/fl", () => {
    const e: ModelEdge = {
      id: "e1", from: "a", to: "b", keys: [{ left: "id", right: "a_id" }],
      bidirectional: false, sourceHandle: "left", targetHandle: "right",
    };
    const out = buildRfEdges([e], nodes, "erd");
    expect(out[0].sourceHandle).toBe("fl:id");
    expect(out[0].targetHandle).toBe("fr:a_id");
  });

  it("erd: falls back to node-level handles when a key field is missing", () => {
    const out = buildRfEdges([edge([{ left: "id", right: "nope" }])], nodes, "erd");
    expect(out).toHaveLength(1);
    expect(out[0].sourceHandle).toBe("fr:id");
    expect(out[0].targetHandle).toBe("left");
  });

  it("erd: an edge with no usable keys yields a single node-level fallback edge", () => {
    const out = buildRfEdges([edge([{ left: "", right: "" }])], nodes, "erd");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("e1");
    expect(out[0].sourceHandle).toBe("right");
    expect(out[0].targetHandle).toBe("left");
  });
});

describe("buildRfEdges cardinality passthrough", () => {
  const nodes: ModelNode[] = [
    { key: "a", title: "A", inputSource: "TABLE", status: "pending", owoxId: null, position: { x: 0, y: 0 }, schema: [{ name: "x", type: "STRING", pk: true }] },
    { key: "b", title: "B", inputSource: "TABLE", status: "pending", owoxId: null, position: { x: 0, y: 0 }, schema: [{ name: "y", type: "STRING", pk: true }] },
  ];
  const edges: ModelEdge[] = [{ id: "e1", from: "a", to: "b", keys: [{ left: "x", right: "y" }], bidirectional: false, cardinality: "N:1" }];

  it("includes cardinality in compact edge data", () => {
    const rf = buildRfEdges(edges, nodes, "compact");
    expect((rf[0].data as any).cardinality).toBe("N:1");
  });
  it("includes cardinality in ERD edge data", () => {
    const rf = buildRfEdges(edges, nodes, "erd");
    expect((rf[0].data as any).cardinality).toBe("N:1");
  });
});

describe("isEdgeReconnectable (only the selected relationship reconnects)", () => {
  it("is true for the selected edge in compact mode", () => {
    expect(isEdgeReconnectable("e1", "e1", "compact")).toBe(true);
  });
  it("is false for a non-selected edge", () => {
    expect(isEdgeReconnectable("e2", "e1", "compact")).toBe(false);
  });
  it("is false when nothing is selected", () => {
    expect(isEdgeReconnectable("e1", null, "compact")).toBe(false);
  });
  it("is false in ERD mode even for the selected edge (reconnect disabled there)", () => {
    expect(isEdgeReconnectable("e1", "e1", "erd")).toBe(false);
  });
  it("is false when the edge has no modelEdgeId", () => {
    expect(isEdgeReconnectable(undefined, "e1", "compact")).toBe(false);
  });
});
