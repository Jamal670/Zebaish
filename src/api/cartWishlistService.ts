import supabase from './client';
import { CartItem } from '@/types';

// ================= WISHLIST SERVICES =================

/**
 * Fetches product IDs saved in the authenticated user's database wishlist
 */
export async function fetchUserWishlistIds(userId: string): Promise<string[]> {
  try {
    const { data: wishlist, error: wishlistErr } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (wishlistErr || !wishlist) return [];

    const { data: items, error: itemsErr } = await supabase
      .from('wishlist_items')
      .select('product_id')
      .eq('wishlist_id', wishlist.id);

    if (itemsErr || !items) return [];

    return items.map((i: any) => i.product_id);
  } catch (err) {
    console.error('Error fetching DB wishlist:', err);
    return [];
  }
}

/**
 * Toggles a product in the authenticated user's DB wishlist (adds if missing, removes if present)
 */
export async function toggleDbWishlist(userId: string, productId: string): Promise<boolean> {
  try {
    // 1. Find or create user's wishlist record
    let { data: wishlist } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!wishlist) {
      const { data: newWishlist, error: createErr } = await supabase
        .from('wishlists')
        .insert({ user_id: userId })
        .select('id')
        .single();

      if (createErr || !newWishlist) {
        console.error('Failed to create wishlist record:', createErr);
        throw createErr;
      }
      wishlist = newWishlist;
    }

    // 2. Check if item exists in wishlist_items
    const { data: existing } = await supabase
      .from('wishlist_items')
      .select('id')
      .eq('wishlist_id', wishlist.id)
      .eq('product_id', productId)
      .maybeSingle();

    if (existing) {
      // Remove item
      await supabase
        .from('wishlist_items')
        .delete()
        .eq('id', existing.id);
      return false; // Now not wishlisted
    } else {
      // Add item
      await supabase
        .from('wishlist_items')
        .insert({
          wishlist_id: wishlist.id,
          product_id: productId,
        });
      return true; // Now wishlisted
    }
  } catch (err) {
    console.error('Error toggling DB wishlist item:', err);
    throw err;
  }
}


// ================= CART SERVICES =================

/**
 * Syncs a cart item change to database for an authenticated user
 */
export async function syncCartItemToDb(
  userId: string,
  productId: string,
  quantity: number,
  price: number
): Promise<void> {
  try {
    // 1. Find or create user's cart record
    let { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!cart) {
      const { data: newCart, error: createErr } = await supabase
        .from('carts')
        .insert({ user_id: userId })
        .select('id')
        .single();

      if (createErr || !newCart) {
        console.error('Failed to create cart record:', createErr);
        return;
      }
      cart = newCart;
    }

    if (quantity <= 0) {
      // Remove item from DB cart
      await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id)
        .eq('product_id', productId);
    } else {
      // Upsert item in DB cart
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cart.id)
        .eq('product_id', productId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('cart_items')
          .update({
            quantity,
            price,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('cart_items')
          .insert({
            cart_id: cart.id,
            product_id: productId,
            quantity,
            price,
          });
      }
    }
  } catch (err) {
    console.error('Error syncing cart item to DB:', err);
  }
}

/**
 * Bulk merges guest cart items from localStorage into DB upon user login
 */
export async function mergeGuestCartToDb(userId: string, guestItems: CartItem[]): Promise<void> {
  if (guestItems.length === 0) return;

  try {
    let { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!cart) {
      const { data: newCart } = await supabase
        .from('carts')
        .insert({ user_id: userId })
        .select('id')
        .single();
      if (!newCart) return;
      cart = newCart;
    }

    for (const item of guestItems) {
      const pId = item.product.id;
      const price = item.product.price;

      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cart.id)
        .eq('product_id', pId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('cart_items')
          .update({
            quantity: existing.quantity + item.quantity,
            price,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('cart_items')
          .insert({
            cart_id: cart.id,
            product_id: pId,
            quantity: item.quantity,
            price,
          });
      }
    }
  } catch (err) {
    console.error('Error merging guest cart to DB:', err);
  }
}
