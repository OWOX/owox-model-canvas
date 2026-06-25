# OWOX Model Canvas

<p align="center">
  <img src=".github/assets/hero.png" alt="OWOX Model Canvas — a data model of six connected data marts (Customers, Orders, Web Sessions, Product, Order Items, Returns) on the canvas in field-level ERD view" width="900">
</p>

> Draw a data model on a free, anonymous canvas — then push it into OWOX Data Marts in one click.

**▶ Open the live app: [model.owox.com](https://model.owox.com)** — free, no sign-in.

OWOX Model Canvas is a Miro-like canvas for data people. Sketch your **data marts** (tables, views, SQL or connector outputs) as nodes and **joinable relationships** as edges, start from ready-made templates, see the business questions a model unlocks (AI), share it as a link, and — when you're ready — push the whole thing into [OWOX Data Marts](https://www.owox.com/) as drafts. The canvas is 100% free and works without an account; an OWOX API key is needed only to **Push**.

## Why use it

- **Free & anonymous** — design, template, AI-explore and share without signing in.
- **Templates for real domains** — E-commerce, SaaS, Marketplace, Marketing / Lead-gen, Mobile / Gaming, Finance, Healthcare, plus public datasets (Bitcoin, Stack Overflow).
- **Field-level ERD view** — see columns, primary keys and join keys, not just boxes.
- **Insight Questions (AI)** — the business questions a model can answer, generated from schema metadata only (no row-level data leaves your browser).
- **Build it with AI** — copy a short brief into Claude, ChatGPT or Gemini and it generates an importable model. In-app guide: [`/ai-instructions.html`](packages/web/public/ai-instructions.html).
- **Shareable links** — the whole model travels inside the URL; anyone can open your exact diagram, no backend.
- **One-click push to OWOX** — turn the diagram into draft Data Marts + joinable relationships.

## Open Knowledge Format (OKF) — your model stays portable

The canvas reads and writes **[Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog)** — a vendor-neutral way to describe a data model as a **folder of Markdown files** with YAML frontmatter: one document per data mart, a schema table, and a `## Joins` section for relationships. It's **human-readable and agent-friendly** — people can review it in a pull request and LLMs can author it.

- **Author + export, as a pair.** Design visually here and **Export OKF** to get a bundle that round-trips — re-importing restores the model. OWOX publishes real bundles at **[OWOX/models](https://github.com/OWOX/models)**; this canvas is the visual authoring/export front-end for that same format.
- **No lock-in.** Because the format is open and text-based, your model isn't trapped in a proprietary file — it lives in Markdown you own, in any git repo.
- **Generate it with AI.** The exact format an assistant should follow is documented at [`/okf-format.md`](packages/web/public/okf-format.md); the in-app guide has a one-click **Copy AI instructions** button.

That's what sets the canvas apart from generic ERD tools: the diagram is just a view over a portable, open model.

---

# Development

A Miro-like canvas where drawing a data model creates draft OWOX Data Marts and joinable relationships via the OWOX API, with OKF import/export. A free, **anonymous-first** tool: the whole canvas works without signing in — an OWOX API key is needed only to **Push** the model into OWOX.

## Layout (pnpm monorepo)

- `packages/okf` — pure shared lib: `ModelGraph` ⇄ OKF markdown bundle (parse/serialize). No I/O.
- `packages/server` — Fastify BFF: holds the OWOX access token in a cookie-keyed in-memory session, proxies all OWOX HTTP, serves the built SPA. Hardened with CSP/security headers, per-IP rate limiting, an `apiOrigin` allowlist, and session TTL/cap (see **Security**).
- `packages/web` — React + Vite + React Flow SPA: canvas, ERD view toggle, inspector, OKF import/export, template library, optional OWOX sign-in (only gated on Push).

## Develop

```bash
pnpm install
pnpm --filter @mc/okf build      # web/server consume okf's built dist
pnpm dev:web                     # Vite dev server (SPA) on :5173
pnpm dev                         # BFF (tsx watch) on :3000 — proxy/serve API
```

For a quick integrated check: `pnpm build` then `PORT=3111 pnpm --filter @mc/server start`, open http://localhost:3111 — the canvas opens immediately (anonymous). Pressing **Push to OWOX** opens the sign-in modal asking for your OWOX API key.

## Test

```bash
pnpm -r test     # okf + server + web (Vitest)
```

## Deploy (Render)

One Web Service, Node runtime, `starter` plan (`render.yaml`, `autoDeploy` from `main`).

- **Build:** `corepack enable && pnpm install --frozen-lockfile && pnpm build` (builds `okf` + `web`, typechecks `server`).
- **Start:** `pnpm --filter @mc/server start` (runs `src/server.ts` via `tsx` — chosen over compiled JS to avoid Node-ESM extension resolution friction; `tsx` is a runtime dependency).
- **Health check:** `/` (serves the SPA).
- **Env:** `PORT` (provided by Render). No secrets at rest — the OWOX API key is supplied by the user at runtime and held only in the BFF session. Tunable knobs: `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`, `CONNECT_RATE_LIMIT_MAX`, `OWOX_ALLOWED_ORIGIN_SUFFIXES`, `SESSION_TTL_MS`, `MAX_SESSIONS`.

## Auth

Auth is **optional** — only **Push** needs it. To connect, create an OWOX API key (in OWOX: project menu → **Project settings** → **My API Keys** → **Create API Key**) and paste it into the sign-in modal. The BFF exchanges it for a short-lived access token kept in a cookie-keyed session; the key itself is stored in the browser's `localStorage` for convenience. **Sign out** (top bar) clears it.

## Insight Questions (LLM)

Clicking the **Business Goal** button in the top bar opens a dialog where you set a niche and goal. Once set, a "Questions this unlocks" panel appears on any selected data mart, displaying LLM-generated questions prompted by Gemini Flash-Lite. Only schema metadata (mart titles, descriptions, field names) is sent to Google; no row-level data is transmitted. Responses are cached by focus and goal.

> **Deploy flag — `GEMINI_API_KEY` is required per environment for AI to actually run.** The Business Goal button and the questions panel are **always visible** (so the feature is discoverable), but generating questions calls Gemini and needs `GEMINI_API_KEY` set in *that* server's environment (get one from [Google AI Studio](https://aistudio.google.com/apikey)). It's set on **production** but is **not** inherited by branch/preview deploys (`sync: false` in `render.yaml`) — there the nav still shows and the panel displays a graceful "AI question suggestions aren't enabled on this deployment" note instead of generating. To enable AI on a given deploy, set `GEMINI_API_KEY` in its env. Locally: `GEMINI_API_KEY=… PORT=3111 pnpm --filter @mc/server start`.

## Security

The BFF is a thin proxy in front of the OWOX API. Hardening:

- **CSP + security headers** (`@fastify/helmet`): `script-src 'self'` (no inline scripts in the build), HSTS, `X-Content-Type-Options`, `frame-ancestors 'none'`.
- **Per-IP rate limiting** (`@fastify/rate-limit`): a generous global cap plus a tight cap on `/api/auth/connect` (the only endpoint that triggers an outbound OWOX token exchange).
- **`apiOrigin` allowlist**: the origin embedded in a user-supplied key must be an `https` `owox.com` host, blocking SSRF to internal/metadata addresses.
- **Session TTL + hard cap**: in-memory sessions expire and are bounded so abuse can't exhaust memory.

Per-session tenant isolation: every OWOX call uses the caller's own token, so users never see each other's data. Known tradeoff: the OWOX key lives in `localStorage`, so an XSS would expose it — CSP is the primary mitigation.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, and the PR flow. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting a vulnerability

Please report security issues privately — see [SECURITY.md](SECURITY.md). Don't open a public issue for a vulnerability.

## License

[Apache License 2.0](LICENSE) — © 2026 OWOX, Inc. See [NOTICE](NOTICE).

> "Open Knowledge Format (OKF)" is an open specification published by Google. OWOX Model Canvas reads and writes that format but is an independent, community project — not affiliated with or endorsed by Google.
