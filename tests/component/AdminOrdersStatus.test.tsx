import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  refreshOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
  transitionOrderStatus: vi.fn(),
  getCurrentUser: vi.fn(),
  ordersEnabled: vi.fn(() => true),
  supabaseConfigured: vi.fn(() => true),
}));

vi.mock('../../src/context/StoreContext', () => ({
  useStore: () => ({
    orders: [
      {
        id: 'order-1',
        status: 'Pending',
        trackingNumber: 'TRK-1',
        createdAt: new Date().toISOString(),
        total: 1000,
        customer: { fullName: 'Test Buyer', city: 'Cape Town', email: 'buyer@example.com' },
        items: [{ sneaker: { name: 'Air Max' } }],
        timeline: [],
      },
    ],
    updateOrderStatus: mocks.updateOrderStatus,
    showToast: mocks.showToast,
    refreshOrders: mocks.refreshOrders,
  }),
  formatPrice: (n: number) => `R${n}`,
}));

vi.mock('../../src/services/authService', () => ({
  authService: { getCurrentUser: mocks.getCurrentUser },
}));

vi.mock('../../src/services/adminOrderService', () => ({
  adminOrderService: {
    batchUpdateOrderStatus: vi.fn(),
    syncOrderWithGateway: vi.fn(),
    triggerExpiredCleanup: vi.fn(),
  },
}));

vi.mock('../../src/config/features', () => ({
  isSupabaseOrdersEnabled: mocks.ordersEnabled,
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {},
  isSupabaseConfigured: mocks.supabaseConfigured,
}));

vi.mock('../../src/repositories/admin/orderAdminRepository', () => ({
  orderAdminRepository: { transitionOrderStatus: mocks.transitionOrderStatus },
}));

import { AdminOrders } from '../../src/components/admin/AdminOrders';

const renderComponent = () => render(<AdminOrders />);

const changeStatus = (value: string) => {
  fireEvent.change(screen.getByRole('combobox'), { target: { value } });
};

describe('AdminOrders row status select', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ordersEnabled.mockImplementation(() => true);
    mocks.supabaseConfigured.mockImplementation(() => true);
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1' } as any);
  });

  it('success: calls transitionOrderStatus then refreshOrders and shows success toast', async () => {
    mocks.transitionOrderStatus.mockResolvedValue(undefined);
    mocks.refreshOrders.mockResolvedValue({ success: true });

    renderComponent();
    changeStatus('Processing');

    await waitFor(() => {
      expect(mocks.transitionOrderStatus).toHaveBeenCalledWith(
        'order-1',
        'Processing',
        undefined,
        undefined,
        'admin-1'
      );
      expect(mocks.refreshOrders).toHaveBeenCalled();
      expect(mocks.showToast).toHaveBeenCalledWith(
        'Order Updated',
        'Order status updated to Processing.',
        'success'
      );
    });
  });

  it('rejected transition: shows error toast and does not refresh or call updateOrderStatus', async () => {
    mocks.transitionOrderStatus.mockRejectedValue(new Error('Database error'));

    renderComponent();
    changeStatus('Shipped');

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith('Update Failed', 'Database error', 'error');
    });

    expect(mocks.refreshOrders).not.toHaveBeenCalled();
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('flag off: calls updateOrderStatus and never calls transitionOrderStatus', async () => {
    mocks.ordersEnabled.mockImplementation(() => false);
    mocks.supabaseConfigured.mockImplementation(() => false);

    renderComponent();
    changeStatus('Cancelled');

    await waitFor(() => {
      expect(mocks.updateOrderStatus).toHaveBeenCalledWith('order-1', 'Cancelled');
    });

    expect(mocks.transitionOrderStatus).not.toHaveBeenCalled();
  });
});
