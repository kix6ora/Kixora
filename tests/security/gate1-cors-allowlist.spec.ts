import { test, expect } from '@playwright/test';
import { parseCorsAllowlist, validateCorsAllowlistForProduction } from '../../src/config/cors';

test.describe('A2: production CORS allowlist uses CORS_ALLOWED_ORIGINS', () => {
  test('allowlisted origin is accepted in the parsed list', () => {
    const origins = parseCorsAllowlist('https://customer.example.com,https://admin.example.com');
    expect(origins).toEqual(['https://customer.example.com', 'https://admin.example.com']);
    expect(origins).toContain('https://customer.example.com');
  });

  test('third-party origin is not in the allowlist', () => {
    const origins = parseCorsAllowlist('https://customer.example.com,https://admin.example.com');
    expect(origins).not.toContain('https://example.com');
  });

  test('* is rejected in production validation', () => {
    const wildcard = validateCorsAllowlistForProduction('*');
    expect(wildcard.errors.length).toBeGreaterThan(0);

    const mixed = validateCorsAllowlistForProduction('https://customer.example.com,*');
    expect(mixed.errors.length).toBeGreaterThan(0);

    const empty = validateCorsAllowlistForProduction('');
    expect(empty.errors.length).toBeGreaterThan(0);
  });

  test('explicit allowlist without wildcard passes production validation', () => {
    const result = validateCorsAllowlistForProduction(
      'https://customer.example.com,https://admin.example.com',
    );
    expect(result.errors).toEqual([]);
    expect(result.origins).toEqual(['https://customer.example.com', 'https://admin.example.com']);
  });
});
