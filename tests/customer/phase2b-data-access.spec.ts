import { test, expect } from '@playwright/test';
import {
  FEATURES,
  isSupabaseCartEnabled,
  isSupabaseWishlistEnabled,
  isSupabaseOrdersEnabled,
  isSupabaseCheckoutEnabled,
} from '../../src/config/features';
import {
  mapCartItemRowToCartItem,
  mapCartRowsToCartItems,
  CartItemHydratedRow,
} from '../../src/repositories/customer/cartMapper';
import {
  mapWishlistRowToSneaker,
  mapWishlistRowsToSneakers,
  WishlistHydratedRow,
} from '../../src/repositories/customer/wishlistMapper';
import {
  mapOrderRowToOrder,
  mapOrderRowsToOrders,
  OrderHydratedRow,
} from '../../src/repositories/customer/orderMapper';
import { cartRepository } from '../../src/repositories/customer/cartRepository';
import { wishlistRepository } from '../../src/repositories/customer/wishlistRepository';
import { orderRepository } from '../../src/repositories/customer/orderRepository';
import { checkoutService } from '../../src/services/checkoutService';

test.describe('Phase 2B: Cart, Wishlist & Order Data Access Layer', () => {

  test('DAL2B-01: Feature flags exist with safe fallback defaults', async () => {
    expect(FEATURES).toHaveProperty('USE_SUPABASE_CART');
    expect(FEATURES).toHaveProperty('USE_SUPABASE_WISHLIST');
    expect(FEATURES).toHaveProperty('USE_SUPABASE_ORDERS');
    expect(FEATURES).toHaveProperty('USE_SUPABASE_CHECKOUT');

    expect(typeof FEATURES.USE_SUPABASE_CART).toBe('boolean');
    expect(typeof FEATURES.USE_SUPABASE_WISHLIST).toBe('boolean');
    expect(typeof FEATURES.USE_SUPABASE_ORDERS).toBe('boolean');
    expect(typeof FEATURES.USE_SUPABASE_CHECKOUT).toBe('boolean');

    expect(typeof isSupabaseCartEnabled()).toBe('boolean');
    expect(typeof isSupabaseWishlistEnabled()).toBe('boolean');
    expect(typeof isSupabaseOrdersEnabled()).toBe('boolean');
    expect(typeof isSupabaseCheckoutEnabled()).toBe('boolean');
  });

  test('DAL2B-02: CartMapper transforms hydrated database rows to domain CartItem models', async () => {
    const mockCartRow: CartItemHydratedRow = {
      id: 'cart-item-101',
      cart_id: 'cart-abc-001',
      product_id: 'prod-nike-01',
      product_size_id: 'size-row-10',
      quantity: 2,
      created_at: '2026-08-20T10:00:00Z',
      updated_at: '2026-08-20T10:00:00Z',
      products: {
        id: 'prod-nike-01',
        name: 'Air Jordan 1 Retro High OG "Chicago"',
        slug: 'air-jordan-1-chicago',
        brand_id: 'brand-jordan',
        category_id: 'cat-high-top',
        gender: 'Men',
        sku: 'DZ5485-612',
        colorway: 'Varsity Red/Black/Sail',
        price: 3499,
        original_price: 3899,
        description: 'The iconic 1985 silhouette.',
        details: ['Premium leather', 'Air cushioning'],
        tags: ['Grail', 'OG', 'High-Top'],
        rating: 4.9,
        reviews_count: 320,
        sales_count: 1400,
        is_new_release: false,
        is_featured: true,
        is_active: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        brands: { id: 'brand-jordan', name: 'Jordan', slug: 'jordan', is_featured: true, created_at: '' },
        categories: { id: 'cat-high-top', name: 'High-Top', slug: 'high-top', created_at: '' },
        product_images: [
          { id: 'img-1', product_id: 'prod-nike-01', image_url: 'https://images.unsplash.com/photo-1552346154-21d32810aba3', angle_label: 'lateral', display_order: 1, created_at: '' }
        ],
        product_sizes: [
          { id: 'size-row-10', product_id: 'prod-nike-01', size_us: 10.5, created_at: '', inventory: [{ id: 'inv-1', product_size_id: 'size-row-10', stock: 4, reserved_stock: 0, updated_at: '' }] }
        ]
      },
      product_sizes: {
        id: 'size-row-10',
        product_id: 'prod-nike-01',
        size_us: 10.5,
        created_at: '2025-01-01T00:00:00Z'
      }
    };

    const cartItem = mapCartItemRowToCartItem(mockCartRow);

    expect(cartItem.id).toBe('cart-item-101');
    expect(cartItem.quantity).toBe(2);
    expect(cartItem.selectedSize).toBe(10.5);
    expect(cartItem.sneaker.name).toBe('Air Jordan 1 Retro High OG "Chicago"');
    expect(cartItem.sneaker.brand).toBe('Jordan');
    expect(cartItem.sneaker.price).toBe(3499);

    const mappedList = mapCartRowsToCartItems([mockCartRow]);
    expect(mappedList.length).toBe(1);
    expect(mappedList[0].id).toBe('cart-item-101');
  });

  test('DAL2B-03: WishlistMapper transforms hydrated database rows into domain Sneaker models', async () => {
    const mockWishlistRow: WishlistHydratedRow = {
      id: 'wish-1',
      user_id: 'user-001',
      product_id: 'prod-travis-01',
      created_at: '2026-08-21T12:00:00Z',
      products: {
        id: 'prod-travis-01',
        name: 'Travis Scott x Air Jordan 1 Low OG "Reverse Mocha"',
        slug: 'travis-scott-reverse-mocha',
        brand_id: 'brand-travis',
        category_id: 'cat-low-top',
        gender: 'Unisex',
        sku: 'DM7866-162',
        colorway: 'Sail/University Red/Ridgerock',
        price: 8999,
        original_price: 9999,
        description: 'Cactus Jack Reverse Mocha signature sneaker.',
        details: ['Backward swoosh', 'Cactus Jack heel embroidery'],
        tags: ['Grail', 'Collab', 'Low-Top'],
        rating: 5.0,
        reviews_count: 450,
        sales_count: 850,
        is_new_release: false,
        is_featured: true,
        is_active: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        brands: { id: 'brand-travis', name: 'Travis Scott', slug: 'travis-scott', is_featured: true, created_at: '' },
        categories: { id: 'cat-low-top', name: 'Low-Top', slug: 'low-top', created_at: '' },
        product_images: [
          { id: 'img-ts', product_id: 'prod-travis-01', image_url: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a', angle_label: 'lateral', display_order: 1, created_at: '' }
        ],
        product_sizes: [
          { id: 'size-ts-9', product_id: 'prod-travis-01', size_us: 9, created_at: '', inventory: [{ id: 'inv-ts', product_size_id: 'size-ts-9', stock: 2, reserved_stock: 0, updated_at: '' }] }
        ]
      }
    };

    const sneaker = mapWishlistRowToSneaker(mockWishlistRow);
    expect(sneaker).not.toBeNull();
    expect(sneaker?.id).toBe('prod-travis-01');
    expect(sneaker?.name).toBe('Travis Scott x Air Jordan 1 Low OG "Reverse Mocha"');
    expect(sneaker?.brand).toBe('Travis Scott');
    expect(sneaker?.price).toBe(8999);

    const sneakersList = mapWishlistRowsToSneakers([mockWishlistRow]);
    expect(sneakersList.length).toBe(1);
    expect(sneakersList[0].id).toBe('prod-travis-01');
  });

  test('DAL2B-04: OrderMapper transforms hydrated database order into domain Order model', async () => {
    const mockOrderRow: OrderHydratedRow = {
      id: 'ord-888-uuid',
      order_code: 'KIX-748291',
      guest_access_token: 'guest-tok-123',
      user_id: 'user-001',
      customer_snapshot: {
        fullName: 'Marcus Aurelius',
        email: 'marcus@vault.co.za',
        phone: '+27 82 555 0192',
        street: '42 Bree Street',
        city: 'Cape Town',
        state: 'Western Cape',
        zip: '8001',
        country: 'South Africa'
      },
      subtotal: 5998,
      discount: 599.8,
      shipping_fee: 0,
      tax: 809.73,
      total: 5398.2,
      payment_method: 'Credit Card (Escrow)',
      shipping_method: 'Vault Express Delivery',
      payment_status: 'PAID',
      payment_reference: 'PAY-ESCROW-001',
      current_status: 'Shipped',
      created_at: '2026-08-22T08:30:00Z',
      updated_at: '2026-08-22T14:00:00Z',
      order_items: [
        {
          id: 'item-1',
          order_id: 'ord-888-uuid',
          product_id: 'prod-1',
          product_name: 'Nike Dunk Low Retro "Panda"',
          product_sku: 'DD1391-100',
          size_us: 10,
          unit_price: 2999,
          quantity: 2,
          bespoke_snapshot: null,
          image_url: 'https://images.unsplash.com/photo-1552346154-21d32810aba3',
          created_at: '2026-08-22T08:30:00Z'
        }
      ],
      order_status_history: [
        {
          id: 'hist-1',
          order_id: 'ord-888-uuid',
          status: 'Pending',
          title: 'Order Placed',
          description: 'Payment verified and secured in escrow.',
          created_by: null,
          created_at: '2026-08-22T08:30:00Z'
        },
        {
          id: 'hist-2',
          order_id: 'ord-888-uuid',
          status: 'Authenticated',
          title: 'Verified Authentic',
          description: 'Passed 12-point authentication checkpoint.',
          created_by: 'admin-lead',
          created_at: '2026-08-22T10:15:00Z'
        },
        {
          id: 'hist-3',
          order_id: 'ord-888-uuid',
          status: 'Shipped',
          title: 'Dispatched with Courier',
          description: 'Vault tamper-evident package in transit.',
          created_by: 'admin-lead',
          created_at: '2026-08-22T14:00:00Z'
        }
      ],
      shipments: [
        {
          id: 'ship-1',
          order_id: 'ord-888-uuid',
          tracking_number: 'TRK-VAULT-99012',
          carrier: 'RAM Hand-to-Hand',
          nfc_security_tag_id: 'NFC-TAG-77',
          dispatched_at: '2026-08-22T14:00:00Z',
          estimated_delivery: '2026-08-24T17:00:00Z',
          delivered_at: null,
          created_at: '2026-08-22T14:00:00Z'
        }
      ]
    };

    const order = mapOrderRowToOrder(mockOrderRow);

    expect(order.id).toBe('ord-888-uuid');
    expect(order.trackingNumber).toBe('TRK-VAULT-99012');
    expect(order.customer.fullName).toBe('Marcus Aurelius');
    expect(order.customer.city).toBe('Cape Town');
    expect(order.items.length).toBe(1);
    expect(order.items[0].sneaker.name).toBe('Nike Dunk Low Retro "Panda"');
    expect(order.items[0].selectedSize).toBe(10);
    expect(order.items[0].quantity).toBe(2);
    expect(order.subtotal).toBe(5998);
    expect(order.discount).toBe(599.8);
    expect(order.total).toBe(5398.2);
    expect(order.status).toBe('Shipped');
    expect(order.timeline.length).toBe(3);
    expect(order.timeline[0].title).toBe('Order Placed');
    expect(order.timeline[2].title).toBe('Dispatched with Courier');

    const orderList = mapOrderRowsToOrders([mockOrderRow]);
    expect(orderList.length).toBe(1);
    expect(orderList[0].id).toBe('ord-888-uuid');
  });

  test('DAL2B-05: Repositories expose all required customer methods', async () => {
    // Cart Repository
    expect(typeof cartRepository.getOrCreateCart).toBe('function');
    expect(typeof cartRepository.getCart).toBe('function');
    expect(typeof cartRepository.getCartWithItems).toBe('function');
    expect(typeof cartRepository.addItem).toBe('function');
    expect(typeof cartRepository.updateQuantity).toBe('function');
    expect(typeof cartRepository.removeItem).toBe('function');
    expect(typeof cartRepository.clearCart).toBe('function');

    // Wishlist Repository
    expect(typeof wishlistRepository.getWishlist).toBe('function');
    expect(typeof wishlistRepository.addToWishlist).toBe('function');
    expect(typeof wishlistRepository.removeFromWishlist).toBe('function');
    expect(typeof wishlistRepository.isWishlisted).toBe('function');

    // Order Repository
    expect(typeof orderRepository.getCustomerOrders).toBe('function');
    expect(typeof orderRepository.getOrderDetails).toBe('function');
    expect(typeof orderRepository.getOrderTracking).toBe('function');
  });

  test('DAL2B-06: CheckoutService validates input and handles atomic flow safely', async () => {
    expect(typeof checkoutService.placeOrderAtomic).toBe('function');
    expect(typeof checkoutService.placeOrder).toBe('function');

    // Test missing cart/user id validation
    const missingCartResult = await checkoutService.placeOrderAtomic({
      cartId: '',
      customerInfo: { email: 'buyer@vault.co.za' },
      paymentMethod: 'Credit Card',
      shippingMethod: 'Express',
    });
    expect(missingCartResult.success).toBe(false);
    expect(['VALIDATION_ERROR', 'EMPTY_CART']).toContain(missingCartResult.errorCode);

    // Test missing email validation
    const missingEmailResult = await checkoutService.placeOrderAtomic({
      cartId: 'cart-123',
      customerInfo: { email: '' },
      paymentMethod: 'Credit Card',
      shippingMethod: 'Express',
    });
    expect(missingEmailResult.success).toBe(false);
    expect(missingEmailResult.errorCode).toBe('VALIDATION_ERROR');

    // Test fallback / mock placement when Supabase checkout flag is disabled
    const fallbackResult = await checkoutService.placeOrderAtomic({
      cartId: 'cart-123',
      cartItems: [
        {
          id: 'cart-item-test-1',
          sneaker: {
            id: 'sneaker-test-1',
            name: 'Test Sneaker',
            brand: 'Nike',
            category: 'Low-Top',
            gender: 'Unisex',
            price: 1500,
            description: 'Test sneaker',
            image: '',
            images: [],
            gallery: [],
            sizes: [{ size: 9, stock: 10 }],
            colorway: '',
            releaseYear: 2024,
            sku: 'TEST-001',
            story: '',
            rating: 5,
            reviewsCount: 0,
            salesCount: 0,
          },
          selectedSize: 9,
          quantity: 1,
        },
      ],
      customerInfo: {
        email: 'buyer@vault.co.za',
        fullName: 'Sneaker Head',
        street: '10 Main Road',
        city: 'Johannesburg',
        state: 'Gauteng',
        zip: '2000',
        country: 'South Africa',
      },
      paymentMethod: 'Credit Card',
      shippingMethod: 'Express',
    });
    expect(fallbackResult.success).toBe(true);
    expect(fallbackResult.orderCode).toBeDefined();
    expect(fallbackResult.subtotal).toBe(1500);
    expect(fallbackResult.shippingFee).toBe(200);
    expect(fallbackResult.total).toBe(1700);

    const freeShippingResult = await checkoutService.placeOrderAtomic({
      cartId: 'cart-123',
      cartItems: [
        {
          id: 'cart-item-test-2',
          sneaker: {
            id: 'sneaker-test-2',
            name: 'Test Sneaker',
            brand: 'Nike',
            category: 'Low-Top',
            gender: 'Unisex',
            price: 2500,
            description: 'Test sneaker',
            image: '',
            images: [],
            gallery: [],
            sizes: [{ size: 9, stock: 10 }],
            colorway: '',
            releaseYear: 2024,
            sku: 'TEST-002',
            story: '',
            rating: 5,
            reviewsCount: 0,
            salesCount: 0,
          },
          selectedSize: 9,
          quantity: 1,
        },
      ],
      customerInfo: {
        email: 'buyer@vault.co.za',
        fullName: 'Sneaker Head',
        street: '10 Main Road',
        city: 'Johannesburg',
        state: 'Gauteng',
        zip: '2000',
        country: 'South Africa',
      },
      paymentMethod: 'Credit Card',
      shippingMethod: 'Express',
    });
    expect(freeShippingResult.success).toBe(true);
    expect(freeShippingResult.shippingFee).toBe(0);
    expect(freeShippingResult.total).toBe(2500);
  });

});
