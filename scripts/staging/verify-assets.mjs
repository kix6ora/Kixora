import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const customerUrl = 'https://kixora-staging.onrender.com';
const screenshotDir = 'artifacts/staging-item1';
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const browserErrors = [];
let products = [];
let productApiError;
const modelResponses = [];

page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(message.text());
});
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('requestfailed', (request) => {
  if (/\.glb(?:\?|$)/i.test(request.url())) {
    modelResponses.push({ url: request.url(), failure: request.failure()?.errorText ?? 'failed' });
  }
});
page.on('response', async (response) => {
  if (/\/rest\/v1\/products(?:\?|$)/.test(response.url())) {
    if (!response.ok()) {
      productApiError = `Product API returned HTTP ${response.status()}.`;
    } else {
      products = await response.json();
    }
  }
  if (/\.glb(?:\?|$)/i.test(response.url())) {
    modelResponses.push({
      url: response.url(),
      status: response.status(),
      contentType: response.headers()['content-type'] ?? '',
    });
  }
});
await page.addInitScript(() => {
  window.addEventListener('securitypolicyviolation', (event) => {
    const state = window;
    state.__cspViolations ??= [];
    state.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
  });
});

try {
  const response = await page.goto(customerUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (!response?.ok()) throw new Error(`Customer site returned HTTP ${response?.status() ?? 'no response'}.`);
  await page.waitForTimeout(8000);
  if (productApiError) throw new Error(productApiError);
  if (products.length === 0) throw new Error('The storefront did not return any live product rows.');
  await page.screenshot({ path: `${screenshotDir}/customer-list.png`, fullPage: true });

  const list = await page.evaluate(() => ({
    images: [...document.images].map((image) => ({
      url: image.currentSrc,
      loaded: image.complete && image.naturalWidth > 0,
    })),
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '',
  }));
  const imageUrls = [...new Set(products.flatMap((product) => (
    product.product_images ?? []
  ).map((image) => image.image_url).filter((url) => typeof url === 'string')))];
  const modelUrls = [...new Set(products.map((product) => product.model_url).filter((url) => typeof url === 'string' && url.length > 0))];

  const assetResults = [...imageUrls, ...modelUrls].map((url) => {
    const result = spawnSync('curl', ['-sSI', '-L', '--max-time', '30', url], { encoding: 'utf8' });
    const headers = result.stdout ?? '';
    const status = [...headers.matchAll(/^HTTP\/[^ ]+ (\d{3})/gm)].at(-1)?.[1] ?? '000';
    const contentType = [...headers.matchAll(/^content-type:\s*([^\r\n]+)/gim)].at(-1)?.[1]?.trim() ?? '';
    const isModel = /\.glb(?:\?|$)/i.test(url);
    const validType = isModel
      ? /^(model\/gltf-binary|application\/octet-stream)(?:;|$)/i.test(contentType)
      : /^image\//i.test(contentType);
    return { url, status: Number(status), contentType, passed: status === '200' && validType };
  });

  const firstProductId = products[0]?.id;
  if (firstProductId) {
    const card = page.locator(`#product-card-${firstProductId}`);
    if (await card.count()) {
      await card.click();
      await page.waitForTimeout(6000);
    }
  }
  await page.screenshot({ path: `${screenshotDir}/customer-product.png`, fullPage: true });

  const detail = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas').length,
    productModal: Boolean(document.querySelector('#product-modal-backdrop')),
    images: [...document.images].map((image) => ({
      url: image.currentSrc,
      loaded: image.complete && image.naturalWidth > 0,
    })),
    cspViolations: window.__cspViolations ?? [],
  }));
  const cspHeader = response.headers()['content-security-policy'] ?? '';
  const directives = Object.fromEntries(cspHeader.split(';').map((directive) => {
    const [name, ...values] = directive.trim().split(/\s+/);
    return [name, values];
  }));

  console.log(JSON.stringify({
    siteStatus: response.status(),
    productCount: products.length,
    thumbnailUrls: imageUrls,
    modelUrls,
    modelAssetsConfigured: modelUrls.length > 0,
    assetChecks: assetResults,
    listingImages: { total: list.images.length, loaded: list.images.filter((image) => image.loaded).length },
    detailImages: { total: detail.images.length, loaded: detail.images.filter((image) => image.loaded).length },
    canvasCount: detail.canvases,
    modelResponses,
    csp: {
      scriptSrc: directives['script-src'] ?? [],
      imgSrc: directives['img-src'] ?? [],
      connectSrc: directives['connect-src'] ?? [],
      workerSrc: directives['worker-src'] ?? [],
    },
    browserErrors,
    cspViolations: detail.cspViolations,
    screenshots: [`${screenshotDir}/customer-list.png`, `${screenshotDir}/customer-product.png`],
  }, null, 2));
} finally {
  await browser.close();
}
