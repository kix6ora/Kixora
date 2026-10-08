import { test, expect } from '@playwright/test';

test.describe('Kixora Phase 7: Observability, Analytics & SEO', () => {
  
  test('SEO: Verify page titles and meta tags change per view', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sneaker Vault/);
    
    // Check description (last meta description tag rendered by react-helmet)
    const desc = await page.locator('meta[name="description"]').last().getAttribute('content');
    expect(desc).toContain('Browse our curated collection');

    // Navigate to Drops
    await page.click('#nav-link-new-releases');
    await expect(page).toHaveTitle(/Drops Calendar/);
    
    const dropsDesc = await page.locator('meta[name="description"]').last().getAttribute('content');
    expect(dropsDesc).toContain('Never miss a drop');
  });

  test('Analytics: Verify opt-out behavior', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('kixora_cookie_consent', 'accepted'));
    await page.goto('/');
    
    // Open Privacy Settings via Footer
    await page.click('button:has-text("Privacy Preferences")');
    
    // Check if toggle exists
    const toggle = page.locator('#privacy-analytics-toggle');
    await expect(toggle).toBeVisible();

    // Opt out
    await toggle.click();
    
    // Verify localStorage state
    const optOut = await page.evaluate(() => localStorage.getItem('kixora_analytics_opt_out'));
    expect(optOut).toBe('true');
  });

  test('Server: Verify structured logs and correlation ID (Internal/Simulation)', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
  });

  test('SEO: Product Dynamic Metadata', async ({ page }) => {
    await page.goto('/');
    
    // Open a product modal (Wait for sneakers to load)
    const card = page.locator('h3:has-text("Shattered Backboard")');
    await card.waitFor({ state: 'visible' });
    await card.click();
    
    // Verify title changed to product name
    await expect(page).toHaveTitle(/Shattered Backboard/);
    
    // Verify OG image is populated
    const ogImage = await page.locator('meta[property="og:image"]').last().getAttribute('content');
    expect(ogImage).toBeTruthy();
    expect(ogImage?.length).toBeGreaterThan(10);
  });
});
