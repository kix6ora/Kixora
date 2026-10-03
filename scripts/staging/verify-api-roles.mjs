import { readFile } from 'node:fs/promises';

const supabaseUrl = 'https://gzxhgeudovbdpgbvzwoa.supabase.co';
const adminServiceUrl = 'https://kixora-admin-staging.onrender.com';
const requiredEnv = [
  'STAGING_CUSTOMER_EMAIL',
  'STAGING_CUSTOMER_PASSWORD',
  'STAGING_ADMIN_EMAIL',
  'STAGING_ADMIN_PASSWORD',
  'SUPABASE_ANON_KEY',
];
const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(2);
}

const anonKey = process.env.SUPABASE_ANON_KEY;

async function signIn(email, password) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  return {
    status: response.status,
    token: body.access_token,
    role: body.user?.app_metadata?.role ?? 'unknown',
    errorCode: body.code ?? body.error_code ?? null,
  };
}

async function queryAuditLogs(token) {
  const response = await fetch(`${supabaseUrl}/rest/v1/admin_audit_logs?select=id&limit=1`, {
    headers: { apikey: anonKey, authorization: `Bearer ${token}` },
  });
  let rows = null;
  let errorCode = null;
  try {
    const body = await response.json();
    if (Array.isArray(body)) rows = body.length;
    else errorCode = body.code ?? null;
  } catch {
    errorCode = 'invalid-response';
  }
  return { status: response.status, rowCount: rows, errorCode };
}

async function queryAdminAuditRpc(token) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_audit_logs_for_admin`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      p_entity_type: null,
      p_action_type: null,
      p_admin_id: null,
      p_limit: 1,
      p_offset: 0,
    }),
  });
  let rowCount = null;
  let errorCode = null;
  try {
    const body = await response.json();
    if (Array.isArray(body)) rowCount = body.length;
    else errorCode = body.code ?? null;
  } catch {
    errorCode = 'invalid-response';
  }
  return { status: response.status, rowCount, errorCode };
}

async function queryAdminApiRoute(route, token) {
  const response = await fetch(`${adminServiceUrl}${route.path}`, {
    method: route.method.toUpperCase(),
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(route.method === 'post' ? { 'content-type': 'application/json' } : {}),
    },
    ...(route.method === 'post' ? { body: '{}' } : {}),
  });
  return { method: route.method.toUpperCase(), path: route.path, status: response.status };
}

const serverSource = await readFile(new URL('../../server.ts', import.meta.url), 'utf8');
const adminApiRoutes = [...serverSource.matchAll(
  /app\.(get|post|put|patch|delete)\(\s*(?:\[\s*)?['"]([^'"]+)['"]/g,
)]
  .map(([, method, path]) => ({ method, path }))
  .filter((route) => route.path.startsWith('/api/') && /(?:^|\/)admin(?:\/|$)/i.test(route.path));

const [customer, admin] = await Promise.all([
  signIn(process.env.STAGING_CUSTOMER_EMAIL, process.env.STAGING_CUSTOMER_PASSWORD),
  signIn(process.env.STAGING_ADMIN_EMAIL, process.env.STAGING_ADMIN_PASSWORD),
]);
if (!customer.token || !admin.token) {
  console.log(JSON.stringify({
    customerSignIn: { status: customer.status, role: customer.role, errorCode: customer.errorCode },
    adminSignIn: { status: admin.status, role: admin.role, errorCode: admin.errorCode },
  }));
  process.exit(1);
}

const [customerTable, customerRpc, adminRpc, unauthenticatedRouteResults, customerRouteResults] = await Promise.all([
  queryAuditLogs(customer.token),
  queryAdminAuditRpc(customer.token),
  queryAdminAuditRpc(admin.token),
  Promise.all(adminApiRoutes.map((route) => queryAdminApiRoute(route))),
  Promise.all(adminApiRoutes.map((route) => queryAdminApiRoute(route, customer.token))),
]);
console.log(JSON.stringify({
  customerSignIn: { status: customer.status, role: customer.role, errorCode: customer.errorCode },
  adminSignIn: { status: admin.status, role: admin.role, errorCode: admin.errorCode },
  customerDirectAuditRead: customerTable,
  customerAuditRpc: customerRpc,
  adminAuditRpc: adminRpc,
  adminApiRoutes,
  unauthenticatedAdminRoutes: unauthenticatedRouteResults,
  customerAdminRoutes: customerRouteResults,
}));

if (customer.role !== 'customer'
  || !['admin', 'super_admin'].includes(admin.role)
  || customerTable.status !== 403
  || customerTable.rowCount !== null
  || customerRpc.status !== 403
  || customerRpc.errorCode !== '42501'
  || adminRpc.status !== 200
  || adminRpc.rowCount === null
  || unauthenticatedRouteResults.some((result) => result.status !== 401)
  || customerRouteResults.some((result) => result.status !== 403)) {
  process.exitCode = 1;
}
