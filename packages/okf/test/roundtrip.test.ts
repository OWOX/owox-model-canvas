import { describe, it, expect } from "vitest";
import { serializeBundle, parseBundle } from "../src/index";
import type { ModelGraph } from "../src/types";

const graph: ModelGraph = {
  storageId: "stor_1",
  nodes: [
    { key: "fb", title: "Facebook Ads", inputSource: "CONNECTOR", description: "ads",
      schema: [{ name: "campaign_id", type: "STRING", pk: false }], position: { x: 10, y: 20 },
      status: "pending", owoxId: null },
    { key: "camp", title: "Campaigns", inputSource: "VIEW", schema: [{ name: "id", type: "STRING", pk: true }],
      position: { x: 200, y: 20 }, status: "pending", owoxId: null },
  ],
  edges: [{ id: "e1", from: "fb", to: "camp", keys: [{ left: "campaign_id", right: "id" }], bidirectional: false }],
};

describe("okf round-trip", () => {
  it("serializes to files and parses back to an equivalent graph", () => {
    const bundle = serializeBundle(graph, "Demo");
    expect(Object.keys(bundle.files)).toContain("demo/index.md");
    expect(Object.keys(bundle.files)).toContain("demo/facebook-ads.md");
    expect(bundle.files["demo/facebook-ads.md"]).toContain("## Joins");
    const back = parseBundle(bundle.files);
    expect(back.nodes.map(n => n.key).sort()).toEqual(["campaigns", "facebook-ads"]);
    expect(back.edges).toHaveLength(1);
    expect(back.edges[0]).toMatchObject({ from: "facebook-ads", to: "campaigns", keys: [{ left: "campaign_id", right: "id" }] });
  });
  it("round-trips per-field description (alias is not preserved in the superset format), and reads the legacy 3-column form", () => {
    const g: ModelGraph = {
      storageId: null,
      nodes: [{
        key: "u", title: "Users", inputSource: "SQL", position: { x: 0, y: 0 }, status: "pending", owoxId: null,
        schema: [
          { name: "id", type: "STRING", pk: true, alias: "user_id", description: "Unique id" },
          { name: "email", type: "STRING", pk: false },
        ],
      }],
      edges: [],
    };
    const back = parseBundle(serializeBundle(g, "P").files);
    expect(back.nodes[0].schema).toEqual([
      { name: "id", type: "STRING", pk: true, description: "Unique id" },
      { name: "email", type: "STRING", pk: false },
    ]);
    // Legacy 3-column table still imports.
    const legacy = parseBundle({
      "p/a.md": frontless("a", "A") + "\n## Schema\n\n| Column | Type | PK |\n|--|--|--|\n| `x` | INTEGER | ✓ |\n",
    });
    expect(legacy.nodes[0].schema).toEqual([{ name: "x", type: "INTEGER", pk: true }]);
  });

  it("collapses mutual Joins lines into one bidirectional edge", () => {
    const files = {
      "p/a.md": frontless("a", "A") + "\n## Joins\n- [B](./b.md) — `x = y`\n",
      "p/b.md": frontless("b", "B") + "\n## Joins\n- [A](./a.md) — `y = x`\n",
    };
    const g = parseBundle(files);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].bidirectional).toBe(true);
  });
});
function frontless(key: string, title: string) {
  return `---\ntype: "OWOX Data Mart"\ntitle: "${title}"\nowox:\n  key: "${key}"\n  inputSource: "SQL"\n  position: { x: 0, y: 0 }\n---\n# ${title}`;
}

describe("serialize → parse round-trip (superset)", () => {
  const graph: ModelGraph = {
    storageId: null,
    nodes: [
      { key: "orders", title: "Orders", inputSource: "VIEW", status: "pending", owoxId: null, position: { x: 0, y: 0 },
        schema: [
          { name: "order_id", type: "STRING", pk: true, description: "Unique order id" },
          { name: "customer_id", type: "INTEGER", pk: false },
        ] },
      { key: "customers", title: "Customers", inputSource: "TABLE", status: "pending", owoxId: null, position: { x: 0, y: 0 },
        schema: [{ name: "id", type: "INTEGER", pk: true }] },
    ],
    edges: [{ id: "e1", from: "orders", to: "customers", keys: [{ left: "customer_id", right: "id" }], bidirectional: false }],
  };

  it("preserves nodes, PK, types and join keys", () => {
    const { files } = serializeBundle(graph, "Demo");
    const back = parseBundle(files);
    const orders = back.nodes.find(n => n.key === "orders")!;
    expect(orders.inputSource).toBe("VIEW");
    expect(orders.schema.find(f => f.name === "order_id")).toMatchObject({ pk: true, type: "STRING" });
    expect(back.edges).toHaveLength(1);
    expect(back.edges[0]).toMatchObject({ from: "orders", to: "customers", keys: [{ left: "customer_id", right: "id" }] });
  });

  it("keeps both nodes when two titles slugify to the same value", () => {
    const collidingGraph: ModelGraph = {
      storageId: null,
      nodes: [
        { key: "posts", title: "Posts Answers", inputSource: "SQL", status: "pending", owoxId: null, position: { x: 0, y: 0 },
          schema: [{ name: "id", type: "STRING", pk: true }] },
        { key: "answers", title: "Posts & Answers", inputSource: "SQL", status: "pending", owoxId: null, position: { x: 0, y: 0 },
          schema: [{ name: "post_id", type: "STRING", pk: false }] },
      ],
      edges: [{ id: "e1", from: "posts", to: "answers", keys: [{ left: "id", right: "post_id" }], bidirectional: false }],
    };

    const { files } = serializeBundle(collidingGraph, "Demo");
    const martFiles = Object.keys(files).filter(f => !f.endsWith("index.md"));
    expect(martFiles).toHaveLength(2);

    const back = parseBundle(files);
    expect(back.nodes).toHaveLength(2);
    const keys = back.nodes.map(n => n.key);
    expect(new Set(keys).size).toBe(2);

    expect(back.edges).toHaveLength(1);
    const edge = back.edges[0];
    expect(edge.from).not.toBe(edge.to);
    expect(keys).toContain(edge.from);
    expect(keys).toContain(edge.to);
  });
});

import { describe as descRt, it as itRt, expect as expRt } from "vitest";
import { serializeBundle as serRt, parseBundle as parRt } from "../src/index";
import type { ModelGraph as GraphRt, Cardinality as CardRt } from "../src/types";

descRt("cardinality round-trip", () => {
  const make = (cardinality: CardRt, bidirectional: boolean): GraphRt => ({
    storageId: null,
    nodes: [
      { key: "tx", title: "Transactions", inputSource: "TABLE", status: "pending", owoxId: null, position: { x: 0, y: 0 }, schema: [{ name: "block_hash", type: "STRING", pk: true }] },
      { key: "blocks", title: "Blocks", inputSource: "TABLE", status: "pending", owoxId: null, position: { x: 0, y: 0 }, schema: [{ name: "hash", type: "STRING", pk: true }] },
    ],
    edges: [{ id: "e1", from: "tx", to: "blocks", keys: [{ left: "block_hash", right: "hash" }], bidirectional, cardinality }],
  });

  for (const c of ["1:1", "1:N", "N:1", "N:N"] as CardRt[]) {
    itRt(`survives ${c} (one-way)`, () => {
      const back = parRt(serRt(make(c, false), "Demo").files);
      expRt(back.edges[0]).toMatchObject({ from: "transactions", to: "blocks", cardinality: c });
    });
    itRt(`survives ${c} (bidirectional, normalized to from→to)`, () => {
      const back = parRt(serRt(make(c, true), "Demo").files);
      expRt(back.edges[0].cardinality).toBe(c);
      expRt(back.edges[0].bidirectional).toBe(true);
    });
  }
});
