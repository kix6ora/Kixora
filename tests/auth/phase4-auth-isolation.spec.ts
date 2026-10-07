import { test, expect } from '@playwright/test';
import { extractRoleFromUser, isUnauthorizedRoleElevation, hasAdminRole, hasSuperAdminRole } from '../../src/utils/roleUtils';
import { inspectHostname } from '../../src/routes/DomainGuard';
import { authService } from '../../src/services/authService';

test.describe('Phase 4: Real Authentication, Role Synchronization & Domain Isolation', () => {

  test('AUTH-01: Role Utilities strictly trust app_metadata and ignore client user_metadata', () => {
    // 1. Legitimate admin with app_metadata
    const legitimateAdmin = {
      id: 'usr_admin_1',
      email: 'admin@kixora.com',
      role: 'admin' as const,
      app_metadata: { role: 'admin' },
      user_metadata: { full_name: 'Real Admin' }
    };
    expect(extractRoleFromUser(legitimateAdmin)).toBe('admin');
    expect(hasAdminRole(extractRoleFromUser(legitimateAdmin))).toBe(true);

    // 2. Malicious customer attempting role escalation via user_metadata
    const attackerCustomer = {
      id: 'usr_hacker_1',
      email: 'hacker@example.com',
      role: 'customer' as const,
      app_metadata: { role: 'customer' },
      user_metadata: { role: 'super_admin', full_name: 'Attacker' }
    };
    // Must extract strictly 'customer'
    expect(extractRoleFromUser(attackerCustomer)).toBe('customer');
    expect(hasAdminRole(extractRoleFromUser(attackerCustomer))).toBe(false);
    expect(hasSuperAdminRole(extractRoleFromUser(attackerCustomer))).toBe(false);

    // 3. Unauthorized elevation detection
    expect(isUnauthorizedRoleElevation('customer', 'admin')).toBe(true);
    expect(isUnauthorizedRoleElevation('customer', 'super_admin')).toBe(true);
    expect(isUnauthorizedRoleElevation('admin', 'super_admin')).toBe(true);
    expect(isUnauthorizedRoleElevation('admin', 'admin')).toBe(false);
    expect(isUnauthorizedRoleElevation('customer', 'customer')).toBe(false);
  });

  test('AUTH-02: DomainGuard Hostname Inspection differentiates customer and admin domains', () => {
    // 1. Customer domains
    const storeProduction = inspectHostname('kixora.com');
    expect(storeProduction.isAdminDomain).toBe(false);
    expect(storeProduction.isCustomerDomain).toBe(true);

    const storeLocal = inspectHostname('localhost');
    expect(storeLocal.isAdminDomain).toBe(false);
    expect(storeLocal.isCustomerDomain).toBe(true);

    // 2. Admin subdomains
    const adminProduction = inspectHostname('admin.kixora.com');
    expect(adminProduction.isAdminDomain).toBe(true);
    expect(adminProduction.isCustomerDomain).toBe(false);

    const adminLocal = inspectHostname('admin.localhost');
    expect(adminLocal.isAdminDomain).toBe(true);
    expect(adminLocal.isCustomerDomain).toBe(false);

    // 3. Query parameters cannot override the origin boundary
    const queryOverrideAdmin = inspectHostname('localhost', '?domain=admin');
    expect(queryOverrideAdmin.isAdminDomain).toBe(false);

    const queryOverrideCustomer = inspectHostname('admin.kixora.com', '?domain=customer');
    expect(queryOverrideCustomer.isAdminDomain).toBe(true);
  });

  test('AUTH-03: authService customer registration enforces customer role', async () => {
    const signupResult = await authService.signUpCustomer({
      email: 'newcollector@example.com',
      password: 'SecurePassword123!',
      fullName: 'Jordan Collector',
      phone: '+27 82 111 2222',
    });

    expect(signupResult.user).not.toBeNull();
    expect(signupResult.user?.role).toBe('customer');
    expect(signupResult.user?.email).toBe('newcollector@example.com');
    expect(signupResult.user?.fullName).toBe('Jordan Collector');

    // Verify session
    const activeSession = await authService.getSession();
    expect(activeSession?.user?.role).toBe('customer');

    // Clean up
    await authService.signOut();
    const sessionAfterSignOut = await authService.getSession();
    expect(sessionAfterSignOut).toBeNull();
  });

  test('AUTH-03b: mock sign-in never grants admin based on email content', async () => {
    const loginResult = await authService.signIn({
      email: 'admin@foo.com',
      password: 'SecurePassword123!',
    });

    expect(loginResult.user).not.toBeNull();
    expect(loginResult.user?.role).toBe('customer');
    expect(loginResult.user?.email).toBe('admin@foo.com');

    await authService.signOut();
  });

  test('AUTH-04: Customer domain blocks unauthorized access to Admin Dashboard (404 View)', async ({ page }) => {
    // Navigate to customer domain with customer session
    await page.goto('/');
    await page.evaluate(() => {
      const customerSession = {
        user: {
          id: 'usr_cust_01',
          email: 'collector@kixora.com',
          role: 'customer',
          fullName: 'Customer Collector',
          appMetadata: { role: 'customer' },
          userMetadata: { full_name: 'Customer Collector' },
        },
        accessToken: 'mock_jwt_customer',
      };
      localStorage.setItem('kixora_auth_session', JSON.stringify(customerSession));
    });
    await page.reload();

    // Verify the current storefront and that the customer origin does not expose
    // an admin navigation affordance.
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#header-admin-profile-button')).toHaveCount(0);
  });

  test('AUTH-05: Admin domain with admin role allows full access to Admin Hub', async ({ page }) => {
    // Navigate to admin domain with admin session
    await page.goto('/?domain=admin');
    await page.evaluate(() => {
      const adminSession = {
        user: {
          id: 'usr_admin_01',
          email: 'admin@kixora.com',
          role: 'admin',
          fullName: 'Vault Lead Admin',
          appMetadata: { role: 'admin' },
          userMetadata: { full_name: 'Vault Lead Admin' },
        },
        accessToken: 'mock_jwt_admin',
      };
      localStorage.setItem('kixora_auth_session', JSON.stringify(adminSession));
    });
    await page.reload();

    // Click admin button
    const adminBtn = page.locator('#header-admin-profile-button');
    await expect(adminBtn).toBeVisible();
    await adminBtn.click();

    // Verify Admin Dashboard is rendered
    await expect(page.locator('#admin-nav-dashboard')).toBeVisible();
    await expect(page.getByText(/welcome back, admin/i)).toBeVisible();
  });

  test('AUTH-06: Customer role on admin domain receives 403 Forbidden', async ({ page }) => {
    // Navigate to admin domain with customer credentials
    await page.goto('/?domain=admin');
    await page.evaluate(() => {
      const customerSession = {
        user: {
          id: 'usr_cust_02',
          email: 'customer@kixora.com',
          role: 'customer',
          fullName: 'Regular Customer',
          appMetadata: { role: 'customer' },
          userMetadata: { full_name: 'Regular Customer' },
        },
        accessToken: 'mock_jwt_customer',
      };
      localStorage.setItem('kixora_auth_session', JSON.stringify(customerSession));
    });
    await page.reload();

    // Click admin switcher button
    const adminBtn = page.locator('#header-admin-profile-button');
    await expect(adminBtn).toBeVisible();
    await adminBtn.click();

    // Verify 403 Forbidden is rendered
    await expect(page.locator('#admin-route-forbidden')).toBeVisible();
    await expect(page.getByText(/403: access forbidden/i)).toBeVisible();
  });

  test('AUTH-07: Mock admin sign-in cannot elevate an unauthenticated user', async ({ page }) => {
    // Navigate to admin domain with no session
    await page.goto('/?domain=admin');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();

    // Click admin button
    const adminBtn = page.locator('#header-admin-profile-button');
    await expect(adminBtn).toBeVisible();
    await adminBtn.click();

    // Verify Vault Admin Authentication form appears
    await expect(page.locator('#admin-route-forbidden')).toBeVisible();
    await expect(page.getByText(/vault admin authentication/i)).toBeVisible();

    // Fill admin credentials
    await page.getByPlaceholder('admin@kixora.com').fill('admin@kixora.com');
    await page.getByPlaceholder('••••••••••••').fill('StaffPassword123');
    await page.getByRole('button', { name: /authenticate to admin console/i }).click();

    // Mock authentication is customer-only; staff access requires an authoritative admin role.
    await expect(page.locator('#admin-route-forbidden')).toBeVisible();
    await expect(page.getByText(/403: access forbidden/i)).toBeVisible();
    await expect(page.locator('#admin-nav-dashboard')).not.toBeVisible();
  });

});
