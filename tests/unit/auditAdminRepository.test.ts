import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: { rpc: state.rpc },
}));

import { auditAdminRepository } from '../../src/repositories/admin/auditAdminRepository';

describe('auditAdminRepository', () => {
  beforeEach(() => {
    state.rpc.mockReset();
  });

  it('loads logs through the admin-checked RPC with filters and paging', async () => {
    state.rpc.mockResolvedValue({
      data: [{
        id: 'log-1',
        admin_id: 'admin-1',
        action_type: 'UPDATE',
        entity_type: 'product',
        entity_id: 'product-1',
        changes: { price: 10 },
        ip_address: null,
        created_at: '2026-10-03T00:00:00Z',
      }],
      error: null,
    });

    const logs = await auditAdminRepository.getAuditLogs({
      entityType: 'product',
      actionType: 'UPDATE',
      adminId: 'admin-1',
      limit: 10,
      offset: 20,
    });

    expect(state.rpc).toHaveBeenCalledWith('admin_audit_logs_for_admin', {
      p_entity_type: 'product',
      p_action_type: 'UPDATE',
      p_admin_id: 'admin-1',
      p_limit: 10,
      p_offset: 20,
    });
    expect(logs).toMatchObject([{ id: 'log-1', entityType: 'product', actionType: 'UPDATE' }]);
  });

  it('propagates authorization errors from the RPC', async () => {
    const error = { code: '42501', message: 'insufficient_privilege' };
    state.rpc.mockResolvedValue({ data: null, error });

    await expect(auditAdminRepository.getAuditLogs()).rejects.toBe(error);
  });
});
