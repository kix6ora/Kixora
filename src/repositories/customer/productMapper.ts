import { Sneaker } from '../../types';

export interface ProductHydratedRow {
  id: string;
  name: string;
  slug?: string;
  brand_id?: string;
  category_id?: string;
  price: number;
  original_price?: number | null;
  description?: string | null;
  details?: string[] | null;
  tags?: string[] | null;
  story?: string | null;
  colorway?: string | null;
  release_year?: number | null;
  sku?: string | null;
  gender?: 'Men' | 'Women' | 'Unisex' | null;
  rating?: number | null;
  reviews_count?: number | null;
  sales_count?: number | null;
  model_url?: string | null;
  is_vault_exclusive?: boolean | null;
  featured?: boolean | null;
  is_featured?: boolean | null;
  is_new_release?: boolean | null;
  is_best_seller?: boolean | null;
  is_active?: boolean | null;
  created_at?: string;
  updated_at?: string;
  brands?: { id?: string; name: string; slug?: string; [key: string]: any } | null;
  categories?: { id?: string; name: string; slug?: string; [key: string]: any } | null;
  product_images?: Array<{
    id?: string;
    product_id?: string;
    image_url: string;
    angle_label?: string;
    is_primary?: boolean;
    display_order?: number;
    created_at?: string;
    [key: string]: any;
  }> | null;
  product_sizes?: Array<{
    id?: string;
    product_id?: string;
    size?: number;
    size_us?: number;
    created_at?: string;
    inventory?: Array<{
      id?: string;
      product_size_id?: string;
      stock: number;
      reserved_stock?: number;
      updated_at?: string;
      [key: string]: any;
    }> | { stock: number; reserved_stock?: number; [key: string]: any } | null;
    [key: string]: any;
  }> | null;
  [key: string]: any;
}

export const mapProductRowToSneaker = (row: ProductHydratedRow): Sneaker => {
  const brandName = row.brands?.name || 'Nike';
  const categoryName = row.categories?.name || 'High-Top';
  
  const rawImages = [...(row.product_images || [])];
  const sortedImages = rawImages.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const imageUrls = sortedImages.map(img => img.image_url).filter(Boolean);
  const primaryImage = sortedImages.find(img => img.is_primary)?.image_url
    ? sortedImages.find(img => img.is_primary)!.image_url
    : imageUrls[0] || '';

  const rawSizes = [...(row.product_sizes || [])];
  const parsedSizes = rawSizes.map(sz => {
    const numericSize = Number(sz.size_us ?? sz.size ?? 9);
    let availableStock = 0;
    if (Array.isArray(sz.inventory)) {
      availableStock = sz.inventory.reduce((acc, curr) => {
        const total = curr.stock || 0;
        const reserved = curr.reserved_stock || 0;
        return acc + Math.max(0, total - reserved);
      }, 0);
    } else if (sz.inventory) {
      const total = sz.inventory.stock || 0;
      const reserved = sz.inventory.reserved_stock || 0;
      availableStock = Math.max(0, total - reserved);
    }
    return {
      id: sz.id,
      size: numericSize,
      stock: availableStock
    };
  }).sort((a, b) => a.size - b.size);

  const isFeatured = Boolean(row.is_featured ?? row.featured);
  const isNewRelease = Boolean(row.is_new_release);
  const isBestSeller = Boolean(row.is_best_seller ?? ((row.sales_count || 0) > 300));

  return {
    id: row.id,
    name: row.name,
    brand: brandName,
    category: categoryName,
    gender: row.gender || 'Men',
    price: Number(row.price),
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    description: row.description || '',
    details: row.details || undefined,
    tags: row.tags || undefined,
    image: primaryImage,
    modelUrl: row.model_url || undefined,
    images: imageUrls.length > 0 ? imageUrls : [primaryImage],
    gallery: imageUrls.length > 0 ? imageUrls : [primaryImage],
    sizes: parsedSizes.length > 0 ? parsedSizes : [{ size: 9, stock: 5 }, { size: 10, stock: 5 }],
    colorway: row.colorway || '',
    releaseYear: row.release_year || 2024,
    sku: row.sku || '',
    story: row.story || '',
    rating: row.rating ? Number(row.rating) : 5.0,
    reviewsCount: row.reviews_count ? Number(row.reviews_count) : 0,
    salesCount: row.sales_count ? Number(row.sales_count) : 0,
    isVaultExclusive: Boolean(row.is_vault_exclusive),
    featured: isFeatured,
    isFeatured,
    isNewRelease,
    isBestSeller,
  };
};

export const mapProductRowsToSneakers = (rows: ProductHydratedRow[]): Sneaker[] => {
  return rows.map(mapProductRowToSneaker);
};
