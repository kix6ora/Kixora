import { expect, test } from '@playwright/test';

test('Phase 5: product modal uses the 2D turntable fallback when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const prototype = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
    const originalGetContext = prototype.getContext;
    prototype.getContext = function (kind: unknown, ...args: unknown[]) {
      if (kind === 'webgl' || kind === 'experimental-webgl' || kind === 'webgl2') return null;
      return originalGetContext.call(this, kind, ...args);
    };
  });
  await page.goto('/');
  const firstCard = page.locator('div[id^="product-card-"]').first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();
  await expect(page.locator('#product-modal-backdrop')).toBeVisible();
  await expect(page.getByText('Turntable image preview · 3D asset needed')).toBeVisible();
  await expect(page.locator('#product-modal-backdrop img').first()).toBeVisible();
});