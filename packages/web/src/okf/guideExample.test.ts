import { describe, it, expect } from "vitest";
import { filesToGraph } from "./io";
import { parseBundle } from "@mc/okf";

// The exact worked example from public/okf-format.md (the AI authoring guide).
// This guards that the documented format — especially the Joins syntax — keeps
// importing correctly. If the parser or the guide drift, this fails.
const GUIDE_EXAMPLE = `
<!-- shop/customers.md -->
---
type: "OWOX Data Mart"
title: "Customers"
description: "One row per customer"
tags: ["owox", "view"]
---
# Customers

## Overview
- **ID:** \`—\`
- **Status:** DRAFT
- **Definition type:** VIEW
- **Storage:** —

# Schema
| Column | Type | Description |
|--------|------|-------------|
| \`id\` | STRING | PK. Unique customer id |
| \`email\` | STRING | Contact email |
| \`country\` | STRING | Billing country |

<!-- shop/products.md -->
---
type: "OWOX Data Mart"
title: "Products"
description: "One row per product"
tags: ["owox", "view"]
---
# Products

## Overview
- **ID:** \`—\`
- **Status:** DRAFT
- **Definition type:** VIEW
- **Storage:** —

# Schema
| Column | Type | Description |
|--------|------|-------------|
| \`id\` | STRING | PK. Unique product id |
| \`name\` | STRING | Product name |
| \`unit_price\` | NUMERIC | List price per unit |

<!-- shop/orders.md -->
---
type: "OWOX Data Mart"
title: "Orders"
description: "One row per order"
tags: ["owox", "sql"]
---
# Orders

## Overview
- **ID:** \`—\`
- **Status:** DRAFT
- **Definition type:** SQL
- **Storage:** —

# Schema
| Column | Type | Description |
|--------|------|-------------|
| \`id\` | STRING | PK. Unique order id |
| \`customer_id\` | STRING | FK to [Customers](./customers.md) |
| \`order_date\` | DATE | Date the order was placed |
| \`total\` | NUMERIC | Order total, gross |

## Joins
- [Customers](./customers.md) — \`customer_id = id\` [N:1]

<!-- shop/order-items.md -->
---
type: "OWOX Data Mart"
title: "Order Items"
description: "One row per order line item"
tags: ["owox", "view"]
---
# Order Items

## Overview
- **ID:** \`—\`
- **Status:** DRAFT
- **Definition type:** VIEW
- **Storage:** —

# Schema
| Column | Type | Description |
|--------|------|-------------|
| \`id\` | STRING | PK. Unique line-item id |
| \`order_id\` | STRING | FK to [Orders](./orders.md) |
| \`product_id\` | STRING | FK to [Products](./products.md) |
| \`quantity\` | INTEGER | Units purchased |
| \`unit_price\` | NUMERIC | Price charged per unit |

## Joins
- [Orders](./orders.md) — \`order_id = id\` [N:1]
- [Products](./products.md) — \`product_id = id\` [N:1]
`;

describe("okf authoring guide — worked example imports", () => {
  const graph = filesToGraph({ "pasted.md": GUIDE_EXAMPLE });

  it("parses 4 marts", () => {
    expect(graph.nodes.map(n => n.key).sort()).toEqual(["customers", "order-items", "orders", "products"]);
  });

  it("parses all 3 relationships with correct keys and direction", () => {
    const j = graph.edges.map(e => `${e.from}->${e.to}:${e.keys.map(k => `${k.left}=${k.right}`).join(",")}`).sort();
    expect(j).toEqual([
      "order-items->orders:order_id=id",
      "order-items->products:product_id=id",
      "orders->customers:customer_id=id",
    ]);
  });

  it("marks primary keys and parses cardinality", () => {
    const orders = graph.nodes.find(n => n.key === "orders")!;
    expect(orders.schema.find(f => f.name === "id")?.pk).toBe(true);
    const oiToOrders = graph.edges.find(e => e.from === "order-items" && e.to === "orders")!;
    expect(oiToOrders.cardinality).toBe("N:1");
  });
});
