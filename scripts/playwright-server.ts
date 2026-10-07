const port = process.env.PLAYWRIGHT_PORT || '3000';
const useStagingSupabase = process.env.PLAYWRIGHT_USE_STAGING_SUPABASE === 'true';

// Local Playwright runs must be offline by default. A staging-backed run is an
// explicit opt-in and requires credentials supplied by the environment, never
// by a tracked file.
if (!useStagingSupabase) {
  process.env.VITE_SUPABASE_URL = 'https://placeholder.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'placeholder-key';
} else if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error(
    'PLAYWRIGHT_USE_STAGING_SUPABASE=true requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

const flagNames = [
  'VITE_USE_SUPABASE_CATALOG',
  'VITE_USE_SUPABASE_DROPS',
  'VITE_USE_SUPABASE_AUTH',
  'VITE_USE_SUPABASE_CART',
  'VITE_USE_SUPABASE_WISHLIST',
  'VITE_USE_SUPABASE_ORDERS',
  'VITE_USE_SUPABASE_CHECKOUT',
  'VITE_USE_SUPABASE_ADMIN',
  'VITE_USE_SUPABASE_ADMIN_CATALOG',
  'VITE_USE_SUPABASE_ADMIN_ORDERS',
  'VITE_USE_SUPABASE_ADMIN_INVENTORY',
  'VITE_USE_SUPABASE_ADMIN_PROMOS',
  'VITE_USE_SUPABASE_ADMIN_DROPS',
  'VITE_USE_SUPABASE_ADMIN_AUDIT',
];

for (const name of flagNames) {
  process.env[name] = useStagingSupabase ? (process.env[name] || 'false') : 'false';
}
process.env.VITE_PAYMENT_PROVIDER_MODE = 'mock';
process.env.VITE_SNEAKER_MODEL_BASE_URL = '';
process.env.VITE_CLOUDINARY_CLOUD_NAME ||= 'kixora';
process.env.VITE_CLOUDINARY_UPLOAD_PRESET ||= 'kixora_product_images';
process.env.VITE_PLAYWRIGHT_ADMIN = 'true';
process.env.CUSTOMER_ORIGIN = `http://127.0.0.1:${port}`;
process.env.ADMIN_ORIGIN = `http://admin.localhost:${port}`;
process.env.CORS_ALLOWED_ORIGINS = [
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  `http://admin.localhost:${port}`,
].join(',');
process.env.NODE_ENV = 'test';

// server.ts listens on `process.env.PORT` (default 3000), while Playwright
// probes `PLAYWRIGHT_PORT`. Without this bridge the server bound 3000 even when
// the gate asked for another port (release-gate.mjs defaults to 3100), so the
// webServer probe timed out after 120s and the release gate failed.
process.env.PORT = port;

await import('../server.ts');
export { };
