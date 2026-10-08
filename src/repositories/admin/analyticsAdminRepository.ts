import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  activeSilhouettes: number;
  lowStockCount: number;
  totalCustomers: number;
}

export interface BrandSalesMetric {
  brand: string;
  orderCount: number;
  revenue: number;
}

export interface LowStockAlert {
  productId: string;
  productName: string;
  brand: string;
  sizeUs: number;
  stock: number;
  productSizeId: string;
}

export interface TopSellingProduct {
  productId: string;
  name: string;
  brand: string;
  imageUrl: string;
  salesCount: number;
}

export interface RecentAdminOrder {
  id: string;
  orderCode: string;
  total: number;
  status: string;
  createdAt: string;
  customerName: string;
}

export const analyticsAdminRepository = {
  /**
   * Calculates overall dashboard key performance indicators.
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    if (!isSupabaseConfigured()) {
      return {
        totalRevenue: 0,
        totalOrders: 0,
        activeSilhouettes: 0,
        lowStockCount: 0,
        totalCustomers: 0,
      };
    }

    try {
      // 1. Orders & Revenue
      const { data: orders, count: orderCount } = await supabase
        .from('orders')
        .select('total, current_status', { count: 'exact' });

      let revenue = 0;
      (orders || []).forEach((o) => {
        if (o.current_status !== 'Cancelled') {
          revenue += Number(o.total) || 0;
        }
      });

      // 2. Active Silhouettes
      const { count: activeProductCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // 3. Customers
      const { count: customerCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // 4. Low stock count
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('stock')
        .lte('stock', 3);

      return {
        totalRevenue: revenue,
        totalOrders: orderCount || 0,
        activeSilhouettes: activeProductCount || 0,
        lowStockCount: (inventoryData || []).length,
        totalCustomers: customerCount || 0,
      };
    } catch (err) {
      console.error('[analyticsAdminRepository.getDashboardMetrics] Error:', err);
      return {
        totalRevenue: 0,
        totalOrders: 0,
        activeSilhouettes: 0,
        lowStockCount: 0,
        totalCustomers: 0,
      };
    }
  },

  /**
   * Retrieves low stock alerts for inventory warning badges.
   */
  async getLowStockAlerts(threshold: number = 3): Promise<LowStockAlert[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('product_sizes')
      .select(`
        id,
        product_id,
        size_us,
        products (
          name,
          brands (name)
        ),
        inventory (
          stock
        )
      `);

    if (error) {
      console.error('[analyticsAdminRepository.getLowStockAlerts] Error:', error);
      throw error;
    }

    const alerts: LowStockAlert[] = [];
    (data || []).forEach((row: any) => {
      const stock = Number(row.inventory?.[0]?.stock) || 0;
      if (stock <= threshold) {
        alerts.push({
          productSizeId: row.id,
          productId: row.product_id,
          productName: row.products?.name || 'Vault Sneaker',
          brand: row.products?.brands?.name || 'Nike',
          sizeUs: Number(row.size_us),
          stock,
        });
      }
    });

    return alerts;
  },

  /**
   * Retrieves the best-selling products ranked by the sales_count maintained
   * by the checkout database functions. Read-only; used by the admin dashboard.
   */
  async getTopSellingProducts(limit: number = 4): Promise<TopSellingProduct[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sales_count,
        brands ( name ),
        product_images ( image_url, display_order )
      `)
      .eq('is_active', true)
      .order('sales_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[analyticsAdminRepository.getTopSellingProducts] Error:', error);
      throw error;
    }

    return (data || []).map((row: any) => {
      const images = Array.isArray(row.product_images)
        ? [...row.product_images].sort(
            (a: any, b: any) => Number(a.display_order || 0) - Number(b.display_order || 0)
          )
        : [];
      return {
        productId: row.id,
        name: row.name || 'Vault Sneaker',
        brand: row.brands?.name || '',
        imageUrl: images[0]?.image_url || '',
        salesCount: Number(row.sales_count) || 0,
      };
    });
  },

  /**
   * Retrieves the most recent orders for the admin dashboard. Read-only.
   */
  async getRecentOrders(limit: number = 5): Promise<RecentAdminOrder[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('orders')
      .select('id, order_code, total, current_status, created_at, customer_full_name, customer_snapshot')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[analyticsAdminRepository.getRecentOrders] Error:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      orderCode: row.order_code || row.id,
      total: Number(row.total) || 0,
      status: row.current_status || 'Processing',
      createdAt: row.created_at,
      customerName:
        row.customer_snapshot?.fullName || row.customer_full_name || 'Valued Collector',
    }));
  },
};
