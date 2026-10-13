#!/usr/bin/env node
/**
 * Kixora deployment environment assertion (Render + Supabase).
 *
 * Replaces the old Cloud Run prerequisite check. This asserts the APPLICATION
 * contract, not a cloud vendor's variables, so it stays valid regardless of how
 * Render names its own injected RENDER_* values.
 *
 * Usage:
 *   node scripts/verify-deploy-env.mjs            # checks production contract
 *   node scripts/verify-deploy-env.mjs --allow-sandbox
 *
 * Exits 0 when the environment is deployable, 1 with a list of problems
 * otherwise. Never prints secret values — only variable names.
 */

const allowSandbox = process.argv.includes('--allow-sandbox');

const env = process.env;
const problems = [];

const required = (name) => {
  const value = env[name];
  if (!value || value.trim() === '') {
    problems.push(`${name} is required`);
    return false;
  }
  return true;
};

const PLACEHOLDER_SUPABASE_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_SUPABASE_ANON_KEY = 'placeholder-key';

// 1. Runtime mode
if (env.NODE_ENV !== 'production') {
  problems.push('NODE_ENV must be "production"');
}

// 2. Supabase: live coordinates, never the offline placeholders
if (required('VITE_SUPABASE_URL') && env.VITE_SUPABASE_URL === PLACEHOLDER_SUPABASE_URL) {
  problems.push(`VITE_SUPABASE_URL is still the placeholder value (${PLACEHOLDER_SUPABASE_URL})`);
}
if (required('VITE_SUPABASE_ANON_KEY') && env.VITE_SUPABASE_ANON_KEY === PLACEHOLDER_SUPABASE_ANON_KEY) {
  problems.push('VITE_SUPABASE_ANON_KEY is still the placeholder value');
}
required('SUPABASE_SERVICE_ROLE_KEY');

// 3. Live-data feature flags (mirrors scripts/flags.ts)
const CORE_LIVE_DATA_FLAGS = [
  'VITE_USE_SUPABASE_CATALOG',
  'VITE_USE_SUPABASE_DROPS',
  'VITE_USE_SUPABASE_CART',
  'VITE_USE_SUPABASE_WISHLIST',
  'VITE_USE_SUPABASE_ORDERS',
  'VITE_USE_SUPABASE_CHECKOUT',
  'VITE_USE_SUPABASE_AUTH',
];
for (const flag of CORE_LIVE_DATA_FLAGS) {
  if (env[flag] !== 'true') {
    problems.push(`${flag} must be "true" for a live-data production deployment`);
  }
}

// 4. Payments (PayFast is the only supported production provider)
if (env.VITE_PAYMENT_PROVIDER_MODE !== 'payfast') {
  problems.push('VITE_PAYMENT_PROVIDER_MODE must be "payfast" in production');
}
required('VITE_PAYFAST_MERCHANT_ID');
required('VITE_PAYFAST_MERCHANT_KEY');
required('PAYFAST_PASSPHRASE');
if (!allowSandbox && env.VITE_PAYFAST_SANDBOX === 'true') {
  problems.push('VITE_PAYFAST_SANDBOX must not be "true" in production');
}

// 5. Origin contract (must match the Render custom domains)
const customerOrigin = env.CUSTOMER_ORIGIN || env.VITE_CUSTOMER_DOMAIN;
const adminOrigin = env.ADMIN_ORIGIN || env.VITE_ADMIN_DOMAIN;
required('CUSTOMER_ORIGIN');
required('ADMIN_ORIGIN');

const parseOrigin = (name, value) => {
  if (!value) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    problems.push(`${name} must be a valid absolute URL`);
    return null;
  }
  if (parsed.protocol !== 'https:') {
    problems.push(`${name} must use https in production`);
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    problems.push(`${name} must be an origin only (no path, query or hash)`);
  }
  return parsed.origin;
};

const customer = parseOrigin('CUSTOMER_ORIGIN', customerOrigin);
const admin = parseOrigin('ADMIN_ORIGIN', adminOrigin);
if (customer && admin && customer === admin) {
  problems.push('ADMIN_ORIGIN and CUSTOMER_ORIGIN must be different origins');
}

if (required('CORS_ALLOWED_ORIGINS')) {
  const origins = env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0) {
    problems.push('CORS_ALLOWED_ORIGINS must contain at least one explicit origin');
  }
  if (origins.includes('*')) {
    problems.push('CORS_ALLOWED_ORIGINS must not contain a wildcard');
  }
  if (customer && !origins.includes(customer)) {
    problems.push('CORS_ALLOWED_ORIGINS must include CUSTOMER_ORIGIN');
  }
  if (admin && !origins.includes(admin)) {
    problems.push('CORS_ALLOWED_ORIGINS must include ADMIN_ORIGIN');
  }
}

// 6. Server-only secret the API routes need
required('RESEND_API_KEY');

// 7. Informational: Render-provided values (logged, never required)
const renderInfo = {
  service: env.RENDER_SERVICE_NAME || '(not on Render)',
  commit: env.RENDER_GIT_COMMIT ? env.RENDER_GIT_COMMIT.slice(0, 7) : '(unknown)',
  environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV || '(unset)',
};

if (problems.length > 0) {
  console.error('Deployment environment is NOT deployable (Render + Supabase):');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error(`\nRender service: ${renderInfo.service} @ ${renderInfo.commit}`);
  process.exit(1);
}

console.log('Deployment environment validated for Render + Supabase.');
console.log(`  service:     ${renderInfo.service}`);
console.log(`  commit:      ${renderInfo.commit}`);
console.log(`  environment: ${renderInfo.environment}`);
console.log(`  origins:     ${customer} , ${admin}`);
console.log('  note:        VITE_* values are build-time; redeploy after changing them.');

