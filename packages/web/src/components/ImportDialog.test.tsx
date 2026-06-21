import { describe, it, expect } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { bundleToZip, filesToGraph } from "../okf/io";

// Logic-level: a zipped OWOX bundle round-trips into a ModelGraph.
describe("import zipped bundle", () => {
  it("turns a zipped bundle into a graph", () => {
    const md = `---\ntype: "OWOX Data Mart"\ntitle: "Customers"\ntags: ["owox", "table"]\n---\n\n# Customers\n\n## Overview\n- **Definition type:** TABLE\n\n# Schema\n\n| Column | Type | Description |\n|--------|------|-------------|\n| \`id\` | INTEGER | PK. id |\n`;
    const zip = bundleToZip({ "b/index.md": "# B\n", "b/customers.md": md });
    const files: Record<string, string> = {};
    for (const [p, bytes] of Object.entries(unzipSync(zip))) files[p] = strFromU8(bytes as Uint8Array);
    const g = filesToGraph(files);
    expect(g.nodes.map((n) => n.title)).toContain("Customers");
    expect(g.nodes[0].schema[0]).toMatchObject({ name: "id", pk: true });
  });
});
