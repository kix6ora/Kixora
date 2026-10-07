## Summary

Closes out the staging-gate code work for build SHA visibility, product model asset support/CSP, admin audit-log authorization, email confirmation redirect configuration, explicit admin sign-out, and documented deferrals.

## Migrations to apply to staging

1. `supabase/migrations/0032_product_model_urls.sql`
2. `supabase/migrations/0033_admin_audit_access.sql`

Apply in order to the `Kixora-staging` project only. The migrations are not applied by this branch.

## Environment variables

- Added: `VITE_PUBLIC_SITE_URL`
- Existing optional variable used for model-host CSP allowance: `VITE_SNEAKER_MODEL_BASE_URL`

No secret values are included here.

## Tests and evidence

| Check | Result |
|---|---|
| `npx vitest run` | 15 files, 45 tests passed |
| `npm run lint` | ESLint and TypeScript passed |
| Staging product API | 8 products, 5 distinct thumbnail URLs |
| Staging image requests | 13/13 listing and 18/18 detail images loaded; 5/5 distinct live product thumbnails returned HTTP 200 `image/jpeg` |
| Staging 3D data | No model URLs returned; 0 canvas; model URLs/assets still required |
| Staging CORS | Both configured origins accepted; disallowed origin returned 403 on each service |
| Staging health | Both services HTTP 200; SHA field awaits push/deploy |
| Admin/auth checks | Unauthenticated admin screen showed login; credential-based role and sign-out retests await user-run scripts |

## Deferrals

- Google account sign-in: no Supabase sign-in OAuth flow exists; Drive OAuth is separate.
- Placeholder icons: await approved brand assets.
- Live PayFast account passphrase: distinct live configuration and live checkout are outside this sandbox-only gate.
- Duplicate-ITN deployed stock evidence: awaits the user’s sandbox purchase.

Details: `docs/staging/deferrals.md` and `docs/staging/item1-gate-report.md`.
