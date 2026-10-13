import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  data: null as unknown,
  error: null as { message: string } | null,
  thrown: null as Error | null,
  query: null as Record<string, unknown> | null,
}));

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: () => {
      const terminal = async () => {
        if (state.thrown) throw state.thrown;
        return { data: state.data, error: state.error };
      };
      const query: Record<string, unknown> = {
        select: () => query,
        order: () => query,
        eq: () => query,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          terminal().then(resolve, reject),
      };
      state.query = query;
      return query;
    },
  },
}));

vi.mock('../../src/repositories/customer/orderMapper', () => ({
  mapOrderRowToOrder: (row: unknown) => row,
}));

import { orderRepository } from '../../src/repositories/customer/orderRepository';

describe('orderRepository getOrdersResult', () => {
  beforeEach(() => {
    state.data = null;
    state.error = null;
    state.thrown = null;
    state.query = null;
  });

  it('returns { orders: [], error } on a query error', async () => {
    state.data = null;
    state.error = { message: 'relation boom' };

    const result = await orderRepository.getOrdersResult();

    expect(result.orders).toEqual([]);
    expect(result.error).toBe('relation boom');
  });

  it('returns { orders, error: null } on success, including 0 rows', async () => {
    state.data = [];
    state.error = null;

    const result = await orderRepository.getOrdersResult();

    expect(result.orders).toEqual([]);
    expect(result.error).toBeNull();
  });
});
