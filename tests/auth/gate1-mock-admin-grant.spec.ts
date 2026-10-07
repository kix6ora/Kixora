import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';

// Part A1 regression guard: the shipped mock sign-in path must be
// customer-only and must not derive any role from the email string.
test('A1: mock sign-in source is customer-only (no email-derived admin)', async () => {
  const source = fs.readFileSync('src/services/authService.ts', 'utf8');

  expect(source).not.toMatch(/includes\(\s*['"]admin['"]/i);
  expect(source).not.toMatch(/isAdminEmail/i);
  expect(source).not.toMatch(/admin-001/);
  expect(source).toMatch(/customer-only/);
  expect(source).toMatch(/const role: UserRole = 'customer'/);
});


