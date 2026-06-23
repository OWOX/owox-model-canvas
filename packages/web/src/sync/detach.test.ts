import { describe, it, expect } from "vitest";
import { detachFromOwox } from "./detach";
import type { ModelGraph } from "@mc/okf";

const g: ModelGraph = {
  storageId: "st_1",
  nodes: [
    { key: "n1", title: "Orders", inputSource: "SQL", schema: [{ name: "id", type: "STRING", pk: true }], position: { x: 5, y: 6 }, status: "created", owoxId: "owox_a", owoxStorageId: "st_1", createdAt: "2026-06-23T00:00:00Z", error: "x" },
  ],
  edges: [
    { id: "e1", from: "n1", to: "n1", keys: [{ left: "a", right: "b" }], bidirectional: true, existing: true },
  ],
};

describe("detachFromOwox", () => {
  it("clears OWOX identity on nodes (status pending, owoxId/owoxStorageId/createdAt/error null)", () => {
    const out = detachFromOwox(g);
    const n = out.nodes[0];
    expect(n.status).toBe("pending");
    expect(n.owoxId).toBeNull();
    expect(n.owoxStorageId).toBeNull();
    expect(n.createdAt).toBeNull();
    expect(n.error).toBeNull();
  });
  it("clears edge.existing", () => {
    expect(detachFromOwox(g).edges[0].existing).toBe(false);
  });
  it("preserves position, title, schema, keys, storageId", () => {
    const out = detachFromOwox(g);
    expect(out.nodes[0].position).toEqual({ x: 5, y: 6 });
    expect(out.nodes[0].title).toBe("Orders");
    expect(out.nodes[0].schema).toEqual([{ name: "id", type: "STRING", pk: true }]);
    expect(out.edges[0].keys).toEqual([{ left: "a", right: "b" }]);
    expect(out.storageId).toBe("st_1");
  });
  it("does not mutate the input graph", () => {
    detachFromOwox(g);
    expect(g.nodes[0].owoxId).toBe("owox_a");
  });
});
