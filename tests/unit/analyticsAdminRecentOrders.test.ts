import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  data: null as unknown,
  error: null as { message: string } | null,
  lastSelect: '' as string,
}));

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: () => {
      const query: Record<string, unknown> = {
        select: (columns: string) => {
          state.lastSelect = columns;
          return query;
        },
        order: () => query,
        limit: async () => ({ data: state.data, error: state.error }),
      };
      return query;
    },
  },
}));

import { analyticsAdminRepository } from '../../src/repositories/admin/analyticsAdminRepository';

describe('analyticsAdminRepository.getRecentOrders customer_snapshot mapping', () => {
  beforeEach(() => {
    state.data = null;
    state.error = null;
    state.lastSelect = '';
  });

  it('selects customer_snapshot without the non-existent customer_full_name column', async () => {
    state.data = [];
    state.error = null;

    await analyticsAdminRepository.getRecentOrders(5);

    expect(state.lastSelect).toContain('customer_snapshot');
    expect(state.lastSelect).not.toContain('customer_full_name');
  });

  it("maps customer_snapshot.fullName (seed key) and falls back to 'Valued Collector'", async () => {
    state.data = [
      {
        id: 'order-1',
        order_code: 'KXO-8492',
        total: 2699.1,
        current_status: 'Processing',
        created_at: '2026-10-03T00:00:00Z',
        customer_snapshot: { fullName: 'Lerato Modise' },
      },
      {
        id: 'order-2',
        order_code: 'KXO-3912',
        total: 2049,
        current_status: 'Delivered',
        created_at: '2026-10-02T00:00:00Z',
        customer_snapshot: null,
      },
    ];
    state.error = null;

    const orders = await analyticsAdminRepository.getRecentOrders(5);

    expect(orders[0].customerName).toBe('Lerato Modise');
    expect(orders[1].customerName).toBe('Valued Collector');
  });
});
