import React, { useState, useEffect } from 'react';
import { CartItem, Product } from '@/types';
import { X, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import { getItemAvailableStock } from '@/src/utils/stockUtils';
import supabase from '@/src/api/client';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number, size?: string) => void;
  onRemoveItem: (productId: string, size?: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const [adjustedNotices, setAdjustedNotices] = useState<Record<string, string>>({});
  const [freshProducts, setFreshProducts] = useState<Record<string, Product>>({});

  // Re-validate cart items against fresh DB stock whenever the drawer opens
  useEffect(() => {
    if (!isOpen || !items || items.length === 0) return;

    const productIds = Array.from(new Set(items.map((i) => i.product.id)));
    let isCancelled = false;

    async function syncFreshStock() {
      try {
        const { data: dbProducts } = await supabase
          .from('products')
          .select(`
            id,
            quantity,
            category,
            product_variants (
              id,
              size,
              quantity
            )
          `)
          .in('id', productIds);

        if (isCancelled) return;

        const freshMap: Record<string, Product> = {};
        if (dbProducts && dbProducts.length > 0) {
          dbProducts.forEach((p: any) => {
            freshMap[p.id] = p;
          });
          setFreshProducts(freshMap);
        }

        const newNotices: Record<string, string> = {};

        items.forEach((item) => {
          const dbProd = freshMap[item.product.id];
          const latestProduct: Product = dbProd
            ? {
              ...item.product,
              quantity: Number(dbProd.quantity) || 0,
              category: dbProd.category || item.product.category,
              variants: Array.isArray((dbProd as any).product_variants)
                ? (dbProd as any).product_variants.map((v: any) => ({
                  id: v.id,
                  size: v.size,
                  quantity: Number(v.quantity) || 0,
                }))
                : item.product.variants,
            }
            : item.product;

          const maxStock = getItemAvailableStock(latestProduct, item.size);
          const itemKey = `${item.product.id}-${item.size || 'Unstitched'}`;

          if (maxStock > 0 && item.quantity > maxStock) {
            onUpdateQuantity(item.product.id, maxStock, item.size);
            newNotices[itemKey] = `Quantity adjusted to available stock: ${maxStock}`;
          } else if (maxStock === 0 && item.quantity > 0) {
            newNotices[itemKey] = `Item is currently out of stock`;
          }
        });

        setAdjustedNotices((prev) => ({ ...prev, ...newNotices }));
      } catch (err) {
        console.error('Error syncing fresh stock in CartDrawer:', err);
      }
    }

    syncFreshStock();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, items.length]);

  if (!isOpen) return null;

  const handleQuantityChange = (item: CartItem, newQty: number) => {
    const freshProd = freshProducts[item.product.id];
    const latestProduct: Product = freshProd
      ? {
        ...item.product,
        quantity: Number(freshProd.quantity) || 0,
        category: freshProd.category || item.product.category,
        variants: Array.isArray((freshProd as any).product_variants)
          ? (freshProd as any).product_variants.map((v: any) => ({
            id: v.id,
            size: v.size,
            quantity: Number(v.quantity) || 0,
          }))
          : item.product.variants,
      }
      : item.product;

    const maxStock = getItemAvailableStock(latestProduct, item.size);
    if (maxStock <= 0) return;

    // Clamp value between 1 and maxStock
    const clampedQty = Math.max(1, Math.min(maxStock, newQty));
    if (clampedQty !== item.quantity) {
      onUpdateQuantity(item.product.id, clampedQty, item.size);
    }
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const freeShippingThreshold = 300;
  const freeShippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 text-stone-800">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-stone-900" />
            <h2 className="font-brand-serif text-lg font-semibold text-stone-900 uppercase tracking-wide">
              Your Shopping Bag ({items.reduce((acc, i) => acc + i.quantity, 0)})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-500 hover:text-black rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-stone-400 space-y-3 my-12">
              <ShoppingBag className="w-12 h-12 stroke-[1]" />
              <p className="text-sm font-medium text-stone-600">Your shopping bag is empty.</p>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2 bg-black text-white text-xs font-semibold uppercase tracking-wider rounded-sm hover:bg-stone-800 transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            items.map((item) => {
              const itemKey = `${item.product.id}-${item.size || 'Unstitched'}`;
              const freshProd = freshProducts[item.product.id];
              const latestProduct: Product = freshProd
                ? {
                  ...item.product,
                  quantity: Number(freshProd.quantity) || 0,
                  category: freshProd.category || item.product.category,
                  variants: Array.isArray((freshProd as any).product_variants)
                    ? (freshProd as any).product_variants.map((v: any) => ({
                      id: v.id,
                      size: v.size,
                      quantity: Number(v.quantity) || 0,
                    }))
                    : item.product.variants,
                }
                : item.product;

              const maxStock = getItemAvailableStock(latestProduct, item.size);
              const isOutOfStock = maxStock === 0;
              const notice = adjustedNotices[itemKey];

              return (
                <div
                  key={itemKey}
                  className="flex space-x-4 border-b border-stone-100 pb-4"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.title}
                    className="w-20 h-24 object-cover object-top rounded-md bg-stone-100 shrink-0"
                  />
                  <div className="flex-1 flex flex-col justify-between text-xs">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium text-stone-900 line-clamp-1">
                          {item.product.title}
                        </h3>
                        <button
                          onClick={() => onRemoveItem(item.product.id, item.size)}
                          className="text-stone-400 hover:text-red-600 transition-colors p-0.5"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-stone-500 mt-0.5">
                        {item.product.fabric && <span>Fabric: {item.product.fabric}</span>}
                        <span>Option: <strong className="text-stone-800">{item.size || 'Unstitched'}</strong></span>
                        {maxStock > 0 && maxStock <= 3 && (
                          <span className="text-amber-600 font-semibold">
                            (Only {maxStock} left)
                          </span>
                        )}
                        {isOutOfStock && (
                          <span className="text-red-600 font-bold">
                            (Out of Stock)
                          </span>
                        )}
                      </div>

                      {notice && (
                        <p className="text-[10px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded-xs mt-1 border border-amber-200">
                          {notice}
                        </p>
                      )}

                      <p className="font-semibold text-stone-900 mt-1">
                        {item.product.currency} {item.product.price}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center space-x-2 mt-2">
                      <div className="flex items-center border border-stone-300 rounded-sm bg-white">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item, item.quantity - 1)}
                          disabled={item.quantity <= 1 || isOutOfStock}
                          className="p-1 hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <input
                          type="number"
                          min={1}
                          max={maxStock || 1}
                          value={item.quantity}
                          disabled={isOutOfStock}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) {
                              handleQuantityChange(item, val);
                            }
                          }}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (isNaN(val) || val < 1) {
                              handleQuantityChange(item, 1);
                            } else if (val > maxStock && maxStock > 0) {
                              handleQuantityChange(item, maxStock);
                            }
                          }}
                          className="w-8 text-center text-xs font-semibold focus:outline-none disabled:bg-stone-100 disabled:text-stone-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />

                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item, item.quantity + 1)}
                          disabled={item.quantity >= maxStock || isOutOfStock}
                          className="p-1 hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title={item.quantity >= maxStock ? `Maximum stock reached (${maxStock})` : 'Increase quantity'}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Subtotal & Checkout */}
        {items.length > 0 && (
          <div className="p-5 border-t border-stone-200 bg-stone-50 space-y-3">
            <div className="flex justify-between items-center text-sm font-semibold text-stone-900">
              <span>Subtotal</span>
              <span>Rs. {subtotal.toLocaleString()}</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Taxes and shipping calculated at checkout.
            </p>
            <div className="space-y-2">
              <button
                onClick={onCheckout}
                className="w-full py-3.5 bg-black hover:bg-stone-800 text-white font-semibold text-xs uppercase tracking-widest rounded-sm transition-colors shadow-md"
              >
                PROCEED TO CHECKOUT
              </button>
              <button
                onClick={() => {
                  onClose();
                  if (typeof window !== 'undefined') {
                    window.location.href = '/cart';
                  }
                }}
                className="w-full py-2.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-900 font-semibold text-xs uppercase tracking-widest rounded-sm transition-colors"
              >
                VIEW CART
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
