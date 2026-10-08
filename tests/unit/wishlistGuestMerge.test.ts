import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  upsertPayload: null as unknown,
  fromCalls: 0,
}));

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: () => {
      state.fromCalls += 1;
      return {
        upsert: (payload: unknown) => {
          state.upsertPayload = payload;
          return Promise.resolve({ error: null });
        },
      };
    },
  },
}));

vi.mock('../../src/services/authService', () => ({
  authService: { getCurrentUser: async () => null },
}));

import { wishlistRepository } from '../../src/repositories/customer/wishlistRepository';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('wishlistRepository.mergeGuestWishlist guest UUID filter', () => {
  beforeEach(() => {
    state.upsertPayload = null;
    state.fromCalls = 0;
  });

  it('drops non-UUID ids and keeps UUIDs', async () => {
    await wishlistRepository.mergeGuestWishlist('user-1', ['kixo-shattered-backboard-01', UUID_A, UUID_B, UUID_A]);

    expect(state.fromCalls).toBe(1);
    expect(state.upsertPayload).toEqual([
      { user_id: 'user-1', product_id: UUID_A },
      { user_id: 'user-1', product_id: UUID_B },
    ]);
  });

  it('makes no request when no ids remain', async () => {
    await wishlistRepository.mergeGuestWishlist('user-1', ['kixo-shattered-backboard-01', 'not-a-uuid']);

    expect(state.fromCalls).toBe(0);
    expect(state.upsertPayload).toBeNull();
  });
});
