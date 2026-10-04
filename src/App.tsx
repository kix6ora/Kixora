import React, { useState, useMemo } from 'react';
import { useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Filters } from './components/Filters';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { PayFastReturn } from './components/PayFastReturn';
import { WishlistModal } from './components/WishlistModal';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { DropsCalendar } from './components/DropsCalendar';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { DomainGuard } from './routes/DomainGuard';
import { AdminRoute } from './routes/AdminRoute';
const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
import { Toast } from './components/Toast';
import { Footer } from './components/Footer';
import { MobileNav } from './components/MobileNav';
import { SEO } from './components/SEO';
import { 
  ArrowUpDown, 
  SlidersHorizontal, 
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { filterSneakers } from './utils/filterSneakers';

const MainStorefront: React.FC<{ onOpenMobileFilters: () => void }> = ({ onOpenMobileFilters }) => {
  const { sneakers, filters, setFilters, resetFilters } = useStore();

  const filteredSneakers = useMemo(() => filterSneakers(sneakers, filters), [sneakers, filters]);

  return (
    <div className="space-y-12">
      {/* Hero Section matching Reference Image */}
      <Hero />

      {/* Catalog & Filter Section */}
      <div id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Controls bar: Results counter, Active filters chips & Sorting */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-[#282828]">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-white">
                VAULT CATALOG
              </h2>
              <span className="text-xs font-mono text-[#888888]">
                Showing {filteredSneakers.length} authenticated deadstock pairs
              </span>
            </div>

            {/* Mobile filter button */}
            <button
              onClick={onOpenMobileFilters}
              className="lg:hidden ml-auto flex items-center gap-2 px-3.5 py-2 bg-[#1A1A1A] border border-[#2C2C2C] text-[#F5F5F5] text-xs font-bold rounded-xl"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>Filters</span>
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[#888888] uppercase">Sort By:</span>
            <div className="relative">
              <select
                id="catalog-sort-select"
                value={filters.sortBy}
                onChange={e => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                className="bg-[#1A1A1A] border border-[#2C2C2C] text-[#F5F5F5] text-xs rounded-xl px-3.5 py-2 focus:outline-none focus:border-[#FF7A00] font-mono pr-8 appearance-none cursor-pointer"
              >
                <option value="featured">Featured / Hype First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Highest Customer Rating</option>
                <option value="newest">Latest Release</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-[#888888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Active filter badges */}
        {(filters.brand !== 'All' || filters.category !== 'All' || filters.selectedSize !== null || filters.search) && (
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="text-[#888888]">Active Filters:</span>
            {filters.search && (
              <span className="px-2.5 py-1 rounded-lg bg-[#1F1F1F] text-white border border-[#333333] flex items-center gap-1.5">
                <span>"{filters.search}"</span>
                <button onClick={() => setFilters(prev => ({ ...prev, search: '' }))}>
                  <X className="w-3 h-3 text-[#888888] hover:text-white" />
                </button>
              </span>
            )}
            {filters.brand !== 'All' && (
              <span className="px-2.5 py-1 rounded-lg bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/40 flex items-center gap-1.5 font-bold">
                <span>Brand: {filters.brand}</span>
                <button onClick={() => setFilters(prev => ({ ...prev, brand: 'All' }))}>
                  <X className="w-3 h-3 text-[#FF7A00]" />
                </button>
              </span>
            )}
            {filters.category !== 'All' && (
              <span className="px-2.5 py-1 rounded-lg bg-[#1F1F1F] text-white border border-[#333333] flex items-center gap-1.5">
                <span>Category: {filters.category}</span>
                <button onClick={() => setFilters(prev => ({ ...prev, category: 'All' }))}>
                  <X className="w-3 h-3 text-[#888888] hover:text-white" />
                </button>
              </span>
            )}
            {filters.selectedSize !== null && (
              <span className="px-2.5 py-1 rounded-lg bg-[#1F1F1F] text-white border border-[#333333] flex items-center gap-1.5">
                <span>Size: US {filters.selectedSize}</span>
                <button onClick={() => setFilters(prev => ({ ...prev, selectedSize: null }))}>
                  <X className="w-3 h-3 text-[#888888] hover:text-white" />
                </button>
              </span>
            )}

            <button
              onClick={resetFilters}
              className="text-[#FF7A00] hover:underline text-xs ml-2 font-bold"
            >
              Clear All
            </button>
          </div>
        )}

        {/* 2-Column Catalog Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Desktop Filters Sidebar */}
          <div className="hidden lg:block lg:col-span-3 sticky top-24">
            <Filters />
          </div>

          {/* Product Grid */}
          <div className="lg:col-span-9">
            {filteredSneakers.length === 0 ? (
              <div className="py-16 text-center bg-[#161616] border border-[#282828] rounded-3xl p-8 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#1F1F1F] border border-[#2C2C2C] flex items-center justify-center mx-auto text-[#666666]">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-lg text-white">No Matching Grails Found</h3>
                  <p className="text-xs text-[#888888] max-w-sm mx-auto">
                    Try adjusting your filters, price limits, or searching for other sneaker brands and silhouettes.
                  </p>
                </div>
                <button
                  onClick={resetFilters}
                  className="px-5 py-2.5 bg-[#FF7A00] text-black font-extrabold rounded-xl text-xs shadow-lg transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredSneakers.map(sneaker => (
                  <ProductCard key={sneaker.id} sneaker={sneaker} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StoreAppContent: React.FC = () => {
  const { currentView, setCurrentView } = useStore();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#111111] text-[#F5F5F5] flex flex-col font-sans selection:bg-[#FF7A00] selection:text-black pb-16 lg:pb-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#FF7A00] focus:px-4 focus:py-3 focus:font-bold focus:text-black"
      >
        Skip to main content
      </a>
      {/* Top Navigation matching Reference Image */}
      <Navbar onToggleMobileFilters={() => setIsMobileFiltersOpen(true)} />

      {/* Main View Router */}
      <main id="main-content" className="flex-1 pb-16" tabIndex={-1}>
        <AnimatePresence mode="wait">
          {currentView === 'store' && (
            <motion.div
              key="store"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <SEO 
                title="Sneaker Vault & Catalog" 
                description="Browse our curated collection of authenticated limited edition sneakers."
              />
              <MainStorefront onOpenMobileFilters={() => setIsMobileFiltersOpen(true)} />
            </motion.div>
          )}

          {currentView === 'drops' && (
            <motion.div
              key="drops"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <SEO 
                title="Drops Calendar & Raffles" 
                description="Never miss a drop. Stay updated with our live sneaker release calendar and exclusive raffles."
              />
              <DropsCalendar />
            </motion.div>
          )}

          {currentView === 'tracking' && (
            <motion.div
              key="tracking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <SEO 
                title="Order Tracking" 
                description="Track your authenticated sneaker delivery in real-time."
              />
              <OrderTrackingModal />
            </motion.div>
          )}

          {currentView === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DomainGuard onReturnToStore={() => setCurrentView('store')}>
                <AdminRoute onReturnToStore={() => setCurrentView('store')}>
                  <React.Suspense fallback={<div className="p-8 text-center text-[#888888]">Loading Admin Hub...</div>}>
                    <AdminDashboard />
                  </React.Suspense>
                </AdminRoute>
              </DomainGuard>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Filter Slide-over Drawer */}
      <AnimatePresence>
        {isMobileFiltersOpen && (
          <div className="fixed inset-0 z-50 flex justify-start bg-black/80 backdrop-blur-sm lg:hidden">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="w-full max-w-xs bg-[#141414] border-r border-[#282828] p-5 h-full overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#282828] mb-4">
                <h3 className="font-display font-bold text-lg text-white">Filters</h3>
                <button
                  onClick={() => setIsMobileFiltersOpen(false)}
                  className="p-1 text-[#888888] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Filters onCloseMobile={() => setIsMobileFiltersOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Modals & Drawers */}
      <ProductModal />
      <CartDrawer />
      <CheckoutModal />
      <PayFastReturn />
      <WishlistModal />
      <CustomerAuthModal />
      <Toast />

      {/* Footer matching Kixora visual system */}
      {currentView !== 'admin' && <Footer />}
      {currentView !== 'admin' && <MobileNav />}
    </div>
  );
};

export function App() {
  return (
    <StoreAppContent />
  );
}

export default App;
