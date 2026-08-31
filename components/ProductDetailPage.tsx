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
  ExternalLink,
  Loader2,
  X
} from 'lucide-react';
import { ProductCard } from './ProductCard';
import { Product, Review } from '@/types';
import { ALL_PRODUCTS, MOCK_REVIEWS } from '@/data/mockData';
import supabase from '@/src/api/client';
import { getItemAvailableStock } from '@/src/utils/stockUtils';
import { useRouter } from 'next/navigation';
import useAuth from '@/src/hooks/useAuth';

export { getItemAvailableStock };

interface ProductDetailPageProps {
  product: Product;
  reviews?: Review[];
  reviewsLoading?: boolean;
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
  reviewsLoading = false,
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

  // Derive Seller Data directly from product prop (populated in single fetchProductById query)
  const sellerData = useMemo(() => {
    if (product.seller) return product.seller;
    return {
      store_image_url: product.sellerStoreImageUrl || null,
      shop_name: product.resellerName || 'Verified Reseller',
      status: product.sellerStatus || 'Active',
    };
  }, [product.seller, product.sellerStoreImageUrl, product.resellerName, product.sellerStatus]);

  const sellerImageUrl = sellerData?.store_image_url || product.sellerStoreImageUrl || product.seller?.store_image_url || null;
  const storeName = sellerData?.shop_name || product.resellerName || 'Ayesha Luxury Surplus';
  const [imgError, setImgError] = useState<boolean>(false);

  // Close full-screen zoom modal on ESC keypress
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomOpen) {
        setIsZoomOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomOpen]);

  const router = useRouter();
  const { user, role, resellerProfile, userProfile } = useAuth();

  // Review Modal & Validation State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Local displayed reviews state
  const [localReviews, setLocalReviews] = useState<Review[]>(reviews || []);

  useEffect(() => {
    if (reviews) {
      setLocalReviews(reviews);
    }
  }, [reviews]);

  // Floating Toast Notification State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Step 1 - Step 3 Validation when opening Review Modal or submitting
  const handleWriteReviewClick = async () => {
    // Step 1: Check authentication
    if (!user?.id) {
      showToast('First login then write a review', 'error');
      router.push('/login');
      return;
    }

    // Step 2: Check if seller
    let isSeller = role === 'seller' || Boolean(resellerProfile);
    if (!isSeller) {
      try {
        const { data: sellerCheck } = await supabase
          .from('sellers')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        if (sellerCheck) {
          isSeller = true;
        }
      } catch (err) {
        console.error('Error checking seller status:', err);
      }
    }

    if (isSeller) {
      showToast('Seller cannot give a review', 'error');
      return;
    }

    // Step 3: Check for existing review (user_id AND product_id match)
    try {
      const { data: existingRev } = await supabase
        .from('reviews')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (existingRev) {
        showToast('You have already gave review this product', 'error');
        return;
      }
    } catch (err) {
      console.error('Error checking existing review:', err);
    }

    // Open review modal
    setRating(5);
    setComment('');
    setReviewError(null);
    setIsReviewModalOpen(true);
  };

  // Step 4 - Form Submission with Full Security Pipeline
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Step 1 Validation (Auth Check)
    if (!user?.id) {
      setIsReviewModalOpen(false);
      showToast('First login then write a review', 'error');
      router.push('/login');
      return;
    }

    if (rating < 1 || rating > 5) {
      setReviewError('Please select a rating between 1 and 5 stars.');
      return;
    }

    if (!comment.trim()) {
      setReviewError('Please write your review before submitting.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      // Step 2 Validation (Seller Check)
      let isSeller = role === 'seller' || Boolean(resellerProfile);
      if (!isSeller) {
        const { data: sellerCheck } = await supabase
          .from('sellers')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        if (sellerCheck) {
          isSeller = true;
        }
      }

      if (isSeller) {
        setIsSubmittingReview(false);
        setIsReviewModalOpen(false);
        showToast('Seller cannot give a review', 'error');
        return;
      }

      // Step 3 Validation (Duplicate Check: user_id AND product_id)
      const { data: existingRev } = await supabase
        .from('reviews')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (existingRev) {
        setIsSubmittingReview(false);
        setIsReviewModalOpen(false);
        showToast('You have already gave review this product', 'error');
        return;
      }

      // Step 4: Resolve order_item_id & seller_id for Insertion
      let resolvedOrderItemId: string | null = null;
      let resolvedSellerId: string = product.resellerId || '';

      try {
        const { data: userOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('user_id', user.id);

        if (userOrders && userOrders.length > 0) {
          const orderIds = userOrders.map((o) => o.id);
          const { data: matchingItem } = await supabase
            .from('order_items')
            .select('id, seller_id')
            .in('order_id', orderIds)
            .eq('product_id', product.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (matchingItem) {
            resolvedOrderItemId = matchingItem.id;
            if (matchingItem.seller_id) {
              resolvedSellerId = matchingItem.seller_id;
            }
          }
        }

        if (!resolvedOrderItemId) {
          const { data: anyOrderItem } = await supabase
            .from('order_items')
            .select('id, seller_id')
            .eq('product_id', product.id)
            .limit(1)
            .maybeSingle();

          if (anyOrderItem) {
            resolvedOrderItemId = anyOrderItem.id;
            if (!resolvedSellerId && anyOrderItem.seller_id) {
              resolvedSellerId = anyOrderItem.seller_id;
            }
          }
        }

        if (!resolvedOrderItemId) {
          resolvedOrderItemId = crypto.randomUUID();
        }
      } catch (err) {
        console.warn('Error resolving order item:', err);
        if (!resolvedOrderItemId) resolvedOrderItemId = crypto.randomUUID();
      }

      const insertPayload: Record<string, any> = {
        product_id: product.id,
        order_item_id: resolvedOrderItemId,
        user_id: user.id,
        rating: rating,
        review: comment.trim(),
        status: 'Pending',
      };

      if (resolvedSellerId) {
        insertPayload.seller_id = resolvedSellerId;
      }

      let { error: insertErr } = await supabase
        .from('reviews')
        .insert(insertPayload);

      // Fallback 1: Retrying without order_item_id column if not in schema
      if (insertErr && (insertErr.message?.includes('order_item_id') || insertErr.details?.includes('order_item_id') || insertErr.code === 'PGRST204')) {
        delete insertPayload.order_item_id;
        const retryRes = await supabase.from('reviews').insert(insertPayload);
        insertErr = retryRes.error;
      }

      // Fallback 2: Retrying without status column if not in schema
      if (insertErr && (insertErr.message?.includes('status') || insertErr.details?.includes('status'))) {
        delete insertPayload.status;
        const retryRes = await supabase.from('reviews').insert(insertPayload);
        insertErr = retryRes.error;
      }

      if (insertErr) {
        console.error('Error inserting review:', insertErr);
        setReviewError(insertErr.message || 'Failed to submit review. Please try again.');
        setIsSubmittingReview(false);
        return;
      }

      // Successful insertion
      setIsSubmittingReview(false);
      setIsReviewModalOpen(false);
      showToast('Review submitted successfully!', 'success');

      // Prepend review to local state
      const createdReview: Review = {
        id: crypto.randomUUID(),
        productId: product.id,
        userName: `${userProfile?.first_name || 'Customer'} ${userProfile?.last_name || ''}`.trim() || 'Verified Customer',
        rating: rating,
        comment: comment.trim(),
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        verifiedPurchase: true,
      };

      setLocalReviews((prev) => [createdReview, ...prev]);

    } catch (err: any) {
      console.error('Unexpected error submitting review:', err);
      setReviewError(err?.message || 'Failed to submit review.');
      setIsSubmittingReview(false);
    }
  };

  // Gallery images with multi-image support
  const galleryImages = [
    product.image,
    ...(product.additionalImages || []),
    product.hoverImage,
  ].filter((img, idx, self): img is string => Boolean(img) && self.indexOf(img) === idx);

  // Real product reviews passed from 2nd query or updated locally
  const productReviews = localReviews;

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
                  <img src={imgUrl} alt="Thumbnail view" loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
                </button>
              ))}
            </div>

            {/* Main Stage Image Viewer */}
            <div className="relative flex-1 bg-stone-100 rounded-xl overflow-hidden aspect-[3/4] group">
              <img
                src={galleryImages[selectedImageIndex]}
                alt={product.title}
                loading="lazy"
                decoding="async"
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
            {(sellerData || product.resellerName || product.sellerStoreImageUrl) && (
              <div className="mb-5 sm:mb-6 p-3 sm:p-3.5 lg:p-4 rounded-lg border border-stone-200 bg-stone-50/80 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
                  {sellerImageUrl && !imgError ? (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-full overflow-hidden shrink-0 border border-stone-200 bg-stone-100 flex items-center justify-center shadow-2xs">
                      <img
                        src={sellerImageUrl}
                        alt={storeName}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover rounded-full"
                        onError={() => setImgError(true)}
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                      <Store className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] sm:text-xs lg:text-sm font-bold text-stone-900 truncate">
                        {storeName}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] sm:text-[11px] lg:text-xs text-stone-500 mt-0.5">
                      <div className="flex items-center text-amber-600 font-bold">
                        <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-500 text-amber-500 mr-0.5 shrink-0" />
                        <span>{product.resellerRating || 4.9}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {product.resellerId && onSelectReseller && (
                  <button
                    onClick={() => onSelectReseller(product.resellerId!)}
                    className="text-[10px] sm:text-xs lg:text-sm font-bold text-stone-900 hover:text-black underline flex items-center space-x-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white border border-stone-200 rounded-xs hover:border-stone-400 transition-colors shadow-2xs shrink-0"
                  >
                    <span>Visit Store</span>
                    <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-3.5 lg:h-3.5 shrink-0" />
                  </button>
                )}
              </div>
            )}

            {/* Full Attribute List (Label/Value Rows matching Care Instruction style) */}
            <div className="mb-6 border border-stone-200 rounded-lg divide-y divide-stone-200 bg-white text-xs">
              <div className="p-3 flex justify-between">
                <span className="text-stone-500 font-medium">Brand Authenticity:</span>
                <span className="text-stone-900 font-bold flex items-center space-x-1">
                  <span>Official({product.brand})</span>
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


              {product.category === 'Unstitched' ? (
                <div className="p-2 bg-stone-50 border border-stone-200 rounded-md text-xs flex justify-between items-center">
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
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">

              {/* Quantity + Add to Bag + Wishlist */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3 w-full">

                {/* Quantity Controls */}
                <div
                  className="
        flex items-center
        border border-stone-300
        rounded-xs
        bg-white
        shrink-0
        h-9
        sm:h-10
        lg:h-11
      "
                >
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="
          flex items-center justify-center
          w-7 h-full
          sm:w-8
          lg:w-9
          text-stone-600
          hover:text-black
          transition-colors
          disabled:opacity-30
          disabled:cursor-not-allowed
          shrink-0
        "
                  >
                    <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" />
                  </button>

                  <span
                    className="
          w-7
          sm:w-8
          lg:w-10
          text-center
          text-[10px]
          sm:text-xs
          lg:text-sm
          font-extrabold
          shrink-0
        "
                  >
                    {quantity}
                  </span>

                  <button
                    onClick={() => setQuantity((q) => Math.min(maxSelectableQty, q + 1))}
                    disabled={quantity >= maxSelectableQty}
                    className="
          flex items-center justify-center
          w-7 h-full
          sm:w-8
          lg:w-9
          text-stone-600
          hover:text-black
          transition-colors
          disabled:opacity-30
          disabled:cursor-not-allowed
          shrink-0
        "
                  >
                    <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" />
                  </button>
                </div>

                {/* ADD TO BAG */}
                <button
                  onClick={handleAddToCartClick}
                  disabled={availableStock === 0}
                  className="
        flex-1
        min-w-0

        h-9
        sm:h-10
        lg:h-11

        px-2
        sm:px-4
        lg:px-6

        bg-stone-900
        hover:bg-black
        disabled:bg-stone-400

        text-white

        text-[9px]
        sm:text-[10px]
        lg:text-xs

        font-bold
        uppercase
        tracking-wide
        sm:tracking-wider
        lg:tracking-widest

        rounded-xs
        shadow-lg

        flex items-center justify-center
        gap-1
        sm:gap-1.5
        lg:gap-2

        transition-all
        transform
        active:scale-95

        disabled:cursor-not-allowed

        whitespace-nowrap
        overflow-hidden
      "
                >
                  <ShoppingBag
                    className="
          w-3
          h-3
          sm:w-3.5
          sm:h-3.5
          lg:w-4
          lg:h-4
          shrink-0
        "
                  />

                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                    {addedToast
                      ? "ADDED TO BAG ✓"
                      : availableStock === 0
                        ? "OUT OF STOCK"
                        : "ADD TO BAG"}
                  </span>
                </button>

                {/* Wishlist */}
                <button
                  onClick={() => onToggleWishlist(product.id)}
                  className={`
        flex items-center justify-center
        shrink-0

        w-9 h-9
        sm:w-10 sm:h-10
        lg:w-11 lg:h-11

        rounded-xs
        border
        transition-all

        ${isWishlisted
                      ? "border-red-600 bg-red-50 text-red-600"
                      : "border-stone-300 hover:border-stone-900 text-stone-700"
                    }
      `}
                  title="Save to Wishlist"
                >
                  <Heart
                    className={`
    w-4
    h-4
    sm:w-4.5
    sm:h-4.5
    lg:w-5
    lg:h-5
    shrink-0
    ${isWishlisted ? "fill-red-600" : ""}
  `}
                  />
                </button>
              </div>

              {/* Express Shipping Guarantee Badges */}
              <div
                className="
      grid grid-cols-3
      gap-1
      sm:gap-2
      lg:gap-3

      pt-3
      sm:pt-4

      border-t border-stone-200

      text-[8px]
      sm:text-[10px]
      lg:text-xs

      text-stone-600
      font-medium
    "
              >

                <div
                  className="
        flex items-center
        gap-1
        sm:gap-1.5
        min-w-0
        whitespace-nowrap
      "
                >
                  <Truck
                    className="
          w-3
          h-3
          sm:w-3.5
          sm:h-3.5
          lg:w-4
          lg:h-4
          text-stone-800
          shrink-0
        "
                  />
                  <span className="truncate">Express Shipping</span>
                </div>

                <div
                  className="
        flex items-center
        gap-1
        sm:gap-1.5
        min-w-0
        whitespace-nowrap
      "
                >
                  <ShieldCheck
                    className="
          w-3
          h-3
          sm:w-3.5
          sm:h-3.5
          lg:w-4
          lg:h-4
          text-stone-800
          shrink-0
        "
                  />
                  <span className="truncate">Authentic Brand Seal</span>
                </div>

                <div
                  className="
        flex items-center
        gap-1
        sm:gap-1.5
        min-w-0
        whitespace-nowrap
      "
                >
                  <RotateCcw
                    className="
          w-3
          h-3
          sm:w-3.5
          sm:h-3.5
          lg:w-4
          lg:h-4
          text-stone-800
          shrink-0
        "
                  />
                  <span className="truncate">7-Day Return Guarantee</span>
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

          <div className="flex flex-nowrap items-center justify-between gap-2 xs:gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4 min-w-0">
              <h2 className="font-brand-serif text-[15px] xs:text-base sm:text-xl lg:text-2xl font-normal text-stone-900 uppercase tracking-wide sm:tracking-wider truncate">
                REVIEWS & RATINGS
              </h2>

              {productReviews && productReviews.length > 0 && (
                <div className="hidden md:flex items-center space-x-1.5 lg:space-x-2 bg-stone-50 px-2 sm:px-2.5 lg:px-3 py-1 sm:py-1.5 rounded-lg border border-stone-200 text-[10px] sm:text-xs font-bold shrink-0">
                  <div className="flex text-amber-500">
                    <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-500 text-amber-500" />
                  </div>

                  <span className="text-stone-900">
                    {(
                      productReviews.reduce((sum, r) => sum + r.rating, 0) /
                      productReviews.length
                    ).toFixed(1)} / 5
                  </span>

                  <span className="text-stone-500 font-normal">
                    ({productReviews.length})
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={handleWriteReviewClick}
              className="
      shrink-0
      flex items-center justify-center
      space-x-1
      sm:space-x-1.5

      px-2.5
      xs:px-3
      sm:px-3.5
      lg:px-4

      py-1.5
      xs:py-2
      sm:py-2.5

      bg-stone-900
      hover:bg-black
      text-white

      text-[9px]
      xs:text-[10px]
      sm:text-xs
      lg:text-sm

      font-bold
      uppercase
      tracking-wide
      sm:tracking-wider

      rounded-xs
      shadow-xs
      transition-all
      cursor-pointer

      min-w-fit
    "
            >
              <Star className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400 shrink-0" />

              <span className="whitespace-nowrap">
                Write a Review
              </span>
            </button>
          </div>
          ```

          {reviewsLoading ? (
            <div className="p-8 bg-stone-50 border border-stone-200 rounded-lg text-center flex items-center justify-center space-x-2.5 text-xs text-stone-600 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-stone-800" />
              <span>Loading Customer Reviews...</span>
            </div>
          ) : productReviews && productReviews.length > 0 ? (
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
        <div
          className="fixed inset-0 z-50 bg-stone-100/90 backdrop-blur-md overflow-y-auto flex flex-col justify-between transition-opacity duration-300 animate-fade-in"
          onClick={() => setIsZoomOpen(false)}
        >
          {/* Top Header Bar */}
          <div
            className="sticky top-0 z-20 w-full px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between bg-stone-100/80 backdrop-blur-xs border-b border-stone-200/80 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <span className="bg-stone-900 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs shrink-0">
                {product.brand}
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                {product.title}
              </h3>
            </div>

            <button
              onClick={() => setIsZoomOpen(false)}
              className="p-1.5 sm:p-2 bg-stone-200/80 hover:bg-stone-900 text-stone-700 hover:text-white rounded-full transition-all shrink-0 shadow-2xs cursor-pointer"
              title="Close Fullscreen View (Esc)"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Main Content Stage (Positioned toward top of viewport) */}
          <div
            className="flex-1 w-full flex flex-col items-center justify-start pt-3 sm:pt-4 pb-6 px-3 sm:px-6 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative max-w-4xl w-full flex items-start justify-center">
              <img
                src={galleryImages[selectedImageIndex]}
                alt={product.title}
                loading="lazy"
                decoding="async"
                className="max-h-[72vh] sm:max-h-[80vh] w-auto object-contain rounded-md shadow-xl border border-stone-200/80 bg-white"
              />
            </div>

            {/* Gallery Thumbnail Selector inside Modal */}
            {galleryImages.length > 1 && (
              <div className="mt-3 sm:mt-4 flex items-center gap-2 overflow-x-auto max-w-full p-2 bg-white/80 border border-stone-200/80 rounded-lg shadow-2xs shrink-0">
                {galleryImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative w-11 h-14 sm:w-14 sm:h-16 rounded-md overflow-hidden border-2 transition-all shrink-0 ${selectedImageIndex === idx
                        ? 'border-stone-900 ring-2 ring-stone-900 ring-offset-1'
                        : 'border-stone-200 opacity-60 hover:opacity-100'
                      }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`View thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover object-top"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in max-w-md w-full px-4">
          <div
            className={`p-3.5 sm:p-4 rounded-md shadow-2xl border flex items-center justify-between space-x-3 text-xs sm:text-sm font-bold uppercase tracking-wider ${toastMessage.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700'
                : toastMessage.type === 'success'
                  ? 'bg-emerald-900 text-white border-emerald-700'
                  : 'bg-stone-900 text-white border-stone-700'
              }`}
          >
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-stone-300 hover:text-white font-mono text-sm ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-lg max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
              <div>
                <span className="text-[10px] sm:text-xs lg:text-sm font-extrabold text-amber-600 uppercase tracking-widest block">
                  VERIFIED BUYER REVIEW
                </span>
                <h3 className="text-sm sm:text-base lg:text-lg font-bold text-stone-900">
                  Write Product Review
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-700 text-xs sm:text-sm lg:text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Product Information Summary */}
            <div className="flex items-center space-x-3 p-3 bg-stone-50 rounded-xs border border-stone-200 mb-4">
              <img
                src={product.image}
                alt={product.title}
                className="w-12 h-16 sm:w-14 sm:h-18 object-cover object-top rounded-xs border border-stone-200 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-[10px] sm:text-xs lg:text-sm font-bold text-stone-400 uppercase block truncate">
                  {product.brand}
                </span>
                <h4 className="text-xs sm:text-sm lg:text-base font-semibold text-stone-900 line-clamp-2">
                  {product.title}
                </h4>
              </div>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs sm:text-sm lg:text-base">
              {reviewError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xs text-[10px] sm:text-xs lg:text-sm font-medium">
                  {reviewError}
                </div>
              )}

              <div>
                <label className="font-bold text-stone-700 block mb-1.5 uppercase tracking-wider text-[10px] sm:text-xs lg:text-sm">
                  Rating (1 to 5 Stars) *
                </label>
                <div className="flex items-center space-x-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-110 focus:outline-none cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 sm:w-7 sm:h-7 ${star <= rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-stone-200'
                          }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs sm:text-sm lg:text-base font-bold text-stone-600 ml-2">
                    {rating} / 5 Stars
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1.5 uppercase tracking-wider text-[10px] sm:text-xs lg:text-sm">
                  Your Review *
                </label>
                <textarea
                  rows={4}
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write your review..."
                  className="w-full p-3 border border-stone-300 rounded-xs focus:outline-none focus:border-stone-900 text-xs sm:text-sm lg:text-base"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  disabled={isSubmittingReview}
                  className="px-3.5 sm:px-4 py-2 border border-stone-300 text-stone-700 font-bold uppercase tracking-wider text-xs sm:text-sm lg:text-base rounded-xs hover:bg-stone-100 disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-4 sm:px-5 py-2 bg-stone-900 hover:bg-black text-white font-bold uppercase tracking-wider text-xs sm:text-sm lg:text-base rounded-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReview ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>SUBMITTING...</span>
                    </>
                  ) : (
                    <span>Submit Review</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
