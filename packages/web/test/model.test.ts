import { describe, it, expect } from "vitest";
import { createModelStore } from "../src/state/model";
describe("model store", () => {
  it("adds a node defaulting to SQL + pending", () => {
    const s = createModelStore();
    const n = s.addNode({ x: 10, y: 20 });
    expect(n.inputSource).toBe("SQL"); expect(n.status).toBe("pending");
    expect(s.get().nodes).toHaveLength(1);
  });
  it("blocks self-links and collapses mutual edges to bidirectional", () => {
    const s = createModelStore();
    const a = s.addNode({ x: 0, y: 0 }); const b = s.addNode({ x: 1, y: 1 });
    expect(s.addEdge(a.key, a.key)).toBeNull();
    const e = s.addEdge(a.key, b.key)!; expect(e.bidirectional).toBe(false);
    s.addEdge(b.key, a.key);
    expect(s.get().edges).toHaveLength(1);
    expect(s.get().edges[0].bidirectional).toBe(true);
  });
});
