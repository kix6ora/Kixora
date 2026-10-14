# T3 / T4 — csurf replacement and rate-limit store decision (evidence)

**Branch:** `cline/mm6qa9sn` (based on `develop` @ `96b2033`) · **Date:** 2026-10-14

## T3 — Replace `csurf`

`csurf` and `@types/csurf` are removed (`npm uninstall csurf @types/csurf`,
13 packages dropped; 0 references left in `package.json` / `package-lock.json`).
New module: `src/server/csrf.ts`. Decision record:
`docs/adr/0001-csrf-double-submit.md`.

Two stateless layers replace it:

1. **Fetch Metadata guard** on `/api/*` — rejects unsafe methods with
   `Sec-Fetch-Site: cross-site`; exempts `/api/webhooks/*`.
2. **Double-submit cookie** — `csrf_secret` (httpOnly, SameSite=Strict, Secure in
   prod) must equal the `csrf-token` header on `/api/payments`,
   `/api/shipping`, `/api/notifications`. Timing-safe compare.

The `EBADCSRFTOKEN` branch was removed from the global error handler. The
crawler `/product/:id` inline script stays gone (T2).

### Live proof (`NODE_ENV=production node dist/server.cjs`)

    1) GET /api/csrf
       HTTP/1.1 200 OK
       Set-Cookie: csrf_secret=OeuFlLWc2UCQvJ6Vn5q4t6ENjhgETgVUgHVihElic74; Path=/; HttpOnly; Secure; SameSite=Strict
       {"csrfToken":"OeuFlLWc2UCQvJ6Vn5q4t6ENjhgETgVUgHVihElic74"}

    2) POST /api/payments/payfast/initiate  (no token)
       status=403 {"error":"Invalid CSRF token"}

    3) POST /api/payments/payfast/initiate  (cookie + csrf-token header)
       status=500 {"error":"Unable to initialize PayFast checkout."}
       (token accepted — the 500 is the PayFast handler with no live Supabase)

    4) POST /api/payments/payfast/initiate  (Sec-Fetch-Site: cross-site)
       status=403 {"error":"Blocked cross-site request"}

Compatibility contract preserved: cookie `csrf_secret`, header `csrf-token`,
endpoints `/api/csrf` + `/api/csrf-token`, 403 `{error:'Invalid CSRF token'}` —
so `tests/security.spec.ts` and `tests/security/phase-a-hardening.spec.ts` still
hold. `csurf` is absent from `dist/server.cjs` (`grep -c csurf` → 0).

## T4 — Rate-limit store decision

Decision record: `docs/adr/0002-rate-limit-store.md`. Policies extracted to
`src/server/rateLimit.ts` and unit-tested. `render.yaml` pins
`numInstances: 1` on all three services with an inline ADR reference.

Startup log now reports the store mode:

    {"message":"[Startup] Rate limiting","store":"memory","instances":"single-required"}

Chosen path: **per-instance limits + pinned single instance** (the workflow's
explicit alternative). A shared store (Supabase table or Upstash Redis) is
documented as the prerequisite for scaling out; it is deliberately not built now
because it would add a network dependency and, for Supabase, a DB write on every
limited request while the app runs on one instance.

## Verification (all green)

    npx tsc --noEmit                           -> exit 0
    npx eslint . --max-warnings 0              -> exit 0
    npx vitest run --config vitest.config.ts   -> exit 0 (34 files, 122 tests)
    npm run build                              -> exit 0 (dist/server.cjs 94.7kb)
