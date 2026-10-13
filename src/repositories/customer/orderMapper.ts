import { Order, OrderStatus } from '../../types';

export interface OrderHydratedRow {
  id: string;
  order_code?: string;
  tracking_number?: string | null;
  guest_access_token?: string | null;
  user_id?: string | null;
  customer_snapshot?: {
    fullName?: string;
    email?: string;
    phone?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    [key: string]: any;
  } | null;
  status?: string | null;
  current_status?: string | null;
  subtotal: number;
  discount?: number | null;
  shipping_fee?: number | null;
  tax?: number | null;
  total: number;
  payment_method?: string | null;
  shipping_method?: string | null;
  payment_status?: string | null;
  payment_reference?: string | null;
  customer_full_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  shipping_street?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_zip?: string | null;
  shipping_country?: string | null;
  created_at: string;
  updated_at?: string;
  order_items?: Array<{
    id: string;
    order_id?: string;
    product_id: string;
    product_name?: string;
    product_sku?: string;
    size?: number;
    size_us?: number;
    unit_price?: number;
    quantity: number;
    total_price?: number;
    image_url?: string;
    products?: any;
    created_at?: string;
    [key: string]: any;
  }> | null;
  order_events?: Array<{
    id?: string;
    title: string;
    description?: string | null;
    created_at: string;
    [key: string]: any;
  }> | null;
  order_status_history?: Array<{
    id?: string;
    status?: string;
    title: string;
    description?: string | null;
    created_by?: string | null;
    created_at: string;
    [key: string]: any;
  }> | null;
  shipments?: Array<{
    id?: string;
    tracking_number?: string;
    carrier?: string;
    [key: string]: any;
  }> | null;
  [key: string]: any;
}

export const mapOrderRowToOrder = (row: OrderHydratedRow): Order => {
  const items = (row.order_items || []).map(item => {
    const size = Number(item.size_us ?? item.size ?? 9);
    const price = Number(item.unit_price || 0);
    const name = item.product_name || item.products?.name || 'Vault Sneaker';
    const brand = item.products?.brands?.name || 'Nike';
    const category = item.products?.categories?.name || 'High-Top';
    const image = item.image_url || item.products?.product_images?.[0]?.image_url || '';

    return {
      id: item.id,
      sneaker: {
        id: item.product_id,
        name,
        brand,
        category,
        gender: 'Men' as const,
        price,
        description: '',
        image,
        images: [image],
        gallery: [image],
        sizes: [{ size, stock: 5 }],
        colorway: '',
        releaseYear: 2024,
        sku: item.product_sku || '',
        story: '',
        rating: 5.0,
        reviewsCount: 0,
        salesCount: 0,
      },
      selectedSize: size,
      quantity: item.quantity,
    };
  });

  // D-13: the legacy `order_events` relation has no table in supabase/migrations,
  // so events always default to [] and never feed the timeline. The timeline is
  // built from order_status_history and shipments instead.
  const events = row.order_events || [];
  const statusHistory = row.order_status_history || [];
  const shipmentRows = row.shipments || [];

  const timeline = statusHistory.map(evt => ({
    id: evt.id,
    title: evt.title,
    timestamp: new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    description: evt.description || '',
    completed: true,
  }));

  // When no status history exists, derive tracking milestones from shipments.
  if (timeline.length === 0 && shipmentRows.length > 0) {
    shipmentRows.forEach((shipment, index) => {
      const shippedAt = shipment.created_at ? new Date(shipment.created_at) : null;
      timeline.push({
        id: shipment.id || `shipment-${index}`,
        title: 'Shipped',
        timestamp: shippedAt && !Number.isNaN(shippedAt.getTime())
          ? shippedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Just now',
        description: `Tracking ${shipment.tracking_number || 'pending'} via ${shipment.carrier || 'RAM Hand-to-Hand'}`,
        completed: true,
      });
    });
  }

  if (timeline.length === 0 && events.length === 0) {
    timeline.push({
      id: 'default-event',
      title: 'Order Placed',
      timestamp: 'Just now',
      description: 'Order received and being processed in vault.',
      completed: true,
    });
  }

  const trackingNumber =
    row.shipments?.[0]?.tracking_number ||
    row.tracking_number ||
    `TRK-VAULT-${Math.floor(10000 + Math.random() * 90000)}`;

  const customer = {
    fullName: row.customer_snapshot?.fullName || row.customer_full_name || 'Valued Collector',
    email: row.customer_snapshot?.email || row.customer_email || '',
    phone: row.customer_snapshot?.phone || row.customer_phone || '',
    street: row.customer_snapshot?.street || row.shipping_street || '',
    city: row.customer_snapshot?.city || row.shipping_city || '',
    state: row.customer_snapshot?.state || row.shipping_state || '',
    zip: row.customer_snapshot?.zip || row.shipping_zip || '',
    country: row.customer_snapshot?.country || row.shipping_country || 'South Africa',
  };

  const statusRaw = row.current_status || row.status || 'Processing';
  const validStatus: OrderStatus = (
    ['Pending', 'Processing', 'Authenticated', 'Vault Packed', 'Dispatched', 'Shipped', 'Delivered', 'Cancelled'].includes(statusRaw)
      ? statusRaw
      : 'Processing'
  ) as OrderStatus;

  return {
    id: row.id || row.order_code || 'ord-unknown',
    orderCode: row.order_code,
    trackingNumber,
    createdAt: row.created_at,
    customer,
    items,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount || 0),
    shippingFee: Number(row.shipping_fee || 0),
    tax: Number(row.tax || 0),
    total: Number(row.total),
    status: validStatus,
    paymentMethod: row.payment_method || 'Instant EFT',
    shippingMethod: row.shipping_method || 'Vault Express Delivery',
    timeline,
  };
};

export const mapOrderRowsToOrders = (rows: OrderHydratedRow[]): Order[] => {
  return rows.map(mapOrderRowToOrder);
};
