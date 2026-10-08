import React from 'react';
import type { RecentAdminOrder } from '../../../repositories/admin/analyticsAdminRepository';

interface DashboardRecentOrdersProps {
  orders: RecentAdminOrder[];
  onViewAll: () => void;
}

const statusClass = (status: string): string => {
  const s = status.toLowerCase();
  if (s.includes('deliver') || s.includes('complet')) return 'text-[#10B981] bg-[#10B981]/15';
  if (s.includes('ship')) return 'text-[#3B82F6] bg-[#3B82F6]/15';
  if (s.includes('cancel')) return 'text-[#EF4444] bg-[#EF4444]/15';
  return 'text-[#FF7A00] bg-[#FF7A00]/15';
};

const formatTotal = (value: number): string =>
  `R${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const DashboardRecentOrders: React.FC<DashboardRecentOrdersProps> = ({ orders, onViewAll }) => (
  <div className="lg:col-span-4 p-6 rounded-2xl bg-[#161616] border border-[#262626] space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="font-display font-bold text-base text-white">Recent Orders</h3>
      <button onClick={onViewAll} className="text-xs font-mono text-[#FF7A00] hover:underline">
        View All
      </button>
    </div>
    {orders.length === 0 ? (
      <p className="text-xs font-mono text-[#777777]">No recent orders yet.</p>
    ) : (
      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#1D1D1D] text-xs font-mono">
            <div>
              <div className="font-bold text-white">{order.orderCode}</div>
              <div className="text-[10px] text-[#777777]">{order.customerName} · {formatDate(order.createdAt)}</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-white">{formatTotal(order.total)}</div>
              <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-md ${statusClass(order.status)}`}>
                {order.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
