import React, { useState } from 'react';
import { useStore, formatPrice } from '../../context/StoreContext';
import { OrderStatus } from '../../types';
import { Search, Clock, Eye, RefreshCw, FileOutput, ShieldCheck, Truck, Package, Check } from 'lucide-react';
import { adminOrderService } from '../../services/adminOrderService';
import { generateOrderCSV } from '../../utils/orderCsv';
import { authService } from '../../services/authService';
import { motion, AnimatePresence } from 'motion/react';

export const AdminOrders: React.FC = () => {
  const { orders, updateOrderStatus, setTrackingOrder, setCurrentView, showToast, refreshOrders } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isReconciling, setIsReconciling] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const handleBatchFulfillment = async (newStatus: OrderStatus) => {
    if (selectedOrders.length === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const user = await authService.getCurrentUser();
      const res = await adminOrderService.batchUpdateOrderStatus(
        selectedOrders,
        newStatus,
        user?.id || 'system'
      );

      if (res.success) {
        showToast('Batch Success', `Updated ${res.updatedCount} orders to ${newStatus}.`, 'success');
        setSelectedOrders([]);
        await refreshOrders();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      showToast('Batch Failed', err.message, 'error');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchSearch =
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Delivered':
        return 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30';
      case 'Shipped':
        return 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30';
      case 'Processing':
        return 'bg-[#FF7A00]/15 text-[#FF7A00] border-[#FF7A00]/30';
      default:
        return 'bg-[#666666]/15 text-[#888888] border-[#666666]/30';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-lg text-white mb-4">Order Management</h2>
      </div>
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search orders by ID, tracking # or customer..."
            className="w-full bg-[#161616] text-xs text-white placeholder-[#666666] pl-10 pr-4 py-2.5 rounded-xl border border-[#282828] focus:outline-none focus:border-[#FF7A00]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await refreshOrders();
              setIsRefreshing(false);
              showToast('Data Refreshed', 'Orders synchronized with vault.', 'info');
            }}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-[#161616] text-[#888888] hover:text-white border border-[#282828] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={async () => {
              setIsCleaning(true);
              try {
                const count = await adminOrderService.triggerExpiredCleanup(30);
                showToast('Cleanup Complete', `Released ${count} expired pending orders.`, 'success');
              } catch (err: any) {
                showToast('Cleanup Failed', err.message, 'error');
              } finally {
                setIsCleaning(false);
              }
            }}
            disabled={isCleaning}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold bg-[#FF7A00]/10 text-[#FF7A00] border border-[#FF7A00]/30 hover:bg-[#FF7A00]/20 disabled:opacity-50 transition-all"
          >
            <Clock className={`w-3 h-3 ${isCleaning ? 'animate-spin' : ''}`} />
            EXPIRE STALE
          </button>

          <button
            onClick={() => {
              try {
                const csv = generateOrderCSV(orders);
                const fileName = `Kixora_Reconciliation_${new Date().toISOString().split('T')[0]}.csv`;
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                showToast('Export Ready', 'CSV report downloaded.', 'success');
              } catch (err: any) {
                showToast('Export Failed', err.message, 'error');
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30 hover:bg-[#3B82F6]/20 transition-all"
          >
            <FileOutput className="w-3 h-3" />
            DOWNLOAD CSV
          </button>

          <div className="h-6 w-[1px] bg-[#282828] mx-1" />

          {['All', 'Processing', 'Shipped', 'Delivered'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                statusFilter === st
                  ? 'bg-[#FF7A00] text-black'
                  : 'bg-[#161616] text-[#888888] hover:text-white border border-[#282828]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Actions Bar */}
      <AnimatePresence>
        {selectedOrders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex items-center justify-between px-6 py-4 rounded-2xl bg-[#FF7A00] text-black shadow-lg shadow-[#FF7A00]/20"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-black/10">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold">{selectedOrders.length} Orders Selected</div>
                <div className="text-[10px] font-mono uppercase opacity-70">Batch fulfillment ready</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBatchFulfillment('Processing')}
                disabled={isBatchProcessing}
                className="px-4 py-2 rounded-xl bg-black text-white text-[10px] font-mono font-bold hover:bg-black/80 transition-all disabled:opacity-50"
              >
                MARK PROCESSING
              </button>
              <button
                onClick={() => handleBatchFulfillment('Shipped')}
                disabled={isBatchProcessing}
                className="px-4 py-2 rounded-xl bg-white text-black text-[10px] font-mono font-bold hover:bg-white/90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Truck className="w-3 h-3" />
                DISPATCH BATCH
              </button>
              <button
                onClick={() => setSelectedOrders([])}
                className="p-2 text-black/60 hover:text-black transition-colors"
              >
                <Check className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orders Table */}
      <div className="rounded-2xl bg-[#161616] border border-[#262626] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#1A1A1A] border-b border-[#282828] text-[10px] font-mono uppercase tracking-wider text-[#888888]">
              <tr>
                <th className="p-4 w-10">
                  <button 
                    onClick={toggleAllSelection}
                    className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                      selectedOrders.length === filteredOrders.length 
                        ? 'bg-[#FF7A00] border-[#FF7A00]' 
                        : 'border-[#444444] hover:border-[#666666]'
                    }`}
                  >
                    {selectedOrders.length === filteredOrders.length && <Check className="w-3 h-3 text-black" />}
                  </button>
                </th>
                <th className="p-4">Order ID</th>
                <th className="p-4">Date</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Items</th>
                <th className="p-4">Total</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Quick Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424]">
              {filteredOrders.map(order => (
                <tr key={order.id} className={`hover:bg-[#1D1D1D] transition-colors ${selectedOrders.includes(order.id) ? 'bg-[#FF7A00]/5' : ''}`}>
                  <td className="p-4">
                    <button 
                      onClick={() => toggleOrderSelection(order.id)}
                      className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                        selectedOrders.includes(order.id) 
                          ? 'bg-[#FF7A00] border-[#FF7A00]' 
                          : 'border-[#444444] hover:border-[#666666]'
                      }`}
                    >
                      {selectedOrders.includes(order.id) && <Check className="w-3 h-3 text-black" />}
                    </button>
                  </td>
                  <td className="p-4 font-mono font-bold text-white">
                    <button
                      onClick={() => {
                        setTrackingOrder(order);
                        setCurrentView('tracking');
                      }}
                      className="hover:text-[#FF7A00] flex items-center gap-1.5"
                    >
                      <span>#{order.id.slice(0, 8)}</span>
                      <Eye className="w-3 h-3 text-[#777777]" />
                    </button>
                  </td>
                  <td className="p-4 font-mono text-[11px] text-[#888888]">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-white">{order.customer.fullName}</div>
                    <div className="text-[10px] text-[#888888] font-mono">{order.customer.city}</div>
                  </td>
                  <td className="p-4 font-mono text-[11px] text-[#AAAAAA]">
                    {order.items.length} items ({order.items[0]?.sneaker.name.slice(0, 18)}...)
                  </td>
                  <td className="p-4 font-mono font-black text-white">
                    {formatPrice(order.total)}
                  </td>
                  <td className="p-4 font-mono">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${getStatusBadge(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-4 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={async () => {
                        setIsReconciling(order.id);
                        const user = await authService.getCurrentUser();
                        const res = await adminOrderService.syncOrderWithGateway(order.id, user?.id || 'system');
                        if (res.success) {
                          showToast('Reconciliation Success', `Order #${order.id} status is ${res.status}.`, 'success');
                          await refreshOrders();
                        } else {
                          showToast('Reconciliation Notice', res.error || 'Failed to sync with gateway.', 'info');
                        }
                        setIsReconciling(null);
                      }}
                      disabled={isReconciling === order.id}
                      className="p-1.5 rounded-lg bg-[#282828] text-[#888888] hover:text-[#FF7A00] transition-colors disabled:opacity-50"
                      title="Reconcile with Payment Gateway"
                    >
                      <ShieldCheck className={`w-3.5 h-3.5 ${isReconciling === order.id ? 'animate-pulse' : ''}`} />
                    </button>

                    <select
                      value={order.status}
                      onChange={e => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                      className="bg-[#1F1F1F] border border-[#2D2D2D] text-xs text-white rounded-lg px-2 py-1 font-mono focus:outline-none focus:border-[#FF7A00]"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Authenticated">Authenticated</option>
                      <option value="Processing">Processing</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
