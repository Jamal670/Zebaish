import { Product } from '@/types';

/**
 * Single source of truth helper for calculating available stock for a product item
 * (handles variant-based stock and simple product stock).
 */
export function getItemAvailableStock(product: Product, size?: string): number {
  if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
    const currentVariant = product.category === 'Unstitched'
      ? product.variants.find((v) => v.size === 'Unstitched')
      : product.variants.find((v) => v.size?.toLowerCase() === size?.toLowerCase());

    if (currentVariant) {
      return Math.max(0, Number(currentVariant.quantity) || 0);
    }
  }
  return Math.max(0, Number(product.quantity) || 0);
}
