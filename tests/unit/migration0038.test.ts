// tests/unit/migration0038.test.ts
import { test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MIGRATION_PATH = path.join(process.cwd(), 'supabase', 'migrations', '0038_function_privilege_lockdown.sql');

test('migration 0038 file exists', () => {
  const exists = fs.existsSync(MIGRATION_PATH);
  expect(exists).toBe(true);
});

test('migration 0038 contains required REVOKE/GRANT and ALTER statements (normalized whitespace)', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, { encoding: 'utf8' });
  const norm = sql.replace(/\s+/g, ' ').trim();

  // A) Service-role-only functions: REVOKE ... FROM PUBLIC, anon (or PUBLIC, anon, authenticated) and GRANT to service_role
  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.confirm_inventory_sale\s*\(\s*uuid,\s*text\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.confirm_inventory_sale\s*\(\s*uuid,\s*text\s*\)\s+TO\s+service_role/i);

  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.release_order_reservations\s*\(\s*uuid,\s*text\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.release_order_reservations\s*\(\s*uuid,\s*text\s*\)\s+TO\s+service_role/i);

  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.cleanup_expired_reservations\s*\(\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.cleanup_expired_reservations\s*\(\s*\)\s+TO\s+service_role/i);

  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_pending_order_atomic\s*\(\s*uuid,\s*text,\s*jsonb,\s*jsonb,\s*text,\s*text,\s*text,\s*integer\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_pending_order_atomic\s*\(\s*uuid,\s*text,\s*jsonb,\s*jsonb,\s*text,\s*text,\s*text,\s*integer\s*\)\s+TO\s+service_role/i);

  // B) Trigger / lifecycle functions revoked from PUBLIC/anon/authenticated
  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.sync_profile_role_to_auth\s*\(\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.handle_new_user\s*\(\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.guard_role_escalation\s*\(\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.guard_immutable_order_fields\s*\(\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.handle_updated_at\s*\(\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);

  // C) Admin RPCs: revoke from PUBLIC and anon; keep authenticated; grant service_role
  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.admin_adjust_inventory\s*\(\s*uuid,\s*integer,\s*uuid,\s*text\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.admin_adjust_inventory\s*\(\s*uuid,\s*integer,\s*uuid,\s*text\s*\)\s+TO\s+authenticated/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.admin_adjust_inventory\s*\(\s*uuid,\s*integer,\s*uuid,\s*text\s*\)\s+TO\s+service_role/i);

  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.admin_reconcile_payment_state\s*\(\s*uuid,\s*text,\s*text,\s*text,\s*uuid,\s*text,\s*jsonb\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.admin_reconcile_payment_state\s*\(\s*uuid,\s*text,\s*text,\s*text,\s*uuid,\s*text,\s*jsonb\s*\)\s+TO\s+authenticated/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.admin_reconcile_payment_state\s*\(\s*uuid,\s*text,\s*text,\s*text,\s*uuid,\s*text,\s*jsonb\s*\)\s+TO\s+service_role/i);

  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.admin_transition_order_status\s*\(\s*uuid,\s*text,\s*text,\s*text,\s*uuid\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.admin_transition_order_status\s*\(\s*uuid,\s*text,\s*text,\s*text,\s*uuid\s*\)\s+TO\s+authenticated/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.admin_transition_order_status\s*\(\s*uuid,\s*text,\s*text,\s*text,\s*uuid\s*\)\s+TO\s+service_role/i);

  // cleanup_stale_pending_orders redefinition and guard
  expect(norm).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.cleanup_stale_pending_orders\s*\(\s*p_ttl_minutes\s+INTEGER\s+DEFAULT\s+60\s*\)/i);
  expect(norm).toMatch(/IF\s+NOT\s+\(public\.is_admin\(\)\s+OR\s+auth\.role\(\)\s+=\s+'service_role'\)\s+THEN\s+RAISE\s+EXCEPTION\s+'forbidden'\s+USING\s+ERRCODE\s+=\s+'42501';\s+END\s+IF;/i);
  expect(norm).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.cleanup_stale_pending_orders\s*\(\s*integer\s*\)\s+FROM\s+PUBLIC,\s+anon(?:,\s+authenticated)?/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.cleanup_stale_pending_orders\s*\(\s*integer\s*\)\s+TO\s+authenticated/i);
  expect(norm).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.cleanup_stale_pending_orders\s*\(\s*integer\s*\)\s+TO\s+service_role/i);

  // D) Pin search_path statements (explicit for each function)
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.sync_profile_role_to_auth\(\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.handle_updated_at\(\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.handle_new_user\(\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.validate_promo_code\s*\(\s*text,\s*numeric\s*\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.create_pending_order_atomic\s*\(\s*uuid,\s*text,\s*jsonb,\s*jsonb,\s*text,\s*text,\s*text,\s*integer\s*\)\s+SET\s+search_path\s+=\s+public,\s+extensions,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.place_order_atomic\s*\(\s*uuid,\s*text,\s*jsonb,\s*jsonb,\s*text,\s*text,\s*text,\s*text\s*\)\s+SET\s+search_path\s+=\s+public,\s+extensions,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.guard_immutable_order_fields\(\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.cleanup_stale_pending_orders\s*\(\s*integer\s*\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.admin_reconcile_payment_state\s*\(\s*uuid,\s*text,\s*text,\s*text,\s*uuid,\s*text,\s*jsonb\s*\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.confirm_inventory_sale\s*\(\s*uuid,\s*text\s*\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.get_guest_order_secure\s*\(\s*text,\s*text\s*\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.release_order_reservations\s*\(\s*uuid,\s*text\s*\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.guard_role_escalation\(\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.admin_transition_order_status\s*\(\s*uuid,\s*text,\s*text,\s*text,\s*uuid\s*\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.cleanup_expired_reservations\(\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);
  expect(norm).toMatch(/ALTER\s+FUNCTION\s+public\.admin_adjust_inventory\s*\(\s*uuid,\s*integer,\s*uuid,\s*text\s*\)\s+SET\s+search_path\s+=\s+public,\s+pg_temp;/i);

  // Ensure both functions that require 'extensions' are present (exact two assertions)
  // (create_pending_order_atomic and place_order_atomic were asserted above individually)

  // Ensure we did not accidentally GRANT back to anon or PUBLIC
  expect(norm).not.toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[^;]*\bTO\s+(?:anon|PUBLIC)\b/i);

  // Ensure admin guard functions are not revoked (is_admin/is_super_admin/get_auth_role)
  expect(norm).not.toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.is_admin\s*\(\s*\)/i);
  expect(norm).not.toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.is_super_admin\s*\(\s*\)/i);
  expect(norm).not.toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_auth_role\s*\(\s*\)/i);

  // Ensure place_order_atomic & validate_promo_code privileges are not revoked
  expect(norm).not.toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.place_order_atomic/i);
  expect(norm).not.toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.validate_promo_code/i);
});
