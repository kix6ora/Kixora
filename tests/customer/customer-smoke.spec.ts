import { test, expect } from '../fixtures/test-fixtures';

test.describe('Customer Smoke Tests', () => {

  test('CS-01: Application loads with brand navigation and Hero showcase', async ({ customerPage: page }) => {
    // 1. Verify Brand logo is visible
    const brand = page.getByRole('button', { name: /kixora/i }).first();
    await expect(brand).toBeVisible();

    // 2. Verify Hero title
    const heroTitle = page.getByRole('heading', { name: /built for the culture/i });
    await expect(heroTitle).toBeVisible();

    const hero = page.locator('#homepage-hero');
    await expect(hero.getByRole('button', { name: 'SHOP NOW' })).toHaveCount(1);
    await expect(hero.getByRole('button', { name: /preview view/i })).toHaveCount(2);

    // 3. Verify trust pillars exist
    await expect(page.getByText(/100% deadstock/i).first()).toBeVisible();
    await expect(page.getByText(/fast dispatch/i).first()).toBeVisible();
    await expect(page.getByText(/secure payments/i).first()).toBeVisible();
    await expect(page.getByText(/easy returns/i).first()).toBeVisible();
  });

  test('CS-02: Header navigation routes between views seamlessly', async ({ customerPage: page }) => {
    // Navigate to New Releases / Drops
    await page.locator('#nav-link-new-releases').click();
    await expect(page.getByText(/kixora vault raffles & shock drops/i)).toBeVisible();

    // Navigate back to Store via Home
    await page.locator('#nav-link-home').click();
    await expect(page.getByRole('heading', { name: /built for the culture/i })).toBeVisible();
  });

  test('CS-03: Catalog filtering by brand, search, and price slider', async ({ customerPage: page }) => {
    // 1. Filter by brand 'Travis Scott'
    const brandBtn = page.getByRole('button', { name: 'Travis Scott', exact: true }).first();
    await brandBtn.click();

    // Verify active filter badge appears
    await expect(page.getByText(/brand: travis scott/i)).toBeVisible();

    // Verify product catalog displays matching item
    await expect(page.getByText(/travis scott x air jordan 1 low/i).first()).toBeVisible();

    // 2. Search filtering in header
    const searchInput = page.locator('#header-search-input');
    await searchInput.fill('Reverse Mocha');
    await expect(page.getByText(/reverse mocha/i).first()).toBeVisible();

    // Reset filters
    const resetBtn = page.getByRole('button', { name: /reset/i }).first();
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
    }
  });

  test('CS-04: Product inspection modal, angle switching and size selection', async ({ customerPage: page }) => {
    // Open first product card modal
    const firstProduct = page.locator('div[id^="product-card-"]').first();
    await firstProduct.click();

    // Verify product modal is open
    const modal = page.locator('#product-modal-backdrop');
    await expect(modal).toBeVisible();
    await expect(page.getByText(/12-point authentication verified/i)).toBeVisible();

    // Select a size (US 10)
    const sizeButton = page.getByRole('button', { name: 'US 10', exact: true });
    if (await sizeButton.isVisible()) {
      await sizeButton.click();
    }

    // Close modal
    const closeBtn = page.locator('#close-product-modal-btn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('CS-05: Add product to cart, quantity adjustment and promo code application', async ({ customerPage: page }) => {
    // 1. Open first product
    const firstProduct = page.locator('div[id^="product-card-"]').first();
    await firstProduct.click();

    // 2. Select size US 9.5 and add to cart
    const sizeButton = page.getByRole('button', { name: 'US 9.5', exact: true });
    if (await sizeButton.isVisible()) {
      await sizeButton.click();
    }

    const addToCartBtn = page.locator('#modal-add-to-cart-btn');
    await addToCartBtn.click();

    // 3. Cart drawer should open
    const cartDrawer = page.locator('#cart-drawer-container');
    await expect(cartDrawer).toBeVisible();

    // 4. Test quantity increment
    const qtyCount = page.locator('#cart-item-qty-count').first();
    await expect(qtyCount).toHaveText('1');

    const incBtn = page.locator('#cart-item-inc-btn').first();
    await incBtn.click();
    await expect(qtyCount).toHaveText('2');

    // 5. Test promo code (valid KIX10)
    const promoInput = page.locator('#cart-promo-input');
    await promoInput.fill('KIX10');
    await page.locator('#cart-apply-promo-btn').click();

    // Verify discount is applied in cart summary
    await expect(page.getByText(/promo discount \(10%\)/i)).toBeVisible();
  });

  test('CS-06: Complete full checkout flow and generate tracked order', async ({ customerPage: page }) => {
    // 1. Add an item to cart first
    const firstProduct = page.locator('div[id^="product-card-"]').first();
    await firstProduct.click();
    await page.locator('#modal-add-to-cart-btn').click();

    // 2. Proceed to checkout from cart drawer
    const checkoutBtn = page.locator('#cart-proceed-checkout-btn');
    await checkoutBtn.click();

    // 3. Step 1: Fill shipping form
    const checkoutModal = page.locator('#checkout-modal-backdrop');
    await expect(checkoutModal).toBeVisible();

    await page.locator('#checkout-fullname').fill('Alexander Vance');
    await page.locator('#checkout-email').fill('alexander@kixora.com');
    await page.locator('#checkout-street').fill('77 Sneaker Vault Ave');
    await page.locator('#checkout-city').fill('Cape Town');
    await page.locator('#checkout-zip').fill('8001');
    await page.locator('#checkout-phone').fill('+27 82 555 0192');

    await page.locator('#checkout-step1-continue-btn').click();

    // 4. Step 2: Payment method and continue to review
    await expect(page.getByText(/2\. SECURE PAYMENT METHOD/i)).toBeVisible();
    await page.locator('#checkout-step2-continue-btn').click();

    // 5. Step 3: Review and Confirm Order
    await expect(page.getByText(/3\. REVIEW & AUTHORIZATION/i)).toBeVisible();
    await page.locator('#checkout-confirm-pay-btn').click();

    // 6. Order confirmation
    await expect(page.getByText(/order confirmed & in vault authentication/i)).toBeVisible();
    await expect(page.getByText(/tracking #/i)).toBeVisible();

    // 7. Track order button navigates to order tracker
    await page.locator('#checkout-track-order-btn').click();
    await expect(page.getByText(/track your grail/i)).toBeVisible();
    await expect(page.getByText(/order #kxo-/i).first()).toBeVisible();
  });

  test('CS-08: Drops Calendar raffle interaction', async ({ customerPage: page }) => {
    // Navigate to New Releases / Drops
    await page.locator('#nav-link-new-releases').click();
    await expect(page.getByText(/kixora vault raffles & shock drops/i)).toBeVisible();

    // Click "Enter Raffle / Notify Me" on the first drop
    const raffleBtn = page.getByRole('button', { name: /enter raffle \/ notify me/i }).first();
    await raffleBtn.click();

    // Verify button state changes to Alert Set
    await expect(page.getByRole('button', { name: /alert active \/ entered/i }).first()).toBeVisible();
  });

});
