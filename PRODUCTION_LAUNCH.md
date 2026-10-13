# Kixora Production Deployment, Webhook Security & Launch Runbook

## Phase 10: Production Readiness & Architecture Specification

---

## 1. Production Configuration & Secrets Checklist

| Variable Name | Context | Purpose | Mandatory in Prod |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Server | Set to `production` for security middleware & CSP | YES |
| `VITE_SUPABASE_URL` | Client & Server | Supabase project API gateway URL | YES |
| `VITE_SUPABASE_ANON_KEY` | Client & Server | Public read/write client key (enforced by RLS) | YES |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | Internal server maintenance & migration runner | YES |
| `VITE_PAYFAST_MERCHANT_ID` | Client & Server | PayFast merchant account identifier | YES |
| `VITE_PAYFAST_MERCHANT_KEY` | Client & Server | PayFast merchant key used to construct the checkout request | YES |
| `VITE_PAYFAST_SANDBOX` | Client & Server | Use PayFast sandbox in staging; set `false` only for production | YES |
| `PAYFAST_PASSPHRASE` | Server Only | Salt passphrase for MD5 ITN signature verification | YES |
| `THE_COURIER_GUY_API_KEY` | Server Only | The Courier Guy API credentials | YES |
| `SHIPPING_WEBHOOK_SECRET` | Server Only | HMAC-SHA256 secret for The Courier Guy webhook signatures | YES |
| `RESEND_API_KEY` | Server Only | Transactional email delivery service API key | YES |
| `CUSTOMER_ORIGIN` | Server Only | Exact storefront origin | YES |
| `ADMIN_ORIGIN` | Server Only | Exact admin origin; must differ from customer origin | YES |
| `CORS_ALLOWED_ORIGINS` | Server Only | Comma-separated exact allowlist containing both origins | YES |

### Environment & Secrets Hygiene Rules
1. **Zero Client Secrets**: No server secrets (`PAYFAST_PASSPHRASE`, `SHIPPING_WEBHOOK_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are bundled into client-facing artifacts or prefixed with `VITE_`.
2. **Server-Side Proxy**: All external mutations, payment initialization, carrier communication, and transactional emails execute strictly through `/api/*` routes.

---

## 2. CDN & Caching Rules Specification

## 2a. Supabase environment separation

- Staging and production must use separate Supabase projects and separate
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` secret sets.
- CI validates migrations against a local Supabase instance with
  `REQUIRE_SUPABASE=true`; a missing Docker/Supabase runtime is a failed gate,
  not a successful skip.
- Apply migrations to staging first, run authenticated smoke tests, then apply
  the same migration revision to production. No production service-role key
  belongs in browser variables or repository files.

┌─────────────────────────────────────────────────────────────────────────────┐
│                        Render Edge (TLS + global proxy)                     │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
                        ▼                             ▼
       ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
       │     Static Assets (Vite /dist)  │   │      Dynamic APIs (/api/*)      │
       │ Cache-Control: public,          │   │ Cache-Control: no-store,        │
       │ max-age=31536000, immutable     │   │ no-cache, must-revalidate,      │
       │                                 │   │ proxy-revalidate                │
       └─────────────────────────────────┘   └─────────────────────────────────┘
```

> There is **no CDN in front of Render** in this stack. Render terminates TLS and
> serves the Express process directly. Adding Cloudflare/Vercel/Netlify in front
> changes the client IP that rate limiting and logging observe, so it is out of
> scope until explicitly approved.

### Route-Level Cache Policies

1. **Static Assets (`/assets/*`, `.js`, `.css`, `.woff2`, `.png`, `.jpg`, `.webp`)**:
   - `Cache-Control: public, max-age=31536000, immutable`
   - Content-hashed filenames guarantee instant cache invalidation upon redeployment.

2. **Application Entrypoint (`index.html`)**:
   - `Cache-Control: public, max-age=0, must-revalidate`
   - Ensures users always fetch the freshest bundle manifest while allowing HTTP 304 Not Modified.

3. **Dynamic API & Webhook Ingress (`/api/*`, `/api/webhooks/*`)**:
   - `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`
   - `Pragma: no-cache`

4. **Crawler Interceptor & SEO Drops (`/product/:id`)**:
   - `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`
   - Allows edge caching of rendered OpenGraph metadata with fast background revalidation.

---

## 3. Webhook Security Architecture

### Strict Security Controls Matrix

| Webhook Route | Provider | Signature Verification Method | Payload Parsing | Tolerance Window | Idempotency Key |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/webhooks/payfast`| PayFast | MD5 Hash (`data + passphrase`) | URL-encoded Raw Body | N/A (ITN sequence check) | `pf_payment_id` / `m_payment_id` |
| `/api/webhooks/tracking`| The Courier Guy | HMAC-SHA256 (`x-kixora-signature`, `t=...,v1=...`) | Raw Buffer (`express.raw`) | 300 seconds (5 min) | `eventId` |

### Core Security Guarantees:
1. **Raw Body Integrity**: Signatures are evaluated directly against unmodified request byte buffers prior to JSON deserialization.
2. **Replay Protection**: Webhook headers containing timestamps are verified against the system clock (`Math.abs(now - timestamp) <= 300s`). Stale requests are rejected with HTTP 401.
3. **Idempotency Deduplication**: Every event ID is recorded in the `webhook_events` database registry. Duplicate deliveries return HTTP 200 `{ idempotent: true }` without re-executing business logic or email pipelines.
4. **Sanitized Error Responses**: Verification failures return HTTP 400/401/403 with generic error descriptors, preventing information leakage.

---

## 4. DNS & Domain Cutover Runbook

### Pre-Cutover Verification (T-48 Hours)

The repository does not provision DNS, certificates, or registrar changes.
Render issues and renews TLS automatically once a custom domain is attached.
These are external launch blockers and must be verified by the operator in the
Render dashboard and the authoritative DNS provider console before marking complete.

- [ ] Attach `kixora.com`, `www.kixora.com` and `admin.kixora.com` to the Render service.
- [ ] Verify both origins resolve to the Render service and TLS is issued.
- [ ] Confirm `CUSTOMER_ORIGIN`, `ADMIN_ORIGIN`, and `CORS_ALLOWED_ORIGINS` match the verified domains.

### DNS Records Table

| Type | Host | Target / Value | Proxy | TTL |
| :--- | :--- | :--- | :--- | :--- |
| `A` / `ALIAS` | `@` (apex) | Render-provided apex target (see Render → Settings → Custom Domains) | DNS only | Auto |
| `CNAME` | `www` | Render-provided subdomain target | DNS only | Auto |
| `CNAME` | `admin` | Render-provided subdomain target | DNS only | Auto |
| `TXT` | `@` | `v=spf1 include:_spf.resend.com ~all` | DNS only | 300 |
| `CNAME` | `resend._domainkey` | `resend._domainkey.resend.com` | DNS only | 300 |
| `TXT` | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@kixora.com` | DNS only | 300 |

### Cutover Execution Sequence (T-0 Hours)
1. **Maintenance Lock**: Enable maintenance banner if DB migrations require schema locking.
2. **Apply Database Migrations**: Apply the pending `supabase/migrations/*.sql` files to the production Supabase project.
3. **Deploy**: Trigger the **Deploy (Render)** workflow with target `production`.
4. **Verify Origin Contract**: Confirm `/api/health` and `/api/ready` are healthy and the reported commit matches the intended merge.
5. **Switch DNS Records**: Point the apex and `www`/`admin` records at the Render targets.
6. **Verify Resolution**: Test DNS resolution across global resolvers (`8.8.8.8`, `1.1.1.1`).
7. **TLS Certificate Validation**: Confirm the SSL handshake succeeds at `https://kixora.com` and `https://admin.kixora.com`.

---

## 5. Post-Launch Smoke Tests & Verification Plan

### Automated Smoke Test Checklist
- **GET `/api/health`**: Returns HTTP 200 `{ status: 'ok', domain: 'kixora-production' }`.
- **GET `/`**: Returns HTTP 200 with HTML title `Kixora | Authenticated Sneaker Vault`.
- **POST `/api/shipping/rates`**: Must use The Courier Guy integration and fail closed if its production configuration is unavailable.
- **POST `/api/shipping/labels`**: Must create a The Courier Guy waybill or fail closed if carrier configuration is unavailable.
- **POST `/api/webhooks/tracking`**: Rejects missing/tampered signatures (HTTP 401); accepts valid HMAC signatures (HTTP 200).
- **POST `/api/webhooks/payfast`**: Rejects invalid MD5 checksums (HTTP 400); processes valid ITNs and reconciles the order.
- The current The Courier Guy driver returns simulated rates, labels, and tracking; live carrier API integration and staging proof are required before these checks can be marked passed.

### Monitoring & Observability
- **Error Tracking**: Monitor structured logs (`logger.error`) for unhandled exceptions or elevated 5xx rates.
- **Webhook Telemetry**: Track `webhook_events` table for processing latency and duplicate event counts.
- **Uptime Monitoring**: Configure synthetic probes hitting `/api/health` at 60-second intervals from multiple geographical regions.

---

## 6. Rollback Runbook

If a critical incident occurs during cutover (e.g. fatal edge routing, database lock, gateway failure):

1. **DNS Fallback**: Restore the previous DNS target in the registrar; propagation time is not guaranteed.
2. **Service Rollback**: In the Render dashboard, redeploy the previous successful deploy for the service (Deploys → last good deploy → Rollback). Render keeps prior deploys, so no image tag management is required.
3. **Database Reversion**: Apply a **new forward migration** that reverts the incompatible change. Never edit or delete an applied migration.
4. **Incident Audit**: Review Render service logs for root cause analysis before re-attempting deployment.
