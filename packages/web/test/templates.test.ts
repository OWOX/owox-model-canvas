import { describe, it, expect } from "vitest";
import { TEMPLATES } from "../src/templates";
import { serializeBundle, parseBundle } from "@mc/okf";

describe("templates", () => {
  it("ships the four base models", () => {
    expect(TEMPLATES.map(t => t.id).sort()).toEqual(["crypto_bitcoin", "ecommerce", "finance", "medical", "saas"]);
  });

  for (const t of TEMPLATES) {
    describe(t.name, () => {
      const keys = new Set(t.graph.nodes.map(n => n.key));

      it("every node has fields and a primary key", () => {
        for (const n of t.graph.nodes) {
          expect(n.schema.length, `${n.title} has fields`).toBeGreaterThan(0);
          expect(n.schema.some(f => f.pk), `${n.title} has a PK`).toBe(true);
        }
      });

      it("every edge references existing nodes with complete join keys", () => {
        for (const e of t.graph.edges) {
          expect(keys.has(e.from), `${e.id} from`).toBe(true);
          expect(keys.has(e.to), `${e.id} to`).toBe(true);
          expect(e.keys.every(k => k.left && k.right)).toBe(true);
        }
      });

      it("round-trips through OKF", () => {
        const g = parseBundle(serializeBundle(t.graph, t.name).files);
        expect(g.nodes.length).toBe(t.graph.nodes.length);
        expect(g.edges.length).toBe(t.graph.edges.length);
      });
    });
  }
});

it("crypto_bitcoin template resolves all edges and FK columns", () => {
  const t = TEMPLATES.find(x => x.id === "crypto_bitcoin")!;
  expect(t).toBeTruthy();
  const keys = new Set(t.graph.nodes.map(n => n.key));
  for (const e of t.graph.edges) {
    expect(keys.has(e.from)).toBe(true);
    expect(keys.has(e.to)).toBe(true);
    const from = t.graph.nodes.find(n => n.key === e.from)!;
    const to = t.graph.nodes.find(n => n.key === e.to)!;
    for (const k of e.keys) {
      expect(from.schema.some(s => s.name === k.left)).toBe(true);
      expect(to.schema.some(s => s.name === k.right)).toBe(true);
    }
  }
});
