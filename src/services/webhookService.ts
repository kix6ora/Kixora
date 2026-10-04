// ==============================================================================
// KIXORA SECURE WEBHOOK PROCESSING & STATE RECONCILIATION SERVICE (Phase 3C)
// Authoritatively verifies gateway signatures, enforces idempotency, prevents
// replay attacks, and synchronizes atomic order & inventory states.
// ==============================================================================

import { isSupabaseConfigured } from '../lib/supabase';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getPaymentDriver, PaymentProviderType, PaymentStatus } from './payments';
import { webhookIdempotency } from './payments/webhookIdempotency';

export interface ProcessWebhookInput {
  provider: PaymentProviderType;
  payload: any;
  rawBody?: string;
  signature?: string;
  signatureHeader?: string;
  secret?: string;
  passphrase?: string;
  toleranceSeconds?: number;
  eventIdOverride?: string;
}

export interface WebhookReconciliationResult {
  success: boolean;
  provider: PaymentProviderType;
  event: string;
  orderCode?: string;
  paymentIntentId?: string;
  paymentStatus?: PaymentStatus;
  orderStatus?: string;
  idempotent?: boolean;
  inventoryUpdated?: boolean;
  error?: string;
}

export const webhookService = {
  /**
   * Main entry point for processing and reconciling incoming webhook events.
   */
  async processWebhook(input: ProcessWebhookInput): Promise<WebhookReconciliationResult> {
    const { provider, payload, rawBody, signature, signatureHeader, secret, passphrase, toleranceSeconds } = input;

    if (!payload && !rawBody) {
      return {
        success: false,
        provider,
        event: 'unknown',
        error: 'Missing webhook payload and raw body.'
      };
    }

    try {
      const driver = getPaymentDriver(provider);

      // 1. Delegate signature verification & parsing to the driver
      const driverRes = await driver.handleWebhook({
        provider,
        payload,
        rawBody,
        signature,
        signatureHeader,
        secret,
        passphrase,
        toleranceSeconds
      });

      if (!driverRes.success) {
        return {
          success: false,
          provider,
          event: driverRes.event || 'verification_failed',
          error: driverRes.error || 'Webhook driver verification failed.'
        };
      }

      if (['paid', 'refunded'].includes(driverRes.newStatus || '') && !driverRes.orderCode) {
        return {
          success: false,
          provider,
          event: driverRes.event || 'invalid_payment_event',
          error: 'Payment event is missing an order reference.'
        };
      }

      // 2. Determine unique Event ID for idempotency
      const payfastStatus = typeof payload === 'object'
        ? String(payload?.payment_status || '').toUpperCase()
        : '';
      const payfastPaymentId = typeof payload === 'object'
        ? String(payload?.pf_payment_id || '')
        : '';
      const eventId = provider === 'payfast'
        ? (payfastPaymentId && payfastStatus ? `${payfastPaymentId}:${payfastStatus}` : undefined)
        : (input.eventIdOverride ||
          ((typeof payload === 'object' && payload?.id) ||
            (typeof payload === 'object' && payload?.m_payment_id) ||
            undefined));

      if (!eventId) {
        return {
          success: false,
          provider,
          event: driverRes.event,
          error: 'Webhook event is missing a stable event ID.'
        };
      }

      // 3. Idempotency Check & Atomic Lock Acquisition
      const lockAcquired = await webhookIdempotency.acquireProcessingLock(eventId, provider);
      if (!lockAcquired) {
        // If we couldn't acquire the lock, it's either currently in-flight or already processed.
        // We return success: true with idempotent: true to satisfy the caller.
        return {
          success: true,
          provider,
          event: driverRes.event,
          orderCode: driverRes.orderCode,
          paymentIntentId: driverRes.paymentIntentId,
          paymentStatus: driverRes.newStatus,
          idempotent: true
        };
      }

      // 4. Reconcile Order & Inventory state atomically
      const reconciliation = await this.reconcileOrderState({
        provider,
        orderCode: driverRes.orderCode,
        paymentIntentId: driverRes.paymentIntentId,
        newStatus: driverRes.newStatus || 'pending',
        gatewayMetadata: driverRes.gatewayMetadata,
        eventType: driverRes.event
      });

      // 5. Record event in idempotency store
      await webhookIdempotency.recordEventProcessed({
        eventId,
        provider,
        eventType: driverRes.event,
        orderCode: driverRes.orderCode,
        payload: typeof payload === 'object' ? payload : { raw: String(rawBody || '') },
        status: reconciliation.success ? 'processed' : 'failed'
      });

      return {
        success: reconciliation.success,
        provider,
        event: driverRes.event,
        orderCode: driverRes.orderCode,
        paymentIntentId: driverRes.paymentIntentId,
        paymentStatus: driverRes.newStatus,
        orderStatus: reconciliation.orderStatus,
        inventoryUpdated: reconciliation.inventoryUpdated,
        idempotent: false,
        error: reconciliation.error
      };
    } catch (err: any) {
      console.error('[webhookService.processWebhook] Exception:', err);
      return {
        success: false,
        provider,
        event: 'error',
        error: 'Webhook processing failed.'
      };
    }
  },

  /**
   * Helper to verify and process PayFast ITN webhooks with payload and signature.
   */
  async verifyAndProcessPayFastWebhook(
    payload: Record<string, any>,
    signature?: string,
    passphrase?: string
  ): Promise<WebhookReconciliationResult> {
    return this.processWebhook({
      provider: 'payfast',
      payload,
      signature: signature || payload?.signature,
      passphrase
    });
  },

  /**
   * Reconciles order payment status, order tracking state, and inventory allocation.
   */
  async reconcileOrderState(params: {
    provider: PaymentProviderType;
    orderCode?: string;
    paymentIntentId?: string;
    newStatus: PaymentStatus;
    gatewayMetadata?: Record<string, any>;
    eventType: string;
  }): Promise<{ success: boolean; orderStatus?: string; inventoryUpdated?: boolean; error?: string }> {
    const { provider, orderCode, paymentIntentId, newStatus, gatewayMetadata, eventType } = params;

    if (!orderCode && !paymentIntentId) {
      return { success: true, orderStatus: 'unknown' };
    }

    if (!isSupabaseConfigured()) {
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
        return { success: false, error: 'Persistent order reconciliation is unavailable.' };
      }
      // Local fallback representation
      return {
        success: true,
        orderStatus: newStatus === 'paid' ? 'Authenticated' : (newStatus === 'failed' || newStatus === 'cancelled' || newStatus === 'refunded' ? 'Cancelled' : 'Processing'),
        inventoryUpdated: true
      };
    }

    try {
      // Find order by code or id
      const admin = getSupabaseAdmin();
      let query = admin.from('orders').select('id, order_code, current_status, payment_status, payment_reference, total, currency');
      if (orderCode) {
        query = query.eq('order_code', orderCode);
      } else if (paymentIntentId) {
        query = query.eq('payment_reference', paymentIntentId);
      }

      const { data: order, error: findError } = await query.maybeSingle();

      if (findError) {
        console.warn('[webhookService.reconcileOrderState] Database error finding order:', findError);
        return { success: false, error: 'Persistent order reconciliation failed.' };
      }

      if (!order) {
        console.warn(`[webhookService.reconcileOrderState] Order not found for orderCode: ${orderCode}`);
        return { success: false, error: 'Order not found for payment event.' };
      }

      if (newStatus === 'paid') {
        const receivedAmount = gatewayMetadata?.amountGross;
        if (typeof receivedAmount !== 'number' || !Number.isFinite(receivedAmount) ||
            Math.abs(receivedAmount - Number(order.total)) > 0.01) {
          return { success: false, error: 'Payment amount does not match the order total.' };
        }
        const receivedCurrency = String(gatewayMetadata?.currency || '').toLowerCase();
        const orderCurrency = String((order as any).currency || 'ZAR').toLowerCase();
        if (!receivedCurrency || receivedCurrency !== orderCurrency) {
          return { success: false, error: 'Payment currency does not match the order currency.' };
        }
      }

      if (provider === 'payfast' && newStatus === 'cancelled') {
        // Keep the pending reservation briefly so a later COMPLETE ITN can still settle this order.
        return {
          success: true,
          orderStatus: order.current_status,
          inventoryUpdated: false,
        };
      }

      let nextOrderStatus = order.current_status;
      let inventoryUpdated = false;

      if (newStatus === 'paid') {
        nextOrderStatus = 'Authenticated';

        // Use Atomic RPC for all state transitions to ensure concurrency safety
        const { data: rpcData, error: rpcError } = await admin.rpc('confirm_inventory_sale', {
          p_order_id: order.id,
          p_payment_reference: paymentIntentId || order.payment_reference 
        });

        if (rpcError) {
          console.warn('[webhookService] confirm_inventory_sale RPC error:', rpcError);
          return { success: false, error: rpcError.message };
        }

        inventoryUpdated = true;
        nextOrderStatus = rpcData?.current_status || 'Authenticated';

      } else if (newStatus === 'failed' || newStatus === 'cancelled') {
        nextOrderStatus = 'Cancelled';

        // Use Atomic RPC for all state transitions
        const { error: rpcError } = await admin.rpc('release_order_reservations', {
          p_order_id: order.id,
          p_reason: `Payment ${newStatus} via ${provider.toUpperCase()} (Event: ${eventType})`
        });

        if (rpcError) {
          console.warn('[webhookService] release_order_reservations RPC error:', rpcError);
          return { success: false, error: rpcError.message };
        }

        inventoryUpdated = true;

      } else if (newStatus === 'refunded') {
        nextOrderStatus = 'Cancelled';

        // 1. Update order row
        await admin
          .from('orders')
          .update({
            payment_status: 'refunded',
            current_status: 'Cancelled',
            payment_metadata: gatewayMetadata || {}
          })
          .eq('id', order.id);

        // 2. Insert order_status_history
        await admin.from('order_status_history').insert({
          order_id: order.id,
          status: 'Cancelled',
          notes: `Payment fully refunded via ${provider.toUpperCase()} (Event: ${eventType})`
        });
      }

      return {
        success: true,
        orderStatus: nextOrderStatus,
        inventoryUpdated
      };
    } catch (err: any) {
      console.error('[webhookService.reconcileOrderState] Exception:', err);
      return { success: false, error: 'Order reconciliation failed.' };
    }
  }
};
