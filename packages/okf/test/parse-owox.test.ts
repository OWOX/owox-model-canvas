import { describe, it, expect } from "vitest";
import { parseBundle } from "../src/parse";

const customers = `---
type: "OWOX Data Mart"
title: "Customers"
tags: ["owox", "view"]
---

# Customers

## Overview
- **ID:** \`abc-123\`
- **Status:** PUBLISHED
- **Definition type:** VIEW

# Schema

| Column | Type | Description |
|--------|------|-------------|
| \`id\` | INTEGER | PK. Customer id |
`;

const ordersSuperset = `---
type: "OWOX Data Mart"
title: "Orders"
tags: ["owox", "view"]
---

# Orders

## Overview
- **ID:** \`—\`
- **Status:** DRAFT
- **Definition type:** VIEW

# Schema

| Column | Type | Description |
|--------|------|-------------|
| \`order_id\` | STRING | PK. Unique order id |
| \`customer_id\` | INTEGER | FK to [Customers](./customers.md) |

## Joins

- [Customers](./customers.md) — \`customer_id = id\`
`;

// Faithful-OWOX: Joins bullet has NO keys; recovered from FK note + target PK.
const ordersFaithful = ordersSuperset.replace("— \`customer_id = id\`", "");

describe("parseBundle (OWOX format)", () => {
  it("reads PK from the PK. token and identity from Overview", () => {
    const g = parseBundle({ "b/customers.md": customers });
    const n = g.nodes[0];
    expect(n.owoxId).toBe("abc-123");
    expect(n.status).toBe("created");
    expect(n.inputSource).toBe("VIEW");
    expect(n.schema[0]).toMatchObject({ name: "id", type: "INTEGER", pk: true, description: "Customer id" });
  });

  it("reads superset join keys", () => {
    const g = parseBundle({ "b/customers.md": customers, "b/orders.md": ordersSuperset });
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toMatchObject({ from: "orders", to: "customers", keys: [{ left: "customer_id", right: "id" }] });
  });

  it("recovers keys for keyless OWOX joins via FK note + target PK", () => {
    const g = parseBundle({ "b/customers.md": customers, "b/orders.md": ordersFaithful });
    expect(g.edges[0].keys).toEqual([{ left: "customer_id", right: "id" }]);
  });
});

const customersCard = `---
type: "OWOX Data Mart"
title: "Blocks"
tags: ["owox", "table"]
---
# Blocks
# Schema
| Column | Type | Description |
|--------|------|-------------|
| \`hash\` | STRING | PK. id |
`;
const txCard = `---
type: "OWOX Data Mart"
title: "Transactions"
tags: ["owox", "table"]
---
# Transactions
# Schema
| Column | Type | Description |
|--------|------|-------------|
| \`block_hash\` | STRING | PK. h |

## Joins
- [Blocks](./blocks.md) — \`block_hash = hash\` [N:1]
`;

describe("parse cardinality", () => {
  it("reads the [N:1] suffix onto the edge", () => {
    const g = parseBundle({ "b/blocks.md": customersCard, "b/transactions.md": txCard });
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toMatchObject({ from: "transactions", to: "blocks", cardinality: "N:1" });
  });

  it("leaves cardinality undefined when absent", () => {
    const txNo = txCard.replace(" [N:1]", "");
    const g = parseBundle({ "b/blocks.md": customersCard, "b/transactions.md": txNo });
    expect(g.edges[0].cardinality).toBeUndefined();
  });
});
