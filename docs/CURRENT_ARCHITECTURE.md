# Kixora Current Architecture

**Reviewed:** 2026-10-04 against repository source at e71e3e4 (ancestor of audited main) plus live catalog metadata for confirmed production Supabase. This records what exists, not a claim that every path is healthy or production-ready.

## Frontend

- React 18 + TypeScript + Vite, Tailwind CSS, React Three Fiber/Three.js for product visuals, Lucide icons and Motion.
- A single application entry builds the storefront and admin views. The repository uses domain guards and protected/admin route components; no React Router dependency was found in package.json or imports. Navigation/view state is rendered through app/component state rather than a router library.
- Shared store state is in `src/context/StoreContext.tsx`; auth and domain-specific state is exposed through hooks under `src/hooks`.
- UI components live under `src/components`, with storefront/cart/checkout/auth/product/SEO and admin dashboard/products/orders/inventory/promotions/analytics components.
- API/data access is organized as repositories (`src/repositories`), services (`src/services`), Supabase client (`src/lib/supabase.ts`) and mappers/adapters. The public browser client uses the anon key and relies on RLS for row access.
- Forms and component-level validation are distributed across UI and service code. Error handling uses service results, UI state and a structured server logger; critical flows still need systematic network-failure and validation coverage.

## Backend

- Express 5 TypeScript server in root `server.ts`, run with tsx in development and bundled as CommonJS `dist/server.cjs` for production; static Vite assets are served by the same process.
- Routes cover health/readiness, CSRF, PayFast initiation/status/webhook, shipping rates/labels/tracking webhook and email notifications. Middleware includes Helmet, CORS allowlist validation, cookie parsing, CSRF, express-rate-limit, payload caps and centralized errors.
- Service modules handle checkout, payment drivers, webhook idempotency/reconciliation, inventory, shipping/carrier, email, auth, admin orders, fulfillment and analytics.
- Authentication primarily uses Supabase Auth in browser flows. Admin UI/route checks use role hooks and domain guards; database/server authorization remains the enforcing boundary.
- The production-hardening branch has a server-only service-role client for webhook reconciliation; the key must remain server-only and webhook mutations must not use the anon client.

## Database

- Supabase-managed PostgreSQL 17 with Auth and PostgREST Data API. Repository migrations are in `supabase/migrations` (0001–0031 at audited baseline; completion work adds 0032).
- Confirmed production catalog lists 27 public base tables: admin_audit_logs, bespoke_designs, brands, cart_items, carts, categories, drops, fulfillment_batches, fulfillment_channels, fulfillment_locations, inventory, inventory_reservations, inventory_sync_logs, order_items, order_status_history, orders, payment_reconciliation_logs, product_images, product_sizes, products, profiles, promo_codes, promo_redemptions, raffle_entries, shipments, webhook_events and wishlists.
- Foreign keys connect catalog/variants/inventory, user carts/wishlists, orders/items/status history, reservations, promo redemptions, fulfillment and shipment/audit records. The database uses SQL functions/RPCs and triggers for atomic checkout, reservation/confirmation/release, payment reconciliation, auth-role sync, RLS helpers and audit/history.
- RLS is enabled on nearly all public tables in production and all observed tables in staging. The live audit found production RLS disabled on payment_reconciliation_logs, many public-executable SECURITY DEFINER functions, mutable search paths, and an applied-migration gap between production and staging.
- The repository defines Postgres constraints and an in-memory pg-mem validator. The latter simulates selected invariants; it is not equivalent to applying migrations and role policies on real Supabase/Postgres.

## External services

| Service | Purpose/evidence | Current confidence |
|---|---|---|
| Supabase | Auth, Postgres, public anon client, server service role, REST/RPC | Production and staging metadata inspected; role matrix incomplete |
| PayFast | Checkout redirect/initiation and ITN verification/reconciliation | Staging path includes provider postback VALID check; direct DB boundary had critical defect |
| Cloudinary | Image/media client packages and configuration | Integration present; upload policy and production usage unverified |
| The Courier Guy | Carrier configuration, rates/labels/tracking code | Integration present; live account and spend controls unverified |
| Resend | Transactional email configuration/service | Integration present; production configuration and abuse protection unverified |
| Render | Observed staging storefront/admin services | Latest deploys failed at audit; no production service visible in connected workspace |

No Stripe or other payment gateway was found in the declared stack reviewed.

## Main data flow

1. Browser loads catalog and profile/cart data through repositories/adapters using Supabase anon + user JWT, constrained by RLS.
2. Checkout validates UI input and calls atomic Postgres order/reservation RPCs; server-side price, promotion and identity rules must remain authoritative.
3. PayFast checkout is initialized by Express. Provider ITN reaches Express, is checked with PayFast postback validation and signature/business-data checks, then durable idempotency and database reconciliation are performed using a server-only service-role client.
4. Inventory reservations transition to confirmed or released with order state; fulfillment/shipping and customer notifications follow.
5. Admin UI calls service/repository layers. Admin capabilities must be enforced by server/database checks, not hidden navigation.

The above describes intended boundaries. Live audit evidence shows the database permission boundary and some deployments do not yet satisfy this design.

