import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { CartItem, Sneaker } from '../../types';
import { mapCartRowsToCartItems, CartItemHydratedRow } from './cartMapper';

export const cartRepository = {
  async getOrCreateCart(userIdOrGuestToken: string, isGuest: boolean = false): Promise<string> {
    if (!isSupabaseConfigured()) {
      return 'local-cart-id';
    }

    if (!userIdOrGuestToken) {
      return 'guest-temp-cart';
    }

    let query = supabase.from('carts').select('id');
    if (isGuest) {
      query = query.eq('guest_session_token', userIdOrGuestToken);
    } else {
      query = query.eq('user_id', userIdOrGuestToken);
    }

    const { data: existing, error: findError } = await query.limit(1).maybeSingle();
    if (findError) {
      console.warn('[cartRepository.getOrCreateCart] Error finding cart:', findError);
      return 'fallback-cart-id';
    }

    if (existing?.id) {
      return existing.id;
    }

    const insertPayload: any = isGuest
      ? { guest_session_token: userIdOrGuestToken }
      : { user_id: userIdOrGuestToken };

    const { data: created, error: createError } = await supabase
      .from('carts')
      .insert(insertPayload)
      .select('id')
      .maybeSingle();

    if (createError) {
      console.warn('[cartRepository.getOrCreateCart] Error creating cart:', createError);
      return 'fallback-cart-id';
    }

    return created?.id || 'fallback-cart-id';
  },

  async getCart(userId: string): Promise<CartItem[]> {
    if (!isSupabaseConfigured() || !userId) {
      return [];
    }

    try {
      const cartId = await this.getOrCreateCart(userId, false);
      const res: any = await this.getCartWithItems(cartId);
      return Array.isArray(res) ? res : res?.items || [];
    } catch (err) {
      console.warn('[cartRepository.getCart] Error fetching cart:', err);
      return [];
    }
  },

  async getCartWithItems(cartId: string): Promise<CartItem[] & { items: CartItem[]; cart?: any }> {
    if (!isSupabaseConfigured() || !cartId || cartId === 'local-cart-id') {
      const emptyArr: any = [];
      emptyArr.items = [];
      return emptyArr;
    }

    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          products (
            *,
            brands (*),
            categories (*),
            product_images (*),
            product_sizes (
              *,
              inventory (*)
            )
          ),
          product_sizes (*)
        `)
        .eq('cart_id', cartId);

      if (error) {
        console.warn('[cartRepository.getCartWithItems] Error fetching cart items:', error);
        const emptyArr: any = [];
        emptyArr.items = [];
        return emptyArr;
      }

      const items = mapCartRowsToCartItems((data || []) as unknown as CartItemHydratedRow[]);
      const result: any = [...items];
      result.items = items;
      return result;
    } catch (err) {
      console.warn('[cartRepository.getCartWithItems] Exception:', err);
      const emptyArr: any = [];
      emptyArr.items = [];
      return emptyArr;
    }
  },

  async addItem(
    cartIdOrUserId: string,
    sneakerOrSizeId: any,
    sizeOrQuantity?: any,
    quantityOrProductIdOrCustomization?: any
  ): Promise<void> {
    if (!isSupabaseConfigured() || !cartIdOrUserId) return;

    try {
      // Branch 1: Called with (userId | cartId, sneaker: Sneaker, size: number, quantity?: number)
      if (typeof sneakerOrSizeId === 'object' && sneakerOrSizeId?.id) {
        const sneaker: Sneaker = sneakerOrSizeId;
        const size: number = typeof sizeOrQuantity === 'number' ? sizeOrQuantity : 9;
        const quantity: number = typeof quantityOrProductIdOrCustomization === 'number' && quantityOrProductIdOrCustomization > 0
          ? quantityOrProductIdOrCustomization
          : 1;

        let cartId = cartIdOrUserId;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cartId);
        if (!isUuid) {
          cartId = await this.getOrCreateCart(cartIdOrUserId, false);
        }

        // 1. Resolve product_size_id from product_sizes
        let productSizeId: string | null = null;
        const { data: sizeRow } = await supabase
          .from('product_sizes')
          .select('id')
          .eq('product_id', sneaker.id)
          .eq('size_us', size)
          .maybeSingle();

        if (sizeRow?.id) {
          productSizeId = sizeRow.id;
        } else {
          // If no product_size row exists yet, attempt to query any product size or create one
          const { data: fallbackSize } = await supabase
            .from('product_sizes')
            .select('id')
            .eq('product_id', sneaker.id)
            .limit(1)
            .maybeSingle();
          productSizeId = fallbackSize?.id || null;
        }

        if (productSizeId) {
          // Check for existing cart item to increment quantity
          const { data: existingItem } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('cart_id', cartId)
            .eq('product_size_id', productSizeId)
            .is('bespoke_design_id', null)
            .maybeSingle();

          if (existingItem?.id) {
            await supabase
              .from('cart_items')
              .update({ quantity: existingItem.quantity + quantity })
              .eq('id', existingItem.id);
            return;
          }

          await supabase.from('cart_items').insert({
            cart_id: cartId,
            product_id: sneaker.id,
            product_size_id: productSizeId,
            quantity,
          });
        }
        return;
      }

      // Branch 2: Called with (cartId, sizeId, quantity, productId)
      const cartId = cartIdOrUserId;
      const sizeId = sneakerOrSizeId;
      const quantity = typeof sizeOrQuantity === 'number' && sizeOrQuantity > 0 ? sizeOrQuantity : 1;
      const productId = typeof quantityOrProductIdOrCustomization === 'string' ? quantityOrProductIdOrCustomization : null;

      if (!sizeId) return;

      const { error } = await supabase.from('cart_items').insert({
        cart_id: cartId,
        product_size_id: sizeId,
        product_id: productId,
        quantity: quantity || 1,
      });

      if (error) {
        console.warn('[cartRepository.addItem] Error adding cart item:', error);
      }
    } catch (err) {
      console.warn('[cartRepository.addItem] Exception adding cart item:', err);
    }
  },

  async updateItemQuantity(cartItemId: string, quantity: number): Promise<void> {
    if (!isSupabaseConfigured() || !cartItemId) return;

    try {
      if (quantity <= 0) {
        await this.removeItem(cartItemId);
        return;
      }

      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', cartItemId);

      if (error) {
        console.warn('[cartRepository.updateItemQuantity] Error updating quantity:', error);
      }
    } catch (err) {
      console.warn('[cartRepository.updateItemQuantity] Exception:', err);
    }
  },

  async updateQuantity(cartItemIdOrUserId: string, cartItemIdOrQuantity: any, quantity?: number): Promise<void> {
    const itemId = quantity !== undefined ? cartItemIdOrQuantity : cartItemIdOrUserId;
    const qty = quantity !== undefined ? quantity : cartItemIdOrQuantity;
    await this.updateItemQuantity(itemId, typeof qty === 'number' ? qty : 1);
  },

  async removeItem(cartItemIdOrUserId: string, cartItemId?: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const itemId = cartItemId || cartItemIdOrUserId;
    if (!itemId) return;

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.warn('[cartRepository.removeItem] Error removing item:', error);
      }
    } catch (err) {
      console.warn('[cartRepository.removeItem] Exception:', err);
    }
  },

  async clearCart(cartIdOrUserId: string): Promise<void> {
    if (!isSupabaseConfigured() || !cartIdOrUserId) return;

    try {
      let cartId = cartIdOrUserId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cartId);
      if (!isUuid) {
        cartId = await this.getOrCreateCart(cartIdOrUserId, false);
      }

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cartId);

      if (error) {
        console.warn('[cartRepository.clearCart] Error clearing cart:', error);
      }
    } catch (err) {
      console.warn('[cartRepository.clearCart] Exception:', err);
    }
  },

  async mergeGuestCart(userId: string, guestItems: CartItem[]): Promise<void> {
    if (!isSupabaseConfigured() || !userId || !Array.isArray(guestItems) || guestItems.length === 0) {
      return;
    }

    try {
      const cartId = await this.getOrCreateCart(userId, false);
      for (const item of guestItems) {
        if (!item.sneaker?.id) continue;
        await this.addItem(
          cartId,
          item.sneaker,
          item.selectedSize,
          item.quantity
        );
      }
    } catch (err) {
      console.warn('[cartRepository.mergeGuestCart] Error merging guest cart:', err);
    }
  }
};

