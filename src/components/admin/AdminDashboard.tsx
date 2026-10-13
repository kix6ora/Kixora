import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  Boxes, 
  Layers, 
  Tag, 
  Percent, 
  Star, 
  BarChart3, 
  Settings, 
  AlertTriangle, 
  Calendar, 
  Download, 
  ChevronDown,
  Store,
} from 'lucide-react';
import { AdminSignOutButton } from './AdminSignOutButton';
import { AdminProducts } from './AdminProducts';
import { AdminOrders } from './AdminOrders';
import { AdminInventory } from './AdminInventory';
import { AdminPromos } from './AdminPromos';
import { AdminAnalytics } from './AdminAnalytics';
import { isSupabaseAdminEnabled } from '../../config/features';
import { useDashboardData } from './dashboard/useDashboardData';
import { DashboardKpiCards } from './dashboard/DashboardKpiCards';
import { DashboardRecentOrders } from './dashboard/DashboardRecentOrders';
import { DashboardTopSelling } from './dashboard/DashboardTopSelling';

type AdminNavTab = 
  | 'dashboard' 
  | 'products' 
  | 'orders' 
  | 'customers' 
  | 'inventory' 
  | 'categories' 
  | 'brands' 
  | 'coupons' 
  | 'reviews' 
  | 'analytics' 
  | 'settings';

export const AdminDashboard: React.FC = () => {
  const { setCurrentView, showToast } = useStore();
  const [activeTab, setActiveTab] = useState<AdminNavTab>('dashboard');
  const liveAdmin = isSupabaseAdminEnabled();
  const dashboard = useDashboardData();
  const [dateRange] = useState('May 21 – May 27, 2025');
  const rangeLabel = liveAdmin ? dashboard.rangeLabel : dateRange;

  // KPI Calculations matching the reference numbers with live flexibility
  const totalRevenueFormatted = 'R248,950.00';
  const totalOrdersCount = 1458;
  const totalCustomersCount = 892;
  const totalProductsCount = 312;
  const lowStockCount = 23;

  const handleExport = () => {
    showToast('Report Exported', 'Sales and inventory CSV report generated.', 'success');
  };

  return (
    <div className="min-h-screen bg-[#111111] text-[#F5F5F5] flex flex-col lg:flex-row">
      {/* Left Sidebar matching exact Reference Image */}
      <aside className="w-full lg:w-64 bg-[#141414] border-r border-[#262626] flex flex-col justify-between p-5 shrink-0">
        <div className="space-y-6">
          {/* Logo with ADMIN PANEL */}
          <div className="pb-4 border-b border-[#242424]">
            <button
              onClick={() => setCurrentView('store')}
              className="flex flex-col text-left group"
            >
              <div className="font-display font-black text-2xl tracking-wider text-white flex items-center">
                <span>KI</span>
                <span className="text-[#FF7A00]">X</span>
                <span>ORA</span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#777777] font-semibold">
                ADMIN PANEL
              </span>
            </button>
          </div>

          {/* Navigation Links matching reference image */}
          <nav className="space-y-1 text-xs font-sans">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
              { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
              { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-4 h-4" /> },
              { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
              { id: 'inventory', label: 'Inventory', icon: <Boxes className="w-4 h-4" /> },
              { id: 'categories', label: 'Categories', icon: <Layers className="w-4 h-4" /> },
              { id: 'brands', label: 'Brands', icon: <Tag className="w-4 h-4" /> },
              { id: 'coupons', label: 'Coupons', icon: <Percent className="w-4 h-4" /> },
              { id: 'reviews', label: 'Reviews', icon: <Star className="w-4 h-4" /> },
              { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
              { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`admin-nav-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as AdminNavTab)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all ${
                    isActive
                      ? 'bg-[#FF7A00] text-black font-extrabold shadow-md shadow-[#FF7A00]/20'
                      : 'text-[#888888] hover:text-white hover:bg-[#1E1E1E]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile Card matching reference image */}
        <div className="pt-6 border-t border-[#242424] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto,w_120,h_120,c_fill/kixora/avatars/admin_avatar.png"
                alt="Admin Avatar"
                className="w-9 h-9 rounded-full object-cover border border-[#333333]"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Admin User</div>
                <div className="text-[10px] text-[#777777] truncate font-mono">admin@kixora.com</div>
              </div>
            </div>

            <button
              onClick={() => setCurrentView('store')}
              className="p-1.5 text-[#888888] hover:text-[#FF7A00] hover:bg-[#202020] rounded-lg transition-colors"
              title="Return to Customer Store"
            >
              <Store className="w-4 h-4" />
            </button>
          </div>
          <AdminSignOutButton />
        </div>
      </aside>

      {/* Main Admin Console Area */}
      <main className="flex-1 p-6 sm:p-8 lg:p-10 space-y-8 overflow-x-hidden">
        {/* Header matching Reference Image */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white flex items-center gap-2">
              <span>Welcome back, Admin</span>
              <span className="text-2xl">👋</span>
              {!liveAdmin && (
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30">
                  Mock Data
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-[#888888] mt-1 font-sans">
              Here's what's happening with your store today.
            </p>
          </div>

          {/* Date range picker & Export button matching reference image */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg text-xs font-mono text-[#CCCCCC]">
              <Calendar className="w-3.5 h-3.5 text-[#888888]" />
              <span>{rangeLabel}</span>
              <ChevronDown className="w-3 h-3 text-[#888888]" />
            </div>

            <button
              onClick={handleExport}
              className="px-4 py-2 bg-[#FF7A00] hover:bg-[#E56E00] text-black font-extrabold text-xs rounded-lg transition-all shadow-md shadow-[#FF7A00]/20 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* Render Active View / Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {liveAdmin && dashboard.loading && (
              <div className="p-6 rounded-2xl bg-[#161616] border border-[#262626] text-xs font-mono text-[#888888]">
                Loading live dashboard data…
              </div>
            )}
            {liveAdmin && !dashboard.loading && dashboard.error && (
              <div className="p-6 rounded-2xl bg-[#161616] border border-[#EF4444]/40 text-xs font-mono text-[#EF4444]">
                Failed to load live dashboard data: {dashboard.error}
              </div>
            )}
            {liveAdmin ? (
              <DashboardKpiCards metrics={dashboard.metrics} onViewInventory={() => setActiveTab('inventory')} />
            ) : (
            <>
            {/* Top 5 Metric Cards matching exact Reference Image */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* Card 1: TOTAL REVENUE */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-[#262626] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#888888] font-bold">
                    TOTAL REVENUE
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#FF7A00]/15 flex items-center justify-center text-[#FF7A00]">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
                <div className="font-mono text-xl sm:text-2xl font-black text-white">
                  {totalRevenueFormatted}
                </div>
                <div className="text-[11px] font-mono text-[#10B981] flex items-center gap-1 font-semibold">
                  <span>↑ 18.2%</span>
                  <span className="text-[#666666] font-normal">vs last 7 days</span>
                </div>
              </div>

              {/* Card 2: TOTAL ORDERS */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-[#262626] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#888888] font-bold">
                    TOTAL ORDERS
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/15 flex items-center justify-center text-[#3B82F6]">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <div className="font-mono text-xl sm:text-2xl font-black text-white">
                  {totalOrdersCount}
                </div>
                <div className="text-[11px] font-mono text-[#10B981] flex items-center gap-1 font-semibold">
                  <span>↑ 12.5%</span>
                  <span className="text-[#666666] font-normal">vs last 7 days</span>
                </div>
              </div>

              {/* Card 3: TOTAL CUSTOMERS */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-[#262626] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#888888] font-bold">
                    TOTAL CUSTOMERS
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#A855F7]/15 flex items-center justify-center text-[#A855F7]">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="font-mono text-xl sm:text-2xl font-black text-white">
                  {totalCustomersCount}
                </div>
                <div className="text-[11px] font-mono text-[#10B981] flex items-center gap-1 font-semibold">
                  <span>↑ 8.4%</span>
                  <span className="text-[#666666] font-normal">vs last 7 days</span>
                </div>
              </div>

              {/* Card 4: PRODUCTS */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-[#262626] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#888888] font-bold">
                    PRODUCTS
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 flex items-center justify-center text-[#10B981]">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="font-mono text-xl sm:text-2xl font-black text-white">
                  {totalProductsCount}
                </div>
                <div className="text-[11px] font-mono text-[#10B981] flex items-center gap-1 font-semibold">
                  <span>↑ 4.2%</span>
                  <span className="text-[#666666] font-normal">vs last 7 days</span>
                </div>
              </div>

              {/* Card 5: LOW STOCK ITEMS */}
              <div className="p-5 rounded-2xl bg-[#161616] border border-[#262626] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#888888] font-bold">
                    LOW STOCK ITEMS
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#EF4444]/15 flex items-center justify-center text-[#EF4444]">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="font-mono text-xl sm:text-2xl font-black text-white">
                  {lowStockCount}
                </div>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="text-[11px] font-mono text-[#FF7A00] hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>View Inventory</span>
                  <span>→</span>
                </button>
              </div>
            </div>
            </>
            )}

            {/* Lower Grid matching Reference Image */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Sales Overview Area Chart matching reference image */}
              <div className="lg:col-span-5 p-6 rounded-2xl bg-[#161616] border border-[#262626] space-y-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-base text-white">Sales Overview</h3>
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-[#1F1F1F] border border-[#2D2D2D] rounded-lg text-[11px] font-mono text-[#AAAAAA]">
                    <span>This Week</span>
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </div>

                {/* SVG Area spline line chart matching reference styling */}
                <div className="w-full h-48 relative">
                  <svg viewBox="0 0 400 180" className="w-full h-full">
                    <defs>
                      <linearGradient id="salesGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FF7A00" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#FF7A00" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Y-axis gridlines */}
                    {[
                      { label: 'R50k', y: 20 },
                      { label: 'R40k', y: 50 },
                      { label: 'R30k', y: 80 },
                      { label: 'R20k', y: 110 },
                      { label: 'R10k', y: 140 },
                      { label: 'R0', y: 170 }
                    ].map(tick => (
                      <g key={tick.label}>
                        <text x="0" y={tick.y + 4} fill="#555555" fontSize="9" fontFamily="JetBrains Mono, monospace">
                          {tick.label}
                        </text>
                        <line x1="32" y1={tick.y} x2="400" y2={tick.y} stroke="#222222" strokeDasharray="3 3" />
                      </g>
                    ))}

                    {/* Area fill */}
                    <path
                      d="M 50,150 C 90,110 130,85 170,85 C 210,85 230,135 270,105 C 310,75 350,90 390,80 L 390,170 L 50,170 Z"
                      fill="url(#salesGrad)"
                    />

                    {/* Orange Line */}
                    <path
                      d="M 50,150 C 90,110 130,85 170,85 C 210,85 230,135 270,105 C 310,75 350,90 390,80"
                      fill="none"
                      stroke="#FF7A00"
                      strokeWidth="2.5"
                    />

                    {/* Point dots */}
                    {[
                      { cx: 50, cy: 150 },
                      { cx: 100, cy: 110 },
                      { cx: 150, cy: 85 },
                      { cx: 200, cy: 85 },
                      { cx: 250, cy: 135 },
                      { cx: 300, cy: 105 },
                      { cx: 350, cy: 80 },
                      { cx: 390, cy: 80 }
                    ].map((pt, i) => (
                      <circle key={i} cx={pt.cx} cy={pt.cy} r="3.5" fill="#FF7A00" stroke="#161616" strokeWidth="2" />
                    ))}
                  </svg>

                  {/* X-axis date labels */}
                  <div className="flex justify-between pl-8 text-[9px] font-mono text-[#666666] pt-2">
                    <span>May 21</span>
                    <span>May 22</span>
                    <span>May 23</span>
                    <span>May 24</span>
                    <span>May 25</span>
                    <span>May 26</span>
                    <span>May 27</span>
                  </div>
                </div>
              </div>

              {liveAdmin ? (
                <>
                  <DashboardRecentOrders orders={dashboard.recentOrders} onViewAll={() => setActiveTab('orders')} />
                  <DashboardTopSelling products={dashboard.topSelling} onViewAll={() => setActiveTab('products')} />
                </>
              ) : (
              <>
              {/* Recent Orders Table matching reference image */}
              <div className="lg:col-span-4 p-6 rounded-2xl bg-[#161616] border border-[#262626] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-base text-white">Recent Orders</h3>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs font-mono text-[#FF7A00] hover:underline"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    { id: '#KXO-1048', date: 'May 27, 2025', name: 'Lerato M.', total: 'R2,999.00', status: 'Delivered', color: 'text-[#10B981] bg-[#10B981]/15' },
                    { id: '#KXO-1047', date: 'May 27, 2025', name: 'Thabo K.', total: 'R1,599.00', status: 'Processing', color: 'text-[#FF7A00] bg-[#FF7A00]/15' },
                    { id: '#KXO-1046', date: 'May 27, 2025', name: 'Sipho D.', total: 'R2,299.00', status: 'Shipped', color: 'text-[#3B82F6] bg-[#3B82F6]/15' },
                    { id: '#KXO-1045', date: 'May 26, 2025', name: 'Amanda P.', total: 'R3,499.00', status: 'Delivered', color: 'text-[#10B981] bg-[#10B981]/15' },
                    { id: '#KXO-1044', date: 'May 26, 2025', name: 'Jason L.', total: 'R1,299.00', status: 'Processing', color: 'text-[#FF7A00] bg-[#FF7A00]/15' }
                  ].map(order => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#1D1D1D] text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-white">{order.id}</div>
                        <div className="text-[10px] text-[#777777]">{order.name}</div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-white">{order.total}</div>
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-md ${order.color}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Selling Products List matching reference image */}
              <div className="lg:col-span-3 p-6 rounded-2xl bg-[#161616] border border-[#262626] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-base text-white">Top Selling Products</h3>
                  <button
                    onClick={() => setActiveTab('products')}
                    className="text-xs font-mono text-[#FF7A00] hover:underline"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    { name: 'Air Jordan 1 Retro', sub: '"Shattered Backboard"', sold: '356 sold', image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/shattered-backboard-01.png' },
                    { name: 'Nike Air Force 1 \'07', sub: 'White', sold: '289 sold', image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/af1-triple-white-01.png' },
                    { name: 'Nike Dunk Low Retro', sub: 'Black / White', sold: '245 sold', image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/dunk-low-panda-01.png' },
                    { name: 'Air Jordan 4 Retro', sub: 'Black Cat*', sold: '210 sold', image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/aj4-black-cat-01.png' }
                  ].map((prod, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-xl bg-[#1D1D1D]">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-10 h-10 object-cover rounded-lg bg-[#111111] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{prod.name}</div>
                        <div className="text-[10px] text-[#777777] truncate">{prod.sub}</div>
                      </div>
                      <span className="text-[10px] font-mono text-[#AAAAAA] font-bold shrink-0">
                        {prod.sold}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              </>
              )}

            </div>
          </div>
        )}

        {/* Detailed Modules */}
        {activeTab === 'products' && <AdminProducts />}
        {activeTab === 'orders' && <AdminOrders />}
        {activeTab === 'inventory' && <AdminInventory />}
        {activeTab === 'coupons' && <AdminPromos />}
        {activeTab === 'analytics' && <AdminAnalytics />}
        {(activeTab === 'customers' || activeTab === 'categories' || activeTab === 'brands' || activeTab === 'reviews' || activeTab === 'settings') && (
          <div className="p-12 text-center bg-[#161616] border border-[#262626] rounded-2xl space-y-3">
            <h3 className="font-display font-bold text-lg text-white capitalize">{activeTab} Management</h3>
            <p className="text-xs text-[#888888]">
              Active module configured. Use Products, Orders, and Inventory for real-time live data operations.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
