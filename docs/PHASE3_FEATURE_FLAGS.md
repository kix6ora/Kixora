# Phase 3 — Feature Flag Matrix & Env Documentation

## Defaults (all false for safety)
- USE_SUPABASE_CATALOG = false
- USE_SUPABASE_DROPS = false
- USE_SUPABASE_CART = false
- USE_SUPABASE_WISHLIST = false
- USE_SUPABASE_ORDERS = false
- USE_SUPABASE_CHECKOUT = false
- USE_SUPABASE_ADMIN = false
- USE_SUPABASE_AUTH = false

## Staging rollout order
1. Catalog first: VITE_USE_SUPABASE_CATALOG=true
2. Drops: VITE_USE_SUPABASE_DROPS=true
3. Cart + Wishlist: VITE_USE_SUPABASE_CART=true, VITE_USE_SUPABASE_WISHLIST=true
4. Orders: VITE_USE_SUPABASE_ORDERS=true
5. Checkout / Admin / Auth deferred to later phases

## Offline vs Supabase behavior
- Flags OFF: localStorage seed data (INITIAL_SNEAKERS, INITIAL_DROPS, etc.)
- Catalog ON: adapter.loadCatalog() → repository.getProducts() with fallback
- Drops ON: adapter.loadDrops() → repository.getDrops() with fallback
- Cart/Wishlist/Orders: repository sync only when user is authenticated; guest mode stays localStorage

## Current local implementation status (2026-09-24)
- `src/config/features.ts`: Supabase feature flags default to false.
- `src/context/StoreContext.tsx`: catalog/drops reads and notification persistence route
  through the catalog adapter; cart, wishlist, and order synchronization are gated by
  their corresponding flags.
- `scripts/playwright-server.ts`: local browser tests force placeholder Supabase
  configuration and all Supabase feature flags off, preventing remote project access.
- `src/context/adapters/catalogAdapter.ts`: catalog/drop operations check their flags.
- `npm run lint` and `npx tsc --noEmit` passed after the test-target safety change.
- The isolated all-flags-off customer regression passed (24 Playwright tests). It uses
  placeholder Supabase configuration, local seed data, and mock payment mode.

## Verification and rollout status
- The linked Supabase project is `Kixora-staging` (`gzxhgeudovbdpgbvzwoa`), and a
  linked `supabase db push --dry-run` reported the remote database up to date through
  migration `0027`.
- Staging-backed feature-group verification remains incomplete. It requires approved
  staging customer/admin test accounts and newly rotated staging client credentials;
  do not reuse credentials exposed by prior CLI output.
- No additional staging seed was applied in this pass. `01_catalog.sql` is already
  represented by migration `0011`; `02_staging_demo_orders.sql` writes demo profiles
  and orders and requires an explicit QA-data approval before execution.
- Do not enable remote flags or change production flags until each staging group has
  passed its targeted verification. No production migration, seed write, or flag
  change is authorized here.