<!-- docs/production-evidence/phase-b-db-lockdown.md -->

# Phase B — DB Function Privilege Lockdown: Caller Table & Evidence

This document records the verified caller sites for the functions affected by migration 0038_function_privilege_lockdown.sql.
Use this table as the authoritative mapping when reviewing privileges and ensuring no necessary client call sites are broken.

Verified caller table (use exactly as provided):

- confirm_inventory_sale: src/services/webhookService.ts:264 (service-role)
- release_order_reservations: src/services/webhookService.ts:281 (service-role); also called inside cleanup_stale_pending_orders, admin_reconcile_payment_state, admin_transition_order_status
- admin_adjust_inventory: src/repositories/admin/inventoryAdminRepository.ts:119, src/repositories/adminRepository.ts:22 (browser admin)
- admin_transition_order_status: src/repositories/admin/orderAdminRepository.ts:113, src/repositories/adminRepository.ts:45 (browser admin)
- admin_reconcile_payment_state: src/services/adminOrderService.ts:72,109 (browser admin)
- cleanup_stale_pending_orders: src/services/adminOrderService.ts:146 (browser admin)
- place_order_atomic: src/services/checkoutService.ts:165; validate_promo_code: src/services/promoService.ts:11 (public checkout, keep EXECUTE)
- No .rpc call site: cleanup_expired_reservations, create_pending_order_atomic, get_guest_order_secure, and the trigger functions sync_profile_role_to_auth, handle_new_user, guard_role_escalation, guard_immutable_order_fields, handle_updated_at.

Notes / rationale
- confirm_inventory_sale & release_order_reservations are called by the service-role (webhook path) and must be revoked from client roles so anonymous/browser clients cannot invoke them directly.
- Admin RPCs used by browser admin flows (admin_adjust_inventory, admin_transition_order_status, admin_reconcile_payment_state, cleanup_stale_pending_orders) should remain callable by authenticated admin sessions but should be restricted from anon/public; service_role should also have EXECUTE for internal automation.
- place_order_atomic and validate_promo_code are public checkout RPCs and must preserve EXECUTE for anonymous and authenticated clients; they are only pinned for search_path and are not part of privilege revocations.
- Some trigger functions interact with the auth schema (sync_profile_role_to_auth / handle_new_user). These are trigger/daemon functions and are not client callable; EXECUTE was revoked on public/anon/authenticated to prevent accidental client invocation.
- create_pending_order_atomic and place_order_atomic rely on gen_random_bytes() unqualified and therefore the migration pins their search_path to include the 'extensions' schema so pgcrypto calls resolve correctly in environments where extensions are installed in that schema.

This file is produced as part of the patch adding migration 0038 and the offline unit test that verifies its contents.
