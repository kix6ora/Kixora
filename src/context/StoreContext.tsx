import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Sneaker,
  CartItem,
  Order,
  Drop,
  PromoCode,
  FilterState,
  ViewMode,
  OrderStatus
} from '../types';
import {
  INITIAL_SNEAKERS,
  INITIAL_DROPS,
  INITIAL_PROMOS,
  INITIAL_ORDERS
} from '../data/sneakers';
import { authService } from '../services/authService';
import { wishlistRepository } from '../repositories/customer/wishlistRepository';
import { cartRepository } from '../repositories/customer/cartRepository';
import { orderRepository } from '../repositories/customer/orderRepository';
import { checkoutService } from '../services/checkoutService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthUser } from '../types/auth';
import { analyticsService } from '../services/analyticsService';
import { catalogAdapter } from '../context/adapters/catalogAdapter';
import { cartAdapter } from '../context/adapters/cartAdapter';
import { wishlistAdapter } from '../context/adapters/wishlistAdapter';
import { isSupabaseCatalogEnabled, isSupabaseDropsEnabled, isSupabaseCartEnabled, isSupabaseWishlistEnabled, isSupabaseOrdersEnabled } from '../config/features';

export const formatPrice = (amount: number): string => {
  return `R${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface ToastNotification {
  id: string;
  type: 'success' | 'info' | 'error';
  title: string;
  message: string;
}

interface StoreContextType {
  sneakers: Sneaker[];
  drops: Drop[];
  promos: PromoCode[];
  orders: Order[];
  cart: CartItem[];
  wishlist: string[];
  filters: FilterState;
  currentView: ViewMode;
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  isWishlistOpen: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'signin' | 'signup' | 'profile';
  selectedSneaker: Sneaker | null;
  trackingOrder: Order | null;
  appliedPromo: PromoCode | null;
  toasts: ToastNotification[];

  // Actions
  setCurrentView: (view: ViewMode) => void;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  resetFilters: () => void;
  setIsCartOpen: (open: boolean) => void;
  setIsCheckoutOpen: (open: boolean) => void;
  setIsWishlistOpen: (open: boolean) => void;
  setIsAuthModalOpen: (open: boolean) => void;
  setAuthModalMode: (mode: 'signin' | 'signup' | 'profile') => void;
  openAuthModal: (mode?: 'signin' | 'signup' | 'profile') => void;
  closeAuthModal: () => void;
  setSelectedSneaker: (sneaker: Sneaker | null) => void;
  setTrackingOrder: (order: Order | null) => void;
  openSneakerModal: (sneaker: Sneaker) => void;
  closeSneakerModal: () => void;

  // Cart Actions
  addToCart: (sneaker: Sneaker, size: number, quantity?: number) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  applyPromoCode: (code: string) => { success: boolean; message: string };
  removePromoCode: () => void;

  // Wishlist Actions
  toggleWishlist: (sneakerId: string) => void | Promise<void>;
  addToWishlist?: (sneakerId: string) => void | Promise<void>;
  removeFromWishlist?: (sneakerId: string) => void | Promise<void>;

  // Drops Actions
  toggleDropNotify: (dropId: string) => void;

  // Order & Checkout Actions
  placeOrder: (
    customerData: Order['customer'],
    paymentMethod: string,
    shippingMethod: string,
    paymentReference?: string,
    preserveCart?: boolean
  ) => Promise<Order>;

  // Admin Actions
  addSneaker: (sneaker: Omit<Sneaker, 'id' | 'rating' | 'reviewsCount'>) => void;
  updateSneaker: (sneaker: Sneaker) => void;
  deleteSneaker: (id: string) => void;
  updateStock: (sneakerId: string, size: number, newStock: number) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  addPromo: (promo: Omit<PromoCode, 'id'>) => void;
  togglePromoStatus: (promoId: string) => void;
  refreshOrders: () => Promise<void>;

  // Feedback
  showToast: (title: string, message: string, type?: 'success' | 'info' | 'error') => void;
  dismissToast: (id: string) => void;
}

const DEFAULT_FILTERS: FilterState = {
  brand: 'All',
  category: 'All',
  gender: 'All',
  maxPrice: 6000,
  selectedSize: null,
  inStockOnly: false,
  sortBy: 'featured',
  search: ''
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sneakers, setSneakers] = useState<Sneaker[]>(() => {
    try {
      const saved = localStorage.getItem('kixora_sneakers_v2');
      return saved ? JSON.parse(saved) : INITIAL_SNEAKERS;
    } catch {
      return INITIAL_SNEAKERS;
    }
  });

  const [drops, setDrops] = useState<Drop[]>(() => {
    try {
      const saved = localStorage.getItem('kixora_drops_v2');
      return saved ? JSON.parse(saved) : INITIAL_DROPS;
    } catch {
      // Silently handle parsing errors
      return INITIAL_DROPS;
    }
  });

  const [promos, setPromos] = useState<PromoCode[]>(() => {
    try {
      const saved = localStorage.getItem('kixora_promos_v2');
      return saved ? JSON.parse(saved) : INITIAL_PROMOS;
    } catch {
      // Silently handle parsing errors
      return INITIAL_PROMOS;
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('kixora_orders_v2');
      return saved ? JSON.parse(saved) : INITIAL_ORDERS;
    } catch {
      // Silently handle parsing errors
      return INITIAL_ORDERS;
    }
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('kixora_cart_v2');
      return saved ? JSON.parse(saved) : [
        {
          id: 'cart-init-01',
          sneaker: INITIAL_SNEAKERS[0],
          selectedSize: 10,
          quantity: 1
        },
        {
          id: 'cart-init-02',
          sneaker: INITIAL_SNEAKERS[1],
          selectedSize: 9.5,
          quantity: 1
        }
      ];
    } catch {
      // Silently handle parsing errors
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kixora_wishlist_v2');
      return saved ? JSON.parse(saved) : ['kixo-shattered-backboard-01', 'kixo-aj4-black-cat-04'];
    } catch {
      // Silently handle parsing errors
      return [];
    }
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Subscribe to auth session to track active user
  useEffect(() => {
    let isMounted = true;
    authService.getSession().then(session => {
      if (isMounted) {
        setCurrentUser(session?.user || null);
      }
    });

    const unsubscribe = authService.onAuthStateChange(session => {
      if (isMounted) {
        setCurrentUser(session?.user || null);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Fetch products from DB on mount and set up Realtime inventory tracking
  useEffect(() => {
    let isMounted = true;

    async function fetchSneakers() {
      if (!isSupabaseCatalogEnabled()) {
        console.info('[StoreContext] Catalog flag off, using local seed data.');
        return;
      }
      try {
        const data = await catalogAdapter.loadCatalog(INITIAL_SNEAKERS);
        if (isMounted && data && data.length > 0) {
          setSneakers(data);
        }
      } catch {
        // Silently handle adapter failures
      }
    }

    fetchSneakers();

    // Fetch drops from DB when flag enabled
    async function fetchDrops() {
      if (!isSupabaseDropsEnabled()) {
        console.info('[StoreContext] Drops flag off, using local seed data.');
        return;
      }
      try {
        const data = await catalogAdapter.loadDrops(INITIAL_DROPS);
        if (isMounted && data && data.length > 0) {
          setDrops(data);
        }
      } catch {
        // Silently handle adapter failures
      }
    }
    fetchDrops();

    // Subscribe to inventory updates
    let inventoryChannel: any = null;
    if (isSupabaseCatalogEnabled() && isSupabaseConfigured()) {
      inventoryChannel = supabase
        .channel('inventory-realtime')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'inventory' },
          (payload) => {
            const { product_size_id, stock, reserved_stock } = payload.new;
            const availableStock = Math.max(0, (stock || 0) - (reserved_stock || 0));

            setSneakers(prev => prev.map(sneaker => {
              if (!sneaker.sizes.some(sz => sz.id === product_size_id)) return sneaker;

              return {
                ...sneaker,
                sizes: sneaker.sizes.map(sz =>
                  sz.id === product_size_id ? { ...sz, stock: availableStock } : sz
                )
              };
            }));
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      if (inventoryChannel) {
        supabase.removeChannel(inventoryChannel);
      }
    };
  }, []);

  // Synchronize wishlist, cart, and orders from Supabase for authenticated customer, with safe guest merge
  useEffect(() => {
    let isMounted = true;

    async function syncCustomerData() {
      if (currentUser?.id && isSupabaseConfigured() && (isSupabaseCartEnabled() || isSupabaseWishlistEnabled() || isSupabaseOrdersEnabled())) {
        try {
          // 1. Migrate and fetch wishlist only when its data-layer flag is enabled.
          const guestWishlistRaw = isSupabaseWishlistEnabled()
            ? localStorage.getItem('kixora_wishlist_v2')
            : null;
          if (isSupabaseWishlistEnabled() && guestWishlistRaw) {
            try {
              const guestIds: string[] = JSON.parse(guestWishlistRaw);
              if (Array.isArray(guestIds) && guestIds.length > 0) {
                await wishlistRepository.mergeGuestWishlist(currentUser.id, guestIds);
                localStorage.removeItem('kixora_wishlist_v2');
              }
            } catch {
              // Silently handle merge errors
            }
          }

          // Fetch fresh wishlist IDs from Supabase
          const ids = isSupabaseWishlistEnabled()
            ? await wishlistRepository.getWishlistProductIds(currentUser.id)
            : [];
          if (isMounted && isSupabaseWishlistEnabled() && Array.isArray(ids)) {
            setWishlist(ids);
          }

          // 2. Check for guest cart items to migrate
          const guestCartRaw = isSupabaseCartEnabled()
            ? localStorage.getItem('kixora_cart_v2')
            : null;
          if (isSupabaseCartEnabled() && guestCartRaw) {
            try {
              const guestCartItems: CartItem[] = JSON.parse(guestCartRaw);
              if (Array.isArray(guestCartItems) && guestCartItems.length > 0) {
                await cartRepository.mergeGuestCart(currentUser.id, guestCartItems);
                localStorage.removeItem('kixora_cart_v2');
              }
            } catch {
              // Silently handle merge errors
            }
          }

          // Fetch customer cart items from Supabase
          const serverCartItems = isSupabaseCartEnabled()
            ? await cartRepository.getCart(currentUser.id)
            : [];
          if (isMounted && isSupabaseCartEnabled() && Array.isArray(serverCartItems)) {
            const paymentCompleted = sessionStorage.getItem('kixora_payfast_cart_cleared') === 'true';
            if (paymentCompleted) {
              sessionStorage.removeItem('kixora_payfast_cart_cleared');
            } else {
              setCart(serverCartItems);
            }
          }

          // 3. Fetch customer orders from Supabase
          const serverOrders = isSupabaseOrdersEnabled()
            ? await orderRepository.getCustomerOrders(currentUser.id)
            : [];
          if (isMounted && isSupabaseOrdersEnabled() && Array.isArray(serverOrders)) {
            setOrders(prev => {
              const combined = [...serverOrders];
              for (const o of prev) {
                if (!combined.some(c => c.id === o.id || c.orderCode === o.id || c.id === o.orderCode)) {
                  combined.push(o);
                }
              }
              return combined;
            });
          }
        } catch {
          // Silently handle sync fallback
        }
      } else {
        // Guest mode: load from localStorage
        const savedWishlist = localStorage.getItem('kixora_wishlist_v2');
        if (savedWishlist) {
          try {
            setWishlist(JSON.parse(savedWishlist));
          } catch {
            // Silently handle parsing errors
          }
        }
        const savedCart = localStorage.getItem('kixora_cart_v2');
        if (savedCart) {
          try {
            setCart(JSON.parse(savedCart));
          } catch {
            // Silently handle parsing errors
          }
        }
      }
    }

    syncCustomerData();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [currentView, setCurrentView] = useState<ViewMode>('store');
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'profile'>('signin');
  const [selectedSneaker, setSelectedSneaker] = useState<Sneaker | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const openAuthModal = (mode: 'signin' | 'signup' | 'profile' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('kixora_sneakers_v2', JSON.stringify(sneakers));
  }, [sneakers]);

  useEffect(() => {
    localStorage.setItem('kixora_cart_v2', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    // Only persist to localStorage if guest user
    if (!currentUser?.id) {
      localStorage.setItem('kixora_wishlist_v2', JSON.stringify(wishlist));
    }
  }, [wishlist, currentUser?.id]);

  useEffect(() => {
    localStorage.setItem('kixora_orders_v2', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('kixora_promos_v2', JSON.stringify(promos));
  }, [promos]);

  // Toast Helpers
  const showToast = (title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Cart operations
  const addToCart = (sneaker: Sneaker, size: number, quantity = 1) => {
    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(
        item => item.sneaker.id === sneaker.id && item.selectedSize === size
      );

      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity
        };
        return updated;
      }

      const newItem: CartItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sneaker,
        selectedSize: size,
        quantity
      };
      return [...prevCart, newItem];
    });

    analyticsService.trackEvent('add_to_cart', {
      productId: sneaker.id,
      productName: sneaker.name,
      brand: sneaker.brand,
      price: sneaker.price,
      quantity
    });

    showToast(
      'Added to Vault Cart',
      `${sneaker.name} (US ${size}) ready for checkout.`,
      'success'
    );

    // Persist to Supabase if authenticated customer
    if (currentUser?.id && isSupabaseCartEnabled()) {
      void cartAdapter.syncAddItem(currentUser.id, sneaker, size, quantity);
    }
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
    showToast('Item Removed', 'Item removed from your cart', 'info');

    if (currentUser?.id && isSupabaseCartEnabled()) {
      void cartAdapter.syncRemoveItem(currentUser.id, cartItemId);
    }
  };

  const updateCartQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart(prev =>
      prev.map(item => (item.id === cartItemId ? { ...item, quantity } : item))
    );

    if (currentUser?.id && isSupabaseCartEnabled()) {
      void cartAdapter.syncUpdateQuantity(currentUser.id, cartItemId, quantity);
    }
  };

  const clearCart = () => {
    setCart([]);
    if (currentUser?.id && isSupabaseCartEnabled()) {
      void cartAdapter.syncClearCart(currentUser.id);
    }
  };

  const applyPromoCode = (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    const found = promos.find(p => p.code === cleanCode && p.isActive);

    if (!found) {
      showToast('Invalid Promo Code', 'This code does not exist or has expired.', 'error');
      return { success: false, message: 'Invalid promo code' };
    }

    const subtotal = cart.reduce((sum, item) => sum + item.sneaker.price * item.quantity, 0);
    if (found.minSpend && subtotal < found.minSpend) {
      const msg = `Minimum spend of ${formatPrice(found.minSpend)} required for this code.`;
      showToast('Minimum Spend Required', msg, 'error');
      return { success: false, message: msg };
    }

    setAppliedPromo(found);
    showToast('Voucher Activated!', `${found.discountPercent}% discount successfully applied to vault cart.`, 'success');
    return { success: true, message: `${found.discountPercent}% discount applied!` };
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    showToast('Promo Code Removed', 'Discount removed from checkout.', 'info');
  };

  // Wishlist
  const toggleWishlist = async (sneakerId: string) => {
    if (!sneakerId) return;

    const exists = wishlist.includes(sneakerId);
    const next = exists ? wishlist.filter(id => id !== sneakerId) : [...wishlist, sneakerId];

    // Optimistic UI update
    setWishlist(next);

    if (exists) {
      showToast('Removed from Wishlist', 'Grail removed from your saved list.', 'info');
    } else {
      showToast('Saved to Wishlist', 'Grail added to your personal collection.', 'success');
    }

    // Persist to Supabase if authenticated customer
    if (currentUser?.id && isSupabaseWishlistEnabled()) {
      await wishlistAdapter.syncToggleWishlist(currentUser.id, sneakerId, exists);
    }
  };

  const addToWishlist = async (sneakerId: string) => {
    if (!sneakerId || wishlist.includes(sneakerId)) return;
    await toggleWishlist(sneakerId);
  };

  const removeFromWishlist = async (sneakerId: string) => {
    if (!sneakerId || !wishlist.includes(sneakerId)) return;
    await toggleWishlist(sneakerId);
  };

  // Drops
  const toggleDropNotify = (dropId: string) => {
    const currentNotified = drops.find(drop => drop.id === dropId)?.isNotified || false;
    const nextState = !currentNotified;
    setDrops(prev =>
      prev.map(drop => {
        if (drop.id === dropId) {
          showToast(
            nextState ? 'Raffle Alert Set!' : 'Raffle Alert Cancelled',
            nextState ? 'Push alert enabled for this exclusive drop.' : 'Notification removed.',
            'info'
          );
          return {
            ...drop,
            isNotified: nextState,
            subscribersCount: nextState ? drop.subscribersCount + 1 : Math.max(0, drop.subscribersCount - 1)
          };
        }
        return drop;
      })
    );
    void catalogAdapter.toggleDropNotify(dropId, currentNotified);
  };

  // Modal open
  const openSneakerModal = (sneaker: Sneaker) => {
    setSelectedSneaker(sneaker);
    analyticsService.trackEvent('product_view', {
      productId: sneaker.id,
      productName: sneaker.name,
      brand: sneaker.brand,
      category: sneaker.category,
      price: sneaker.price,
      currency: 'ZAR'
    });
  };

  const closeSneakerModal = () => {
    setSelectedSneaker(null);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  // Order creation
  const placeOrder = async (
    customerData: Order['customer'],
    paymentMethod: string,
    shippingMethod: string,
    paymentReference?: string,
    preserveCart = false
  ): Promise<Order> => {
    const subtotal = cart.reduce((sum, item) => sum + item.sneaker.price * item.quantity, 0);
    const discount = appliedPromo ? (subtotal * appliedPromo.discountPercent) / 100 : 0;
    const shippingFee = subtotal >= 2000 || cart.length === 0 ? 0 : 150;
    const tax = 0; // Inclusive VAT
    const calculatedTotal = Math.max(0, subtotal - discount + shippingFee + tax);

    // Call atomic checkout service
    const checkoutRes = await checkoutService.placeOrderAtomic({
      cartItems: [...cart],
      userId: currentUser?.id,
      promoCode: appliedPromo?.code,
      customerInfo: {
        email: customerData.email,
        fullName: customerData.fullName,
        phone: customerData.phone,
        street: customerData.street,
        city: customerData.city,
        state: customerData.state,
        zip: customerData.zip,
        country: customerData.country,
      },
      paymentMethod,
      shippingMethod,
      paymentReference,
    });

    if (!checkoutRes.success) {
      showToast('Order Failed', checkoutRes.error || 'Could not place order. Please try again.', 'error');
      throw new Error(checkoutRes.error || 'Checkout failed');
    }

    const orderId = checkoutRes.orderCode || `KXO-${Math.floor(1000 + Math.random() * 9000)}`;
    const trackingNumber = checkoutRes.trackingNumber || `KX-${Math.floor(10000000 + Math.random() * 90000000)}-ZA`;
    const finalTotal = checkoutRes.total !== undefined ? checkoutRes.total : calculatedTotal;

    const newOrder: Order = {
      id: orderId,
      guestAccessToken: checkoutRes.guestAccessToken,
      trackingNumber,
      createdAt: new Date().toISOString(),
      customer: customerData,
      items: [...cart],
      subtotal: checkoutRes.subtotal !== undefined ? checkoutRes.subtotal : subtotal,
      discount: checkoutRes.discount !== undefined ? checkoutRes.discount : discount,
      shippingFee: checkoutRes.shippingFee !== undefined ? checkoutRes.shippingFee : shippingFee,
      tax,
      total: finalTotal,
      status: (checkoutRes.currentStatus as OrderStatus) || 'Processing',
      paymentMethod,
      shippingMethod,
      timeline: [
        {
          title: 'Order Confirmed & in Vault Authentication',
          timestamp: 'Just now',
          description: 'Payment authorized. Order sent to 12-point authentication facility.',
          completed: true
        },
        {
          title: '12-Point Authentication Inspection',
          timestamp: 'Pending (In Queue)',
          description: 'Senior authenticator will verify stitching, box label, and affix NFC Security Tag.',
          completed: false
        },
        {
          title: 'Vault Double-Box Packing',
          timestamp: 'Pending',
          description: 'Secured inside reinforced double-wall packaging.',
          completed: false
        },
        {
          title: 'Dispatched with Courier',
          timestamp: 'Pending',
          description: 'Courier express collection.',
          completed: false
        }
      ]
    };

    if (!preserveCart) {
      setSneakers(prevSneakers => {
        return prevSneakers.map(sneaker => {
          const matchingCartItems = cart.filter(item => item.sneaker.id === sneaker.id);
          if (matchingCartItems.length === 0) return sneaker;

          const updatedSizes = sneaker.sizes.map(sz => {
            const cartForSize = matchingCartItems.find(i => i.selectedSize === sz.size);
            if (cartForSize) {
              return {
                ...sz,
                stock: Math.max(0, sz.stock - cartForSize.quantity)
              };
            }
            return sz;
          });

          return {
            ...sneaker,
            sizes: updatedSizes
          };
        });
      });

      setOrders(prev => [newOrder, ...prev]);
      setCart([]);
      if (currentUser?.id && isSupabaseCartEnabled()) {
        void cartAdapter.syncClearCart(currentUser.id);
      }
      setAppliedPromo(null);
      setTrackingOrder(newOrder);

      analyticsService.trackEvent('purchase_success', {
        orderId: orderId,
        cartValue: finalTotal,
        itemCount: cart.length
      });

      showToast('Vault Order Placed!', `Order ${orderId} successfully created.`, 'success');
    }

    return newOrder;
  };

  // Admin Actions
  const addSneaker = (sneakerData: Omit<Sneaker, 'id' | 'rating' | 'reviewsCount'>) => {
    const newSneaker: Sneaker = {
      ...sneakerData,
      id: `sneaker-${Date.now()}`,
      rating: 5.0,
      reviewsCount: 0,
      salesCount: 0
    };
    setSneakers(prev => [newSneaker, ...prev]);
    showToast('Sneaker Added', 'Successfully added to vault catalog.', 'success');
  };

  const updateSneaker = (updated: Sneaker) => {
    setSneakers(prev => prev.map(s => (s.id === updated.id ? updated : s)));
    showToast('Sneaker Updated', 'Catalog record updated.', 'success');
  };

  const deleteSneaker = (id: string) => {
    setSneakers(prev => prev.filter(s => s.id !== id));
    showToast('Sneaker Deleted', 'Item removed from vault.', 'info');
  };

  const updateStock = (sneakerId: string, size: number, newStock: number) => {
    setSneakers(prev =>
      prev.map(s => {
        if (s.id !== sneakerId) return s;
        return {
          ...s,
          sizes: s.sizes.map(sz => (sz.size === size ? { ...sz, stock: newStock } : sz))
        };
      })
    );
    showToast('Stock Adjusted', `Stock updated for size US ${size}.`, 'info');
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status,
          timeline: [
            {
              title: `Status Changed to ${status}`,
              timestamp: 'Just now',
              description: `Fulfillment status changed to ${status}`,
              completed: true
            },
            ...o.timeline
          ]
        };
      })
    );
    showToast('Order Status Updated', `Order #${orderId} marked as ${status}.`, 'info');
  };

  const addPromo = (promoData: Omit<PromoCode, 'id'>) => {
    const newPromo: PromoCode = {
      ...promoData,
      id: `promo-${Date.now()}`
    };
    setPromos(prev => [newPromo, ...prev]);
    showToast('Promo Created', `Successfully created discount code.`, 'success');
  };

  const togglePromoStatus = (promoId: string) => {
    setPromos(prev =>
      prev.map(p => (p.id === promoId ? { ...p, isActive: !p.isActive } : p))
    );
    showToast('Promo Updated', 'Voucher status toggled.', 'info');
  };

  const refreshOrders = async () => {
    if (!isSupabaseOrdersEnabled() || !isSupabaseConfigured()) return;
    try {
      const serverOrders = await orderRepository.getOrders();
      if (serverOrders && serverOrders.length > 0) {
        setOrders(serverOrders);
      }
    } catch (_err) {
      // Silently handle refresh errors
    }
  };

  const handleSetIsCheckoutOpen = (open: boolean) => {
    setIsCheckoutOpen(open);
    if (open && cart.length > 0) {
      analyticsService.trackEvent('checkout_start', {
        cartValue: cart.reduce((sum, item) => sum + item.sneaker.price * item.quantity, 0),
        itemCount: cart.length
      });
    }
  };

  return (
    <StoreContext.Provider
      value={{
        sneakers,
        drops,
        promos,
        orders,
        cart,
        wishlist,
        filters,
        currentView,
        isCartOpen,
        isCheckoutOpen,
        isWishlistOpen,
        isAuthModalOpen,
        authModalMode,
        selectedSneaker,
        trackingOrder,
        appliedPromo,
        toasts,
        setCurrentView,
        setFilters,
        resetFilters,
        setIsCartOpen,
        setIsCheckoutOpen: handleSetIsCheckoutOpen,
        setIsWishlistOpen,
        setIsAuthModalOpen,
        setAuthModalMode,
        openAuthModal,
        closeAuthModal,
        setSelectedSneaker,
        setTrackingOrder,
        openSneakerModal,
        closeSneakerModal,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        applyPromoCode,
        removePromoCode,
        toggleWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleDropNotify,
        placeOrder,
        addSneaker,
        updateSneaker,
        deleteSneaker,
        updateStock,
        updateOrderStatus,
        addPromo,
        togglePromoStatus,
        refreshOrders,
        showToast,
        dismissToast
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
