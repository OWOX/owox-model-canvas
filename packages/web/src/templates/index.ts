import type { ModelGraph, ModelNode, ModelEdge, InputSource, SchemaField } from "@mc/okf";

// ── tiny authoring helpers ─────────────────────────────────────────────────
const f = (name: string, type: string, pk = false, description?: string): SchemaField =>
  ({ name, type, pk, ...(description ? { description } : {}) });
const mart = (
  key: string,
  title: string,
  inputSource: InputSource,
  schema: SchemaField[],
  description?: string,
): ModelNode =>
  ({ key, title, inputSource, description, schema, position: { x: 0, y: 0 }, status: "pending", owoxId: null });
// Edges carry cardinality so the ERD/OKF export reads like a real star schema.
// Default N:1 because the common case is a fact row pointing at one dimension.
const rel = (
  id: string,
  from: string,
  to: string,
  left: string,
  right: string,
  cardinality: ModelEdge["cardinality"] = "N:1",
  bidirectional = false,
): ModelEdge => ({ id, from, to, keys: [{ left, right }], bidirectional, cardinality });

export interface Template {
  id: string;
  name: string;
  description: string;
  graph: ModelGraph;
}

// Templates are authored as ModelGraph (the same shape OKF encodes), so they
// round-trip to an OKF bundle via Export OKF. Positions are 0,0 — the canvas
// runs Dagre auto-layout when a template is loaded.

// E-commerce / Retail — Kimball-style sales star. fct_order_items is the lowest
// grain (order × SKU) where true line margin lives; fct_orders keeps the header
// totals; sessions and returns hang off the same conformed customer/product dims.
const ecommerce: ModelGraph = {
  storageId: null,
  nodes: [
    mart("dim_customer", "Customer", "VIEW", [
      f("customer_id", "STRING", true, "Surrogate customer key."),
      f("email", "STRING", false, "Primary contact address used for login and outreach."),
      f("country", "STRING", false, "Customer's country, used for geo segmentation."),
      f("region", "STRING", false, "Sub-national region or state within the country."),
      f("acquisition_channel", "STRING", false, "First-touch channel that won the customer."),
      f("first_order_date", "DATE", false, "Date of the customer's very first purchase."),
      f("rfm_segment", "STRING", false, "Recency-Frequency-Monetary segment (e.g. Champions, At-risk)."),
      f("lifetime_orders", "INTEGER", false, "Total count of orders placed to date."),
      f("lifetime_gmv", "FLOAT", false, "Cumulative gross merchandise value across all orders."),
      f("is_subscriber", "BOOLEAN", false, "Whether the customer holds an active subscription."),
    ], "One row per customer. Conformed dimension with acquisition and RFM/LTV attributes."),
    mart("dim_product", "Product", "VIEW", [
      f("product_id", "STRING", true, "Surrogate product key."),
      f("sku", "STRING", false, "Stock-keeping unit code that identifies the sellable item."),
      f("name", "STRING", false, "Display name of the product."),
      f("category", "STRING", false, "Top-level category in the product hierarchy."),
      f("subcategory", "STRING", false, "Second-level grouping within the category."),
      f("brand", "STRING", false, "Manufacturer or brand label."),
      f("unit_cost", "FLOAT", false, "Landed cost — needed for line margin."),
      f("list_price", "FLOAT", false, "Standard catalog selling price before discounts."),
      f("is_active", "BOOLEAN", false, "Whether the SKU is currently available for sale."),
    ], "One row per sellable SKU with the category hierarchy and unit cost."),
    mart("fct_orders", "Orders", "VIEW", [
      f("order_id", "STRING", true, "Unique identifier for the order."),
      f("customer_id", "STRING", false, "Buyer."),
      f("order_ts", "TIMESTAMP", false, "Moment the order was placed."),
      f("channel", "STRING", false, "Sales channel through which the order came in."),
      f("status", "STRING", false, "Current fulfillment state (e.g. paid, shipped, cancelled)."),
      f("items_count", "INTEGER", false, "Number of line items in the order."),
      f("gross_revenue", "FLOAT", false, "Order value before discounts, shipping and tax."),
      f("discount_amount", "FLOAT", false, "Total discounts applied to the order."),
      f("shipping_fee", "FLOAT", false, "Shipping charged to the customer."),
      f("tax_amount", "FLOAT", false, "Tax collected on the order."),
      f("net_revenue", "FLOAT", false, "Gross − discount + shipping − tax."),
      f("is_first_order", "BOOLEAN", false, "Drives new-vs-returning revenue splits."),
    ], "Order-header grain: one row per order with totals, discounts, shipping and status."),
    mart("fct_order_items", "Order Items", "VIEW", [
      f("order_item_id", "STRING", true, "Unique identifier for the order line."),
      f("order_id", "STRING", false, "Parent order."),
      f("product_id", "STRING", false, "SKU sold."),
      f("quantity", "INTEGER", false, "Units of the product sold on this line."),
      f("unit_price", "FLOAT", false, "Price charged per unit on this line."),
      f("unit_cost", "FLOAT", false, "Cost per unit at time of sale."),
      f("discount_amount", "FLOAT", false, "Discount applied to this line."),
      f("line_revenue", "FLOAT", false, "Revenue for the line — unit_price × quantity less discount."),
      f("line_margin", "FLOAT", false, "(unit_price − unit_cost) × qty − discount."),
    ], "Lowest sales grain (order × SKU). The table for margin and basket analysis."),
    mart("fct_sessions", "Web Sessions", "CONNECTOR", [
      f("session_id", "STRING", true, "Unique identifier for the web/app session."),
      f("customer_id", "STRING", false, "Null for anonymous visitors."),
      f("started_at", "TIMESTAMP", false, "Moment the session began."),
      f("source", "STRING", false, "Traffic source that referred the session."),
      f("medium", "STRING", false, "Marketing medium (e.g. organic, cpc, email)."),
      f("campaign", "STRING", false, "Campaign that drove the session."),
      f("device", "STRING", false, "Device type used (e.g. mobile, desktop, tablet)."),
      f("landing_page", "STRING", false, "First page viewed in the session."),
      f("pageviews", "INTEGER", false, "Count of pages viewed during the session."),
      f("add_to_cart", "BOOLEAN", false, "Whether an item was added to the cart."),
      f("reached_checkout", "BOOLEAN", false, "Whether the visitor reached the checkout step."),
      f("converted", "BOOLEAN", false, "Whether the session ended in a purchase."),
    ], "One row per web/app session from the analytics stream — funnel and acquisition source."),
    mart("fct_returns", "Returns", "VIEW", [
      f("return_id", "STRING", true, "Unique identifier for the return."),
      f("order_item_id", "STRING", false, "Returned line."),
      f("product_id", "STRING", false, "SKU that was returned."),
      f("returned_at", "DATE", false, "Date the return was processed."),
      f("quantity", "INTEGER", false, "Units returned on this line."),
      f("refund_amount", "FLOAT", false, "Amount refunded to the customer."),
      f("reason", "STRING", false, "Stated reason for the return."),
    ], "One row per returned line — drives net margin and return-rate by category."),
  ],
  edges: [
    rel("e1", "fct_orders", "dim_customer", "customer_id", "customer_id"),
    rel("e2", "fct_order_items", "fct_orders", "order_id", "order_id"),
    rel("e3", "fct_order_items", "dim_product", "product_id", "product_id"),
    rel("e4", "fct_sessions", "dim_customer", "customer_id", "customer_id"),
    rel("e5", "fct_returns", "fct_order_items", "order_item_id", "order_item_id"),
    rel("e6", "fct_returns", "dim_product", "product_id", "product_id"),
  ],
};

// SaaS / Subscription — B2B recurring-revenue model. The centrepiece is
// fct_subscription_events: one row per MRR movement, which reconstructs the
// new/expansion/contraction/churn waterfall and feeds NRR/GRR. Usage, invoices
// and support hang off the account dimension as leading churn/expansion signals.
const saas: ModelGraph = {
  storageId: null,
  nodes: [
    mart("dim_account", "Account", "VIEW", [
      f("account_id", "STRING", true, "Unique account identifier."),
      f("name", "STRING", false, "Company/account name."),
      f("industry", "STRING", false, "Industry vertical of the account."),
      f("employee_band", "STRING", false, "Company-size bucket by headcount."),
      f("plan_tier", "STRING", false, "Subscription plan tier."),
      f("mrr_band", "STRING", false, "Monthly-recurring-revenue size bucket."),
      f("region", "STRING", false, "Sales/geographic region."),
      f("signup_date", "DATE", false, "Date the account first signed up."),
      f("csm_owner", "STRING", false, "Customer success manager who owns the account."),
      f("health_score", "INTEGER", false, "0–100 product-health composite."),
      f("lifecycle_stage", "STRING", false, "trial / active / at-risk / churned."),
    ], "One row per customer account (company). Firmographics, plan tier and health."),
    mart("dim_user", "User", "VIEW", [
      f("user_id", "STRING", true, "Unique user identifier."),
      f("account_id", "STRING", false, "Owning account."),
      f("email", "STRING", false, "User's email address."),
      f("role", "STRING", false, "User's role within the account."),
      f("seat_type", "STRING", false, "Type of seat assigned (e.g. full / viewer)."),
      f("invited_at", "TIMESTAMP", false, "When the user was invited."),
      f("last_active_at", "TIMESTAMP", false, "Most recent activity timestamp."),
      f("is_active", "BOOLEAN", false, "Whether the seat is currently active."),
    ], "One row per user seat within an account."),
    mart("fct_subscription_events", "Subscription Events", "VIEW", [
      f("event_id", "STRING", true, "Unique subscription-event identifier."),
      f("account_id", "STRING", false, "Account the event belongs to."),
      f("event_ts", "TIMESTAMP", false, "When the subscription change occurred."),
      f("event_type", "STRING", false, "new / upgrade / downgrade / reactivation / churn."),
      f("plan_from", "STRING", false, "Plan before the change."),
      f("plan_to", "STRING", false, "Plan after the change."),
      f("mrr_delta", "FLOAT", false, "Signed MRR change — the MRR-movement waterfall."),
      f("seats_delta", "INTEGER", false, "Signed change in seat count."),
      f("mrr_after", "FLOAT", false, "Total MRR after the change."),
    ], "One row per subscription change. Reconstructs the MRR waterfall and NRR/GRR."),
    mart("fct_invoices", "Invoices", "VIEW", [
      f("invoice_id", "STRING", true, "Unique invoice identifier."),
      f("account_id", "STRING", false, "Account billed."),
      f("issued_at", "DATE", false, "Date the invoice was issued."),
      f("period_start", "DATE", false, "Start of the billing period."),
      f("period_end", "DATE", false, "End of the billing period."),
      f("amount", "FLOAT", false, "Invoice amount before tax."),
      f("tax", "FLOAT", false, "Tax charged on the invoice."),
      f("status", "STRING", false, "Payment status of the invoice."),
      f("paid_at", "DATE", false, "Date the invoice was paid."),
      f("is_failed", "BOOLEAN", false, "Failed payment — involuntary-churn signal."),
    ], "One row per invoice. Billing, collections and dunning."),
    mart("fct_usage_daily", "Usage (daily)", "CONNECTOR", [
      f("usage_id", "STRING", true, "Unique daily-usage record identifier."),
      f("account_id", "STRING", false, "Account that generated the usage."),
      f("user_id", "STRING", false, "User that generated the usage."),
      f("usage_date", "DATE", false, "Calendar day of the usage."),
      f("active_minutes", "INTEGER", false, "Minutes the user was active in-product."),
      f("key_actions", "INTEGER", false, "Count of high-value actions taken."),
      f("feature_adoption_score", "FLOAT", false, "Breadth of features touched — activation signal."),
    ], "One row per account × user × day of product usage. Engagement and activation."),
    mart("fct_support_tickets", "Support Tickets", "VIEW", [
      f("ticket_id", "STRING", true, "Unique support-ticket identifier."),
      f("account_id", "STRING", false, "Account that opened the ticket."),
      f("opened_at", "TIMESTAMP", false, "When the ticket was opened."),
      f("closed_at", "TIMESTAMP", false, "When the ticket was closed."),
      f("priority", "STRING", false, "Ticket priority level."),
      f("category", "STRING", false, "Ticket topic/category."),
      f("csat_score", "INTEGER", false, "Customer satisfaction rating for the ticket."),
      f("first_response_mins", "INTEGER", false, "Minutes to first agent response."),
    ], "One row per support ticket — CSAT and churn-risk signal."),
  ],
  edges: [
    rel("e1", "dim_user", "dim_account", "account_id", "account_id"),
    rel("e2", "fct_subscription_events", "dim_account", "account_id", "account_id"),
    rel("e3", "fct_invoices", "dim_account", "account_id", "account_id"),
    rel("e4", "fct_usage_daily", "dim_account", "account_id", "account_id"),
    rel("e5", "fct_usage_daily", "dim_user", "user_id", "user_id"),
    rel("e6", "fct_support_tickets", "dim_account", "account_id", "account_id"),
  ],
};

// Finance / Fintech — neobank + lending model. Two fact streams sit side by
// side: fct_transactions (card/money movement → engagement, interchange, fraud)
// and the lending funnel fct_loans → fct_repayments (origination, pull-through,
// DPD and charge-off). KYC/risk attributes live on the customer dimension.
const finance: ModelGraph = {
  storageId: null,
  nodes: [
    mart("dim_customer", "Customer", "VIEW", [
      f("customer_id", "STRING", true, "Unique customer identifier."),
      f("signup_date", "DATE", false, "Date the customer signed up."),
      f("kyc_status", "STRING", false, "passed / pending / rejected."),
      f("risk_band", "STRING", false, "Internal risk tier assigned to the customer."),
      f("credit_score", "INTEGER", false, "Credit score at onboarding."),
      f("acquisition_channel", "STRING", false, "Channel that brought the customer in."),
      f("region", "STRING", false, "Customer's geographic region."),
      f("is_funded", "BOOLEAN", false, "Has at least one funded account — activation flag."),
    ], "One row per customer with KYC, risk band and acquisition."),
    mart("dim_product", "Product", "TABLE", [
      f("product_id", "STRING", true, "Unique product identifier."),
      f("name", "STRING", false, "Product display name."),
      f("product_type", "STRING", false, "deposit / card / loan / BNPL."),
      f("apr", "FLOAT", false, "Annual percentage rate for the product."),
      f("term_months", "INTEGER", false, "Product term length in months."),
    ], "Reference of financial products."),
    mart("fct_accounts", "Accounts", "VIEW", [
      f("account_id", "STRING", true, "Unique account identifier."),
      f("customer_id", "STRING", false, "Owning customer."),
      f("product_id", "STRING", false, "Product held in this account."),
      f("opened_at", "DATE", false, "Date the account was opened."),
      f("status", "STRING", false, "Current account status."),
      f("current_balance", "FLOAT", false, "Current account balance."),
      f("activated_at", "DATE", false, "First funding / first card use."),
      f("is_active", "BOOLEAN", false, "Whether the account is currently active."),
    ], "One row per opened product holding. Balances and activation state."),
    mart("fct_transactions", "Transactions", "CONNECTOR", [
      f("txn_id", "STRING", true, "Unique transaction identifier."),
      f("account_id", "STRING", false, "Account the transaction belongs to."),
      f("txn_ts", "TIMESTAMP", false, "When the transaction occurred."),
      f("txn_type", "STRING", false, "Type of transaction."),
      f("mcc", "STRING", false, "Merchant category code."),
      f("amount", "FLOAT", false, "Transaction amount."),
      f("currency", "STRING", false, "Currency of the transaction."),
      f("is_declined", "BOOLEAN", false, "Whether the transaction was declined."),
      f("fraud_score", "FLOAT", false, "Model score at authorization time."),
      f("channel", "STRING", false, "Channel used for the transaction."),
    ], "One row per money movement / card authorization. Engagement, interchange and fraud."),
    mart("fct_loans", "Loans", "VIEW", [
      f("loan_id", "STRING", true, "Unique loan identifier."),
      f("customer_id", "STRING", false, "Borrowing customer."),
      f("product_id", "STRING", false, "Loan product applied for."),
      f("applied_at", "DATE", false, "Date the loan was applied for."),
      f("decision", "STRING", false, "approved / declined / withdrawn."),
      f("approved_amount", "FLOAT", false, "Amount approved at underwriting."),
      f("funded_amount", "FLOAT", false, "Approved → funded is the pull-through rate."),
      f("apr", "FLOAT", false, "Annual percentage rate on the loan."),
      f("term_months", "INTEGER", false, "Loan term length in months."),
      f("funded_at", "DATE", false, "Date the loan was funded."),
      f("status", "STRING", false, "Current loan status."),
    ], "One row per loan application → origination. Underwriting funnel and pull-through."),
    mart("fct_repayments", "Repayments", "VIEW", [
      f("repayment_id", "STRING", true, "Unique repayment identifier."),
      f("loan_id", "STRING", false, "Loan this repayment belongs to."),
      f("due_date", "DATE", false, "Date the payment is due."),
      f("paid_date", "DATE", false, "Date the payment was made."),
      f("due_amount", "FLOAT", false, "Amount scheduled to be paid."),
      f("paid_amount", "FLOAT", false, "Amount actually paid."),
      f("days_past_due", "INTEGER", false, "DPD bucket driver for delinquency."),
      f("is_charged_off", "BOOLEAN", false, "Whether the loan was charged off."),
    ], "One row per scheduled repayment. Delinquency (DPD) and charge-off."),
  ],
  edges: [
    rel("e1", "fct_accounts", "dim_customer", "customer_id", "customer_id"),
    rel("e2", "fct_accounts", "dim_product", "product_id", "product_id"),
    rel("e3", "fct_transactions", "fct_accounts", "account_id", "account_id"),
    rel("e4", "fct_loans", "dim_customer", "customer_id", "customer_id"),
    rel("e5", "fct_loans", "dim_product", "product_id", "product_id"),
    rel("e6", "fct_repayments", "fct_loans", "loan_id", "loan_id"),
  ],
};

// Healthcare provider — operational + revenue-cycle model. fct_appointments
// carries scheduling (no-show, wait, lead time); fct_encounters the clinical
// visit (LOS, 30-day readmission); fct_claims the revenue cycle (denials, AR
// days) against the payer dimension. Patient and provider are conformed dims.
const medical: ModelGraph = {
  storageId: null,
  nodes: [
    mart("dim_patient", "Patient", "VIEW", [
      f("patient_id", "STRING", true, "Unique de-identified patient identifier."),
      f("birth_year", "INTEGER", false, "Year of birth, used for age banding."),
      f("gender", "STRING", false, "Patient gender."),
      f("postal_code", "STRING", false, "Patient postal/ZIP code for geographic analysis."),
      f("insurance_type", "STRING", false, "commercial / Medicare / Medicaid / self-pay."),
      f("risk_tier", "STRING", false, "Risk-stratification band for care management."),
      f("registered_at", "DATE", false, "Date the patient was first registered."),
    ], "One row per patient. De-identified demographics and risk stratification."),
    mart("dim_provider", "Provider", "TABLE", [
      f("provider_id", "STRING", true, "Unique provider identifier."),
      f("full_name", "STRING", false, "Provider's full name."),
      f("specialty", "STRING", false, "Clinical specialty of the provider."),
      f("department", "STRING", false, "Department the provider belongs to."),
      f("npi", "STRING", false, "National Provider Identifier."),
    ], "One row per clinician/provider."),
    mart("dim_payer", "Payer", "TABLE", [
      f("payer_id", "STRING", true, "Unique payer identifier."),
      f("name", "STRING", false, "Payer / insurance plan name."),
      f("plan_type", "STRING", false, "HMO / PPO / EPO / government."),
    ], "Reference of insurance payers / plans."),
    mart("fct_appointments", "Appointments", "VIEW", [
      f("appointment_id", "STRING", true, "Unique appointment identifier."),
      f("patient_id", "STRING", false, "Patient who booked the appointment."),
      f("provider_id", "STRING", false, "Provider seeing the patient."),
      f("scheduled_at", "TIMESTAMP", false, "Scheduled date and time of the appointment."),
      f("department", "STRING", false, "Department where the appointment takes place."),
      f("status", "STRING", false, "Appointment status (e.g. booked, completed, cancelled)."),
      f("is_no_show", "BOOLEAN", false, "Whether the patient failed to show up."),
      f("wait_minutes", "INTEGER", false, "Door-to-provider wait."),
      f("lead_time_days", "INTEGER", false, "Booking-to-visit lead time — no-show driver."),
    ], "One row per scheduled appointment. No-show, wait time and utilization."),
    mart("fct_encounters", "Encounters", "VIEW", [
      f("encounter_id", "STRING", true, "Unique clinical encounter identifier."),
      f("appointment_id", "STRING", false, "Appointment that led to this encounter."),
      f("patient_id", "STRING", false, "Patient seen in the encounter."),
      f("provider_id", "STRING", false, "Provider who delivered care."),
      f("admit_ts", "TIMESTAMP", false, "Admission date and time."),
      f("discharge_ts", "TIMESTAMP", false, "Discharge date and time."),
      f("encounter_type", "STRING", false, "outpatient / inpatient / ED."),
      f("primary_diagnosis", "STRING", false, "Primary ICD-10 code."),
      f("length_of_stay_days", "FLOAT", false, "Length of stay in days."),
      f("is_readmission_30d", "BOOLEAN", false, "Unplanned readmission within 30 days."),
    ], "One row per clinical encounter. Diagnoses, length-of-stay and readmission."),
    mart("fct_claims", "Claims", "VIEW", [
      f("claim_id", "STRING", true, "Unique claim identifier."),
      f("encounter_id", "STRING", false, "Encounter the claim is billed for."),
      f("payer_id", "STRING", false, "Payer responsible for the claim."),
      f("submitted_at", "DATE", false, "Date the claim was submitted."),
      f("paid_at", "DATE", false, "Date the claim was paid."),
      f("billed_amount", "FLOAT", false, "Amount billed to the payer."),
      f("allowed_amount", "FLOAT", false, "Payer-allowed amount."),
      f("paid_amount", "FLOAT", false, "Amount actually paid."),
      f("status", "STRING", false, "Claim status (e.g. submitted, paid, denied)."),
      f("denial_code", "STRING", false, "CARC/RARC denial reason, when denied."),
      f("ar_days", "INTEGER", false, "Days in accounts receivable — revenue-cycle speed."),
    ], "One row per claim line. Revenue cycle, denials and AR days."),
  ],
  edges: [
    rel("e1", "fct_appointments", "dim_patient", "patient_id", "patient_id"),
    rel("e2", "fct_appointments", "dim_provider", "provider_id", "provider_id"),
    rel("e3", "fct_encounters", "fct_appointments", "appointment_id", "appointment_id"),
    rel("e4", "fct_encounters", "dim_patient", "patient_id", "patient_id"),
    rel("e5", "fct_claims", "fct_encounters", "encounter_id", "encounter_id"),
    rel("e6", "fct_claims", "dim_payer", "payer_id", "payer_id"),
  ],
};

// Marketplace / Platform — two-sided model. Supply (sellers, listings) and
// demand (buyers, search) are deliberately separate branches; fct_orders is the
// match where they meet, carrying GMV, take rate and fill. Liquidity = the rate
// at which search requests and listings convert into completed orders.
const marketplace: ModelGraph = {
  storageId: null,
  nodes: [
    mart("dim_buyer", "Buyer", "VIEW", [
      f("buyer_id", "STRING", true, "Unique buyer identifier."),
      f("signup_date", "DATE", false, "When the buyer first registered."),
      f("acquisition_channel", "STRING", false, "Marketing source that brought the buyer in."),
      f("region", "STRING", false, "Buyer's geographic region."),
      f("segment", "STRING", false, "Buyer segment for targeting and analysis."),
      f("lifetime_orders", "INTEGER", false, "Total orders placed to date."),
      f("is_repeat", "BOOLEAN", false, "Made 2+ orders — demand-side retention."),
    ], "Demand side: one row per buyer."),
    mart("dim_seller", "Seller", "VIEW", [
      f("seller_id", "STRING", true, "Unique seller identifier."),
      f("onboarded_at", "DATE", false, "When the seller joined the platform."),
      f("category", "STRING", false, "Primary category the seller sells in."),
      f("region", "STRING", false, "Seller's geographic region."),
      f("rating", "FLOAT", false, "Average buyer rating of the seller."),
      f("active_listings", "INTEGER", false, "Number of currently live listings."),
      f("is_activated", "BOOLEAN", false, "Reached first sale — supply activation."),
      f("fulfillment_type", "STRING", false, "How the seller fulfils orders."),
    ], "Supply side: one row per seller/supplier."),
    mart("fct_listings", "Listings", "VIEW", [
      f("listing_id", "STRING", true, "Unique listing identifier."),
      f("seller_id", "STRING", false, "Seller that owns the listing."),
      f("created_at", "TIMESTAMP", false, "When the listing was created."),
      f("category", "STRING", false, "Listing's product category."),
      f("price", "FLOAT", false, "Listed price of the offer."),
      f("status", "STRING", false, "Current listing status."),
      f("is_available", "BOOLEAN", false, "Live inventory — supply availability."),
    ], "One row per listing/offer. Supply inventory and availability."),
    mart("fct_search_requests", "Search Requests", "CONNECTOR", [
      f("request_id", "STRING", true, "Unique search request identifier."),
      f("buyer_id", "STRING", false, "Buyer who made the search."),
      f("requested_at", "TIMESTAMP", false, "When the search was made."),
      f("query", "STRING", false, "Raw search text entered by the buyer."),
      f("category", "STRING", false, "Category the search was scoped to."),
      f("results_count", "INTEGER", false, "Number of results returned."),
      f("clicked", "BOOLEAN", false, "Whether the buyer clicked a result."),
      f("converted", "BOOLEAN", false, "Whether the search led to an order."),
      f("time_to_match_mins", "FLOAT", false, "Search → transaction latency."),
    ], "One row per search/browse request. Demand and match-quality signal."),
    mart("fct_orders", "Orders", "VIEW", [
      f("order_id", "STRING", true, "Unique order identifier."),
      f("buyer_id", "STRING", false, "Buyer on the order."),
      f("seller_id", "STRING", false, "Seller on the order."),
      f("listing_id", "STRING", false, "Listing that was purchased."),
      f("ordered_at", "TIMESTAMP", false, "When the order was placed."),
      f("gmv", "FLOAT", false, "Gross merchandise value."),
      f("take_rate", "FLOAT", false, "Platform's cut as a fraction of GMV."),
      f("platform_revenue", "FLOAT", false, "gmv × take_rate."),
      f("status", "STRING", false, "Current order status."),
      f("is_fulfilled", "BOOLEAN", false, "Whether the order was fulfilled."),
      f("fulfillment_mins", "FLOAT", false, "Order-to-fulfilment time — fill speed."),
    ], "The match: one row per completed transaction. GMV, take rate and fill."),
    mart("fct_reviews", "Reviews", "VIEW", [
      f("review_id", "STRING", true, "Unique review identifier."),
      f("order_id", "STRING", false, "Order the review relates to."),
      f("rating", "INTEGER", false, "Buyer's star rating for the order."),
      f("created_at", "TIMESTAMP", false, "When the review was submitted."),
      f("has_complaint", "BOOLEAN", false, "Whether the review flags a complaint."),
    ], "One row per post-transaction review. Trust and retention signal."),
  ],
  edges: [
    rel("e1", "fct_listings", "dim_seller", "seller_id", "seller_id"),
    rel("e2", "fct_search_requests", "dim_buyer", "buyer_id", "buyer_id"),
    rel("e3", "fct_orders", "dim_buyer", "buyer_id", "buyer_id"),
    rel("e4", "fct_orders", "dim_seller", "seller_id", "seller_id"),
    rel("e5", "fct_orders", "fct_listings", "listing_id", "listing_id"),
    rel("e6", "fct_reviews", "fct_orders", "order_id", "order_id"),
  ],
};

// Mobile / Gaming — free-to-play telemetry model. fct_sessions/fct_events are
// the high-volume engagement streams (retention, FTUE funnel); monetization
// splits into fct_iap_purchases (ARPPU, payer conversion) and fct_ad_impressions
// (ad ARPDAU). fct_ua_spend closes the loop on CPI and D7 ROAS by campaign.
const mobile_gaming: ModelGraph = {
  storageId: null,
  nodes: [
    mart("dim_player", "Player", "VIEW", [
      f("player_id", "STRING", true, "Unique player identifier."),
      f("install_ts", "TIMESTAMP", false, "When the player first installed the app."),
      f("platform", "STRING", false, "Device platform (iOS / Android)."),
      f("country", "STRING", false, "Player's country."),
      f("acquisition_source", "STRING", false, "Channel that brought the player in."),
      f("campaign", "STRING", false, "UA campaign — joins to spend."),
      f("is_payer", "BOOLEAN", false, "Whether the player has ever paid."),
      f("ltv", "FLOAT", false, "Lifetime value to date."),
      f("last_active_date", "DATE", false, "Most recent day the player was active."),
    ], "One row per player/install. Acquisition, device and LTV state."),
    mart("fct_sessions", "Sessions", "CONNECTOR", [
      f("session_id", "STRING", true, "Unique session identifier."),
      f("player_id", "STRING", false, "Player who played the session."),
      f("started_at", "TIMESTAMP", false, "Session start time."),
      f("ended_at", "TIMESTAMP", false, "Session end time."),
      f("session_length_secs", "INTEGER", false, "Session duration in seconds."),
      f("level_reached", "INTEGER", false, "Highest level reached in the session."),
      f("day_number", "INTEGER", false, "Days since install — powers D1/D7/D30 retention."),
    ], "One row per game session. Engagement, retention and session length."),
    mart("fct_events", "Events", "CONNECTOR", [
      f("event_id", "STRING", true, "Unique event identifier."),
      f("player_id", "STRING", false, "Player who triggered the event."),
      f("session_id", "STRING", false, "Session the event belongs to."),
      f("event_ts", "TIMESTAMP", false, "When the event occurred."),
      f("event_name", "STRING", false, "tutorial_step / level_complete / store_open …"),
      f("level", "INTEGER", false, "Game level at the time of the event."),
      f("value", "FLOAT", false, "Numeric value attached to the event."),
    ], "One row per gameplay/telemetry event. FTUE funnel and feature usage."),
    mart("fct_iap_purchases", "IAP Purchases", "VIEW", [
      f("purchase_id", "STRING", true, "Unique purchase identifier."),
      f("player_id", "STRING", false, "Player who made the purchase."),
      f("purchased_at", "TIMESTAMP", false, "When the purchase was made."),
      f("product_sku", "STRING", false, "Purchased product identifier."),
      f("price_usd", "FLOAT", false, "Purchase price in USD."),
      f("currency", "STRING", false, "Currency the player paid in."),
      f("store", "STRING", false, "App store where the purchase was made."),
      f("is_first_purchase", "BOOLEAN", false, "Payer-conversion event."),
    ], "One row per in-app purchase. Monetization, ARPPU and payer conversion."),
    mart("fct_ad_impressions", "Ad Impressions", "CONNECTOR", [
      f("impression_id", "STRING", true, "Unique ad impression identifier."),
      f("player_id", "STRING", false, "Player who saw the ad."),
      f("shown_at", "TIMESTAMP", false, "When the ad was shown."),
      f("ad_format", "STRING", false, "rewarded / interstitial / banner."),
      f("placement", "STRING", false, "Where in the app the ad was placed."),
      f("revenue_usd", "FLOAT", false, "Estimated ad revenue — ad ARPDAU."),
      f("network", "STRING", false, "Ad network serving the impression."),
    ], "One row per ad impression. Ad monetization and ARPDAU."),
    mart("fct_ua_spend", "UA Spend", "VIEW", [
      f("spend_id", "STRING", true, "Unique spend record identifier."),
      f("spend_date", "DATE", false, "Date the spend occurred."),
      f("network", "STRING", false, "Ad network the spend went to."),
      f("campaign", "STRING", false, "UA campaign the spend belongs to."),
      f("country", "STRING", false, "Country targeted by the spend."),
      f("installs", "INTEGER", false, "Installs attributed to the spend."),
      f("spend_usd", "FLOAT", false, "Amount spent in USD."),
      f("impressions", "INTEGER", false, "Ad impressions bought."),
      f("clicks", "INTEGER", false, "Clicks generated."),
    ], "One row per campaign × day of user-acquisition spend. CPI and D7 ROAS."),
  ],
  edges: [
    rel("e1", "fct_sessions", "dim_player", "player_id", "player_id"),
    rel("e2", "fct_events", "dim_player", "player_id", "player_id"),
    rel("e3", "fct_events", "fct_sessions", "session_id", "session_id"),
    rel("e4", "fct_iap_purchases", "dim_player", "player_id", "player_id"),
    rel("e5", "fct_ad_impressions", "dim_player", "player_id", "player_id"),
    rel("e6", "fct_ua_spend", "dim_player", "campaign", "campaign", "N:N"),
  ],
};

// B2B Marketing / Lead-gen — spend + funnel model. fct_ad_spend gives the cost
// side by channel/campaign; fct_touchpoints records each marketing touch with a
// per-touch credit weight; the funnel runs dim_lead → fct_opportunities
// (MQL → SQL → Closed-Won) so spend can be tied to closed revenue.
const marketing_ads: ModelGraph = {
  storageId: null,
  nodes: [
    mart("dim_campaign", "Campaign", "TABLE", [
      f("campaign_id", "STRING", true, "Unique identifier for each campaign."),
      f("campaign_name", "STRING", false, "Human-readable name of the campaign."),
      f("channel", "STRING", false, "Marketing channel the campaign runs on (e.g. paid search, social, email)."),
      f("objective", "STRING", false, "Primary goal of the campaign (e.g. awareness, lead generation)."),
      f("utm_source", "STRING", false, "UTM source tag identifying where the traffic originates."),
      f("utm_medium", "STRING", false, "UTM medium tag describing the type of traffic (e.g. cpc, email)."),
      f("start_date", "DATE", false, "Date the campaign went live."),
    ], "Reference of campaigns with channel, objective and UTM tags."),
    mart("fct_ad_spend", "Ad Spend", "CONNECTOR", [
      f("spend_id", "STRING", true, "Unique identifier for each spend record."),
      f("spend_date", "DATE", false, "Day the spend was incurred."),
      f("campaign_id", "STRING", false, "Campaign this spend belongs to."),
      f("channel", "STRING", false, "Marketing channel where the cost was spent."),
      f("ad_group", "STRING", false, "Ad group or ad set within the campaign."),
      f("impressions", "INTEGER", false, "Number of times ads were shown."),
      f("clicks", "INTEGER", false, "Number of clicks the ads received."),
      f("cost", "FLOAT", false, "Money spent on this ad group for the day."),
    ], "One row per campaign × ad-group × day. Cross-channel cost, impressions, clicks."),
    mart("dim_lead", "Lead", "VIEW", [
      f("lead_id", "STRING", true, "Unique identifier for each lead or contact."),
      f("created_at", "TIMESTAMP", false, "When the lead first entered the system."),
      f("source_channel", "STRING", false, "Channel that first brought in the lead."),
      f("lead_score", "INTEGER", false, "Fit + engagement score for MQL gating."),
      f("company_size_band", "STRING", false, "Bucketed size of the lead's company (e.g. 1-50, 51-200)."),
      f("industry", "STRING", false, "Industry the lead's company operates in."),
      f("country", "STRING", false, "Country where the lead is located."),
      f("lifecycle_stage", "STRING", false, "subscriber / MQL / SQL / opportunity / customer."),
    ], "One row per lead/contact. Source, score and firmographics."),
    mart("fct_touchpoints", "Touchpoints", "CONNECTOR", [
      f("touchpoint_id", "STRING", true, "Unique identifier for each marketing touch."),
      f("lead_id", "STRING", false, "Lead that this touch belongs to."),
      f("campaign_id", "STRING", false, "Campaign associated with this touch."),
      f("occurred_at", "TIMESTAMP", false, "When the touch happened."),
      f("channel", "STRING", false, "Channel where the touch occurred."),
      f("touch_type", "STRING", false, "Kind of interaction (e.g. ad click, form fill, email open)."),
      f("touch_credit", "FLOAT", false, "Credit assigned to this marketing touch (sums to 1 per lead)."),
      f("is_first_touch", "BOOLEAN", false, "True if this was the lead's very first touch."),
      f("is_lead_create", "BOOLEAN", false, "True if this touch created the lead."),
    ], "One row per marketing touch on the path to conversion."),
    mart("fct_opportunities", "Opportunities", "VIEW", [
      f("opportunity_id", "STRING", true, "Unique identifier for each sales opportunity."),
      f("lead_id", "STRING", false, "Lead that the opportunity originated from."),
      f("created_at", "DATE", false, "Date the opportunity was created."),
      f("stage", "STRING", false, "Current stage in the sales pipeline."),
      f("is_mql", "BOOLEAN", false, "True if the lead reached marketing-qualified status."),
      f("is_sql", "BOOLEAN", false, "True if the lead reached sales-qualified status."),
      f("amount", "FLOAT", false, "ACV / deal size."),
      f("close_date", "DATE", false, "Date the opportunity was won or lost."),
      f("is_won", "BOOLEAN", false, "True if the deal was won."),
      f("sales_cycle_days", "INTEGER", false, "Number of days from creation to close."),
      f("owner", "STRING", false, "Sales rep who owns the opportunity."),
    ], "One row per sales opportunity. Pipeline stage, ACV and win/loss."),
  ],
  edges: [
    rel("e1", "fct_ad_spend", "dim_campaign", "campaign_id", "campaign_id"),
    rel("e2", "fct_touchpoints", "dim_campaign", "campaign_id", "campaign_id"),
    rel("e3", "fct_touchpoints", "dim_lead", "lead_id", "lead_id"),
    rel("e4", "fct_opportunities", "dim_lead", "lead_id", "lead_id"),
  ],
};

// Public-dataset templates (kept schema-faithful to the real BigQuery tables).

const crypto_bitcoin: ModelGraph = {
  storageId: null,
  nodes: [
    mart("blocks", "Blocks", "TABLE", [
      f("hash", "STRING", true, "Block header hash that uniquely identifies the block."),
      f("number", "INTEGER", false, "Block height (sequential index in the chain)."),
      f("size", "INTEGER", false, "Serialized block size in bytes."),
      f("weight", "INTEGER", false, "Block weight as defined by BIP 141."),
      f("version", "INTEGER", false, "Block version indicating which validation rules to follow."),
      f("merkle_root", "STRING", false, "Merkle tree root hash of all transactions in the block."),
      f("timestamp", "TIMESTAMP", false, "Time the miner started hashing the block header."),
      f("nonce", "STRING", false, "Value miners vary to satisfy the proof-of-work difficulty target."),
      f("bits", "STRING", false, "Compact encoding of the proof-of-work difficulty target."),
      f("transaction_count", "INTEGER", false, "Number of transactions included in the block."),
    ], "Bitcoin blocks: one row per mined block with header and summary fields."),
    mart("transactions", "Transactions", "TABLE", [
      f("hash", "STRING", true, "Transaction hash (txid) that uniquely identifies the transaction."),
      f("size", "INTEGER", false, "Serialized transaction size in bytes."),
      f("virtual_size", "INTEGER", false, "Virtual transaction size in virtual bytes (SegWit-weighted)."),
      f("version", "INTEGER", false, "Transaction format version number."),
      f("lock_time", "INTEGER", false, "Earliest block height or time at which the transaction may be added."),
      f("block_hash", "STRING", false, "Hash of the block containing this transaction."),
      f("block_number", "INTEGER", false, "Height of the block containing this transaction."),
      f("block_timestamp", "TIMESTAMP", false, "Timestamp of the block containing this transaction."),
      f("input_count", "INTEGER", false, "Number of inputs in the transaction."),
      f("output_count", "INTEGER", false, "Number of outputs in the transaction."),
      f("input_value", "NUMERIC", false, "Total value of all inputs in BTC."),
      f("output_value", "NUMERIC", false, "Total value of all outputs in BTC."),
      f("is_coinbase", "BOOLEAN", false, "Whether this is a coinbase (block reward) transaction."),
      f("fee", "NUMERIC", false, "Transaction fee paid to the miner in BTC."),
    ], "Bitcoin transactions: one row per transaction with value and fee details."),
    mart("inputs", "Inputs", "TABLE", [
      f("transaction_hash", "STRING", false, "Hash of the transaction this input belongs to."),
      f("block_hash", "STRING", false, "Hash of the block containing this input."),
      f("block_number", "INTEGER", false, "Height of the block containing this input."),
      f("block_timestamp", "TIMESTAMP", false, "Timestamp of the block containing this input."),
      f("index", "INTEGER", true, "Zero-based position of this input within the transaction."),
      f("spent_transaction_hash", "STRING", false, "Hash of the transaction whose output is being spent."),
      f("spent_output_index", "INTEGER", false, "Output index in the prior transaction being spent."),
      f("script_asm", "STRING", false, "Unlocking script (scriptSig) in human-readable assembly."),
      f("sequence", "INTEGER", false, "Input sequence number used for relative locktime/RBF."),
      f("type", "STRING", false, "Type of the spent output script (e.g. pubkeyhash)."),
      f("value", "NUMERIC", false, "Value of the spent output in BTC."),
    ], "Bitcoin transaction inputs: one row per input referencing a spent output."),
    mart("outputs", "Outputs", "TABLE", [
      f("transaction_hash", "STRING", false, "Hash of the transaction this output belongs to."),
      f("block_hash", "STRING", false, "Hash of the block containing this output."),
      f("block_number", "INTEGER", false, "Height of the block containing this output."),
      f("block_timestamp", "TIMESTAMP", false, "Timestamp of the block containing this output."),
      f("index", "INTEGER", true, "Zero-based position of this output within the transaction."),
      f("script_asm", "STRING", false, "Locking script (scriptPubKey) in human-readable assembly."),
      f("type", "STRING", false, "Type of the output script (e.g. pubkeyhash, scripthash)."),
      f("value", "NUMERIC", false, "Value of the output in BTC."),
    ], "Bitcoin transaction outputs: one row per output with value and script."),
  ],
  edges: [
    rel("e1", "transactions", "blocks", "block_hash", "hash"),
    rel("e2", "inputs", "transactions", "transaction_hash", "hash"),
    rel("e3", "outputs", "transactions", "transaction_hash", "hash"),
  ],
};

const stackoverflow: ModelGraph = {
  storageId: null,
  nodes: [
    mart("users", "Users", "TABLE", [
      f("id", "INTEGER", true, "Unique identifier of the user."),
      f("display_name", "STRING", false, "Public display name of the user."),
      f("reputation", "INTEGER", false, "Reputation points earned from community activity."),
      f("creation_date", "TIMESTAMP", false, "Timestamp when the user account was created."),
      f("location", "STRING", false, "Free-text location provided by the user."),
      f("up_votes", "INTEGER", false, "Number of up votes cast by the user."),
      f("down_votes", "INTEGER", false, "Number of down votes cast by the user."),
    ], "Stack Overflow users: one row per registered user with reputation and vote counts."),
    mart("posts_questions", "Posts Questions", "TABLE", [
      f("id", "INTEGER", true, "Unique identifier of the question post."),
      f("title", "STRING", false, "Title text of the question."),
      f("body", "STRING", false, "HTML body content of the question."),
      f("owner_user_id", "INTEGER", false, "User id of the question's author."),
      f("creation_date", "TIMESTAMP", false, "Timestamp when the question was posted."),
      f("score", "INTEGER", false, "Net score (up votes minus down votes) of the question."),
      f("view_count", "INTEGER", false, "Number of times the question has been viewed."),
      f("answer_count", "INTEGER", false, "Number of answers posted to the question."),
      f("tags", "STRING", false, "Tags associated with the question, separated by pipes."),
    ], "Stack Overflow questions: one row per question post."),
    mart("posts_answers", "Posts Answers", "TABLE", [
      f("id", "INTEGER", true, "Unique identifier of the answer post."),
      f("parent_id", "INTEGER", false, "Id of the question this answer responds to."),
      f("owner_user_id", "INTEGER", false, "User id of the answer's author."),
      f("body", "STRING", false, "HTML body content of the answer."),
      f("creation_date", "TIMESTAMP", false, "Timestamp when the answer was posted."),
      f("score", "INTEGER", false, "Net score (up votes minus down votes) of the answer."),
    ], "Stack Overflow answers: one row per answer post linked to a question."),
    mart("comments", "Comments", "TABLE", [
      f("id", "INTEGER", true, "Unique identifier of the comment."),
      f("post_id", "INTEGER", false, "Id of the post the comment was made on."),
      f("user_id", "INTEGER", false, "User id of the comment's author."),
      f("text", "STRING", false, "Text content of the comment."),
      f("creation_date", "TIMESTAMP", false, "Timestamp when the comment was posted."),
      f("score", "INTEGER", false, "Number of up votes the comment received."),
    ], "Stack Overflow comments: one row per comment on a question or answer."),
    mart("votes", "Votes", "TABLE", [
      f("id", "INTEGER", true, "Unique identifier of the vote."),
      f("post_id", "INTEGER", false, "Id of the post the vote applies to."),
      f("vote_type_id", "INTEGER", false, "Code identifying the type of vote cast."),
      f("creation_date", "TIMESTAMP", false, "Timestamp when the vote was cast."),
    ], "Stack Overflow votes: one row per vote cast on a post."),
    mart("badges", "Badges", "TABLE", [
      f("id", "INTEGER", true, "Unique identifier of the badge award."),
      f("user_id", "INTEGER", false, "User id who earned the badge."),
      f("name", "STRING", false, "Name of the badge."),
      f("date", "TIMESTAMP", false, "Timestamp when the badge was awarded."),
      f("class", "INTEGER", false, "Badge class: gold (1), silver (2), or bronze (3)."),
    ], "Stack Overflow badges: one row per badge awarded to a user."),
    mart("tags", "Tags", "TABLE", [
      f("id", "INTEGER", true, "Unique identifier of the tag."),
      f("tag_name", "STRING", false, "Name of the tag."),
      f("count", "INTEGER", false, "Number of questions associated with the tag."),
      f("excerpt_post_id", "INTEGER", false, "Id of the post holding the tag's excerpt text."),
    ], "Stack Overflow tags: one row per tag with usage count."),
  ],
  edges: [
    rel("e1", "posts_questions", "users", "owner_user_id", "id"),
    rel("e2", "posts_answers", "posts_questions", "parent_id", "id"),
    rel("e3", "posts_answers", "users", "owner_user_id", "id"),
    rel("e4", "comments", "posts_questions", "post_id", "id"),
    rel("e5", "comments", "users", "user_id", "id"),
    rel("e6", "votes", "posts_questions", "post_id", "id"),
    rel("e7", "badges", "users", "user_id", "id"),
  ],
};

export const TEMPLATES: Template[] = [
  { id: "ecommerce", name: "E-commerce / Retail", description: "Sales star schema: order & line-item margin, web sessions and returns over conformed customer/product dimensions.", graph: ecommerce },
  { id: "saas", name: "SaaS / Subscription", description: "Recurring revenue: accounts, seats, MRR-movement events, invoices, daily product usage and support.", graph: saas },
  { id: "marketplace", name: "Marketplace", description: "Two-sided platform: buyers, sellers, listings, search demand, GMV/take-rate orders and reviews.", graph: marketplace },
  { id: "marketing_ads", name: "Marketing / Lead-gen", description: "B2B funnel: cross-channel ad spend, campaigns, marketing touchpoints, leads and pipeline opportunities.", graph: marketing_ads },
  { id: "mobile_gaming", name: "Mobile / Gaming", description: "Free-to-play telemetry: players, sessions, events, IAP, ad impressions and user-acquisition spend.", graph: mobile_gaming },
  { id: "finance", name: "Finance / Fintech", description: "Neobank & lending: customers (KYC/risk), accounts, transactions, loan origination and repayments.", graph: finance },
  { id: "medical", name: "Healthcare", description: "Provider analytics: patients, providers, appointments, encounters (LOS/readmission) and claims/denials.", graph: medical },
  { id: "crypto_bitcoin", name: "Bitcoin (crypto)", description: "Blocks, transactions, inputs and outputs from the public Bitcoin BigQuery dataset.", graph: crypto_bitcoin },
  { id: "stackoverflow", name: "Stack Overflow", description: "Users, questions, answers, comments, votes, badges and tags from the public Stack Overflow BigQuery dataset.", graph: stackoverflow },
];
