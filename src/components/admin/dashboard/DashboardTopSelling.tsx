import React from 'react';
import type { TopSellingProduct } from '../../../repositories/admin/analyticsAdminRepository';

interface DashboardTopSellingProps {
  products: TopSellingProduct[];
  onViewAll: () => void;
}

export const DashboardTopSelling: React.FC<DashboardTopSellingProps> = ({ products, onViewAll }) => (
  <div className="lg:col-span-3 p-6 rounded-2xl bg-[#161616] border border-[#262626] space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="font-display font-bold text-base text-white">Top Selling Products</h3>
      <button onClick={onViewAll} className="text-xs font-mono text-[#FF7A00] hover:underline">
        View All
      </button>
    </div>
    {products.length === 0 ? (
      <p className="text-xs font-mono text-[#777777]">No sales data yet.</p>
    ) : (
      <div className="space-y-3">
        {products.map((prod) => (
          <div key={prod.productId} className="flex items-center gap-3 p-2 rounded-xl bg-[#1D1D1D]">
            {prod.imageUrl ? (
              <img src={prod.imageUrl} alt={prod.name} className="w-10 h-10 object-cover rounded-lg bg-[#111111] shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[#111111] shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{prod.name}</div>
              <div className="text-[10px] text-[#777777] truncate">{prod.brand}</div>
            </div>
            <span className="text-[10px] font-mono text-[#AAAAAA] font-bold shrink-0">{prod.salesCount} sold</span>
          </div>
        ))}
      </div>
    )}
  </div>
);
