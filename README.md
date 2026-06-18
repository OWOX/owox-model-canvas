# OWOX Model Canvas

A Miro-like canvas where drawing a data model creates draft OWOX Data Marts and joinable relationships via the OWOX API, with OKF import/export. Single-user prototype.

See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the implementation plan. The approved interaction/visual reference is `docs/superpowers/prototype/canvas.html`.

## Layout (pnpm monorepo)

- `packages/okf` — pure shared lib: `ModelGraph` ⇄ OKF markdown bundle (parse/serialize). No I/O.
- `packages/server` — Fastify BFF: holds the OWOX access token in a cookie-keyed session, proxies all OWOX HTTP, serves the built SPA.
- `packages/web` — React + Vite + React Flow SPA: login gate, canvas, inspector, OKF import/export, push.

## Develop

```bash
pnpm install
pnpm --filter @mc/okf build      # web/server consume okf's built dist
pnpm dev:web                     # Vite dev server (SPA) on :5173
pnpm dev                         # BFF (tsx watch) on :3000 — proxy/serve API
```

For a quick integrated check: `pnpm build` then `PORT=3111 pnpm --filter @mc/server start`, open http://localhost:3111 — the login gate ("Connect to OWOX") appears; paste an `owox_key_…` to connect.

## Test

```bash
pnpm -r test     # okf + server + web (Vitest)
```

## Deploy (Render)

One Web Service, Node runtime.

- **Build:** `pnpm install && pnpm build` (builds `okf` + `web`, typechecks `server`).
- **Start:** `pnpm --filter @mc/server start` (runs `src/server.ts` via `tsx` — chosen over compiled JS to avoid Node-ESM extension resolution friction; `tsx` is a runtime dependency).
- **Env:** `PORT` (provided by Render). No secrets at rest — the OWOX API key is supplied by the user at runtime and held only in the BFF session.

## Auth

Paste your OWOX API key (`owox_key_…`, from Project settings → My API Keys). It is stored in the browser's `localStorage` (single-user convenience) and exchanged by the BFF for a short-lived access token. **Sign out** (top bar) clears it.
