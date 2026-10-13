import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Sneaker } from '../../types';
import { mapWishlistRowsToSneakers, WishlistHydratedRow } from './wishlistMapper';
import { authService } from '../../services/authService';

export const wishlistRepository = {
  /**
   * Fetches the authenticated customer's wishlist items with hydrated product details.
   */
  async getWishlist(userId?: string): Promise<Sneaker[]> {
    const effectiveUserId = userId || (await this.resolveUserId());
    if (!isSupabaseConfigured() || !effectiveUserId) {
      return [];
    }

    const { data, error } = await supabase
      .from('wishlists')
      .select(`
        id,
        user_id,
        product_id,
        created_at,
        products (
          *,
          brands (*),
          categories (*),
          product_images (*),
          product_sizes (
            *,
            inventory (*)
          )
        )
      `)
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[wishlistRepository.getWishlist] Database error (falling back to empty):', error);
      return [];
    }

    return mapWishlistRowsToSneakers((data || []) as unknown as WishlistHydratedRow[]);
  },

  /**
   * Fetches the array of wishlisted product IDs for the given user.
   */
  async getWishlistProductIds(userId?: string): Promise<string[]> {
    const effectiveUserId = userId || (await this.resolveUserId());
    if (!isSupabaseConfigured() || !effectiveUserId) {
      return [];
    }

    const { data, error } = await supabase
      .from('wishlists')
      .select('product_id')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[wishlistRepository.getWishlistProductIds] Database error (falling back to empty):', error);
      return [];
    }

    return (data || []).map((row: any) => row.product_id).filter(Boolean);
  },

  /**
   * Adds a product to the user's wishlist. Handles unique constraint duplicates gracefully.
   */
  async addToWishlist(userId: string, productId: string): Promise<void> {
    const effectiveUserId = userId || (await this.resolveUserId());
    if (!isSupabaseConfigured() || !effectiveUserId || !productId) {
      return;
    }

    const { error } = await supabase
      .from('wishlists')
      .insert({
        user_id: effectiveUserId,
        product_id: productId,
      });

    // 23505 is PostgreSQL unique constraint violation (duplicate wishlist entry)
    if (error && (error as any).code !== '23505') {
      console.error('[wishlistRepository.addToWishlist] Error adding to wishlist:', error);
      throw error;
    }
  },

  /**
   * Removes a product from the user's wishlist.
   */
  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    const effectiveUserId = userId || (await this.resolveUserId());
    if (!isSupabaseConfigured() || !effectiveUserId || !productId) {
      return;
    }

    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', effectiveUserId)
      .eq('product_id', productId);

    if (error) {
      console.error('[wishlistRepository.removeFromWishlist] Error removing from wishlist:', error);
      throw error;
    }
  },

  /**
   * Checks whether a product exists in the user's wishlist.
   */
  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const effectiveUserId = userId || (await this.resolveUserId());
    if (!isSupabaseConfigured() || !effectiveUserId || !productId) {
      return false;
    }

    const { data, error } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('product_id', productId)
      .maybeSingle();

    if (error) {
      console.error('[wishlistRepository.isInWishlist] Error checking wishlist item:', error);
      return false;
    }

    return Boolean(data?.id);
  },

  /**
   * Alias for isInWishlist for backward compatibility.
   */
  async isWishlisted(userId: string, productId: string): Promise<boolean> {
    return this.isInWishlist(userId, productId);
  },

  /**
   * Helper to merge guest wishlist product IDs into an authenticated user's wishlist.
   */
  async mergeGuestWishlist(userId: string, guestProductIds: string[]): Promise<void> {
    if (!isSupabaseConfigured() || !userId || !guestProductIds || guestProductIds.length === 0) {
      return;
    }

    const uniqueIds = Array.from(new Set(guestProductIds.filter(Boolean)));
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = uniqueIds.filter((id) => uuidRe.test(id));
    if (validIds.length === 0) {
      return;
    }
    const inserts = validIds.map(productId => ({
      user_id: userId,
      product_id: productId,
    }));

    const { error } = await supabase
      .from('wishlists')
      .upsert(inserts, { onConflict: 'user_id,product_id', ignoreDuplicates: true });

    if (error && (error as any).code !== '23505') {
      console.warn('[wishlistRepository.mergeGuestWishlist] Error merging items:', error);
    }
  },

  /**
   * Private helper to resolve current user ID from session if not passed directly.
   */
  async resolveUserId(): Promise<string | undefined> {
    const currentUser = await authService.getCurrentUser();
    if (currentUser?.id) return currentUser.id;

    if (isSupabaseConfigured()) {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id;
    }
    return undefined;
  }
};
