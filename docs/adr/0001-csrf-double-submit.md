# ADR 0001 — Replace `csurf` with a double-submit cookie + Fetch Metadata check

- **Status:** Accepted
- **Date:** 2026-10-14
- **Supersedes:** the `csurf` middleware wired in Phase A

## Context

`csurf` is archived and deprecated. It currently guards `/api/payments`,
`/api/shipping` and `/api/notifications` using a `csrf_secret` cookie and a
`csrf-token` header. An unmaintained security library is a supply-chain risk.

## Decision

Remove `csurf`. Replace it with two stateless layers:

1. **Fetch Metadata (`Sec-Fetch-Site`)** — reject state-changing requests whose
   `sec-fetch-site` is `cross-site`. Browsers set this header and a page cannot
   spoof it. This is the primary control.
2. **Double-submit cookie** — a random token is issued in an `httpOnly`
   `csrf_secret` cookie (`SameSite=Strict`, `Secure` in production) and must be
   echoed in the `csrf-token` request header. The server compares the two with a
   timing-safe equality check. This is the fallback for clients that do not send
   Fetch Metadata.

Only unsafe methods (POST/PUT/PATCH/DELETE) are checked. `/api/webhooks/*` is
exempt from the Fetch Metadata layer: those callbacks are server-to-server and
are authenticated by signature.

## Why not a nonce / synchroniser token

A nonce needs server-side session state and an HTML-transforming render step.
Kixora serves a static SPA shell, so there is nothing to inject a nonce into. The
double-submit pattern is stateless.

## Compatibility contract (do not change)

- Cookie name: `csrf_secret`
- Header name: `csrf-token` (case-insensitive)
- Accepted header aliases: `x-csrf-token`, `xsrf-token`, `x-xsrf-token` — kept
  for backward compatibility with clients written against `csurf`, which
  accepted all of these spellings.
- Endpoints: `GET /api/csrf` and `GET /api/csrf-token` → `{ csrfToken }`
- Rejection: HTTP 403 `{ "error": "Invalid CSRF token" }`

`tests/security.spec.ts` and `tests/security/phase-a-hardening.spec.ts` encode
this contract.

## Risk

The classic double-submit weakness is cookie injection from a sibling subdomain.
It is mitigated by `SameSite=Strict` and the Fetch Metadata layer. A signed/HMAC
token would remove it entirely at the cost of a shared secret; revisit only if a
second registrable domain is introduced.

## Alternatives considered

Keep `csurf`. Rejected: unmaintained, no upstream security fixes.

## Rollback

Revert the commit; `csurf` and `@types/csurf` are restored from `package.json`.

## Consequences

- `csurf` and `@types/csurf` are removed from `package.json`.
- CSRF lives in `src/server/csrf.ts`.
- The `EBADCSRFTOKEN` branch is removed from the global error handler.
