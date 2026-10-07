import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePayFastSignature } from '../../src/services/payments/crypto';

const state = vi.hoisted(() => {
  const values = {
    orders: new Map<string, Record<string, unknown>>(),
    claims: new Set<string>(),
    rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
    inventory: { stock: 5, reservedStock: 1, reservationStatus: 'active' },
    paymentRecords: [] as Array<{ orderId: string; reference: string }>,
    reservationReleaseCalls: [] as string[],
  };
  const client = {
    from(table: string) {
      const filters: Record<string, string> = {};
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: string) {
          filters[column] = value;
          return query;
        },
        async maybeSingle() {
          const order = [...values.orders.values()].find(row =>
            Object.entries(filters).every(([key, value]) => row[key] === value)
          );
          return { data: table === 'orders' ? order || null : null, error: null };
        },
        async upsert() {
          return { error: null };
        },
      };
      return query;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      values.rpcCalls.push({ name, args });
      if (name === 'claim_webhook_event') {
        const key = `${args.p_provider}:${args.p_event_id}`;
        if (values.claims.has(key)) return { data: false, error: null };
        values.claims.add(key);
        return { data: true, error: null };
      }

      const order = [...values.orders.values()].find(row => row.id === args.p_order_id);
      if (!order) return { data: null, error: { message: 'Order not found.' } };
      if (name === 'release_order_reservations') {
        values.reservationReleaseCalls.push(String(args.p_order_id));
        if (order.payment_status === 'paid') return { data: false, error: null };
        if (values.inventory.reservationStatus === 'active') {
          values.inventory.reservedStock -= 1;
          values.inventory.reservationStatus = 'released';
        }
        order.current_status = 'Cancelled';
        order.payment_status = 'failed';
        return { data: true, error: null };
      }
      if (name === 'confirm_inventory_sale') {
        if (order.payment_status === 'paid') {
          return { data: { current_status: 'Authenticated', idempotent: true }, error: null };
        }
        if (order.current_status === 'Cancelled') {
          return { data: null, error: { message: 'Order is already cancelled.' } };
        }
        if (values.inventory.reservationStatus !== 'active') {
          return { data: null, error: { message: 'No active inventory reservations found.' } };
        }
        values.inventory.stock -= 1;
        values.inventory.reservedStock -= 1;
        values.inventory.reservationStatus = 'confirmed';
        order.payment_status = 'paid';
        order.current_status = 'Authenticated';
        order.payment_reference = args.p_payment_reference;
        values.paymentRecords.push({
          orderId: String(args.p_order_id),
          reference: String(args.p_payment_reference),
        });
        return { data: { current_status: 'Authenticated' }, error: null };
      }

      return { data: null, error: null };
    },
  };
  return { ...values, client };
});

vi.mock('../../src/lib/supabase', () => ({
  supabase: state.client,
  isSupabaseConfigured: () => true,
}));

vi.mock('../../src/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => state.client,
}));

import { webhookIdempotency } from '../../src/services/payments/webhookIdempotency';
import { webhookService } from '../../src/services/webhookService';

const PASSPHRASE = 'unit-test-passphrase';

function makeOrder(): Record<string, unknown> {
  return {
    id: 'order-id-1',
    order_code: 'KXO-1234',
    current_status: 'Pending',
    payment_status: 'pending',
    payment_reference: null,
    total: 1250.5,
    currency: 'ZAR',
  };
}

function signedPayload(
  status: 'COMPLETE' | 'CANCELLED',
  overrides: Record<string, string> = {}
): Record<string, string> {
  const payload = {
    m_payment_id: 'KXO-1234',
    pf_payment_id: 'PF-98765',
    payment_status: status,
    amount_gross: '1250.50',
    currency: 'ZAR',
    ...overrides,
  };
  return {
    ...payload,
    signature: generatePayFastSignature(payload, PASSPHRASE),
  };
}

async function process(payload: Record<string, string>) {
  return webhookService.verifyAndProcessPayFastWebhook(
    payload,
    payload.signature,
    PASSPHRASE
  );
}

describe('PayFast ITN reconciliation', () => {
  beforeEach(() => {
    state.orders.clear();
    state.claims.clear();
    state.rpcCalls.length = 0;
    state.inventory.stock = 5;
    state.inventory.reservedStock = 1;
    state.inventory.reservationStatus = 'active';
    state.paymentRecords.length = 0;
    state.reservationReleaseCalls.length = 0;
    state.orders.set('order-id-1', makeOrder());
    webhookIdempotency.clearRegistry();
  });

  it('processes CANCELLED then COMPLETE as distinct events for one payment', async () => {
    const cancelled = await process(signedPayload('CANCELLED'));
    const completed = await process(signedPayload('COMPLETE'));

    expect(cancelled.success).toBe(true);
    expect(cancelled.inventoryUpdated).toBe(false);
    expect(completed.idempotent).toBe(false);
    expect(completed.success).toBe(true);
    expect(state.orders.get('order-id-1')?.payment_status).toBe('paid');
    expect(state.rpcCalls.filter(call => call.name === 'confirm_inventory_sale')).toHaveLength(1);
  });

  it('processes duplicate COMPLETE as idempotent without duplicating persisted effects', async () => {
    const payload = signedPayload('COMPLETE');
    const first = await process(payload);
    const duplicate = await process(payload);

    expect(first.success).toBe(true);
    expect(first.idempotent).toBe(false);
    expect(duplicate.success).toBe(true);
    expect(duplicate.idempotent).toBe(true);
    expect(state.orders.get('order-id-1')).toMatchObject({
      payment_status: 'paid',
      current_status: 'Authenticated',
      payment_reference: 'PF-98765',
    });
    expect(state.inventory).toEqual({
      stock: 4,
      reservedStock: 0,
      reservationStatus: 'confirmed',
    });
    expect(state.paymentRecords).toEqual([
      { orderId: 'order-id-1', reference: 'PF-98765' },
    ]);
    expect(state.rpcCalls.filter(call => call.name === 'confirm_inventory_sale')).toHaveLength(1);
  });

  it('keeps an already-paid order paid when a signed CANCELLED ITN arrives', async () => {
    const complete = await process(signedPayload('COMPLETE'));
    const inventoryAfterComplete = { ...state.inventory };
    const cancelled = await process(signedPayload('CANCELLED'));

    expect(complete.success).toBe(true);
    expect(cancelled).toMatchObject({
      success: true,
      paymentStatus: 'cancelled',
      orderStatus: 'Authenticated',
      inventoryUpdated: false,
    });
    expect(state.orders.get('order-id-1')).toMatchObject({
      payment_status: 'paid',
      current_status: 'Authenticated',
      payment_reference: 'PF-98765',
    });
    expect(state.inventory).toEqual(inventoryAfterComplete);
    expect(state.paymentRecords).toEqual([
      { orderId: 'order-id-1', reference: 'PF-98765' },
    ]);
    expect(state.reservationReleaseCalls).toHaveLength(0);
    expect(state.rpcCalls.filter(call => call.name === 'confirm_inventory_sale')).toHaveLength(1);
  });

  it('rejects mismatched COMPLETE amount without changing persisted order, payment, or inventory state', async () => {
    const originalOrder = { ...state.orders.get('order-id-1') };
    const originalInventory = { ...state.inventory };
    const result = await process(signedPayload('COMPLETE', { amount_gross: '1250.40' }));

    expect(result).toMatchObject({ success: false, paymentStatus: 'paid' });
    expect(result.error).toContain('amount does not match');
    expect(state.orders.get('order-id-1')).toEqual(originalOrder);
    expect(state.inventory).toEqual(originalInventory);
    expect(state.paymentRecords).toHaveLength(0);
    expect(state.rpcCalls.filter(call =>
      call.name === 'confirm_inventory_sale' || call.name === 'release_order_reservations'
    )).toHaveLength(0);
  });

  it('rejects invalid signature without changing persisted order, payment, or inventory state', async () => {
    const payload = signedPayload('COMPLETE');
    payload.signature = 'not-a-valid-signature';
    const originalOrder = { ...state.orders.get('order-id-1') };
    const originalInventory = { ...state.inventory };

    const result = await process(payload);

    expect(result).toMatchObject({
      success: false,
      event: 'payfast.itn.invalid_signature',
    });
    expect(state.orders.get('order-id-1')).toEqual(originalOrder);
    expect(state.inventory).toEqual(originalInventory);
    expect(state.paymentRecords).toHaveLength(0);
    expect(state.rpcCalls.filter(call =>
      call.name === 'confirm_inventory_sale' || call.name === 'release_order_reservations'
    )).toHaveLength(0);
  });

  it('rejects a signed notification for an unknown order code', async () => {
    const result = await process(signedPayload('COMPLETE', { m_payment_id: 'KXO-UNKNOWN' }));

    expect(result.success).toBe(false);
    expect(result.error).toContain('Order not found');
  });
});
