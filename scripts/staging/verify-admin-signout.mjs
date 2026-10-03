import { chromium } from '@playwright/test';

const adminUrl = 'https://kixora-admin-staging.onrender.com';
const email = process.env.STAGING_ADMIN_EMAIL;
const password = process.env.STAGING_ADMIN_PASSWORD;
if (!email || !password) {
  console.error('Missing required environment variables: STAGING_ADMIN_EMAIL, STAGING_ADMIN_PASSWORD');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let signInStatus = null;
page.on('response', (response) => {
  if (/\/auth\/v1\/token/.test(response.url())) signInStatus = response.status();
});

try {
  const pageResponse = await page.goto(adminUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (!pageResponse?.ok()) throw new Error(`Admin service returned HTTP ${pageResponse?.status() ?? 'no response'}.`);
  await page.getByRole('button', { name: /Admin Panel|Admin/i }).first().click();
  await page.getByLabel('Staff Email').fill(email);
  await page.getByLabel('Security Passcode').fill(password);
  await page.getByRole('button', { name: /Authenticate to Admin Console/i }).click();
  await page.getByText('Welcome back, Admin').waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByText('Vault Admin Authentication').waitFor({ timeout: 15000 });
  const authStorageEntries = await page.evaluate(() => Object.keys(localStorage)
    .filter((key) => key.endsWith('-auth-token') && localStorage.getItem(key)).length);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Admin Panel|Admin/i }).first().click();
  await page.getByText('Vault Admin Authentication').waitFor({ timeout: 15000 });
  const protectedViewAfterReload = await page.locator('#admin-route-forbidden').count();

  console.log(JSON.stringify({
    adminServiceStatus: pageResponse.status(),
    signInStatus,
    protectedAdminViewAfterSignOut: protectedViewAfterReload > 0 ? 'login-required' : 'not-on-protected-view',
    authStorageEntries,
  }));
  if (signInStatus !== 200 || authStorageEntries !== 0 || protectedViewAfterReload === 0) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
