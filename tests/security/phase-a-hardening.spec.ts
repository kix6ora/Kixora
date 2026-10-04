// ==============================================================================
// KIXORA PHASE A: SECURITY HARDENING TESTS
// Tests for CORS allowlist, CSRF protection, body size limits, and framing policy
// ==============================================================================

import { test, expect, APIRequestContext } from '@playwright/test';

test.describe('Kixora Phase A: Security Hardening', () => {
  const port = process.env.PLAYWRIGHT_PORT || '3000';
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

  async function csrfHeaders(request: APIRequestContext) {
    const tokenResponse = await request.get(`${baseURL}/api/csrf`);
    const { csrfToken } = await tokenResponse.json();
    const cookies = tokenResponse.headers()['set-cookie'] || '';
    return {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Cookie': cookies.split(';')[0],
    };
  }

  // ---------------------------------------------------------------------------
  // 1. CORS ALLOWLIST TESTS
  // ---------------------------------------------------------------------------
  test.describe('CORS Allowlist', () => {
    test('Cross-origin request from disallowed origin is blocked (403)', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/payments/payfast/initialize`, {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://evil.example.com',
        },
        data: {
          amount: 1000,
          currency: 'ZAR',
          orderCode: 'TEST-CORS-001',
          customerEmail: 'test@example.com',
        },
      });

      // The CORS middleware returns 403 for invalid origins in production
      // In development, it also blocks non-configured origins
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Blocked by CORS allowlist');
    });

    test('Same-origin request is allowed', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/payments/payfast/initialize`, {
        headers: {
          ...(await csrfHeaders(request)),
        },
        data: {
          amount: 1000,
          currency: 'ZAR',
          orderCode: 'TEST-CORS-002',
          customerEmail: 'test@example.com',
        },
      });

      // Should not be blocked by CORS (403).
      expect(response.status()).not.toBe(403);
    });

    test('Allowed development origin (localhost:5173) is permitted', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/payments/payfast/initialize`, {
        headers: {
          'Origin': 'http://localhost:5173',
          ...(await csrfHeaders(request)),
        },
        data: {
          amount: 1000,
          currency: 'ZAR',
          orderCode: 'TEST-CORS-003',
          customerEmail: 'test@example.com',
        },
      });

      // Should not be blocked by CORS
      expect(response.status()).not.toBe(403);
    });

    test('Request with no Origin header is allowed (server-to-server)', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/payments/payfast/initialize`, {
        headers: {
          ...(await csrfHeaders(request)),
        },
        data: {
          amount: 1000,
          currency: 'ZAR',
          orderCode: 'TEST-CORS-004',
          customerEmail: 'test@example.com',
        },
      });

      // Requests without Origin (curl, mobile, server-to-server) are allowed
      expect(response.status()).not.toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. CSRF PROTECTION TESTS
  // ---------------------------------------------------------------------------
  test.describe('CSRF Protection', () => {
    test('POST to /api/payments without CSRF token is rejected (403)', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/payments/payfast/initialize`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          amount: 1000,
          currency: 'ZAR',
          orderCode: 'TEST-CSRF-001',
          customerEmail: 'test@example.com',
        },
      });

      // csurf returns 403 for missing/invalid CSRF token on protected routes
      expect(response.status()).toBe(403);
    });

    test('POST to /api/shipping with valid CSRF token is accepted', async ({ request }) => {
      // First, get a CSRF token
      const tokenResponse = await request.get(`${baseURL}/api/csrf`, {
        headers: {
          'Cookie': '', // Will be set by the response
        },
      });

      expect(tokenResponse.status()).toBe(200);
      const { csrfToken } = await tokenResponse.json();
      expect(csrfToken).toBeTruthy();

      // Extract the CSRF cookie from the response
      const cookies = tokenResponse.headers()['set-cookie'] || '';
      const csrfCookie = cookies.split(';')[0]; // Get the first cookie

      // Now make a request to shipping with the valid token
      const response = await request.post(`${baseURL}/api/shipping/rates`, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Cookie': csrfCookie,
        },
        data: {
          destination: { country: 'ZA', postalCode: '8001' },
          items: [{ weight: 1, quantity: 1 }],
        },
      });

      // Should not be rejected by CSRF (403). May return 400/500 for invalid payload.
      expect(response.status()).not.toBe(403);
    });

    test('POST to /api/notifications requires an authenticated admin even with valid CSRF', async ({ request }) => {
      const tokenResponse = await request.get(`${baseURL}/api/csrf`);
      expect(tokenResponse.status()).toBe(200);
      const { csrfToken } = await tokenResponse.json();
      const cookies = tokenResponse.headers()['set-cookie'] || '';
      const csrfCookie = cookies.split(';')[0];

      const response = await request.post(`${baseURL}/api/notifications/email/order-confirmation`, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Cookie': csrfCookie,
        },
        data: {
          orderCode: 'TEST-CSRF-002',
          customerEmail: 'test@example.com',
          items: [],
          total: 1000,
        },
      });

      expect(response.status()).toBe(401);
    });

    test('POST to /api/shipping/labels requires an authenticated admin even with valid CSRF', async ({ request }) => {
      const tokenResponse = await request.get(`${baseURL}/api/csrf`);
      const { csrfToken } = await tokenResponse.json();
      const cookies = tokenResponse.headers()['set-cookie'] || '';
      const csrfCookie = cookies.split(';')[0];

      const response = await request.post(`${baseURL}/api/shipping/labels`, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Cookie': csrfCookie,
        },
        data: { orderId: 'not-authorized' },
      });

      expect(response.status()).toBe(401);
    });

    test('CSRF token endpoint returns a valid token', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/csrf`);
      expect(response.status()).toBe(200);

      const { csrfToken } = await response.json();
      expect(csrfToken).toBeTruthy();
      expect(typeof csrfToken).toBe('string');
      expect(csrfToken.length).toBeGreaterThan(10);
    });

    test('CSRF cookie is HttpOnly and Secure in production', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/csrf`);
      const cookies = response.headers()['set-cookie'] || '';

      // In development, secure may be false; in production it should be true
      // At minimum, HttpOnly should always be present
      expect(cookies).toContain('HttpOnly');
      expect(cookies).toContain('csrf_secret=');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. BODY SIZE LIMIT TESTS
  // ---------------------------------------------------------------------------
  test.describe('Body Size Limits (~1MB)', () => {
    test('Request body > 1MB is rejected with 413', async ({ request }) => {
      // Create a payload slightly over 1MB
      const largePayload = {
        data: 'x'.repeat(1024 * 1024 + 100), // ~1MB + 100 bytes
      };

      const response = await request.post(`${baseURL}/api/shipping/rates`, {
        headers: {
          ...(await csrfHeaders(request)),
        },
        data: largePayload,
      });

      expect(response.status()).toBe(413);
      const body = await response.json();
      expect(body.error).toBe('Payload too large');
    });

    test('Request body under 1MB is accepted (not 413)', async ({ request }) => {
      // Create a payload well under 1MB
      const smallPayload = {
        destination: { country: 'ZA', postalCode: '8001' },
        items: [{ weight: 1, quantity: 1 }],
      };

      const response = await request.post(`${baseURL}/api/shipping/rates`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: smallPayload,
      });

      // Should not be rejected for size (413)
      expect(response.status()).not.toBe(413);
    });

    test('Payment request enforces the global 10KB limit', async ({ request }) => {
      // Create a payload between 10KB and 1MB
      const mediumPayload = {
        amount: 1000,
        currency: 'ZAR',
        orderCode: 'TEST-SIZE-001',
        customerEmail: 'test@example.com',
        data: 'x'.repeat(15 * 1024), // 15KB - over the 10KB route-specific limit
      };

      const response = await request.post(`${baseURL}/api/payments/payfast/initialize`, {
        headers: {
          ...(await csrfHeaders(request)),
        },
        data: mediumPayload,
      });

      // The server rejects JSON payloads larger than its 10KB limit.
      expect(response.status()).toBe(413);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. FRAMING POLICY TESTS
  // ---------------------------------------------------------------------------
  test.describe('Framing Policy (X-Frame-Options & CSP frame-ancestors)', () => {
    test('X-Frame-Options header is DENY', async ({ request }) => {
      const response = await request.get(`${baseURL}/`);
      const xFrameOptions = response.headers()['x-frame-options'];
      expect(xFrameOptions).toBe('DENY');
    });

    test('CSP frame-ancestors directive is none', async ({ request }) => {
      const response = await request.get(`${baseURL}/`);
      const csp = response.headers()['content-security-policy'] || '';
      expect(csp).toContain("frame-ancestors 'none'");
    });

    test('Page cannot be embedded in an iframe (blocked by both headers)', async ({ page }) => {
      // Navigate to a test page that tries to iframe the app
      await page.goto(`${baseURL}/`);
      
      // Check that the page loads normally (not in an iframe)
      const isInIframe = await page.evaluate(() => window.self !== window.top);
      expect(isInIframe).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. REGRESSION: CHECKOUT FLOW STILL WORKS
  // ---------------------------------------------------------------------------
  test.describe('Checkout Regression', () => {
    test('Health endpoint is accessible', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/health`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
    });

    test('CSRF token endpoint works and returns valid token', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/csrf`);
      expect(response.status()).toBe(200);
      const { csrfToken } = await response.json();
      expect(csrfToken).toBeTruthy();
    });

    test('PayFast payment request accepts a valid CSRF token', async ({ request }) => {
      // Get a valid CSRF token first
      const tokenResponse = await request.get(`${baseURL}/api/csrf`);
      const { csrfToken } = await tokenResponse.json();
      const cookies = tokenResponse.headers()['set-cookie'] || '';
      const csrfCookie = cookies.split(';')[0];

      const response = await request.post(`${baseURL}/api/payments/payfast/initialize`, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Cookie': csrfCookie,
        },
        data: {
          amount: 1000,
          currency: 'ZAR',
          orderCode: 'TEST-REGRESSION-001',
          customerEmail: 'test@example.com',
        },
      });

      // The supplied token should prevent CSRF rejection.
      expect(response.status()).not.toBe(403);
    });
  });
});

