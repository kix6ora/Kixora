# Required Item 1: Real Staging Environment — Gate Report

**Branch:** `staging/payfast-checkout`  
**Local HEAD:** `e142e1a`  
**Remote branch HEAD at check:** `ebecce9`  
**Report status:** The local blocker commits could not be pushed because GitHub authentication is unavailable in this session. No staging migrations were applied.

## Gate evidence

| # | Gate item | Status | Evidence | Commit SHA |
|---|---|---|---|---|
| R0 | Build SHA visibility | PENDING-USER | Added the first seven characters of `RENDER_GIT_COMMIT` to health JSON in [healthCheck.ts](../../src/lib/healthCheck.ts#L21), with a unit test. Both currently deployed health endpoints return HTTP 200 but have no `commit` field; the new commit has not been pushed/deployed. | `6bebb14` |
| R1 | Customer deployment SHA | PENDING-USER | Push failed with `fatal: unable to get password from user`. Local HEAD is `e142e1a`; `git ls-remote origin staging/payfast-checkout` still reports `ebecce9`. The 20-poll/30-second verifier is [wait-for-render-deploy.mjs](../../scripts/staging/wait-for-render-deploy.mjs#L1); it was not run against an unpushed commit. | `e710d7e` |
| R2 | Deployed product images and 3D viewer | PENDING-USER | Chromium against the deployed customer URL saw 8 product rows, 5 distinct thumbnail URLs, 13/13 listing images and 18/18 detail images loaded. `curl -sSI` returned HTTP 200 and `image/jpeg` for each distinct live thumbnail. Screenshots are saved under ignored `artifacts/staging-item1/`. The database currently returns no model URLs and the detail page has 0 canvases. No browser console errors or CSP violations were observed. The deployed CSP has `script-src` for first-party scripts, `img-src` for Unsplash/Cloudinary/Supabase plus `data:`, and `connect-src` for Cloudinary/Supabase; it has no `worker-src` and does not yet include `blob:` image support. The code now adds the model URL field and maps it in [productMapper.ts](../../src/repositories/customer/productMapper.ts#L111), and configures the model origin, `worker-src 'self' blob:`, and `img-src blob: data:` in [server.ts](../../server.ts#L94) and [cspImageSources.ts](../../src/config/cspImageSources.ts#L1). The new code and [0032_product_model_urls.sql](../../supabase/migrations/0032_product_model_urls.sql) are not deployed/applied. | `a1713f4` |
| R3 | Admin API role enforcement | PENDING-USER | [0033_admin_audit_access.sql](../../supabase/migrations/0033_admin_audit_access.sql#L1) revokes direct `SELECT` and adds the admin-checked `admin_audit_logs_for_admin` RPC; the client now calls it from [auditAdminRepository.ts](../../src/repositories/admin/auditAdminRepository.ts#L25). `server.ts` currently defines no `/api/admin` routes, and the admin UI reads audit logs directly through Supabase, so the RPC is the applicable boundary. The migration has not been applied and credential-based 403/42501 retests have not run. See [verify-api-roles.mjs](../../scripts/staging/verify-api-roles.mjs#L1). | `3b115a2` |
| R4 | Email confirmation redirect | PENDING-USER | `signUp` now uses validated `VITE_PUBLIC_SITE_URL` via [authService.ts](../../src/services/authService.ts#L96); production startup validation is in [env.ts](../../src/config/env.ts#L51), and unit tests cover both. No resend or password-reset calls exist in source. Render and Supabase URL settings plus the fresh-email confirmation flow remain user actions. | `1567830` |
| R5 | Google sign-in scope | DEFERRED | No Supabase `signInWithOAuth` sign-in flow or sign-in button exists. The current Google Identity Services hook is for Drive reports only. Formal deferral and prerequisites are recorded in [deferrals.md](./deferrals.md). | `6ac7de6` |
| R6 | Admin sign-out | PENDING-USER | Added an explicit Sign out control in [AdminSignOutButton.tsx](../../src/components/admin/AdminSignOutButton.tsx#L6) that calls `useAuth().signOut()` and returns to the guarded admin view; the existing “Exit Admin” remains navigation only. Unit coverage passed. The deployed unauthenticated admin view did show the login screen, but new-code signed-in sign-out/session clearing cannot be tested until deploy and credentials are available. Run [verify-admin-signout.mjs](../../scripts/staging/verify-admin-signout.mjs#L1). | `50de1af`, `e142e1a` |
| R7 | Deferred small items | DEFERRED | Placeholder icons and live PayFast passphrase separation are formally recorded in [deferrals.md](./deferrals.md). Live checkout was not used. | `d547ee1` |
| R8 | Final deployment comparison | PENDING-USER | Not satisfied: local HEAD `e142e1a` differs from remote `ebecce9`; both deployed `/api/health` endpoints currently return HTTP 200 with `commit: null`. Final comparison must be repeated after push and Render deploy. | `e710d7e` |
| C1 | Customer/admin distinct origins | PASS | Customer and admin use distinct staging hostnames. Both deployed services returned HTTP 200 and matching `Access-Control-Allow-Origin` headers for either allowed origin. | `ef76da2` |
| C2 | CORS | PASS | Live requests from each staging origin returned HTTP 200 with the matching allow-origin header; a disallowed origin returned HTTP 403 with no allow-origin header on both services. | `ef76da2` |
| C3 | Auth | PENDING-USER | Current deployed admin UI prompted unauthenticated visitors with “Vault Admin Authentication”. Customer-token and admin-role checks, plus the signed-in logout retest, require the user credential scripts after deploy. | `50de1af` |
| C4 | Sandbox checkout | PASS | Previously proven sandbox flow per supplied context; checkout/webhook tests remained green. No live PayFast or Stripe checkout was used. | `4dbe156` |
| C5 | No secrets exposed | PASS | No credential values were read, printed, or added to source/report. Health JSON contains only status/domain/time/uptime/check fields and the short build SHA. Credential scripts print status, role, error code, and row counts only. | — |
| C6 | Duplicate-ITN stock evidence | PENDING-USER | Duplicate ITN handling is covered in code/tests, but deployed stock evidence still depends on the user’s sandbox purchase and duplicate notification. | `4418161` |

## Decisions and rationale

- Added nullable `products.model_url` through migration `0032` because live catalog rows contain images but no model URL field; no fake model URL or asset was invented.
- Used a `SECURITY DEFINER` audit RPC with explicit `is_admin()`/`is_super_admin()` checks and SQLSTATE `42501` because the admin UI previously selected audit rows directly; direct `SELECT` is revoked from `anon` and `authenticated`.
- Did not add an admin API route or middleware: no `/api/admin` route exists in this repository’s Express server. The current admin data access is Supabase/PostgREST.
- Deferred Google account sign-in because only Google Drive OAuth exists and sign-in would also require provider/client dashboard configuration.
- Kept “Exit Admin” as navigation and added a separate auth-backed Sign out control.
- Did not apply migrations, write staging data, use a service-role key, or run live payment checkout.
- The R6 browser verifier needed a follow-up locator correction after the live admin navigation was observed; both R6 commits are listed above.
- The existing PR is open as #22, is not marked draft, and has an empty body. `gh` is not authenticated, so its description could not be updated; a prepared description is in [item1-pr-description.md](./item1-pr-description.md).
- The report and PR-description draft are intentionally not committed. Creating/pushing another documentation commit would change the SHA that R8 must verify; the deployed comparison is already pending because the code push failed.

## User actions — exact order

### 1. Authenticate GitHub push and push the branch

From the repository root, after configuring GitHub write authentication:

```sh
git push origin staging/payfast-checkout
git rev-parse --short HEAD
git ls-remote origin staging/payfast-checkout
```

Paste the push result and the two SHA lines. Do not paste credentials or tokens.

### 2. Apply staging migrations (Supabase SQL Editor)

In Supabase Dashboard → project `Kixora-staging` → SQL Editor, run the complete contents of [0032_product_model_urls.sql](../../supabase/migrations/0032_product_model_urls.sql) first, then [0033_admin_audit_access.sql](../../supabase/migrations/0033_admin_audit_access.sql). Do not use a service-role key or apply these to production.

Then run this read-only privilege/RLS check:

```sql
SELECT
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', 'public.admin_audit_logs', 'SELECT') AS anon_select,
  has_table_privilege('authenticated', 'public.admin_audit_logs', 'SELECT') AS authenticated_select,
  has_function_privilege(
    'anon',
    'public.admin_audit_logs_for_admin(text,text,uuid,integer,integer)',
    'EXECUTE'
  ) AS anon_rpc_execute,
  has_function_privilege(
    'authenticated',
    'public.admin_audit_logs_for_admin(text,text,uuid,integer,integer)',
    'EXECUTE'
  ) AS authenticated_rpc_execute
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'admin_audit_logs';

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'admin_audit_logs';
```

Expected privilege row: RLS enabled, `anon_select = false`, `authenticated_select = false`, `anon_rpc_execute = false`, and `authenticated_rpc_execute = true`. Paste only SQL success/error codes and these query results.

The migration adds the model URL column but cannot make a 3D viewer appear without real GLB assets. Once approved model assets and URLs are available, provide their public URLs so an idempotent data migration can be prepared; do not update staging rows ad hoc.

### 3. Configure and deploy both Render services

For both `kixora-staging` and `kixora-admin-staging`, open Render → service → Settings → Build & Deploy. Set Branch to `staging/payfast-checkout` and Auto-Deploy to On. Add `VITE_PUBLIC_SITE_URL` on both services, set to the customer staging origin. If GLB files use a separate host, set the existing optional `VITE_SNEAKER_MODEL_BASE_URL` to that host on both services.

Deploy the latest commit. If the customer service does not reach the new SHA after the poller’s 20 checks, use Render → `kixora-staging` → Settings → Build & Deploy, confirm Branch and Auto-Deploy, then Manual Deploy → Deploy latest commit. Repeat for admin if it lags.

Run:

```sh
node scripts/staging/wait-for-render-deploy.mjs
```

Paste its status/commit output. The output contains no environment values.

### 4. Set Supabase Auth URL configuration

Supabase Dashboard → `Kixora-staging` → Authentication → URL Configuration:

- Site URL: `https://kixora-staging.onrender.com`
- Add Redirect URLs: `https://kixora-staging.onrender.com/**`
- Add Redirect URLs: `https://kixora-admin-staging.onrender.com/**`

Paste a confirmation that these three URL settings are saved; do not paste credentials.

### 5. Run customer/admin role checks

From the repository root, enter credentials without echoing them, then run the script:

```sh
read -r -p 'Customer email: ' STAGING_CUSTOMER_EMAIL
read -r -s -p 'Customer password: ' STAGING_CUSTOMER_PASSWORD; printf '\n'
read -r -p 'Admin email: ' STAGING_ADMIN_EMAIL
read -r -s -p 'Admin password: ' STAGING_ADMIN_PASSWORD; printf '\n'
read -r -s -p 'Supabase anon key: ' SUPABASE_ANON_KEY; printf '\n'
export STAGING_CUSTOMER_EMAIL STAGING_CUSTOMER_PASSWORD STAGING_ADMIN_EMAIL STAGING_ADMIN_PASSWORD SUPABASE_ANON_KEY
node scripts/staging/verify-api-roles.mjs
```

Paste only the script’s JSON output. Expected customer direct audit-table read and customer audit RPC: HTTP 403; RPC error code `42501`; admin RPC HTTP 200; customer/admin role names correct. The script inventories this repository’s `/api/admin` routes and tests every route it finds; current count is zero.

### 6. Run browser checks and email confirmation retest

Run the real deployed catalog/CSP/image/model check:

```sh
node scripts/staging/verify-assets.mjs
```

Paste product count, per-asset HTTP/content-type results, image counts, canvas count, CSP directives, browser/CSP errors, and model URL count. Do not paste environment values. For a 3D PASS, first provide real GLB URLs through an idempotent migration and confirm the deployed CSP allows their host; then the detail view must show a canvas with no CSP violations.

For admin sign-out, enter the admin email/password in non-echoing prompts and run:

```sh
read -r -p 'Admin email: ' STAGING_ADMIN_EMAIL
read -r -s -p 'Admin password: ' STAGING_ADMIN_PASSWORD; printf '\n'
export STAGING_ADMIN_EMAIL STAGING_ADMIN_PASSWORD
node scripts/staging/verify-admin-signout.mjs
```

Paste only its JSON status output. It must show the login-required protected view after sign-out and zero auth storage entries.

For email confirmation, complete these four steps:

1. On `https://kixora-staging.onrender.com`, sign up with a fresh email address.
2. Open the confirmation email and click its link.
3. Confirm the browser lands on the customer staging origin.
4. Confirm the customer account is signed in.

Paste only whether all four steps passed and the final origin; never paste the confirmation link or credentials.

Finally, run `git rev-parse --short HEAD` and `git ls-remote origin staging/payfast-checkout` again after any subsequent commits. Paste both values. If you update the PR description, first authenticate `gh`, then run `gh pr edit 22 --body-file docs/staging/item1-pr-description.md`; do not create a new PR.

## Final verdict

**NOT PASSED, pending:** authenticated push of `staging/payfast-checkout`; Render deploys showing the final branch SHA on both services; staging migrations `0032` and `0033` applied and verified; real GLB URLs and deployed 3D canvas/CSP check; customer/admin credential role retests; Supabase Auth URL settings and four-step email confirmation; signed-in admin sign-out retest; duplicate-ITN stock evidence from the user’s sandbox purchase; and the final R8 SHA comparison.
