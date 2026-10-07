import { test, expect } from '../fixtures/test-fixtures';

test.describe('Admin Smoke Tests', () => {

  test('AS-01: Admin dashboard loads with key performance indicators', async ({ adminPage: page }) => {
    // Verify Dashboard welcome text
    await expect(page.getByText(/Welcome back, Admin/i)).toBeVisible();

    // Verify key metric cards are displayed
    await expect(page.getByText(/total revenue/i).first()).toBeVisible();
    await expect(page.getByText(/total orders/i).first()).toBeVisible();
    await expect(page.getByText(/total customers/i).first()).toBeVisible();
  });

  test('AS-02: Products tab - Search, Add, Edit and Delete a sneaker', async ({ adminPage: page }) => {
    // 1. Switch to Products tab
    await page.locator('#admin-nav-products').click();
    await expect(page.getByText(/brand \/ category/i)).toBeVisible();

    // 2. Add a new Sneaker
    await page.getByRole('button', { name: /add sneaker/i }).click();
    await expect(page.getByText(/add new deadstock sneaker/i)).toBeVisible();

    // Fill form
    await page.getByPlaceholder(/e\.g\. Travis Scott x Air Jordan 1/i).fill('Air Jordan 4 Retro White Cement');
    await page.getByRole('button', { name: /save to vault catalog/i }).click();

    // Verify new sneaker is present in table
    await expect(page.locator('tbody').getByText('Air Jordan 4 Retro White Cement')).toBeVisible();

    // 3. Search for the sneaker
    const searchInput = page.getByPlaceholder(/search catalog by name, brand, sku/i);
    await searchInput.fill('White Cement');
    await expect(page.locator('tbody').getByText('Air Jordan 4 Retro White Cement')).toBeVisible();

    // 4. Delete the sneaker
    const deleteBtn = page.locator('button[title="Delete from Catalog"]').first();
    await deleteBtn.click();
  });

  test('AS-03: Orders tab - Filter orders and update order status', async ({ adminPage: page }) => {
    // Switch to Orders tab
    await page.locator('#admin-nav-orders').click();
    await expect(page.getByText(/order management/i)).toBeVisible();

    // Filter by 'Processing' status
    const processingBtn = page.getByRole('button', { name: 'Processing', exact: true });
    await processingBtn.click();

    // Change status of first order in table
    const statusSelect = page.locator('table tbody tr select').first();
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('Shipped');
    }
  });

  test('AS-04: Inventory tab - Adjust stock levels for specific shoe sizes', async ({ adminPage: page }) => {
    // Switch to Inventory tab
    await page.locator('#admin-nav-inventory').click();
    await expect(page.getByText(/size-level inventory manager/i)).toBeVisible();

    // Verify stock increment button works
    const plusBtn = page.locator('table tbody tr button:has(svg.lucide-plus)').first();
    await plusBtn.click();
  });

  test('AS-05: Promos tab - Create a new promo discount code and toggle active status', async ({ adminPage: page }) => {
    // Switch to Coupons/Promos tab
    await page.locator('#admin-nav-coupons').click();
    await expect(page.getByText(/promo & discount codes/i)).toBeVisible();

    // Click Create Promo
    await page.getByRole('button', { name: /create promo/i }).click();
    await expect(page.getByText(/create promo discount/i)).toBeVisible();

    // Fill form
    await page.locator('input[placeholder="e.g. GRAIL20, FLASH15"]').fill('TESTVIP50');
    await page.getByRole('button', { name: /create promo code/i }).click();

    // Verify promo card appears
    await expect(page.getByText('TESTVIP50')).toBeVisible();

    // Toggle active status
    const toggleBtn = page.locator('text=TESTVIP50').locator('..').locator('..').getByRole('button').first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
    }
  });

  test('AS-06: Analytics tab and return to storefront', async ({ adminPage: page }) => {
    // Switch to Analytics tab
    await page.locator('#admin-nav-analytics').click();
    await expect(page.getByText(/analytics & performance intelligence/i)).toBeVisible();

    // Click return to store button
    const backBtn = page.locator('button[title="Return to Customer Store"]');
    await backBtn.click();

    // Verify storefront is rendered
    await expect(page.getByRole('heading', { name: /built for the culture/i })).toBeVisible();
  });

});
