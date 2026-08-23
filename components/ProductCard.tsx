import React from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@/types';
import { Eye, ShoppingBag, Heart, Star, Store } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onToggleWishlist?: (productId: string) => void;
  isWishlisted?: boolean;
  onSelectProduct?: (product: Product) => void;
  onSelectReseller?: (resellerId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onQuickView,
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
  onSelectProduct,
  onSelectReseller,
}) => {
  const router = useRouter();

  const handleClick = () => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else {
      router.push(`/product/${product.id}`);
    }
  };

  const hasDiscount = Boolean(product.originalPrice && product.originalPrice > product.price);

  // Compute clean single badge logic to prevent cluttered overlapping badges
  const getCleanBadge = () => {
    if (hasDiscount) {
      const percentage = product.discountPercentage
        ? product.discountPercentage
        : Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100);
      return {
        label: `${percentage}% OFF`,
        isDiscount: true,
      };
    }

    if (product.badge) {
      // If badge string is just discount info like "35% OFF" or "LEFTOVER 36% OFF", filter out duplicates
      if (/OFF|%/i.test(product.badge)) {
        return null;
      }
      return {
        label: product.badge,
        isDiscount: false,
      };
    }

    return null;
  };

  const badge = getCleanBadge();

  const productRating = product.average_rating ?? product.averageRating ?? product.resellerRating;
  const ratingToDisplay = productRating !== undefined && productRating !== null
    ? (Number(productRating) || 0).toFixed(1)
    : '0.0';
  const reviewCount = product.review_count ?? product.reviewCount;

  return (
    <div className="group/card flex flex-col h-full bg-white rounded-xl overflow-hidden border border-stone-100 hover:border-stone-300 hover:shadow-md transition-all duration-300">
      {/* Image Container */}
      <div
        onClick={handleClick}
        className="relative aspect-[3/4] bg-stone-100 overflow-hidden cursor-pointer"
      >
        <img
          src={typeof product.image === 'string' ? product.image : (product.image as any).src}
          alt={product.title}
          className="w-full h-full object-cover object-top transition-transform duration-700 group-hover/card:scale-105"
        />

        {product.hoverImage && (
          <img
            src={typeof product.hoverImage === 'string' ? product.hoverImage : (product.hoverImage as any).src}
            alt={`${product.title} detail`}
            className="absolute inset-0 w-full h-full object-cover object-top opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"
          />
        )}

        {/* Single Clean Badge Pill - Top Left */}
        {badge && (
          <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10">
            <span
              className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-2xs ${badge.isDiscount
                  ? 'bg-red-600 text-white'
                  : 'bg-stone-900/90 text-white backdrop-blur-xs'
                }`}
            >
              {badge.label}
            </span>
          </div>
        )}

        {/* Wishlist Button - Top Right */}
        {onToggleWishlist && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(product.id);
            }}
            aria-label="Toggle Wishlist"
            className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-10 p-1.5 sm:p-2 rounded-full bg-white/80 hover:bg-white text-stone-700 hover:text-red-600 shadow-2xs transition-all hover:scale-110 active:scale-95 backdrop-blur-xs"
          >
            <Heart
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isWishlisted ? 'fill-red-600 text-red-600' : ''
                }`}
            />
          </button>
        )}

        {/* Desktop Hover Actions Overlay */}
        <div className="hidden md:flex absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/75 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 items-center justify-center space-x-2">
          {onQuickView && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(product);
              }}
              className="flex-1 py-1.5 bg-white/95 hover:bg-white text-stone-900 text-[11px] font-semibold uppercase tracking-wider rounded-xs flex items-center justify-center space-x-1 shadow-2xs transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Quick View</span>
            </button>
          )}

          {onAddToCart && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product);
              }}
              className="p-1.5 bg-stone-900 hover:bg-black text-white rounded-xs shadow-2xs transition-colors"
              title="Add to Bag"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Quick Add Floating Icon (Bottom Right) */}
        {onAddToCart && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            className="md:hidden absolute bottom-2 right-2 z-10 p-2 rounded-full bg-stone-900/90 text-white shadow-md active:scale-95 transition-transform"
            title="Add to Bag"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Product Meta Info */}
      <div className="p-2.5 sm:p-3.5 flex flex-col justify-between flex-1 bg-white">
        <div>
          {/* Brand & Stitching status in single line */}
          <div className="flex items-center justify-between gap-1 mb-1">
            {product.brand && (
              <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-stone-900 uppercase truncate">
                {product.brand}
              </span>
            )}
            {product.stitchingStatus && (
              <span className="text-[9px] sm:text-[10px] font-medium text-stone-400 uppercase tracking-wide shrink-0">
                {product.stitchingStatus}
              </span>
            )}
          </div>

          <h3
            onClick={handleClick}
            className="text-xs sm:text-sm font-normal text-stone-800 line-clamp-1 sm:line-clamp-2 hover:text-black cursor-pointer transition-colors leading-snug"
          >
            {product.title}
          </h3>
        </div>

        {/* Price & Seller */}
        <div className="mt-2 pt-2 border-t border-stone-100 flex flex-col space-y-1">
          <div className="flex items-baseline space-x-1.5">
            <p className="text-xs sm:text-sm font-bold text-stone-900 tracking-tight">
              {product.currency} {product.price.toLocaleString()}
            </p>
            {hasDiscount && (
              <p className="text-[10px] sm:text-[11px] text-stone-400 font-normal line-through">
                {product.currency} {product.originalPrice?.toLocaleString()}
              </p>
            )}
          </div>

          {/* Reseller Info & Product Rating Footer */}
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-stone-400 pt-0.5">
            {product.resellerName ? (
              <div
                onClick={(e) => {
                  if (product.resellerId) {
                    e.stopPropagation();
                    if (onSelectReseller) {
                      onSelectReseller(product.resellerId);
                    } else {
                      router.push(`/store/${product.resellerId}`);
                    }
                  }
                }}
                className="flex items-center space-x-1 truncate max-w-[120px] sm:max-w-[150px] hover:text-stone-900 cursor-pointer group/reseller"
              >
                <Store className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-stone-400 group-hover/reseller:text-stone-800 shrink-0" />
                <span className="truncate group-hover/reseller:underline font-normal text-stone-500">{product.resellerName}</span>
              </div>
            ) : <div />}

            <div className="flex items-center space-x-0.5 text-amber-600 font-semibold text-[9px] sm:text-[10px] shrink-0 ml-auto">
              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
              <span>{ratingToDisplay}</span>
              {reviewCount !== undefined && reviewCount !== null && reviewCount > 0 && (
                <span className="text-stone-400 font-normal text-[9px] sm:text-[10px] ml-0.5">
                  ({reviewCount})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

