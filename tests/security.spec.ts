import { test, expect } from '@playwright/test';

test.describe('Phase A: Security Hardening', () => {
  const port = process.env.PLAYWRIGHT_PORT || '3000';
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

  test('CORS: Cross-origin request blocked (non-allowlisted)', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/health`, {
      headers: {
        'Origin': 'https://malicious-site.com'
      }
    });
    expect(response.status()).toBe(403);
    expect(response.headers()['access-control-allow-origin']).toBeUndefined();
  });

  test('CSRF: GET /api/csrf-token returns a token and sets cookie', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/csrf-token`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.csrfToken).toBeDefined();
    expect(response.headers()['set-cookie']).toBeDefined();
  });

  test('CSRF: POST to /api/payments without token is rejected', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/payments/payfast/initialize`, {
      data: { amount: 100 }
    });
    // Expected to be forbidden because no CSRF token
    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Invalid CSRF token');
  });

  test('CSRF: POST to /api/payments with valid token is accepted', async ({ request }) => {
    // 1. Get token and cookie
    const csrfRes = await request.get(`${baseUrl}/api/csrf-token`);
    const csrfData = await csrfRes.json();
    const cookies = csrfRes.headers()['set-cookie'];

    // 2. Post with token
    const response = await request.post(`${baseUrl}/api/payments/payfast/initialize`, {
      headers: {
        'CSRF-Token': csrfData.csrfToken,
        'Cookie': cookies || '' // Pass cookie back
      },
      data: { 
        amount: 100,
        currency: 'ZAR',
        orderCode: 'TEST1234'
      }
    });
    
    // A non-403 response confirms the supplied CSRF token was accepted.
    // Since we provided the token, it shouldn't be 403.
    expect(response.status()).not.toBe(403);
  });

  test('Body Size: Request body > 1MB is rejected with 413', async ({ request }) => {
    const largeString = 'a'.repeat(2 * 1024 * 1024); // 2MB string
    const response = await request.post(`${baseUrl}/api/shipping/rates`, {
      data: { largeData: largeString },
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    expect(response.status()).toBe(413);
  });

  test('Frameguard/CSP: Iframe headers allow same-origin or allowed ancestors', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/health`);
    const headers = response.headers();
    
    // Check that CSP frame-ancestors is present
    expect(headers['content-security-policy']).toContain('frame-ancestors');
    expect(headers['x-frame-options']).toBe('DENY');
  });
});
