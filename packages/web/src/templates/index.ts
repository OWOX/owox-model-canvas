import type { ModelGraph, ModelNode, ModelEdge, InputSource, SchemaField } from "@mc/okf";

// ── tiny authoring helpers ─────────────────────────────────────────────────
const f = (name: string, type: string, pk = false): SchemaField => ({ name, type, pk });
const mart = (key: string, title: string, inputSource: InputSource, schema: SchemaField[]): ModelNode =>
  ({ key, title, inputSource, schema, position: { x: 0, y: 0 }, status: "pending", owoxId: null });
const rel = (id: string, from: string, to: string, left: string, right: string, bidirectional = false): ModelEdge =>
  ({ id, from, to, keys: [{ left, right }], bidirectional });

export interface Template {
  id: string;
  name: string;
  description: string;
  graph: ModelGraph;
}

// Templates are authored as ModelGraph (the same shape OKF encodes), so they
// round-trip to an OKF bundle via Export OKF. Positions are 0,0 — the canvas
// runs Dagre auto-layout when a template is loaded.

const ecommerce: ModelGraph = {
  storageId: null,
  nodes: [
    mart("customers", "Customers", "VIEW", [f("id", "STRING", true), f("email", "STRING"), f("country", "STRING"), f("created_at", "TIMESTAMP")]),
    mart("products", "Products", "VIEW", [f("id", "STRING", true), f("name", "STRING"), f("category", "STRING"), f("price", "FLOAT")]),
    mart("orders", "Orders", "VIEW", [f("id", "STRING", true), f("customer_id", "STRING"), f("order_date", "DATE"), f("total", "FLOAT"), f("status", "STRING")]),
    mart("order_items", "Order Items", "VIEW", [f("id", "STRING", true), f("order_id", "STRING"), f("product_id", "STRING"), f("quantity", "INTEGER"), f("unit_price", "FLOAT")]),
    mart("sessions", "Sessions", "CONNECTOR", [f("id", "STRING", true), f("customer_id", "STRING"), f("source", "STRING"), f("started_at", "TIMESTAMP")]),
  ],
  edges: [
    rel("e1", "order_items", "orders", "order_id", "id"),
    rel("e2", "order_items", "products", "product_id", "id"),
    rel("e3", "orders", "customers", "customer_id", "id"),
    rel("e4", "sessions", "customers", "customer_id", "id"),
  ],
};

const saas: ModelGraph = {
  storageId: null,
  nodes: [
    mart("accounts", "Accounts", "VIEW", [f("id", "STRING", true), f("name", "STRING"), f("plan", "STRING"), f("created_at", "TIMESTAMP")]),
    mart("users", "Users", "VIEW", [f("id", "STRING", true), f("account_id", "STRING"), f("email", "STRING"), f("role", "STRING")]),
    mart("subscriptions", "Subscriptions", "VIEW", [f("id", "STRING", true), f("account_id", "STRING"), f("plan", "STRING"), f("mrr", "FLOAT"), f("status", "STRING")]),
    mart("invoices", "Invoices", "VIEW", [f("id", "STRING", true), f("subscription_id", "STRING"), f("amount", "FLOAT"), f("issued_at", "DATE"), f("paid", "BOOLEAN")]),
    mart("usage_events", "Usage Events", "CONNECTOR", [f("id", "STRING", true), f("user_id", "STRING"), f("event_name", "STRING"), f("occurred_at", "TIMESTAMP")]),
  ],
  edges: [
    rel("e1", "users", "accounts", "account_id", "id"),
    rel("e2", "subscriptions", "accounts", "account_id", "id"),
    rel("e3", "invoices", "subscriptions", "subscription_id", "id"),
    rel("e4", "usage_events", "users", "user_id", "id"),
  ],
};

const finance: ModelGraph = {
  storageId: null,
  nodes: [
    mart("customers", "Customers", "VIEW", [f("id", "STRING", true), f("name", "STRING"), f("segment", "STRING"), f("onboarded_at", "DATE")]),
    mart("branches", "Branches", "TABLE", [f("id", "STRING", true), f("name", "STRING"), f("city", "STRING")]),
    mart("accounts", "Accounts", "VIEW", [f("id", "STRING", true), f("customer_id", "STRING"), f("branch_id", "STRING"), f("type", "STRING"), f("balance", "FLOAT")]),
    mart("transactions", "Transactions", "CONNECTOR", [f("id", "STRING", true), f("account_id", "STRING"), f("amount", "FLOAT"), f("txn_type", "STRING"), f("txn_date", "DATE")]),
    mart("products", "Products", "TABLE", [f("id", "STRING", true), f("name", "STRING"), f("category", "STRING")]),
  ],
  edges: [
    rel("e1", "accounts", "customers", "customer_id", "id"),
    rel("e2", "accounts", "branches", "branch_id", "id"),
    rel("e3", "transactions", "accounts", "account_id", "id"),
  ],
};

const medical: ModelGraph = {
  storageId: null,
  nodes: [
    mart("patients", "Patients", "VIEW", [f("id", "STRING", true), f("full_name", "STRING"), f("birth_date", "DATE"), f("gender", "STRING")]),
    mart("doctors", "Doctors", "TABLE", [f("id", "STRING", true), f("full_name", "STRING"), f("specialty", "STRING")]),
    mart("appointments", "Appointments", "VIEW", [f("id", "STRING", true), f("patient_id", "STRING"), f("doctor_id", "STRING"), f("scheduled_at", "TIMESTAMP"), f("status", "STRING")]),
    mart("visits", "Visits", "VIEW", [f("id", "STRING", true), f("appointment_id", "STRING"), f("diagnosis", "STRING"), f("visit_date", "DATE")]),
    mart("invoices", "Invoices", "VIEW", [f("id", "STRING", true), f("visit_id", "STRING"), f("amount", "FLOAT"), f("paid", "BOOLEAN")]),
  ],
  edges: [
    rel("e1", "appointments", "patients", "patient_id", "id"),
    rel("e2", "appointments", "doctors", "doctor_id", "id"),
    rel("e3", "visits", "appointments", "appointment_id", "id"),
    rel("e4", "invoices", "visits", "visit_id", "id"),
  ],
};

const crypto_bitcoin: ModelGraph = {
  storageId: null,
  nodes: [
    mart("blocks", "Blocks", "TABLE", [
      f("hash", "STRING", true), f("number", "INTEGER"), f("size", "INTEGER"), f("weight", "INTEGER"),
      f("version", "INTEGER"), f("merkle_root", "STRING"), f("timestamp", "TIMESTAMP"),
      f("nonce", "STRING"), f("bits", "STRING"), f("transaction_count", "INTEGER"),
    ]),
    mart("transactions", "Transactions", "TABLE", [
      f("hash", "STRING", true), f("size", "INTEGER"), f("virtual_size", "INTEGER"), f("version", "INTEGER"),
      f("lock_time", "INTEGER"), f("block_hash", "STRING"), f("block_number", "INTEGER"),
      f("block_timestamp", "TIMESTAMP"), f("input_count", "INTEGER"), f("output_count", "INTEGER"),
      f("input_value", "NUMERIC"), f("output_value", "NUMERIC"), f("is_coinbase", "BOOLEAN"), f("fee", "NUMERIC"),
    ]),
    mart("inputs", "Inputs", "TABLE", [
      f("transaction_hash", "STRING"), f("block_hash", "STRING"), f("block_number", "INTEGER"),
      f("block_timestamp", "TIMESTAMP"), f("index", "INTEGER", true), f("spent_transaction_hash", "STRING"),
      f("spent_output_index", "INTEGER"), f("script_asm", "STRING"), f("sequence", "INTEGER"),
      f("type", "STRING"), f("value", "NUMERIC"),
    ]),
    mart("outputs", "Outputs", "TABLE", [
      f("transaction_hash", "STRING"), f("block_hash", "STRING"), f("block_number", "INTEGER"),
      f("block_timestamp", "TIMESTAMP"), f("index", "INTEGER", true), f("script_asm", "STRING"),
      f("type", "STRING"), f("value", "NUMERIC"),
    ]),
  ],
  edges: [
    rel("e1", "transactions", "blocks", "block_hash", "hash"),
    rel("e2", "inputs", "transactions", "transaction_hash", "hash"),
    rel("e3", "outputs", "transactions", "transaction_hash", "hash"),
  ],
};

export const TEMPLATES: Template[] = [
  { id: "ecommerce", name: "E-commerce", description: "Orders, products, customers and web sessions.", graph: ecommerce },
  { id: "saas", name: "SaaS", description: "Accounts, users, subscriptions, invoices and usage.", graph: saas },
  { id: "finance", name: "Finance", description: "Customers, accounts, transactions and branches.", graph: finance },
  { id: "medical", name: "Medical clinics", description: "Patients, doctors, appointments, visits and billing.", graph: medical },
  { id: "crypto_bitcoin", name: "Bitcoin (crypto)", description: "Blocks, transactions, inputs and outputs from the public Bitcoin BigQuery dataset.", graph: crypto_bitcoin },
];
