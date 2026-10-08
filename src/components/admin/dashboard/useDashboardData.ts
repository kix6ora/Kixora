import { useEffect, useState } from 'react';
import { isSupabaseAdminEnabled } from '../../../config/features';
import {
  analyticsAdminRepository,
  type DashboardMetrics,
  type LowStockAlert,
  type RecentAdminOrder,
  type TopSellingProduct,
} from '../../../repositories/admin/analyticsAdminRepository';

export interface DashboardData {
  loading: boolean;
  error: string | null;
  metrics: DashboardMetrics | null;
  lowStock: LowStockAlert[];
  topSelling: TopSellingProduct[];
  recentOrders: RecentAdminOrder[];
  rangeLabel: string;
}

const formatShort = (d: Date): string =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const buildRangeLabel = (today: Date = new Date()): string => {
  const end = new Date(today);
  const start = new Date(today);
  start.setDate(end.getDate() - 6);
  return `${formatShort(start)} \u2013 ${formatShort(end)}, ${end.getFullYear()}`;
};

export const useDashboardData = (): DashboardData => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [lowStock, setLowStock] = useState<LowStockAlert[]>([]);
  const [topSelling, setTopSelling] = useState<TopSellingProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentAdminOrder[]>([]);
  const [rangeLabel] = useState(() => buildRangeLabel());

  useEffect(() => {
    if (!isSupabaseAdminEnabled()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const [m, low, top, recent] = await Promise.all([
          analyticsAdminRepository.getDashboardMetrics(),
          analyticsAdminRepository.getLowStockAlerts(),
          analyticsAdminRepository.getTopSellingProducts(),
          analyticsAdminRepository.getRecentOrders(5),
        ]);
        if (cancelled) return;
        setMetrics(m);
        setLowStock(low);
        setTopSelling(top);
        setRecentOrders(recent);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, error, metrics, lowStock, topSelling, recentOrders, rangeLabel };
};
