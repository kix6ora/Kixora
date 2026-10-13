import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Order, OrderStatus } from '../../types';
import { mapOrderRowToOrder, OrderHydratedRow } from './orderMapper';

export interface OrderTrackingResult {
  order: Order;
  trackingNumber: string;
  carrier?: string;
  status: OrderStatus;
  timeline: any[];
  shipment?: any;
}

export interface OrdersQueryResult {
  orders: Order[];
  error: string | null;
}

export const orderRepository = {
  /**
   * Fetches orders with the full error detail so callers can surface failures
   * instead of silently receiving an empty list (D-13).
   */
  async getOrdersResult(userId?: string): Promise<OrdersQueryResult> {
    if (!isSupabaseConfigured()) {
      return { orders: [], error: null };
    }

    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              *,
              brands (*),
              categories (*),
              product_images (*)
            )
          ),
          order_status_history (*),
          shipments (*)
        `)
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[orderRepository.getOrdersResult] Error fetching orders:', error);
        return { orders: [], error: error.message || 'Failed to load orders.' };
      }

      return {
        orders: (data || []).map(row => mapOrderRowToOrder(row as unknown as OrderHydratedRow)),
        error: null,
      };
    } catch (err) {
      console.warn('[orderRepository.getOrdersResult] Exception:', err);
      return {
        orders: [],
        error: err instanceof Error ? err.message : 'Failed to load orders.',
      };
    }
  },

  async getOrders(userId?: string): Promise<Order[]> {
    const { orders } = await this.getOrdersResult(userId);
    return orders;
  },

  async getMyOrders(userId?: string): Promise<Order[]> {
    return this.getOrders(userId);
  },

  async getOrderHistory(userId?: string): Promise<Order[]> {
    return this.getOrders(userId);
  },

  async getCustomerOrders(userId: string): Promise<Order[]> {
    return this.getOrders(userId);
  },

  async getOrderByCode(orderCodeOrId: string, guestAccessToken?: string): Promise<Order | null> {
    if (!isSupabaseConfigured() || !orderCodeOrId) {
      return null;
    }

    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              *,
              brands (*),
              categories (*),
              product_images (*)
            )
          ),
          order_status_history (*),
          shipments (*)
        `);

      if (guestAccessToken) {
        query = query.eq('guest_access_token', guestAccessToken);
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderCodeOrId);
      const { data, error } = isUuid
        ? await query.eq('id', orderCodeOrId).maybeSingle()
        : await query.eq('order_code', orderCodeOrId).maybeSingle();

      if (error) {
        console.warn('[orderRepository.getOrderByCode] Error fetching order:', error);
        return null;
      }

      if (!data) return null;
      return mapOrderRowToOrder(data as unknown as OrderHydratedRow);
    } catch (err) {
      console.warn('[orderRepository.getOrderByCode] Exception:', err);
      return null;
    }
  },

  async getOrderById(orderId: string, guestAccessToken?: string): Promise<Order | null> {
    return this.getOrderByCode(orderId, guestAccessToken);
  },

  async getOrderDetails(orderIdOrCode: string, guestAccessToken?: string): Promise<Order | null> {
    return this.getOrderByCode(orderIdOrCode, guestAccessToken);
  },

  async getOrderStatusHistory(orderId: string): Promise<any[]> {
    if (!isSupabaseConfigured() || !orderId) return [];

    try {
      const { data, error } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[orderRepository.getOrderStatusHistory] Error:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('[orderRepository.getOrderStatusHistory] Exception:', err);
      return [];
    }
  },

  async getShipmentTracking(trackingNumberOrCode: string): Promise<OrderTrackingResult | null> {
    return this.getOrderTracking(trackingNumberOrCode);
  },

  async getShipmentDetails(orderId: string): Promise<any> {
    if (!isSupabaseConfigured() || !orderId) return null;

    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (error) return null;
      return data;
    } catch {
      return null;
    }
  },

  async getOrderTracking(trackingNumberOrCode: string): Promise<OrderTrackingResult | null> {
    if (!isSupabaseConfigured() || !trackingNumberOrCode) {
      return null;
    }

    try {
      // Try finding by shipment tracking number
      const { data: shipmentData } = await supabase
        .from('shipments')
        .select('*, orders (*)')
        .eq('tracking_number', trackingNumberOrCode)
        .maybeSingle();

      if (shipmentData?.order_id) {
        const order = await this.getOrderByCode(shipmentData.order_id);
        if (order) {
          return {
            order,
            trackingNumber: shipmentData.tracking_number || order.trackingNumber,
            carrier: shipmentData.carrier || 'RAM Hand-to-Hand',
            status: order.status,
            timeline: order.timeline,
            shipment: shipmentData,
          };
        }
      }

      const order = await this.getOrderByCode(trackingNumberOrCode);
      if (order) {
        return {
          order,
          trackingNumber: order.trackingNumber,
          carrier: 'RAM Hand-to-Hand',
          status: order.status,
          timeline: order.timeline,
        };
      }

      return null;
    } catch (err) {
      console.warn('[orderRepository.getOrderTracking] Exception:', err);
      return null;
    }
  }
};
