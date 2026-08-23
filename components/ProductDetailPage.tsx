import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronRight,
  Heart,
  ShoppingBag,
  Truck,
  ShieldCheck,
  RotateCcw,
  Plus,
  Minus,
  Maximize2,
  Star,
  Store,
  Check,
  Clock,
  ExternalLink
} from 'lucide-react';
import { ProductCard } from './ProductCard';
import { Product, Review } from '@/types';
import { ALL_PRODUCTS, MOCK_REVIEWS } from '@/data/mockData';
import supabase from '@/src/api/client';
import { getItemAvailableStock } from '@/src/utils/stockUtils';

export { getItemAvailableStock };

interface ProductDetailPageProps {
  product: Product;
  reviews?: Review[];
  relatedProducts?: Product[];
  onAddToCart: (product: Product, size?: string, quantity?: number) => void;
  onToggleWishlist: (productId: string) => void;
  isWishlisted: boolean;
  onSelectProduct: (product: Product) => void;
  onSelectReseller?: (resellerId: string) => void;
  onNavigateHome: () => void;
  onNavigateCollection: () => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  reviews = [],
  relatedProducts: propRelatedProducts,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
  onSelectProduct,
  onSelectReseller,
  onNavigateHome,
  onNavigateCollection,
}) => {
  if (!product || !product.id) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-stone-50">
        <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 mb-2">This product is no longer available.</h2>
        <p className="text-xs text-stone-500 mb-6 max-w-md">The product you are looking for does not exist or has been removed by the seller.</p>
        <button
          onClick={onNavigateCollection || onNavigateHome}
          className="px-6 py-2.5 bg-stone-900 text-white rounded-xs text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors"
        >
          Back to Shop
        </button>
      </div>
    );
  }

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>(() => {
    if (product.variants && Array.isArray(product.variants)) {
      const avail = product.variants.find((v) => Number(v.quantity) > 0 && v.size !== 'Unstitched');
      if (avail?.size) return avail.size;
    }
    return 'Small';
  });
  const [quantity, setQuantity] = useState(1);
  const [openAccordion, setOpenAccordion] = useState<string | null>('description');
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [addedToast, setAddedToast] = useState(false);

  // Dynamic Seller Data state (fetching store_image_url, shop_name, status from sellers table)
  const [sellerData, setSellerData] = useState<{
    store_image_url?: string | null;
    shop_name?: string | null;
    status?: string | null;
  } | null>(() => {
    if (product.seller) return product.seller;
    if (product.resellerName || product.sellerStoreImageUrl || product.sellerStatus) {
      return {
        store_image_url: product.sellerStoreImageUrl || null,
        shop_name: product.resellerName || null,
        status: product.sellerStatus || null,
      };
    }
    return null;
  });

  const [sellerLoading, setSellerLoading] = useState<boolean>(() => {
    if (product.seller || product.sellerStoreImageUrl !== undefined || product.sellerStatus !== undefined) return false;
    return Boolean(product.resellerId);
  });

  const [sellerFetchFailed, setSellerFetchFailed] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  useEffect(() => {
    setImgError(false);

    if (product.seller) {
      setSellerData(product.seller);
      setSellerLoading(false);
      setSellerFetchFailed(false);
      return;
    }

    if (product.sellerStoreImageUrl !== undefined || product.sellerStatus !== undefined) {
      setSellerData({
        store_image_url: product.sellerStoreImageUrl || null,
        shop_name: product.resellerName || null,
        status: product.sellerStatus || null,
      });
      setSellerLoading(false);
      setSellerFetchFailed(false);
      return;
    }

    const sellerId = product.resellerId;
    if (!sellerId) {
      setSellerData(null);
      setSellerLoading(false);
      setSellerFetchFailed(true);
      return;
    }

    let isCancelled = false;
    setSellerLoading(true);

    async function fetchSellerDetails() {
      try {
        const { data, error } = await supabase
          .from('sellers')
          .select('store_image_url, shop_name, status')
          .eq('id', sellerId)
          .maybeSingle();

        if (isCancelled) return;

        if (error || !data) {
          setSellerData(null);
          setSellerFetchFailed(true);
        } else {
          setSellerData({
            store_image_url: data.store_image_url,
            shop_name: data.shop_name,
            status: data.status,
          });
          setSellerFetchFailed(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setSellerData(null);
          setSellerFetchFailed(true);
        }
      } finally {
        if (!isCancelled) {
          setSellerLoading(false);
        }
      }
    }

    fetchSellerDetails();

    return () => {
      isCancelled = true;
    };
  }, [product.id, product.resellerId, product.seller, product.sellerStoreImageUrl, product.sellerStatus, product.resellerName]);

  // Gallery images with multi-image support
  const galleryImages = [
    product.image,
    ...(product.additionalImages || []),
    product.hoverImage,
  ].filter((img, idx, self): img is string => Boolean(img) && self.indexOf(img) === idx);

  // Real product reviews passed from 2nd query (no mock data fallback)
  const productReviews = reviews;

  // Compute available stock for current selected variant or Unstitched product
  const currentVariant = product.category === 'Unstitched'
    ? product.variants?.find((v) => v.size === 'Unstitched')
    : product.variants?.find((v) => v.size?.toLowerCase() === selectedSize?.toLowerCase());
  const availableStock = currentVariant ? Math.max(0, Number(currentVariant.quantity) || 0) : (product.quantity || 0);
  const maxSelectableQty = Math.max(1, availableStock);

  const handleAddToCartClick = () => {
    const finalSize = product.category === 'Unstitched' ? 'Unstitched' : selectedSize;
    const finalQty = Math.min(maxSelectableQty, quantity);
    onAddToCart(product, finalSize, finalQty);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 3000);
  };

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  const relatedProducts =
    propRelatedProducts && propRelatedProducts.length > 0
      ? propRelatedProducts
      : ALL_PRODUCTS.filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <div className="bg-white min-h-screen text-stone-900 pb-20 animate-fade-in">
      {/* 1. Breadcrumb Bar */}
      

      {/* Main PDP Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 md:pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* LEFT COLUMN: Gallery & Images (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col-reverse sm:flex-row gap-4">
            {/* Thumbnails Sidebar */}
            <div className="flex sm:flex-col gap-3 overflow-x-auto sm:overflow-y-auto max-h-[560px] no-scrollbar shrink-0">
              {galleryImages.map((imgUrl, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative w-16 h-20 sm:w-20 sm:h-26 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${selectedImageIndex === idx
                    ? 'border-stone-900 ring-2 ring-stone-900 ring-offset-1'
                    : 'border-stone-200 opacity-70 hover:opacity-100'
                    }`}
                >
                  <img src={imgUrl} alt="Thumbnail view" className="w-full h-full object-cover object-top" />
                </button>
              ))}
            </div>

            {/* Main Stage Image Viewer */}
            <div className="relative flex-1 bg-stone-100 rounded-xl overflow-hidden aspect-[3/4] group">
              <img
                src={galleryImages[selectedImageIndex]}
                alt={product.title}
                className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
              />

              {/* Badge Overlay */}
              <div className="absolute top-4 left-4 z-10 flex flex-col space-y-1.5">
                <span className="bg-black/90 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-xs backdrop-blur-xs">
                  {product.brand}
                </span>
                <span className="bg-red-600 text-white text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-xs shadow-sm">
                  LEFTOVER — LIMITED QUANTITY
                </span>
              </div>

              {/* Zoom Button */}
              <button
                onClick={() => setIsZoomOpen(true)}
                className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-white text-stone-800 rounded-full shadow-sm transition-all"
                title="Fullscreen Zoom"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Product Details & Buy Box (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-start">
            {/* Brand Name & Collection / Season Label */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-[0.2em] text-stone-500 uppercase">
                {product.brand} • {product.season || 'End-of-Season Surplus'}
              </span>
              {/* <span className="text-[11px] font-mono text-stone-500 uppercase">
                SKU: {product.brand.slice(0, 2).toUpperCase()}-LEFTOVER-{product.id.slice(-4)}
              </span> */}
            </div>

            {/* Product Title */}
            <h1 className="font-brand-serif text-2xl sm:text-3xl font-normal text-stone-900 leading-tight mb-3">
              {product.title}
            </h1>

            {/* Price Box with Strikethrough & Discount Pill */}
            <div className="flex items-baseline space-x-3 mb-4">
              <span className="text-2xl font-extrabold text-stone-900">
                Rs. {product?.price?.toLocaleString()}
              </span>
              {product?.originalPrice && (
                <span className="text-sm text-stone-400 line-through">
                  Rs. {product?.originalPrice?.toLocaleString()}
                </span>
              )}
            </div>

            {/* Stock Indicator
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800 mb-6 bg-emerald-50 p-2.5 rounded-xs border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Leftover Stock Verified — Dispatches within 24 Hours</span>
            </div> */}

            {/* Reseller Info Card */}
            {sellerLoading ? (
              <div className="mb-6 p-4 rounded-lg border border-stone-200 bg-stone-50/80 flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-stone-200 shrink-0" />
                  <div className="space-y-2">
                    <div className="h-3.5 w-32 bg-stone-200 rounded" />
                    <div className="h-3 w-24 bg-stone-200 rounded" />
                  </div>
                </div>
                <div className="h-7 w-20 bg-stone-200 rounded" />
              </div>
            ) : !sellerFetchFailed && (sellerData || product.resellerName) ? (
              <div className="mb-6 p-4 rounded-lg border border-stone-200 bg-stone-50/80 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {sellerData?.store_image_url && !imgError ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-stone-200 bg-stone-100 flex items-center justify-center">
                      <img
                        src={sellerData.store_image_url}
                        alt={sellerData.shop_name || product.resellerName || 'Seller shop logo'}
                        className="w-full h-full object-cover rounded-full"
                        onError={() => setImgError(true)}
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      <Store className="w-5 h-5 text-amber-400" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-stone-900">
                        {sellerData?.shop_name || product.resellerName || 'Ayesha Luxury Surplus'}
                      </span>
                      {sellerData?.status === 'Active' && (
                        <span className="text-[10px] bg-stone-200 text-stone-800 font-semibold px-1.5 py-0.2 rounded-xs">
                          Verified Reseller
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-stone-500 mt-0.5">
                      <div className="flex items-center text-amber-600 font-bold">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500 mr-0.5" />
                        <span>{product.resellerRating || 4.9}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-stone-400" />
                        <span>Replies {product.resellerResponseTime || '< 15 mins'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {product.resellerId && onSelectReseller && (
                  <button
                    onClick={() => onSelectReseller(product.resellerId!)}
                    className="text-xs font-bold text-stone-900 hover:text-black underline flex items-center space-x-1 px-3 py-1.5 bg-white border border-stone-200 rounded-xs hover:border-stone-400 transition-colors shadow-2xs"
                  >
                    <span>Visit Store</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : null}

            {/* Full Attribute List (Label/Value Rows matching Care Instruction style) */}
            <div className="mb-6 border border-stone-200 rounded-lg divide-y divide-stone-200 bg-white text-xs">
              <div className="p-3 flex justify-between">
                <span className="text-stone-500 font-medium">Brand Authenticity:</span>
                <span className="text-stone-900 font-bold flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Official Surplus Stock ({product.brand})</span>
                </span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-stone-500 font-medium">Category:</span>
                <span className="text-stone-900 font-bold">{product.category || 'Unstitched'}</span>
              </div>
              {product.subcategory && (
                <div className="p-3 flex justify-between">
                  <span className="text-stone-500 font-medium">Subcategory:</span>
                  <span className="text-stone-900 font-bold">{product.subcategory}</span>
                </div>
              )}
              <div className="p-3 flex justify-between">
                <span className="text-stone-500 font-medium">Fabric Type:</span>
                <span className="text-stone-900 font-bold">{product.fabric || 'Embroidered Lawn'}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-stone-500 font-medium">Piece Count:</span>
                <span className="text-stone-900 font-bold">{product.pieceCount || '1-Piece'}</span>
              </div>
              {product.color && (
                <div className="p-3 flex justify-between">
                  <span className="text-stone-500 font-medium">Color Palette:</span>
                  <span className="text-stone-900 font-bold">{product.color}</span>
                </div>
              )}
              {product.defect && (
                <div className="p-3 flex justify-between bg-amber-50/50">
                  <span className="text-amber-800 font-medium">Defect Disclaimer:</span>
                  <span className="text-amber-900 font-bold text-right">{product.defect}</span>
                </div>
              )}
            </div>

            {/* Stitching & Size Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-900">
                  Select Size & Stock Option
                </span>
                {product.category !== 'Unstitched' && (
                  <span className="text-[11px] text-stone-500 underline cursor-pointer">
                    SIZE CHART
                  </span>
                )}
              </div>

              {product.category === 'Unstitched' ? (
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-md text-xs flex justify-between items-center">
                  <span className="font-bold text-stone-800 uppercase tracking-wider">Unstitched Fabric Ensemble</span>
                  {availableStock <= 5 ? (<span className="font-extrabold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">
                    {availableStock} Pcs Left
                  </span>) : (
                    <span></span>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {['Small', 'Medium', 'Large', 'X Large'].map((sz) => {
                      const variantMatch = product.variants?.find((v) => v.size?.toLowerCase() === sz.toLowerCase());
                      const stockQty = variantMatch ? Number(variantMatch.quantity) || 0 : 0;
                      const isAvailable = stockQty > 0;
                      const isLowStock = isAvailable && stockQty <= 3;

                      return (
                        <button
                          key={sz}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => {
                            if (isAvailable) {
                              setSelectedSize(sz);
                              const newMax = Math.max(1, stockQty);
                              if (quantity > newMax) setQuantity(newMax);
                            }
                          }}
                          className={`px-3.5 py-2 rounded-xs border text-xs font-bold uppercase transition-all flex flex-col items-center justify-center ${selectedSize === sz && isAvailable
                            ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                            : isAvailable
                              ? 'border-stone-300 text-stone-800 hover:border-stone-900 bg-white cursor-pointer'
                              : 'border-stone-200 bg-stone-100 text-stone-400 line-through cursor-not-allowed opacity-60'
                            }`}
                        >
                          <span>{sz}</span>
                          {isLowStock && (
                            <span className={`text-[9px] font-semibold tracking-tight ${selectedSize === sz ? 'text-amber-300' : 'text-amber-600'}`}>
                              Only {stockQty} left
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quantity Stepper & Add to Bag Row */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center space-x-3">
                {/* Quantity Controls */}
                <div className="flex items-center border border-stone-300 rounded-xs bg-white">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="p-3 text-stone-600 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center text-xs font-extrabold">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(maxSelectableQty, q + 1))}
                    disabled={quantity >= maxSelectableQty}
                    className="p-3 text-stone-600 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* ADD TO BAG CTA Button */}
                <button
                  onClick={handleAddToCartClick}
                  disabled={availableStock === 0}
                  className="flex-1 py-3.5 px-6 bg-stone-900 hover:bg-black disabled:bg-stone-400 text-white text-xs font-bold uppercase tracking-widest rounded-xs shadow-lg flex items-center justify-center space-x-2 transition-all transform active:scale-95 disabled:cursor-not-allowed"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{addedToast ? 'ADDED TO BAG ✓' : availableStock === 0 ? 'OUT OF STOCK' : 'ADD TO BAG'}</span>
                </button>

                {/* Wishlist Button */}
                <button
                  onClick={() => onToggleWishlist(product.id)}
                  className={`p-3.5 rounded-xs border transition-all ${isWishlisted
                    ? 'border-red-600 bg-red-50 text-red-600'
                    : 'border-stone-300 hover:border-stone-900 text-stone-700'
                    }`}
                  title="Save to Wishlist"
                >
                  <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-red-600' : ''}`} />
                </button>
              </div>

              {/* Express Shipping Guarantee Badges */}
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-stone-200 text-[11px] text-stone-600 font-medium">
                <div className="flex items-center space-x-1.5">
                  <Truck className="w-4 h-4 text-stone-800 shrink-0" />
                  <span>Express TCS Shipping</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-stone-800 shrink-0" />
                  <span>Authentic Brand Seal</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <RotateCcw className="w-4 h-4 text-stone-800 shrink-0" />
                  <span>7-Day Return Guarantee</span>
                </div>
              </div>
            </div>

            {/* Accordions */}
            <div className="border-t border-stone-200 divide-y divide-stone-200">
              {/* Description Accordion */}
              <div className="py-4">
                <button
                  onClick={() => toggleAccordion('description')}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900"
                >
                  <span>PRODUCT DETAILS & SPECIFICATIONS</span>
                  {openAccordion === 'description' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>

                {openAccordion === 'description' && (
                  <div className="mt-3 text-xs text-stone-600 leading-relaxed animate-fade-in">
                    <p className="whitespace-pre-line">
                      {product.description || 'No description provided by the seller.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Fabric & Care Accordion */}
              <div className="py-4">
                <button
                  onClick={() => toggleAccordion('fabric')}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900"
                >
                  <span>FABRIC & CARE INSTRUCTIONS</span>
                  {openAccordion === 'fabric' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>

                {openAccordion === 'fabric' && (
                  <div className="mt-3 text-xs text-stone-600 leading-relaxed space-y-1.5 animate-fade-in">
                    <p><strong>Primary Fabric:</strong> {product.fabric || 'Lawn & Silk'}</p>
                    <p>• Dry clean recommended for long-lasting vibrant color saturation.</p>
                    <p>• Do not expose to direct sunlight or harsh chemical detergents.</p>
                    <p>• Iron at moderate heat level only.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* REVIEWS & RATINGS SECTION */}
        <div className="mt-16 pt-12 border-t border-stone-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-stone-400 block mb-1">
                VERIFIED PURCHASES
              </span>
              <h2 className="font-brand-serif text-2xl font-normal text-stone-900 uppercase tracking-wider">
                CUSTOMER REVIEWS & RATINGS
              </h2>
            </div>
            {productReviews && productReviews.length > 0 && (
              <div className="flex items-center space-x-3 bg-stone-50 px-4 py-2 rounded-lg border border-stone-200">
                <div className="flex text-amber-500">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-4 h-4 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <span className="text-xs font-extrabold text-stone-900">
                  {(productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length).toFixed(1)} out of 5
                </span>
                <span className="text-xs text-stone-500">({productReviews.length} Verified Reviews)</span>
              </div>
            )}
          </div>

          {productReviews && productReviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {productReviews.map((rev) => (
                <div key={rev.id} className="p-5 rounded-lg border border-stone-200 bg-white flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex text-amber-500">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        ))}
                      </div>
                      <span className="text-[11px] text-stone-400">{rev.date}</span>
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed mb-3">"{rev.comment}"</p>

                    {rev.resellerReply && (
                      <div className="mt-3 p-3 bg-amber-50/60 rounded-xs border-l-2 border-amber-500 text-xs">
                        <span className="font-bold text-stone-900 block text-[11px] mb-0.5">
                          Response from {product.resellerName || 'Seller'}:
                        </span>
                        <p className="text-stone-700 italic">"{rev.resellerReply}"</p>
                      </div>
                    )}
                  </div>
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs mt-3">
                    <span className="font-bold text-stone-900">{rev.userName}</span>
                    {rev.verifiedPurchase && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-xs border border-emerald-200">
                        ✓ Verified Buyer
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 bg-stone-50 border border-stone-200 rounded-lg text-center text-xs text-stone-500 font-medium">
              No reviews submitted yet for this collection item.
            </div>
          )}
        </div>

        {/* WISHLIST RECOMMENDATIONS (Rendered ONLY if current user has wishlist recommendations) */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div className="mt-20 pt-12 border-t border-stone-200">
            <div className="text-center mb-8">
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-stone-400 block mb-1">
                CROSS-BRAND SURPLUS RECOMMENDATIONS
              </span>
              <h2 className="font-brand-serif text-2xl sm:text-3xl font-normal text-stone-900 uppercase tracking-wider">
                YOU MAY ALSO LIKE
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((relProd) => (
                <ProductCard
                  key={relProd.id}
                  product={relProd}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                  onSelectProduct={onSelectProduct}
                  onSelectReseller={onSelectReseller}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox / Fullscreen Zoom Modal */}
      {isZoomOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <button
            onClick={() => setIsZoomOpen(false)}
            className="absolute top-6 right-6 p-2 text-white hover:text-stone-300"
          >
            ✕
          </button>
          <img
            src={galleryImages[selectedImageIndex]}
            alt={product.title}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xs"
          />
        </div>
      )}
    </div>
  );
};
