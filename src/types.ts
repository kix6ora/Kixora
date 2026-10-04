export type ViewMode = 'store' | 'shop' | 'drops' | 'admin' | 'tracking';

export type Brand = 'Nike' | 'Jordan' | 'Adidas' | 'New Balance' | 'Asics' | 'Travis Scott' | 'Yeezy' | 'Puma' | 'Vans' | 'Converse' | string;
export type Category = 'High-Top' | 'Low-Top' | 'Mid-Top' | 'Retro' | 'Running' | 'Lifestyle' | 'Limited Edition' | string;

export type OrderStatus =
  | 'Pending'
  | 'Processing'
  | 'Authenticated'
  | 'Vault Packed'
  | 'Dispatched'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export interface SneakerSize {
  id?: string;
  size: number;
  stock: number;
}

export interface Sneaker {
  id: string;
  name: string;
  brand: string;
  category: string;
  gender: 'Men' | 'Women' | 'Unisex';
  price: number;
  originalPrice?: number;
  description: string;
  image: string;
  /** Optional public GLB/GLTF URL (e.g. Cloudinary or Supabase Storage). */
  modelUrl?: string;
  images: string[];
  gallery: string[];
  sizes: SneakerSize[];
  colorway: string;
  releaseYear: number;
  releaseDate?: string;
  sku: string;
  story: string;
  details?: string[];
  tags?: string[];
  rating: number;
  reviewsCount: number;
  salesCount: number;
  isVaultExclusive?: boolean;
  featured?: boolean;
  isFeatured?: boolean;
  isNewRelease?: boolean;
  isBestSeller?: boolean;
}

export interface CartItem {
  id: string;
  sneaker: Sneaker;
  selectedSize: number;
  quantity: number;
}

export interface PromoCode {
  id: string;
  code: string;
  discountPercent: number;
  minSpend?: number;
  maxUses?: number;
  currentUses?: number;
  isActive: boolean;
  startsAt?: string;
  expiresAt?: string | null;
  createdAt?: string;
  description?: string;
}

export interface OrderTimelineEvent {
  id?: string;
  title: string;
  timestamp: string;
  description: string;
  completed: boolean;
  status?: string;
}

export interface OrderCustomer {
  fullName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Order {
  id: string;
  orderCode?: string;
  guestAccessToken?: string;
  trackingNumber: string;
  createdAt: string;
  customer: OrderCustomer;
  items: CartItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentMethod: string;
  shippingMethod: string;
  timeline: OrderTimelineEvent[];
}

export interface Drop {
  id: string;
  sneakerName: string;
  brand: string;
  price: number;
  releaseTime: string;
  image: string;
  description: string;
  isNotified: boolean;
  subscribersCount: number;
  raffleOpen: boolean;
  editionSize: number;
  hypeLevel?: string;
  type?: string;
  dropType?: string;
}

export interface FilterState {
  brand: string;
  category: string;
  gender: string;
  maxPrice: number;
  selectedSize: number | null;
  inStockOnly: boolean;
  sortBy: 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'rating' | string;
  search: string;
}

export interface AdminAuditLog {
  id: string;
  createdAt: string;
  adminEmail?: string;
  adminId?: string;
  action?: string;
  actionType?: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

export * from './types/auth';
