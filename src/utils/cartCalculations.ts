import { CartItem } from '@/types';

export interface CartTotalsResult {
  subtotal: number;
  shippingTotal: number;
  grandTotal: number;
  sellerIds: string[];
}

/**
 * Extracts normalized seller ID from a cart item using all available paths,
 * including item.seller_id, product properties, and an optional fallback map.
 */
export function getCartItemSellerId(
  item: CartItem,
  fallbackMap: Record<string, string> = {}
): string | undefined {
  return (
    item.seller_id ||
    item.product.resellerId ||
    (item.product as any).seller_id ||
    (item.product as any).sellerId ||
    (item.product.seller as any)?.id ||
    fallbackMap[item.product.id] ||
    undefined
  );
}

/**
 * Extracts unique, sorted seller IDs from cart items.
 */
export function getUniqueSellerIds(
  items: CartItem[],
  fallbackMap: Record<string, string> = {}
): string[] {
  if (!items || items.length === 0) return [];
  const set = new Set<string>();
  items.forEach((item) => {
    const sId = getCartItemSellerId(item, fallbackMap);
    if (sId) {
      set.add(sId);
    }
  });
  return Array.from(set).sort();
}

/**
 * Computes subtotal, unique seller shipping total, and grand total.
 * Each unique seller currently present in the cart has their shipping fee counted exactly once.
 * Missing/null/NaN shipping amounts are safely treated as 0 without throwing.
 */
export function calculateCartTotals(
  items: CartItem[],
  shippingMap: Record<string, number> = {},
  fallbackMap: Record<string, string> = {},
  discountAmount: number = 0
): CartTotalsResult {
  if (!items || items.length === 0) {
    return { subtotal: 0, shippingTotal: 0, grandTotal: 0, sellerIds: [] };
  }

  // 1. Subtotal = Σ price × quantity (rounded to 2 decimal places)
  const subtotal = Math.round(
    items.reduce((sum, item) => sum + (Number(item.product.price) || 0) * (Number(item.quantity) || 1), 0) * 100
  ) / 100;

  // 2. Extract seller IDs of items currently in the cart
  const sellerIds = getUniqueSellerIds(items, fallbackMap);

  // 3. Shipping total: Σ over sellerIds currently in the cart of shippingMap[sellerId] ?? 0
  const shippingTotal = sellerIds.reduce((sum, sId) => {
    const rawFee = Number(shippingMap[sId]);
    const fee = isNaN(rawFee) ? 0 : Math.max(0, rawFee);
    return sum + fee;
  }, 0);

  const grandTotal = Math.max(0, subtotal - discountAmount + shippingTotal);

  return {
    subtotal,
    shippingTotal,
    grandTotal,
    sellerIds,
  };
}
