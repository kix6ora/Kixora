import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0032_rpc_authorization_hardening.sql'),
  'utf8',
);
const guestIdentityMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0033_guest_identity_hardening.sql'),
  'utf8',
);

describe('commerce RPC authorization migration', () => {
  it('restricts payment confirmation and reservation release to service_role', () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.confirm_inventory_sale\(UUID, TEXT\)[\s\S]*?FROM PUBLIC, anon, authenticated/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.confirm_inventory_sale\(UUID, TEXT\)[\s\S]*?TO service_role/i);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.release_order_reservations\(UUID, TEXT\)[\s\S]*?FROM PUBLIC, anon, authenticated/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.release_order_reservations\(UUID, TEXT\)[\s\S]*?TO service_role/i);
  });

  it('authorizes and bounds stale-order cleanup before mutation', () => {
    const authGuard = migration.indexOf("COALESCE(auth.role(), '') <> 'service_role'");
    const ttlGuard = migration.indexOf('p_ttl_minutes < 1 OR p_ttl_minutes > 1440');
    const firstMutation = migration.indexOf('FOR v_order_id IN');

    expect(authGuard).toBeGreaterThan(-1);
    expect(ttlGuard).toBeGreaterThan(authGuard);
    expect(firstMutation).toBeGreaterThan(ttlGuard);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.cleanup_stale_pending_orders\(INTEGER\)[\s\S]*?FROM PUBLIC, anon, authenticated/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.cleanup_stale_pending_orders\(INTEGER\)[\s\S]*?TO authenticated, service_role/i);
  });

  it('prevents unauthenticated checkout from assigning an account and removes email as an order credential', () => {
    expect(guestIdentityMigration).toMatch(/ELSIF p_user_id IS NOT NULL THEN[\s\S]*?Guest checkout cannot assign an account user ID/i);
    expect(guestIdentityMigration).toMatch(/SET search_path = pg_catalog, public, extensions/i);
    expect(guestIdentityMigration).not.toMatch(/LOWER\(customer_snapshot->>'email'\)/i);
    expect(guestIdentityMigration).toMatch(/guest_access_token = TRIM\(p_token_or_email\)/i);
    expect(guestIdentityMigration).toMatch(/REVOKE ALL ON FUNCTION public\.create_pending_order_atomic[\s\S]*?FROM PUBLIC, anon, authenticated/i);
  });
});

