# T1 / T2 — Sentry SDK and CSP tightening (evidence)

**Branch:** `cline/mm6qa9sn` (based on `develop` @ `96b2033`) · **Date:** 2026-10-14

## T1 — Real error tracking

Installed `@sentry/react@11.7.0` and `@sentry/node@11.7.0`.

- `src/lib/sentryServer.ts` — Node SDK init + reporter registration (called from `server.ts`).
- `src/lib/sentryBrowser.ts` — browser SDK init + reporter registration (called from `src/main.tsx`).
- `src/services/monitoringService.ts` — the fake `fetch(SENTRY_DSN)` POST is deleted.
  `reportError` now delegates to the registered SDK reporter and falls back to the
  structured console only when no SDK is registered.
- `src/config/env.ts` — `getObservabilityConfig` reads `SENTRY_DSN` on the server
  and `VITE_SENTRY_DSN` in the browser via the shared `readEnv` helper.

Startup log, `SENTRY_DSN` unset:

    {"message":"[Startup] Error tracking","sentryEnabled":false}

Startup log, `SENTRY_DSN=https://abc123@o0.ingest.sentry.io/0`:

    {"message":"[Startup] Error tracking","sentryEnabled":true}

Remaining human action: set `SENTRY_DSN` on the Render services and confirm one
deliberately thrown staging error lands in the dashboard within 60s.

## T2 — CSP tightening

`server.ts` now uses `buildCspScriptSources(isProduction)`, and the crawler
redirect in the `/product/:id` route was changed from an inline `<script>` to a
`<meta http-equiv="refresh">`, so no inline script remains in any served HTML.

Live production header (`NODE_ENV=production node dist/server.cjs`):

    Content-Security-Policy: default-src 'self'
    script-src 'self'
    script-src-attr 'none'
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com https://res.cloudinary.com
    frame-ancestors 'none'
    object-src 'none'

- `script-src` no longer contains `'unsafe-inline'` or `'unsafe-eval'`.
- `style-src` keeps `'unsafe-inline'` (Tailwind/motion inject styles at runtime).
- Production `dist/index.html` has no inline script — only
  `<script type="module" crossorigin src="/assets/index-*.js"></script>`.
- Dev keeps the relaxed directives because the Vite dev server injects inline HMR
  scripts. Asserted by `tests/unit/cspImageSources.test.ts`.

## Verification (all green)

    npx tsc --noEmit                           -> exit 0
    npx eslint . --max-warnings 0              -> exit 0
    npx vitest run --config vitest.config.ts   -> exit 0 (32 files, 107 tests)
    npm run build                              -> exit 0 (dist/server.cjs 92.1kb)
    GET /api/health  -> 200 {"status":"ok",...}
    GET /api/ready   -> 503 {"status":"degraded",...}   (no live Supabase, expected)
