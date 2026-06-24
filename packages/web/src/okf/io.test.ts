import { describe, it, expect } from "vitest";
import { bundleToZip, zipToFiles, graphToBundleFiles } from "./io";
import type { ModelGraph } from "@mc/okf";

describe("zip round-trip", () => {
  it("zips and unzips bundle files losslessly", () => {
    const files = { "demo/index.md": "# Demo\n", "demo/orders.md": "# Orders\n" };
    const buf = bundleToZip(files);
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(zipToFiles(buf)).toEqual(files);
  });
});

describe("graphToBundleFiles", () => {
  const graph: ModelGraph = {
    storageId: null,
    nodes: [{ key: "orders", title: "Orders", inputSource: "VIEW", schema: [{ name: "id", type: "STRING", pk: true }], position: { x: 0, y: 0 }, status: "pending", owoxId: null }],
    edges: [],
  };

  it("appends an OWOX attribution footer to the bundle index only", () => {
    const files = graphToBundleFiles(graph, "Demo");
    const indexKey = Object.keys(files).find(k => k.endsWith("index.md"))!;
    expect(files[indexKey]).toContain("Generated with");
    expect(files[indexKey]).toContain("OWOX Data Marts");
    expect(files[indexKey]).toContain("github.com/OWOX/canvas-model-editor");
    const martKey = Object.keys(files).find(k => k.endsWith("orders.md"))!;
    expect(files[martKey]).not.toContain("Generated with"); // per-mart docs stay clean
  });
});
