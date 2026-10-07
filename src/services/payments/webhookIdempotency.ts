// ==============================================================================
// KIXORA WEBHOOK IDEMPOTENCY & REPLAY PROTECTION (Phase 3C)
// Tracks processed webhook event IDs to prevent double-processing,
// duplicate inventory deductions, and replay attacks.
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

export interface ProcessedWebhookRecord {
  eventId: string;
  provider: string;
  eventType: string;
  orderCode?: string;
  payload?: any;
  status: 'processed' | 'failed' | 'ignored';
  processedAt: string;
}

class WebhookIdempotencyRegistry {
  private inMemoryCache: Map<string, ProcessedWebhookRecord> = new Map();
  private maxCacheSize = 2000;

  private getPersistenceClient() {
    if (typeof window === 'undefined') {
      return getSupabaseAdmin();
    }
    return supabase;
  }

  private makeKey(provider: string, eventId: string): string {
    return `${provider.toLowerCase()}:${eventId}`;
  }

  /**
   * Check if a webhook event has already been processed.
   */
  async isEventProcessed(eventId: string, provider: string): Promise<boolean> {
    if (!eventId || !provider) return false;

    const key = this.makeKey(provider, eventId);
    if (this.inMemoryCache.has(key)) {
      return true;
    }

    // Check Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await this.getPersistenceClient()
          .from('webhook_events')
          .select('event_id')
          .eq('event_id', eventId)
          .eq('provider', provider)
          .maybeSingle();

        if (!error && data) {
          this.inMemoryCache.set(key, {
            eventId,
            provider,
            eventType: 'existing',
            status: 'processed',
            processedAt: new Date().toISOString()
          });
          return true;
        }
      } catch (err) {
        console.warn('[WebhookIdempotency] Supabase lookup error (falling back to memory):', err);
      }
    }

    return false;
  }

  /**
   * Atomically checks and acquires lock if not already processed or currently in-flight.
   * Returns true if lock was successfully acquired (first processing attempt), false if duplicate.
   */
  async acquireProcessingLock(eventId: string, provider: string): Promise<boolean> {
    if (!eventId || !provider) return false;

    const key = this.makeKey(provider, eventId);
    
    // 1. Synchronous check-and-set for memory cache to block concurrent in-flight requests
    if (this.inMemoryCache.has(key)) {
      return false;
    }

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await this.getPersistenceClient().rpc('claim_webhook_event', {
          p_event_id: eventId,
          p_provider: provider,
        });

        if (error) {
          throw new Error(`Authoritative webhook claim failed: ${error.message}`);
        }
        if (data === false) {
          return false;
        }
        if (data !== true) throw new Error('Authoritative webhook claim returned an invalid result.');
        this.inMemoryCache.set(key, {
          eventId,
          provider,
          eventType: 'in_flight',
          status: 'processed',
          processedAt: new Date().toISOString(),
        });
        return true;
      } catch (err) {
        console.error('[WebhookIdempotency] Authoritative claim exception:', err);
        throw err;
      }
    }

    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      throw new Error('Persistent webhook idempotency is unavailable in production.');
    }

    // Development/test fallback only.
    this.inMemoryCache.set(key, {
      eventId,
      provider,
      eventType: 'in_flight',
      status: 'processed',
      processedAt: new Date().toISOString(),
    });
    return true;
  }

  /**
   * Record a webhook event as successfully processed.
   */
  async recordEventProcessed(record: {
    eventId: string;
    provider: string;
    eventType: string;
    orderCode?: string;
    payload?: any;
    status?: 'processed' | 'failed' | 'ignored';
  }): Promise<void> {
    const { eventId, provider, eventType, orderCode, payload, status = 'processed' } = record;
    if (!eventId || !provider) return;

    const key = this.makeKey(provider, eventId);
    const entry: ProcessedWebhookRecord = {
      eventId,
      provider,
      eventType,
      orderCode,
      payload,
      status,
      processedAt: new Date().toISOString()
    };

    // Maintain in-memory cache size
    if (this.inMemoryCache.size >= this.maxCacheSize) {
      const firstKey = this.inMemoryCache.keys().next().value;
      if (firstKey) this.inMemoryCache.delete(firstKey);
    }
    this.inMemoryCache.set(key, entry);

    // Persist the authoritative final state if configured.
    if (isSupabaseConfigured()) {
      try {
        const { error } = await this.getPersistenceClient().from('webhook_events').upsert({
          event_id: eventId,
          provider,
          event_type: eventType,
          order_code: orderCode || null,
          payload: payload || {},
          status,
          processed_at: new Date().toISOString()
        }, { onConflict: 'provider,event_id' });
        if (error) {
          console.error('[WebhookIdempotency] Supabase event update failed:', error);
        }
      } catch (err) {
        console.error('[WebhookIdempotency] Supabase event update exception:', err);
      }
    }
  }

  /**
   * Reset the in-memory cache (for test isolation).
   */
  clearRegistry(): void {
    this.inMemoryCache.clear();
  }
}

export const webhookIdempotency = new WebhookIdempotencyRegistry();
