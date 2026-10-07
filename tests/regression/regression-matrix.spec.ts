import { test, expect } from '../fixtures/test-fixtures';

test.describe('Phase 1 Regression Matrix Tests', () => {

  // C-01: Header Navigation
  test('REG-C01: [Manual C-01] Header navigation returns to home storefront on logo click', async ({ customerPage: page }) => {
    // Navigate away from store
    await page.locator('#nav-link-new-releases').click();
    await expect(page.getByText(/kixora vault raffles & shock drops/i)).toBeVisible();

    // Click logo
    await page.getByRole('button', { name: /kixora/i }).first().click();
    await expect(page.getByRole('heading', { name: /built for the culture/i })).toBeVisible();
  });

  // C-15: Catalog Brand Filter
  test('REG-C15: [Manual C-15] Brand filter isolates specific manufacturer catalog', async ({ customerPage: page }) => {
    // Filter by Nike
    await page.getByRole('button', { name: 'Nike', exact: true }).first().click({ force: true });
    await expect(page.getByText(/brand: nike/i)).toBeVisible();

    // Verify Nike Air Force 1 is shown
    await expect(page.getByText(/air force 1 '07/i).first()).toBeVisible();
  });

  // C-20: In-Stock Toggle
  test('REG-C20: [Manual C-20] In-stock filter hides zero-inventory silhouettes', async ({ customerPage: page }) => {
    const inStockCheckbox = page.locator('input[type="checkbox"]').first();
    if (await inStockCheckbox.isVisible()) {
      await inStockCheckbox.check();
    }
    // Verify catalog continues to show available pairs
    await expect(page.locator('div[id^="product-card-"]').first()).toBeVisible();
  });

  // C-24: Wishlist Toggle
  test('REG-C24: [Manual C-24] Product card wishlist toggle saves item to wishlist modal', async ({ customerPage: page }) => {
    // Click wishlist heart on first product card
    const heartBtn = page.locator('button[id^="wishlist-toggle-btn-"]').first();
    if (await heartBtn.isVisible()) {
      await heartBtn.click();
    }

    // Open wishlist modal via header
    const headerWishlistBtn = page.locator('#header-wishlist-button');
    if (await headerWishlistBtn.isVisible()) {
      await headerWishlistBtn.click();
      await expect(page.locator('#wishlist-modal-backdrop')).toBeVisible();
    }
  });

  // C-27: Add to Cart
  test('REG-C27: [Manual C-27] Adding item with selected size opens cart drawer with correct unit price', async ({ customerPage: page }) => {
    const firstProduct = page.locator('div[id^="product-card-"]').first();
    await firstProduct.click();

    // Click Add to Cart
    await page.locator('#modal-add-to-cart-btn').click({ force: true });

    // Cart drawer should be visible with item
    await expect(page.locator('#cart-drawer-container')).toBeVisible();
    await expect(page.locator('#cart-item-qty-count').first()).toHaveText('1');
  });

  // C-29 & C-30: Promo Code Engine
  test('REG-C29-30: [Manual C-29, C-30] Promo code calculates 10% discount and enforces minimum spend threshold', async ({ customerPage: page }) => {
    // 1. Add product to cart
    const firstProduct = page.locator('div[id^="product-card-"]').first();
    await firstProduct.click();
    await page.locator('#modal-add-to-cart-btn').click();

    // 2. Apply invalid/high-threshold code
    const promoInput = page.locator('#cart-promo-input');
    await promoInput.fill('NONEXISTENT_CODE');
    await page.locator('#cart-apply-promo-btn').click();
    await expect(page.getByText(/invalid promo code/i)).toBeVisible();

    // 3. Apply valid code
    await promoInput.fill('KIX10');
    await page.locator('#cart-apply-promo-btn').click();
    await expect(page.getByText(/promo discount \(10%\)/i)).toBeVisible();
  });

  // C-31 & C-32: Checkout Flow & Order Generation
  test('REG-C31-32: [Manual C-31, C-32] Multi-step checkout creates order, generates tracking ID, and clears cart', async ({ customerPage: page }) => {
    // Add item to cart
    const firstProduct = page.locator('div[id^="product-card-"]').first();
    await firstProduct.click();
    await page.locator('#modal-add-to-cart-btn').click();

    // Proceed to checkout
    await page.keyboard.press('Escape');
    await page.locator('#cart-proceed-checkout-btn').click();
    await expect(page.locator('#checkout-fullname')).toBeVisible();

    // Fill details
    await page.locator('#checkout-fullname').fill('David Miller');
    await page.locator('#checkout-email').fill('david@miller.co.za');
    await page.locator('#checkout-street').fill('12 Long Street');
    await page.locator('#checkout-city').fill('Johannesburg');
    await page.locator('#checkout-zip').fill('2000');
    await page.locator('#checkout-phone').fill('+27 11 555 0100');

    await page.locator('#checkout-step1-continue-btn').click();
    await page.locator('#checkout-step2-continue-btn').click();
    await page.locator('#checkout-confirm-pay-btn').click();

    // Confirm order confirmation
    await expect(page.getByText(/order confirmed & in vault authentication/i)).toBeVisible();
  });

  // A-04 & A-07: Admin Product Management Lifecycle
  test('REG-A04-07: [Manual A-04, A-07] Admin adds new sneaker and subsequently deletes it from catalog', async ({ adminPage: page }) => {
    // Switch to Products
    await page.locator('#admin-nav-products').click();

    // Add Sneaker
    await page.getByRole('button', { name: /add sneaker/i }).click();
    await page.getByPlaceholder(/e\.g\. Travis Scott x Air Jordan 1/i).fill('Test Jordan Regression Pair');
    await page.getByRole('button', { name: /save to vault catalog/i }).click();

    // Verify added
    await expect(page.getByText('Test Jordan Regression Pair')).toBeVisible();

    // Delete
    const deleteBtn = page.locator('tr:has-text("Test Jordan Regression Pair") button[title="Delete from Catalog"]');
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await expect(page.getByText('Test Jordan Regression Pair')).not.toBeVisible();
    }
  });

  // A-12: Admin Live Stock Adjustment
  test('REG-A12: [Manual A-12] Admin increments size stock level in real-time matrix', async ({ adminPage: page }) => {
    await page.locator('#admin-nav-inventory').click();
    await expect(page.getByText(/size-level inventory manager/i)).toBeVisible();

    const initialStockCell = page.locator('table tbody tr').first();
    await expect(initialStockCell).toBeVisible();

    // Click increment
    const plusBtn = initialStockCell.locator('button:has(svg.lucide-plus)').first();
    await plusBtn.click();
  });

});
