import React from 'react';
import { AlertTriangle, BarChart3, Package, ShoppingBag, Users } from 'lucide-react';
import type { DashboardMetrics } from '../../../repositories/admin/analyticsAdminRepository';

interface DashboardKpiCardsProps {
  metrics: DashboardMetrics | null;
  onViewInventory: () => void;
}

const formatRevenue = (value: number): string =>
  `R${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const DashboardKpiCards: React.FC<DashboardKpiCardsProps> = ({ metrics, onViewInventory }) => {
  const cards = [
    { label: 'TOTAL REVENUE', value: formatRevenue(metrics?.totalRevenue ?? 0), icon: <BarChart3 className="w-4 h-4" />, iconClass: 'bg-[#FF7A00]/15 text-[#FF7A00]' },
    { label: 'TOTAL ORDERS', value: String(metrics?.totalOrders ?? 0), icon: <ShoppingBag className="w-4 h-4" />, iconClass: 'bg-[#3B82F6]/15 text-[#3B82F6]' },
    { label: 'TOTAL CUSTOMERS', value: String(metrics?.totalCustomers ?? 0), icon: <Users className="w-4 h-4" />, iconClass: 'bg-[#A855F7]/15 text-[#A855F7]' },
    { label: 'PRODUCTS', value: String(metrics?.activeSilhouettes ?? 0), icon: <Package className="w-4 h-4" />, iconClass: 'bg-[#10B981]/15 text-[#10B981]' },
    { label: 'LOW STOCK ITEMS', value: String(metrics?.lowStockCount ?? 0), icon: <AlertTriangle className="w-4 h-4" />, iconClass: 'bg-[#EF4444]/15 text-[#EF4444]' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.slice(0, 4).map((card) => (
        <div key={card.label} className="p-5 rounded-2xl bg-[#161616] border border-[#262626] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#888888] font-bold">{card.label}</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconClass}`}>{card.icon}</div>
          </div>
          <div className="font-mono text-xl sm:text-2xl font-black text-white">{card.value}</div>
          <div className="text-[11px] font-mono text-[#666666] font-normal">Live data</div>
        </div>
      ))}
      <div className="p-5 rounded-2xl bg-[#161616] border border-[#262626] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#888888] font-bold">LOW STOCK ITEMS</span>
          <div className="w-8 h-8 rounded-lg bg-[#EF4444]/15 flex items-center justify-center text-[#EF4444]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="font-mono text-xl sm:text-2xl font-black text-white">{metrics?.lowStockCount ?? 0}</div>
        <button onClick={onViewInventory} className="text-[11px] font-mono text-[#FF7A00] hover:underline flex items-center gap-1 font-semibold">
          <span>View Inventory</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
};
