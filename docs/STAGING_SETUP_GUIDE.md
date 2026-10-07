# Staging Environment Setup Guide

## Overview
This guide provides step-by-step instructions for setting up the Kixora staging environment with a real Supabase project.

## Prerequisites
- Supabase account with organization access
- Git repository access
- Node.js 22.x installed
- Docker installed (for local Supabase)

## Step 1: Create Supabase Staging Project

1. **Log in to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Sign in with your organization account

2. **Create New Project**
   - Click "New Project"
   - Name: `Kixora-staging`
   - Database Password: Generate strong password (save securely)
   - Region: Choose closest to your target users (e.g., af-south-1 for South Africa)
   - Click "Create new project"

3. **Wait for Project Initialization**
   - Supabase will take 2-3 minutes to set up
   - Save the project URL and anon key from Settings > API

## Step 2: Configure Local Environment

1. **Create Staging Environment File**
   ```bash
   cd Kixora
   cp .env.example .env.staging
   ```

2. **Configure Staging Variables**
   Edit `.env.staging` with the following:

   ```bash
   # Environment
   NODE_ENV=production
   PORT=3000

   # Supabase Staging
   VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

   # Feature Flags (gradual rollout)
   VITE_USE_SUPABASE_CATALOG=true
   VITE_USE_SUPABASE_DROPS=true
   VITE_USE_SUPABASE_CART=true
   VITE_USE_SUPABASE_WISHLIST=true
   VITE_USE_SUPABASE_ORDERS=true
   VITE_USE_SUPABASE_CHECKOUT=true
   VITE_USE_SUPABASE_ADMIN=true
   VITE_USE_SUPABASE_AUTH=true

   # Payments (PayFast sandbox)
   VITE_PAYMENT_PROVIDER_MODE=payfast
   VITE_PAYFAST_MERCHANT_ID=<your-payfast-sandbox-merchant-id>
   VITE_PAYFAST_MERCHANT_KEY=<your-payfast-sandbox-merchant-key>
   VITE_PAYFAST_SANDBOX=true
   PAYFAST_PASSPHRASE=<your-payfast-sandbox-passphrase>

   # Shipping (The Courier Guy staging/sandbox)
   THE_COURIER_GUY_API_KEY=<your-courier-guy-test-key>
   SHIPPING_WEBHOOK_SECRET=<your-carrier-webhook-secret>

   # Email (staging)
   RESEND_API_KEY=re_<your-resend-key>
   EMAIL_FROM=Kixora Staging <staging@kixora.com>

   # CORS (staging domains)
   CUSTOMER_ORIGIN=https://staging.kixora.com
   ADMIN_ORIGIN=https://admin-staging.kixora.com
   CORS_ALLOWED_ORIGINS=https://staging.kixora.com,https://admin-staging.kixora.com

   # Optional ITN replay script inputs (set in a secured shell, not committed files)
   STAGING_CUSTOMER_URL=https://staging.kixora.com
   STAGING_ORDER_AMOUNT=<order-total-in-ZAR>
   ```

## Step 3: Apply Database Migrations

1. **Link Local to Staging Project**
   ```bash
   cd Kixora
   npx supabase link --project-ref <your-project-id>
   ```

2. **Push Migrations to Staging**
   ```bash
   npx supabase db push
   ```

3. **Verify Migration Success**
   ```bash
   npx supabase db remote commit
   ```

## Step 4: Seed Staging Data (Optional)

1. **Create Test Admin User**
   - Go to Supabase Dashboard > Authentication > Users
   - Create admin user: `admin@kixora-staging.com`
   - Set role to `admin` in the profiles table

2. **Add Sample Products**
   - Use the Admin Dashboard to add test products
   - Or run seed scripts if available

## Step 5: Test Staging Environment

1. **Start Local Server with Staging Config**
   ```bash
   cd Kixora
   cp .env.staging .env
   npm run dev
   ```

2. **Run Tests Against Staging**
   ```bash
   npm test
   ```

3. **Verify Health Endpoint**
   ```bash
   curl http://localhost:3000/api/health
   ```

   Expected response:
   ```json
   {
     "status": "ok",
     "domain": "kixora-development",
     "timestamp": "2026-09-30T...",
     "uptime": 123.45,
     "checks": {
       "database": "healthy",
       "supabase": "healthy"
     }
   }
   ```

## Step 6: Deploy to Staging

### Option A: Vercel/Netlify (Recommended for quick staging)

1. **Connect Repository**
   - Connect your GitHub repository to Vercel/Netlify

2. **Configure Environment Variables**
   - Add all variables from `.env.staging`
   - Set build command: `npm run build`
   - Set output directory: `dist`

3. **Deploy**
   - Push to `develop` branch
   - Vercel/Netlify will auto-deploy

### Option B: Cloud Run (Production-like)

1. **Build Docker Image**
   ```bash
   docker build -t kixora-staging .
   ```

2. **Tag and Push**
   ```bash
   docker tag kixora-staging gcr.io/<your-project>/kixora-staging
   docker push gcr.io/<your-project>/kixora-staging
   ```

3. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy kixora-staging \
     --image gcr.io/<your-project>/kixora-staging \
     --platform managed \
     --region <your-region> \
     --allow-unauthenticated
   ```

## Step 7: Configure DNS (Optional)

1. **Add CNAME Records**
   - `staging.kixora.com` → your deployment URL
   - `admin-staging.kixora.com` → your deployment URL

2. **Configure SSL**
   - Most platforms handle SSL automatically
   - Verify with `https://staging.kixora.com`

## Verification Checklist

- [ ] Supabase staging project created
- [ ] All migrations applied successfully
- [ ] Environment variables configured
- [ ] Health endpoint returns healthy status
- [ ] Admin user can access admin dashboard
- [ ] Customer signup/login works
- [ ] Product catalog loads from Supabase
- [ ] Cart operations persist to Supabase
- [ ] Smoke tests pass against staging
- [ ] DNS configured (if applicable)

## Troubleshooting

### Migration Failures
```bash
# Check migration status
npx supabase migration list

# Reset and retry (CAUTION: deletes data)
npx supabase db reset
```

### Connection Issues
```bash
# Test Supabase connection
npx supabase status

# Check local vs remote schema
npx supabase db diff --use-migra
```

### Environment Variable Issues
```bash
# Verify variables are loaded
node -e "console.log(require('dotenv').config().parsed)"
```

## Security Notes

- **Never commit** `.env.staging` or any environment files with real secrets
- **Rotate keys** if staging credentials are accidentally exposed
- **Use separate Supabase projects** for staging and production
- **Limit admin access** in staging to authorized team members only

## Next Steps

After staging is set up:
1. Run full test suite against staging
2. Perform manual QA of critical user flows
3. Test payment gateway in staging mode
4. Test PayFast in sandbox mode and verify its ITN webhook handling
5. For a staged ITN replay, provide `STAGING_CUSTOMER_URL`, `STAGING_ORDER_AMOUNT`, `VITE_PAYFAST_MERCHANT_ID`, and `PAYFAST_PASSPHRASE` through the secured runtime environment, then run:
   ```bash
   node scripts/staging/payfast-itn-replay.mjs <order-code> <valid|duplicate|wrong-amount|wrong-signature|unknown-order|cancelled>
   ```
   The script reports only the HTTP result; never pass secrets as command-line arguments or print the staging environment.
6. Verify whether The Courier Guy has provided sandbox credentials/API access; do not treat the current simulated rates, labels, or tracking as a live integration.
7. Complete and test the real Courier Guy API and webhook flow before production sign-off.
8. Prepare production deployment runbook

## Contact

For issues with staging setup, contact the DevOps team or check the main project documentation.
# Staging Supabase Setup for Admin E2E Tests

Admin browser tests use the local mock-auth path during development. CI skips admin browser tests by default because a local mock session does not verify real Supabase authentication. To run them against Supabase, use a dedicated staging project, never production.

## Staging Project

1. Create a Supabase project dedicated to staging and apply the repository migrations.
2. Create a test administrator account in Supabase Auth.
3. Grant that user the `admin` role through the trusted `app_metadata` role-management path used by the application. Do not grant admin access through `user_metadata` or client-side local storage.
4. Seed the staging project with the catalog, inventory, orders, and promo data required by admin smoke tests. Those tests create and modify records.

## Local Run

Export the staging configuration in the shell before starting Playwright:

```sh
export PLAYWRIGHT_USE_STAGING_SUPABASE=true
export PLAYWRIGHT_SUPABASE_URL=https://your-staging-project.supabase.co
export PLAYWRIGHT_SUPABASE_ANON_KEY=your-staging-anon-key
export PLAYWRIGHT_ADMIN_EMAIL=admin-test@example.com
export PLAYWRIGHT_ADMIN_PASSWORD='your-staging-admin-password'
npx playwright test tests/admin tests/auth/phase4-auth-isolation.spec.ts
```

The Playwright server fails at startup if staging mode is enabled but any required variable is missing. With staging mode disabled, local runs use mock auth. In CI, admin browser tests are skipped unless staging auth is explicitly enabled.

## GitHub Actions

Set the repository variable `PLAYWRIGHT_USE_STAGING_SUPABASE` to `true` to opt in. Add secrets `PLAYWRIGHT_SUPABASE_URL`, `PLAYWRIGHT_SUPABASE_ANON_KEY`, `PLAYWRIGHT_ADMIN_EMAIL`, and `PLAYWRIGHT_ADMIN_PASSWORD`. The variable defaults to `false`, so the standard CI run needs no staging credentials.

Use an isolated staging project and test account with only staging data. Never add credential values to tracked files or use production credentials.
