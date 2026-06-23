import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { strFromU8, unzipSync } from "fflate";
import { bundleToZip, filesToGraph } from "../okf/io";
import { ImportDialog } from "./ImportDialog";

const PASTE = `<!-- customers.md -->
---
type: "OWOX Data Mart"
title: "Customers"
tags: ["owox", "table"]
---

# Customers

## Overview
- **Definition type:** TABLE

# Schema

| Column | Type | Description |
|--------|------|-------------|
| \`id\` | INTEGER | PK. id |
`;

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

describe("ImportDialog UI", () => {
  it("previews counts after paste and confirms with the chosen mode", async () => {
    const onConfirm = vi.fn();
    render(<ImportDialog onConfirm={onConfirm} onClose={() => {}} />);
    // No preview/counts before any input.
    expect(screen.queryByText(/Will import/i)).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/path\/to\/file\.md/i), { target: { value: PASTE } });
    await waitFor(() => expect(screen.getByText(/Will import 1 marts, 0 relationships/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/Merge into the canvas/i));
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [graph, mode] = onConfirm.mock.calls[0];
    expect(graph.nodes.map((n: { title: string }) => n.title)).toContain("Customers");
    expect(graph.nodes[0].status).toBe("pending");
    expect(mode).toBe("merge");
  });
});
