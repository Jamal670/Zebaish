import React, { useState, useEffect } from 'react';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight } from 'lucide-react';
import { CartItem, Product } from '@/types';
import { getItemAvailableStock } from '@/src/utils/stockUtils';
import supabase from '@/src/api/client';

interface CartPageProps {
  cartItems: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number, size?: string) => void;
  onRemoveItem: (productId: string, size?: string) => void;
  onProceedToCheckout: () => void;
  onNavigateHome: () => void;
}

export const CartPage: React.FC<CartPageProps> = ({
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
  onNavigateHome,
}) => {
  const [promoCode, setPromoCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [adjustedNotices, setAdjustedNotices] = useState<Record<string, string>>({});
  const [freshProducts, setFreshProducts] = useState<Record<string, Product>>({});

  // Re-validate cart items against fresh DB stock whenever cart items change
  useEffect(() => {
    if (!cartItems || cartItems.length === 0) return;

    const productIds = Array.from(new Set(cartItems.map((i) => i.product.id)));
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

        cartItems.forEach((item) => {
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
        console.error('Error syncing fresh stock in CartPage:', err);
      }
    }

    syncFreshStock();

    return () => {
      isCancelled = true;
    };
  }, [cartItems.length]);

  const getLatestProductForItem = (item: CartItem): Product => {
    const dbProd = freshProducts[item.product.id];
    if (!dbProd) return item.product;
    return {
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
    };
  };

  const handleQuantityChange = (item: CartItem, newQty: number) => {
    const latestProduct = getLatestProductForItem(item);
    const maxStock = getItemAvailableStock(latestProduct, item.size);
    const itemKey = `${item.product.id}-${item.size || 'Unstitched'}`;

    if (maxStock <= 0) {
      setAdjustedNotices((prev) => ({ ...prev, [itemKey]: 'Item is currently out of stock' }));
      return;
    }

    const clampedQty = Math.max(1, Math.min(maxStock, newQty));
    if (newQty > maxStock) {
      setAdjustedNotices((prev) => ({
        ...prev,
        [itemKey]: `Only ${maxStock} item${maxStock > 1 ? 's' : ''} available in stock`,
      }));
    } else {
      setAdjustedNotices((prev) => {
        const next = { ...prev };
        delete next[itemKey];
        return next;
      });
    }

    if (clampedQty !== item.quantity) {
      onUpdateQuantity(item.product.id, clampedQty, item.size);
    }
  };

  const subtotal = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const shippingFee = subtotal > 150 ? 0 : 15;
  const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoCode.trim().toUpperCase() === 'ZEBAISH10') {
      const disc = Math.round(subtotal * 0.1);
      setDiscountAmount(disc);
      setPromoMessage('Promo code ZEBAISH10 applied! 10% Extra Discount');
    } else {
      setPromoMessage('Invalid promo code. Try "ZEBAISH10"');
    }
  };

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <h1 className="text-lg sm:text-2xl lg:text-2xl font-extrabold text-stone-900 tracking-tight mb-8">
          YOUR SHOPPING BAG ({cartItems.reduce((a, b) => a + b.quantity, 0)})
        </h1>

        {cartItems.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-lg p-12 text-center my-8">
            <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <h2 className="text-base sm:text-lg lg:text-xl font-bold text-stone-900 uppercase tracking-wider">
              YOUR BAG IS CURRENTLY EMPTY
            </h2>
            <p className="text-[10px] sm:text-xs lg:text-sm text-stone-500 mt-1 max-w-sm mx-auto">
              Browse leftover branded suits from top Pakistani designers at unbeatable surplus prices.
            </p>
            <button
              onClick={onNavigateHome}
              className="mt-6 inline-block bg-stone-900 text-white text-2xs sm:text-xs lg:text-sm font-bold px-6 py-3 rounded-xs uppercase tracking-wider hover:bg-black transition-colors"
            >
              EXPLORE LEFTOVER CATALOG
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Items List (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {cartItems.map((item) => {
                const latestProduct = getLatestProductForItem(item);
                const maxStock = getItemAvailableStock(latestProduct, item.size);
                const isOutOfStock = maxStock <= 0;
                const itemKey = `${item.product.id}-${item.size || 'Unstitched'}`;
                const notice = adjustedNotices[itemKey];

                return (
                  <div
                    key={`${item.product.id}-${item.size}`}
                    className="bg-white border border-stone-200 rounded-lg p-4 sm:p-5 flex gap-4 sm:gap-6 shadow-2xs transition-all hover:border-stone-300"
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.title}
                      className="w-20 h-28 sm:w-24 sm:h-32 object-cover object-top rounded-xs border border-stone-100 shrink-0"
                    />

                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block">
                              {item.product.brand} • {item.product.stitchingStatus || 'Unstitched'}
                            </span>
                            <h3 className="text-xs sm:text-sm font-semibold text-stone-900 line-clamp-2">
                              {item.product.title}
                            </h3>
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-stone-900">
                            {item.product.currency} {(item.product.price * item.quantity).toLocaleString()}
                          </p>
                        </div>

                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-stone-500">
                          <span>Option: <strong className="text-stone-800">{item.size || 'Unstitched'}</strong></span>
                          <span>•</span>
                          <span>Seller: <strong className="text-stone-800">{item.product.resellerName || 'Verified Reseller'}</strong></span>
                        </div>

                        {notice && (
                          <p className="text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-xs mt-1.5 border border-amber-200 inline-block">
                            {notice}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                        {/* Quantity Stepper */}
                        <div className="flex items-center border border-stone-300 rounded-xs bg-white">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item, item.quantity - 1)}
                            disabled={item.quantity <= 1 || isOutOfStock}
                            className="p-1.5 text-stone-600 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
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
                            className="w-10 text-center text-xs font-bold focus:outline-none disabled:bg-stone-100 disabled:text-stone-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item, item.quantity + 1)}
                            disabled={item.quantity >= maxStock || isOutOfStock}
                            className="p-1.5 text-stone-600 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={item.quantity >= maxStock ? `Maximum stock reached (${maxStock})` : 'Increase quantity'}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => onRemoveItem(item.product.id, item.size)}
                          className="text-stone-400 hover:text-red-600 p-1 transition-colors flex items-center space-x-1 text-xs cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Summary Box (4 cols) */}
            <div className="lg:col-span-4">
              <div className="bg-white border border-stone-200 rounded-lg p-6 shadow-sm sticky top-24 space-y-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-stone-900 pb-3 border-b border-stone-200">
                  ORDER SUMMARY
                </h2>

                {/* Promo Code Form */}
                <form onSubmit={handleApplyPromo} className="space-y-2">
                  <label className="text-xs font-semibold text-stone-700 block">
                    Promo Code / Voucher
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="ZEBAISH10"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="flex-1 px-3 py-2 border border-stone-300 rounded-xs text-xs focus:outline-none focus:border-stone-900 uppercase"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-stone-900 text-white rounded-xs text-xs font-bold uppercase hover:bg-black transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  {promoMessage && (
                    <p className={`text-[11px] font-medium ${discountAmount > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {promoMessage}
                    </p>
                  )}
                </form>

                {/* Calculations */}
                <div className="space-y-2.5 text-xs border-t border-b border-stone-200 py-4">
                  <div className="flex justify-between text-stone-600">
                    <span>Bag Subtotal</span>
                    <span className="font-semibold text-stone-900">
                      Rs. {subtotal.toLocaleString()}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Promo Discount</span>
                      <span>- Rs. {discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-600">
                    <span>Shipping Fee</span>
                    <span>{shippingFee === 0 ? <strong className="text-emerald-700">FREE</strong> : `Rs. ${shippingFee}`}</span>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="flex justify-between items-baseline text-stone-900 font-extrabold text-base">
                  <span>Grand Total</span>
                  <span>Rs. {grandTotal.toLocaleString()}</span>
                </div>

                {/* Checkout CTA Button */}
                <button
                  onClick={onProceedToCheckout}
                  className="w-full py-3.5 bg-stone-900 hover:bg-black text-white rounded-xs text-xs font-bold uppercase tracking-widest shadow-md flex items-center justify-center space-x-2 transition-all transform active:scale-95"
                >
                  <span>PROCEED TO CHECKOUT</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
