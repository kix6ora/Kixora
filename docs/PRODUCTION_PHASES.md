# KIXORA — Phases to Production

**Project:** KIXORA Authentic Sneaker Platform  
**Repo:** https://github.com/Mandlakaise-Qhomane/Kixora  
**Branch audited:** `main` (`6767cad`)  
**Also present (unmerged):** `remediation/production-launch`  
**Visual source:** KIXORA brand / homepage design board  
**Date:** 10 September 2026

---

## Current state

The storefront already has a dark UI, orange accent usage, hero copy (“BUILT FOR THE CULTURE”), product cards, cart/checkout, admin hub, Supabase schema, DAL repositories, and payment/shipping route stubs. The selected production integrations are PayFast for payments and The Courier Guy for delivery.

It is **not** production-ready and it does **not** yet match the design board exactly.

### Design gaps vs the picture

| Item | Design board | Current `main` |
|---|---|---|
| Canvas `#111111` + accent `#FF7A00` | Required | Partial. CSS variables exist; Tailwind `vault.accent` is still `#00F0FF` |
| Space Grotesk / Inter / JetBrains Mono | Required | Named in CSS, not loaded in `index.html` |
| Metallic KIXORA mark + “OWN THE CULTURE” | Required | Flat text logo, no tagline |
| Homepage hero (NEW DROP, rock platform, SHOP NOW, trust row) | Required | Mostly implemented |
| 3D product cards / hover-rotate / WebGL | Required | CSS tilt + image swap only |
| Mobile bottom tabs | Required | Hamburger drawer only |
| PWA / Dark Mode First / Mobile First strip | Required | No manifest, no service worker |
| ABOUT in nav | Required | Navbar says AUTHENTICITY |

### Launch blockers

1. Fonts and design tokens are not locked to the board.
2. Catalog can still run on local seed data (`VITE_USE_SUPABASE_CATALOG=false`).
3. Payments default to `mock`.
4. Admin UI ships in the same public bundle as the store.
5. Helmet `frameguard: deny` conflicts with custom `frameAncestors`.
6. Global JSON body limit is still 50mb. `csurf` is installed but not wired. No `CORS_ORIGIN` allowlist.
7. No real 3D pipeline (Three.js / `.glb`).
8. No PWA service worker or install prompt.
9. Cloudinary URLs assume cloud name `kixora` — assets may 404.
10. No Dockerfile, staging/prod deploy workflows, Sentry, or real `/api/health` (DB ping).

---

## Phase 1 — Design system lock

**Status:** Prepared locally. Not committed (GitHub write scope blocked).

**Objective:** Make the live app use the exact brand system from the picture.

**Work**

- Load Space Grotesk, Inter, and JetBrains Mono in `index.html`.
- Replace leftover cyan/gold Tailwind tokens with:
  - `#FF7A00` `#232323` `#111111` `#F5F5F5` `#FFFFFF`
- Wordmark: orange **X**, tagline **OWN THE CULTURE**.
- Shared button and chip styles (PRIMARY / SECONDARY / NEW / SALE / LIMITED).
- Mobile bottom tab bar: Home, Shop, Drops, Cart, Account.
- `public/manifest.json` (name: Kixora Vault, theme `#111111`).
- Nav label ABOUT (not AUTHENTICITY).
- Footer capability strip: PWA Ready, Dark Mode First, Ultra Fast, SEO Optimized, Mobile First.

**Exit criteria**

- Headlines render in Space Grotesk.
- No cyan accent left in the design tokens.
- Mobile tab bar visible below `lg`.
- Visual match on typography, colour, and chrome is clearly closer to the board.

---

## Phase 2 — Homepage and product-card fidelity

**Objective:** The storefront hero and cards look like the “HOMEPAGE HERO” and “3D PRODUCT CARDS” frames.

**Work**

- Hero: NEW DROP, BUILT FOR **THE CULTURE**, one primary SHOP NOW, sneaker on glowing rock platform.
- Trust row: Authentic Guarantee, Fast Delivery, Secure Payments, Easy Returns.
- Product cards: orange border on hover/active, R price in mono, orange cart tile.
- Optional phone-frame preview of the mobile homepage.
- Image zoom and per-size stock colours in the product modal.

**Exit criteria**

- Side-by-side with the design board, hero and cards match layout and hierarchy.
- No extra competing CTAs in the hero.

---

## Phase 3 — StoreContext and DAL integration

**Objective:** UI state talks to real repositories without breaking the current storefront.

**Work**

- Wire `StoreContext` to catalog, drops, cart, wishlist, and order repositories.
- Feature flags (`USE_SUPABASE_*`) with local fallback.
- Keep public hook/component signatures stable.

**Exit criteria**

- Flags on: catalog, cart, wishlist, and orders read/write Supabase.
- Flags off: app still runs on local data.
- Existing Playwright smoke tests still pass.

---

## Phase 4 — Authentication and domain isolation

**Objective:** Real auth and a hard split between store and admin.

**Work**

- Supabase Auth with roles: `customer`, `admin`, `super_admin`.
- Storefront at `kixora.com`, Admin Hub at `admin.kixora.com`.
- Vite bundle split so admin code is not in the public store bundle.
- Remove mock “email contains admin” style grants if any remain.

**Exit criteria**

- Customer session cannot open admin routes.
- Admin assets are absent from the storefront production bundle.

---

## Phase 5 — 3D sneaker experience

**Objective:** Deliver the 3D behaviour advertised on the board.

**Work**

- Add `@react-three/fiber`, `@react-three/drei`, `three`.
- Card mini-viewer: auto-rotate on hover.
- Product modal / hero: orbit, zoom, studio lighting, contact shadows.
- Lazy-load Three.js. Fallback to 2D Cloudinary images if WebGL is missing.
- GLB/GLTF pipeline (or turntable image fallback via Cloudinary).

**Exit criteria**

- Three.js is a separate chunk and does not block first paint.
- Fallback image renders when WebGL is unavailable.
- Mobile hover/touch rotate works at usable FPS.

---

## Phase 6 — Checkout and payments

**Objective:** Take real money and commit stock once.

**Work**

- PayFast as the sole payment provider (ZAR).
- Server-side PayFast ITN verification and idempotent order reconciliation.
- Atomic checkout (`place_order_atomic`) so stock cannot oversell.
- Multi-currency display with ZAR as base.

**Exit criteria**

- Mock mode is off in production.
- Successful payment → order `Paid` and stock decremented once.
- Duplicate webhooks are idempotent.

---

## Phase 7 — PWA and media

**Objective:** Installable app and production-grade imagery.

**Work**

- Service worker: cache-first for `/assets/*`, network-first for `/api/*`, offline fallback.
- Custom install prompt with remembered dismissal.
- Offline cart queue (IndexedDB) and sync on reconnect.
- Move product, drop, and customizer media to Cloudinary or Supabase Storage.
- Confirm Cloudinary cloud name, presets, and live image URLs.

**Exit criteria**

- Installable on Android Chrome. iOS add-to-home documented.
- Product images load from CDN, not broken placeholders.
- Stale-cache strategy uses a versioned cache name.

---

## Phase 8 — Production hardening

**Objective:** Security and ops bar for a public shop.

**Work**

- CORS allowlist from `CORS_ORIGIN`.
- CSRF on `/api/payments/*`, `/api/shipping/*`, `/api/notifications/*`.
- Drop global JSON limit from 50mb to 1mb. Webhook limiter 20 / 15 min.
- Remove Helmet `frameguard` conflict; keep CSP `frameAncestors`.
- Sentry on client and server.
- `/api/health` returns process, DB, and Supabase ping.
- Multi-stage Dockerfile. Split CI / staging / prod workflows.
- `npm audit --audit-level=high` as a CI gate.
- POPIA cookie banner; analytics blocked until accepted.

**Exit criteria**

- No high/critical npm audit findings.
- Health endpoint is comprehensive.
- Staging deploy exists and is separate from production.

---

## Phase 9 — External integrations

**Objective:** Fulfilment and customer communication.

**Work**

- The Courier Guy rates, waybills, and tracking webhooks. The current carrier driver returns simulated data; direct API integration and staging proof are still required before launch.
- Resend (or equivalent) order confirmation and Courier Guy shipping emails.
- Returns request UI and status on order tracking.
- Low-stock alerts in admin.

**Exit criteria**

- A paid order can generate a verified The Courier Guy waybill and tracking event using the live carrier integration.
- Customer receives confirmation email in staging.

---

## Phase 10 — Launch cutover

**Objective:** DNS, CDN, and sign-off.

**Work**

- Fill production secrets from `PRODUCTION_LAUNCH.md` (never commit real keys).
- Cloudflare Full (Strict) TLS, cache rules for `/assets/*` vs `/api/*`.
- DNS cutover for apex + `www` + `admin`.
- Full Playwright + unit + Lighthouse + security regression.

**Launch checklist**

- [ ] Design board match accepted
- [ ] All P0/P1 security items closed
- [ ] Payments live in production mode
- [ ] Stock commit is atomic
- [ ] PWA installable
- [ ] 3D viewer or approved 2D fallback
- [ ] Health checks and error tracking live
- [ ] Staging verified
- [ ] DNS + TLS verified
- [ ] Rollback plan tested

**Go / No-Go:** only after the checklist is evidenced, not assumed.

---

## Suggested order of work

1. Reconnect GitHub with **Contents: Read and write** and **Pull requests: Read and write**.
2. Commit Phase 1 onto `phase-1-design-system` and open a PR into `main`.
3. Do not skip to payments or DNS until Phases 3–4 are on and admin is isolated.
4. Treat Phase 5 (3D) and Phase 7 (PWA/media) as parallel tracks after Phase 2.

---

## Phase 1 files already prepared

These exist locally and are ready to commit once write access is restored:

- `index.html`
- `tailwind.config.js`
- `src/index.css`
- `public/manifest.json`
- `src/components/MobileNav.tsx`
- `docs/PRODUCTION_PHASES.md`
