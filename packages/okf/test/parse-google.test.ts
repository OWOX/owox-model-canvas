import { describe, it, expect } from "vitest";
import { parseBundle } from "../src/parse";
import { loadBundle } from "./fixtures-loader";

describe("Google OKF v0.1 — marts", () => {
  it("ingests only BigQuery Table docs from GA4, mapping type to inputSource", () => {
    const g = parseBundle(loadBundle("ga4"));
    expect(g.nodes.map(n => n.key)).toEqual(["events_"]);
    expect(g.nodes[0].inputSource).toBe("TABLE");
  });

  it("ingests all four Bitcoin tables and no dataset docs", () => {
    const g = parseBundle(loadBundle("crypto_bitcoin"));
    expect(g.nodes.map(n => n.key).sort()).toEqual(["blocks", "inputs", "outputs", "transactions"]);
  });

  it("filters Stack Overflow's 32 reference lookup docs, keeping 16 tables", () => {
    const g = parseBundle(loadBundle("stackoverflow"));
    expect(g.nodes).toHaveLength(16);
    expect(g.nodes.map(n => n.key)).toContain("users");
    expect(g.nodes.map(n => n.key)).not.toContain("badge_classes");
  });
});
