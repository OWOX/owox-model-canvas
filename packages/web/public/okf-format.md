# OWOX Model Canvas — OKF authoring guide for AI agents

Use this to generate a data model in **OKF (Open Knowledge Format)** that imports cleanly into **OWOX Model Canvas** (https://model.owox.com) and pushes to OWOX Data Marts in one click.

**How the user will use your output:** they open **Import** on the canvas, paste your text (or upload a `.zip`), review the rendered graph, then **Push to OWOX**.

---

## ⚠️ Read first — the 3 rules that make relationships (Joins) work

Most failed imports come from getting Joins wrong. Follow these exactly:

1. **One file per Data Mart, separated by markers.** A single blob with no markers is read as ONE mart, so nothing can join. When pasting, put each document after a `<!-- path/slug.md -->` comment (see “Packaging”). Each mart's file name is its **slug** = the title lowercased with spaces → hyphens (e.g. `Order Items` → `order-items.md`).

2. **A Join link must point to the target mart's exact file name.** Format:
   `- [Target Title](./target-slug.md) — ` + a backticked key.
   The `target-slug` in `(./target-slug.md)` MUST equal the target's file name. If `Customers` lives in `customers.md`, the link is `(./customers.md)` — not `(./customer.md)`, not `(./customers-ecommerce.md)`.

3. **Join keys must be wrapped in backticks**: `` `left_field = right_field` ``. Without backticks the keys are not parsed. Both fields should exist in their marts' `# Schema`.

✅ Correct:
```
## Joins
- [Customers](./customers.md) — `customer_id = id`
```
❌ Wrong (no backticks, slug ≠ filename, missing `./` or `.md`):
```
## Joins
- [Customers](customers) — customer_id = id
```

---

## Packaging — two ways to deliver the model

Both use the same per-document format; they differ only in how the documents are bundled.

### A — Single file / paste (recommended for chat)
Put every document in one block, each preceded by a `<!-- path/slug.md -->` marker:

```
<!-- shop/customers.md -->
---
type: "OWOX Data Mart"
title: "Customers"
tags: ["owox", "view"]
---
# Customers
...

<!-- shop/orders.md -->
---
type: "OWOX Data Mart"
title: "Orders"
tags: ["owox", "sql"]
---
# Orders
...
```
The user pastes the whole thing into **Import**.

### B — ZIP bundle
A folder with an `index.md` plus one `<slug>.md` per mart, zipped. This is exactly what **Export OKF** downloads, so anything the canvas exports round-trips back in.

---

## Anatomy of a Data Mart document

```
---
type: "OWOX Data Mart"
title: "Orders"
description: "One row per order"
tags: ["owox", "sql"]          # 2nd tag = input source (lowercased)
---
# Orders
One row per order, used for revenue and retention.

## Overview
- **ID:** `—`                  # leave as — ; filled after Push
- **Status:** DRAFT
- **Definition type:** SQL      # SQL | CONNECTOR | VIEW | TABLE — sets the input source
- **Storage:** —               # leave as — ; the canvas applies the selected storage

# Schema
| Column | Type | Description |
|--------|------|-------------|
| `id` | STRING | PK. Unique order identifier |
| `customer_id` | STRING | FK to [Customers](./customers.md) |
| `order_date` | DATE | |
| `total` | FLOAT | Order total, gross |

## Definition
```sql
SELECT id, customer_id, order_date, total FROM `project.dataset.orders`
```

## Joins
- [Customers](./customers.md) — `customer_id = id`
```

### Frontmatter
- `type` — always `"OWOX Data Mart"`.
- `title` — the mart's display name. Its **slug** (lowercase, spaces → hyphens) is the file name AND what Joins link to, so **keep titles distinct**.
- `description` — one-line summary (optional).
- `tags` — `["owox", "<input source lowercased>"]`, e.g. `["owox","view"]`.

### `## Overview`
- `**Definition type:**` — `SQL | CONNECTOR | VIEW | TABLE`. This sets the input source.
- Leave `**ID:**` and `**Storage:**` as `—` — the canvas fills them.

### `# Schema` (the mart's output fields)
A 3-column table: **Column** (name in backticks), **Type**, **Description**.
- **Primary key:** start the Description with `PK.` — e.g. `PK. Unique id`. Mark exactly one PK per mart.
- **Foreign key:** write `FK to [Target Title](./target-slug.md)` in the Description. (Helps relationships and documentation.)
- **Allowed types only** (cross-storage set — do NOT use others like DATETIME):
  `STRING` `INTEGER` `FLOAT` `NUMERIC` `BOOLEAN` `DATE` `TIME` `TIMESTAMP` `BYTES` `GEOGRAPHY` `VARIANT`

### `## Definition` (optional)
A fenced code block; its meaning follows the Definition type:
- **SQL** — a query in a ```` ```sql ```` fence.
- **TABLE** — a fully-qualified table name (e.g. `project.dataset.table`).
- **VIEW** — a fully-qualified view name (a reference, not a query).
- **CONNECTOR** — omit; configured in OWOX after creation.

### `## Joins` (relationships) — put on the SOURCE mart
- One bullet per relationship: `- [Target Title](./target-slug.md) — ` + backticked key(s).
- **Multiple keys:** comma-separate the backticked pairs — `` `a = a2`, `b = b2` ``.
- **Cardinality (optional):** append `[1:1]`, `[1:N]`, `[N:1]` or `[N:N]` after the keys, oriented source → target — e.g. `` — `order_id = id` [N:1] ``. Visual only; ignored by OWOX.
- **Bidirectional:** add a matching Joins line in the OTHER document with the key sides swapped. Renders as a double-headed arrow.

---

## Common mistakes (checklist before you hand it over)
- [ ] Every mart is its **own** document with a `<!-- path/slug.md -->` marker (or its own file in the zip).
- [ ] Each Join link `(./slug.md)` matches a real file's name **exactly**.
- [ ] Every Join key is **backticked**: `` `left = right` ``.
- [ ] Join fields exist in **both** marts' `# Schema`.
- [ ] Exactly **one** `PK.` field per mart; only **allowed types** used.
- [ ] `ID` and `Storage` left as `—`.

---

## Complete worked example (copy-paste-ready)

```
<!-- shop/customers.md -->
---
type: "OWOX Data Mart"
title: "Customers"
description: "One row per customer"
tags: ["owox", "view"]
---
# Customers

## Overview
- **ID:** `—`
- **Status:** DRAFT
- **Definition type:** VIEW
- **Storage:** —

# Schema
| Column | Type | Description |
|--------|------|-------------|
| `id` | STRING | PK. Unique customer id |
| `email` | STRING | Contact email |
| `country` | STRING | Billing country |

<!-- shop/products.md -->
---
type: "OWOX Data Mart"
title: "Products"
description: "One row per product"
tags: ["owox", "view"]
---
# Products

## Overview
- **ID:** `—`
- **Status:** DRAFT
- **Definition type:** VIEW
- **Storage:** —

# Schema
| Column | Type | Description |
|--------|------|-------------|
| `id` | STRING | PK. Unique product id |
| `name` | STRING | Product name |
| `unit_price` | NUMERIC | List price per unit |

<!-- shop/orders.md -->
---
type: "OWOX Data Mart"
title: "Orders"
description: "One row per order"
tags: ["owox", "sql"]
---
# Orders

## Overview
- **ID:** `—`
- **Status:** DRAFT
- **Definition type:** SQL
- **Storage:** —

# Schema
| Column | Type | Description |
|--------|------|-------------|
| `id` | STRING | PK. Unique order id |
| `customer_id` | STRING | FK to [Customers](./customers.md) |
| `order_date` | DATE | Date the order was placed |
| `total` | NUMERIC | Order total, gross |

## Definition
```sql
SELECT id, customer_id, order_date, total FROM `project.dataset.orders`
```

## Joins
- [Customers](./customers.md) — `customer_id = id` [N:1]

<!-- shop/order-items.md -->
---
type: "OWOX Data Mart"
title: "Order Items"
description: "One row per order line item"
tags: ["owox", "view"]
---
# Order Items

## Overview
- **ID:** `—`
- **Status:** DRAFT
- **Definition type:** VIEW
- **Storage:** —

# Schema
| Column | Type | Description |
|--------|------|-------------|
| `id` | STRING | PK. Unique line-item id |
| `order_id` | STRING | FK to [Orders](./orders.md) |
| `product_id` | STRING | FK to [Products](./products.md) |
| `quantity` | INTEGER | Units purchased |
| `unit_price` | NUMERIC | Price charged per unit |

## Joins
- [Orders](./orders.md) — `order_id = id` [N:1]
- [Products](./products.md) — `product_id = id` [N:1]
```

That's a complete, valid model: four marts, three relationships. The user pastes it into **Import**, picks a Storage, and clicks **Push to OWOX**.
