# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do **not** open a public GitHub issue, PR, or discussion for a vulnerability.

Email **bi@owox.com** with:

- a description of the issue and its impact,
- steps to reproduce (or a proof of concept),
- the affected component (`packages/okf`, `packages/server`, `packages/web`) and version/commit if known.

We aim to acknowledge reports within a few business days and will keep you updated as we investigate and ship a fix. Please give us reasonable time to remediate before any public disclosure. We're happy to credit reporters who'd like acknowledgement.

## Supported versions

This is an actively developed project; security fixes target the latest `main` (and the deployed app at `model.owox.com`). There are no long-term support branches.

## Security model (context for reporters)

The server (`packages/server`) is a thin BFF in front of the OWOX API, hardened with:

- **CSP + security headers** (`@fastify/helmet`): `script-src 'self'` (no inline scripts in the build), HSTS, `X-Content-Type-Options`, `frame-ancestors 'none'`.
- **Per-IP rate limiting**, with a tighter cap on the one endpoint that triggers an outbound OWOX token exchange.
- **`apiOrigin` allowlist** — a user-supplied key's origin must be an `https` `owox.com` host, blocking SSRF to internal/metadata addresses.
- **In-memory sessions** with a TTL and a hard cap; no secrets are stored at rest.

Known, documented tradeoff: the OWOX API key is kept in the browser's `localStorage` for convenience, so an XSS would expose it — CSP is the primary mitigation. Reports that strengthen this boundary are especially welcome.
