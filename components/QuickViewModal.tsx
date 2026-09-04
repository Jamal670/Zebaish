import React, { useState } from 'react';
import { Product } from '@/types';
import { X, ShoppingBag, Heart, Check, ShieldCheck, Truck } from 'lucide-react';

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, size: string, quantity: number) => void;
  onToggleWishlist: (productId: string) => void;
  isWishlisted: boolean;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
}) => {
  if (!product) return null;

  const [selectedSize, setSelectedSize] = useState('Unstitched');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const sizes = ['Unstitched', 'Small', 'Medium', 'Large', 'Custom Stitching'];

  const handleAdd = () => {
    onAddToCart(product, selectedSize, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl bg-white shadow-2xl rounded-lg overflow-hidden z-10 text-stone-900 border border-stone-200 my-8 max-h-[90vh] flex flex-col md:flex-row">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-1.5 text-stone-500 hover:text-black bg-white/80 hover:bg-white rounded-full transition-colors shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Product Image */}
        <div className="md:w-1/2 bg-stone-100 h-[320px] md:h-auto relative overflow-hidden shrink-0">
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover object-top"
          />
          {product.badge && (
            <span className="absolute top-4 left-4 bg-black text-white text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1">
              {product.badge}
            </span>
          )}
        </div>

        {/* Product Details Column */}
        <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-stone-400 block mb-1">
              MARIA.B. {product.category}
            </span>
            <h2 className="font-brand-serif text-lg sm:text-xl lg:text-2xl font-normal text-stone-900 mb-2">
              {product.title}
            </h2>
            <p className="text-base sm:text-lg lg:text-xl font-semibold text-stone-900 mb-4">
              {product.currency} {product.price.toLocaleString()}
            </p>

            <p className="text-[10px] sm:text-xs lg:text-sm text-stone-600 leading-relaxed mb-6 font-light">
              {product.description ||
                'High quality authentic MARIA.B. creation featuring intricate resham and tilla embroidery with silk organza dupatta and embroidered borders.'}
            </p>

            {/* Fabric Tag */}
            {product.fabric && (
              <div className="mb-6 pb-4 border-b border-stone-100 text-[10px] sm:text-xs">
                <span className="text-stone-400 font-medium mr-2">Fabric:</span>
                <span className="text-stone-800 font-semibold">{product.fabric}</span>
              </div>
            )}

            {/* Size Selector */}
            <div className="mb-6">
              <label className="text-[10px] sm:text-xs font-semibold text-stone-800 uppercase tracking-wider block mb-2">
                Select Option / Size:
              </label>
              <div className="flex flex-wrap gap-2">
                {sizes.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={`px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded-xs border transition-all ${selectedSize === sz
                        ? 'border-black bg-black text-white'
                        : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
                      }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4 border-t border-stone-100">
            <div className="flex space-x-3">
              <button
                onClick={handleAdd}
                className={`flex-1 py-3.5 px-4 font-semibold text-2xs sm:text-xs lg:text-sm uppercase tracking-widest rounded-sm transition-all flex items-center justify-center space-x-2 shadow-sm ${added
                    ? 'bg-emerald-700 text-white'
                    : 'bg-black hover:bg-stone-800 text-white'
                  }`}
              >
                {added ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Bag</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add to Shopping Bag</span>
                  </>
                )}
              </button>

              <button
                onClick={() => onToggleWishlist(product.id)}
                className={`p-3.5 border rounded-sm transition-colors ${isWishlisted
                    ? 'border-red-600 bg-red-50 text-red-600'
                    : 'border-stone-300 hover:border-stone-900 text-stone-700'
                  }`}
              >
                <Heart
                  className={`w-4 h-4 ${isWishlisted ? 'fill-red-600' : ''}`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-500 pt-2">
              <span className="flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Guaranteed Authentic</span>
              </span>
              <span className="flex items-center space-x-1">
                <Truck className="w-3.5 h-3.5 text-stone-600" />
                <span>Worldwide Express Shipping</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
