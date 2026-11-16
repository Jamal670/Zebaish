import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import {
  Heart,
  ShoppingBag,
  Plus,
  Minus,
  Star,
  ExternalLink,
  Loader2,
  X,
  ChevronDown
} from 'lucide-react';
import { Product, Review, ProductColor, CartItemColor } from '@/types';
import supabase from '@/src/api/client';
import { getItemAvailableStock } from '@/src/utils/stockUtils';
import { resolveSwatchColor } from '@/src/utils/colorUtils';
import { useRouter } from 'next/navigation';
import useAuth from '@/src/hooks/useAuth';
import { formatStoreSlug } from '@/src/api/sellerService';
import { ProductMainImage } from './product/ProductMainImage';
import { SpecificationDescription, SpecificationsTable } from './product/SpecificationDescription';
import { useProductDetail } from '@/hooks/useProductDetail';
import { useVariantResolution } from '@/hooks/useVariantResolution';

const DEFAULT_STORE_IMAGE =
  'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png';

const EMPTY_REVIEWS: Review[] = [];

// Flag to control legacy product details/description block (hide for now, code preserved)
const SHOW_PRODUCT_DESCRIPTION = false;

export { getItemAvailableStock, resolveSwatchColor };

interface ProductDetailPageProps {
  productId?: string;
  product?: Product | any;
  reviews?: Review[];
  isLoading?: boolean;
  onAddToCart: (
    product: Product,
    size?: string,
    quantity?: number,
    color?: CartItemColor | null,
    variantId?: string | null,
    variantOptions?: Record<string, string> | null,
    variantSku?: string | null
  ) => void;
  onToggleWishlist: (productId: string) => void;
  isWishlisted: boolean;
  onSelectProduct: (product: Product) => void;
  onSelectReseller?: (resellerId: string) => void;
  onNavigateHome: () => void;
  onNavigateCollection: () => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  productId,
  product: initialProduct,
  reviews: initialReviews,
  isLoading: isExternalLoading = false,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
  onSelectProduct,
  onSelectReseller,
  onNavigateHome,
  onNavigateCollection,
}) => {
  const router = useRouter();
  const { user, role, resellerProfile, userProfile } = useAuth();

  const targetId = productId || initialProduct?.id || '';

  // 1. Initial product load via parallel requests hook (Query 1 + Query 2a/2b)
  const {
    product: loadedProduct,
    images: loadedImages,
    specs: loadedSpecs,
    options: loadedOptions,
    optionImages,
    status: detailStatus,
    retry,
  } = useProductDetail(targetId);

  const product = loadedProduct || initialProduct;
  const reviews = initialReviews && initialReviews.length > 0 ? initialReviews : EMPTY_REVIEWS;
  const specs = loadedSpecs && loadedSpecs.length > 0 ? loadedSpecs : (product?.specs || []);
  const options = loadedOptions && loadedOptions.length > 0 ? loadedOptions : (product?.options || []);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [dropdownSelections, setDropdownSelections] = useState<Record<string, string>>({});
  const [dropdownError, setDropdownError] = useState<string | null>(null);
  const [unselectedOptionIds, setUnselectedOptionIds] = useState<string[]>([]);
  const [optionImageOverride, setOptionImageOverride] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [openAccordion, setOpenAccordion] = useState<string | null>('description');
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [addedToast, setAddedToast] = useState(false);
  const [imgError, setImgError] = useState<boolean>(false);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [colorError, setColorError] = useState<string | null>(null);

  // 2. On-demand Variant Resolution hook
  const variantState = useVariantResolution({
    productId: targetId,
    options: options,
    selection: dropdownSelections,
  });

  // Derived Pricing & Stock
  const displayPricing = useMemo(() => {
    if (!product) {
      return {
        priceText: 'Rs. 0',
        rawPrice: 0,
        compareAtPrice: null as number | null,
        discountPercent: null as number | null,
        stockText: '',
        availableStock: 0,
        isOutOfStock: true,
        priceSlotStatus: 'normal' as 'normal' | 'loading' | 'unavailable' | 'error',
        canAddToCart: false,
      };
    }

    const isVariantsMode = product.inventoryMode === 'variants';
    const defaultPrice = Number(product.price) || 0;
    const defaultCompareAt = product.compareAtPrice ? Number(product.compareAtPrice) : null;

    // A. Simple product
    if (!isVariantsMode) {
      const price = defaultPrice;
      const compareAt = defaultCompareAt;
      const discountPercent =
        compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : null;
      const stock = Math.max(0, Number(product.quantity) || 0);
      const outOfStock = stock <= 0 || product.status === 'sold_out';

      return {
        priceText: `Rs. ${price.toLocaleString()}`,
        rawPrice: price,
        compareAtPrice: compareAt,
        discountPercent,
        stockText: outOfStock ? 'Out of stock' : '',
        availableStock: stock,
        isOutOfStock: outOfStock,
        priceSlotStatus: 'normal' as const,
        canAddToCart: !outOfStock,
      };
    }

    // B. Variants Mode - Resolved variant
    if (variantState.status === 'resolved' && variantState.variant) {
      const v = variantState.variant;
      const price =
        v.selling_price !== null && v.selling_price !== undefined
          ? Number(v.selling_price)
          : defaultPrice;
      const compareAt =
        v.compare_at_price !== null && v.compare_at_price !== undefined
          ? Number(v.compare_at_price)
          : defaultCompareAt;
      const discountPercent =
        compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : null;
      const stock = Math.max(0, Number(v.quantity) || 0);
      const outOfStock = stock <= 0 || !v.is_active;

      return {
        priceText: `Rs. ${price.toLocaleString()}`,
        rawPrice: price,
        compareAtPrice: compareAt,
        discountPercent,
        stockText: outOfStock ? 'Out of stock' : '',
        availableStock: stock,
        isOutOfStock: outOfStock,
        priceSlotStatus: 'normal' as const,
        canAddToCart: !outOfStock,
      };
    }

    // C. Variants Mode - Fallback (loading, unavailable, error, or idle/partial selection)
    // Always show the product price so users never see placeholder text like "This combination is unavailable"
    const price = defaultPrice;
    const compareAt = defaultCompareAt;
    const discountPercent =
      compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : null;
    const totalStock = Math.max(0, Number(product.quantity) || 0);
    const outOfStock = variantState.status === 'unavailable' || totalStock <= 0;

    return {
      priceText: `Rs. ${price.toLocaleString()}`,
      rawPrice: price,
      compareAtPrice: compareAt,
      discountPercent,
      stockText: outOfStock ? 'Out of stock' : '',
      availableStock: totalStock,
      isOutOfStock: outOfStock,
      priceSlotStatus: 'normal' as const,
      canAddToCart: !outOfStock && variantState.status !== 'unavailable',
    };
  }, [product, variantState]);

  // Reset local state when targetId changes
  useEffect(() => {
    setSelectedImageIndex(0);
    setSelectedColorId(null);
    setColorError(null);
    setDropdownSelections({});
    setDropdownError(null);
    setUnselectedOptionIds([]);
    setOptionImageOverride(null);
    setImgError(false);
    setQuantity(1);
    setSelectedSize('');
  }, [targetId]);

  const handleSelectOptionValue = (optionId: string, valueId: string) => {
    setDropdownSelections((prev) => ({
      ...prev,
      [optionId]: valueId,
    }));
    setDropdownError(null);

    // If an image override exists for this option value
    if (optionImages && optionImages.has(valueId)) {
      setOptionImageOverride(optionImages.get(valueId) || null);
    }
  };

  // Deduplicated all product colors from product data (when not using options)
  const allProductColors = useMemo(() => {
    const raw = product?.colors || product?.product_colors || [];
    if (!Array.isArray(raw) || raw.length === 0) return [];

    const seen = new Set<string>();
    const list: ProductColor[] = [];

    for (const c of raw) {
      if (!c || !c.color_name) continue;
      const key = c.color_name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(c);
    }

    return list;
  }, [product?.colors, product?.product_colors]);

  // Colors filtered by the currently selected size (or Unstitched category)
  const availableColors = useMemo(() => {
    if (allProductColors.length === 0) return [];

    const variants = product?.variants || [];
    if (!Array.isArray(variants) || variants.length === 0) {
      return allProductColors;
    }

    const currentSize = product?.category === 'Unstitched' ? 'Unstitched' : selectedSize;
    if (!currentSize) return allProductColors;

    const sizeVariants = variants.filter(
      (v: any) => v.size && v.size.trim().toLowerCase() === currentSize.trim().toLowerCase()
    );

    const matchingColorKeys = new Set<string>();
    sizeVariants.forEach((v: any) => {
      if (v.color_id) {
        matchingColorKeys.add(String(v.color_id).trim().toLowerCase());
      }
      if ((v as any).color) {
        matchingColorKeys.add(String((v as any).color).trim().toLowerCase());
      }
    });

    if (matchingColorKeys.size > 0) {
      const filtered = allProductColors.filter((c) => {
        const idMatch = c.id && matchingColorKeys.has(String(c.id).trim().toLowerCase());
        const nameMatch = c.color_name && matchingColorKeys.has(String(c.color_name).trim().toLowerCase());
        return idMatch || nameMatch;
      });
      if (filtered.length > 0) {
        return filtered;
      }
    }

    return allProductColors;
  }, [allProductColors, product?.variants, product?.category, selectedSize]);

  // Preselect only if the filtered availableColors has exactly one color; require manual selection if several
  useEffect(() => {
    if (availableColors.length === 1) {
      const singleId = availableColors[0].id;
      setSelectedColorId((prev) => (prev === singleId ? prev : singleId));
      setColorError((prev) => (prev === null ? prev : null));
    } else if (availableColors.length > 1) {
      setSelectedColorId((prev) => {
        if (prev && availableColors.some((c) => c.id === prev)) {
          return prev;
        }
        return null;
      });
    } else {
      setSelectedColorId((prev) => (prev === null ? prev : null));
      setColorError((prev) => (prev === null ? prev : null));
    }
  }, [availableColors]);

  // Derive Seller Data directly from product (populated in single fetchProductById query or loadedProduct)
  const sellerData = useMemo(() => {
    if (!product) return null;
    if (product.seller) return product.seller;
    return {
      store_image_url: product.sellerStoreImageUrl || null,
      shop_name: product.resellerName || 'Verified Reseller',
      average_rating: product.resellerRating !== undefined && product.resellerRating !== null ? Number(product.resellerRating) : 0,
      status: product.sellerStatus || 'Active',
    };
  }, [product?.seller, product?.sellerStoreImageUrl, product?.resellerName, product?.resellerRating, product?.sellerStatus]);

  const sellerImageUrl = sellerData?.store_image_url || product?.sellerStoreImageUrl || product?.seller?.store_image_url || null;
  const storeName = sellerData?.shop_name || product?.resellerName || product?.seller?.shop_name || 'Verified Reseller';
  const sellerRating = sellerData?.average_rating !== undefined && sellerData?.average_rating !== null
    ? Number(sellerData.average_rating)
    : (product?.resellerRating !== undefined && product?.resellerRating !== null ? Number(product.resellerRating) : 0);

  // Review Modal & Validation State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Local displayed reviews state
  const [localReviews, setLocalReviews] = useState<Review[]>(reviews);

  useEffect(() => {
    if (!initialReviews || initialReviews.length === 0) {
      setLocalReviews((prev) => (prev.length === 0 ? prev : EMPTY_REVIEWS));
      return;
    }
    setLocalReviews(initialReviews);
  }, [initialReviews]);

  // Floating Toast Notification State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

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

  // Gallery images with thumbnail first and multi-image support
  const galleryImages = useMemo<string[]>(() => {
    if (loadedImages && loadedImages.length > 0) {
      return loadedImages.map((img: any) => typeof img === 'string' ? img : (img.imageUrl || img.image_url || ''));
    }
    if (Array.isArray(product?.images) && product.images.length > 0) {
      return product.images;
    }
    const fallback = [
      product?.image,
      ...(product?.additionalImages || []),
      product?.hoverImage,
    ].filter((img, idx, self): img is string => Boolean(img) && self.indexOf(img) === idx);
    return fallback.length > 0 ? fallback : [DEFAULT_STORE_IMAGE];
  }, [loadedImages, product?.images, product?.image, product?.additionalImages, product?.hoverImage]);

  // Active main image (with instant option image override support)
  const currentMainImage = optionImageOverride || galleryImages[selectedImageIndex] || galleryImages[0] || DEFAULT_STORE_IMAGE;

  // Compute available stock for current selected variant or simple product
  const chosenColor = allProductColors.find((c) => c.id === selectedColorId);

  const currentVariant = product?.category === 'Unstitched'
    ? (selectedColorId
        ? product?.variants?.find((v: any) => v.size === 'Unstitched' && (v.color_id === selectedColorId || (chosenColor && v.color_id?.toLowerCase() === chosenColor.color_name.toLowerCase()))) || product?.variants?.find((v: any) => v.size === 'Unstitched')
        : product?.variants?.find((v: any) => v.size === 'Unstitched'))
    : (selectedColorId
        ? product?.variants?.find((v: any) => v.size?.toLowerCase() === selectedSize?.toLowerCase() && (v.color_id === selectedColorId || (chosenColor && v.color_id?.toLowerCase() === chosenColor.color_name.toLowerCase()))) || product?.variants?.find((v: any) => v.size?.toLowerCase() === selectedSize?.toLowerCase())
        : product?.variants?.find((v: any) => v.size?.toLowerCase() === selectedSize?.toLowerCase()));

  const availableStock = useMemo(() => {
    if (!product) return 0;
    if (product.inventoryMode === 'variants') {
      if (variantState.status === 'resolved' && variantState.variant) {
        return Math.max(0, Number(variantState.variant.quantity) || 0);
      }
      return Math.max(0, Number(product.quantity) || 0);
    }
    if (product.inventoryMode === 'simple') {
      return Math.max(0, Number(product.quantity) || 0);
    }
    if (currentVariant) {
      return Math.max(0, Number(currentVariant.quantity) || 0);
    }
    return Math.max(0, Number(product.quantity) || 0);
  }, [product, variantState, currentVariant]);

  const isOutOfStock = displayPricing.isOutOfStock;
  const maxSelectableQty = Math.max(1, availableStock);

  // Automatically clamp quantity if current selection has less stock
  useEffect(() => {
    if (availableStock > 0 && quantity > availableStock) {
      setQuantity(availableStock);
    }
  }, [availableStock]);

  // Real product reviews passed from 2nd query or updated locally
  const productReviews = localReviews;

  // 1. Loading Skeleton Block
  if ((detailStatus === 'loading' || isExternalLoading) && !product) {
    return (
      <div className="bg-white min-h-screen text-stone-900 pb-20 animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 md:pt-12">
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 lg:gap-11 items-stretch">
            {/* Gallery Skeleton */}
            <div className="w-full lg:w-auto flex flex-col-reverse sm:flex-row gap-1 sm:gap-1.5 items-start justify-start shrink-0">
              <div className="flex sm:flex-col gap-1.5 sm:gap-2 overflow-hidden shrink-0">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-16 h-20 sm:w-20 sm:h-25 rounded-lg bg-stone-200 animate-pulse shrink-0" />
                ))}
              </div>
              <div className="relative mx-auto sm:mx-0 w-full sm:w-[520px] max-w-[520px] bg-stone-200 animate-pulse rounded-xl sm:rounded-2xl aspect-[4/5] shrink-0" />
            </div>

            {/* Details Skeleton */}
            <div className="w-full h-full flex flex-col justify-between lg:pl-2">
              <div className="flex flex-col flex-1 min-h-0">
                {/* Title Skeleton */}
                <div className="h-8 w-3/4 bg-stone-200 animate-pulse rounded-xs" />
                <div className="border-t border-stone-200/80 my-3.5" />
                {/* Seller Skeleton */}
                <div className="h-14 w-full bg-stone-100 border border-stone-200/80 animate-pulse rounded-lg" />
                <div className="border-t border-stone-200/80 my-3.5" />
                {/* Price Skeleton */}
                <div className="h-7 w-40 bg-stone-200 animate-pulse rounded-xs" />
                <div className="border-t border-stone-200/80 my-3" />
                {/* Specifications Skeleton */}
                <div className="flex-1 min-h-[160px] max-h-[260px] lg:max-h-none w-full bg-stone-100 border border-stone-200/80 animate-pulse rounded-lg" />
              </div>
              {/* Dropdowns & Add to Bag Skeleton Pinned to Bottom */}
              <div className="mt-auto pt-3 space-y-2.5 shrink-0">
                <div className="h-10 w-full bg-stone-200 animate-pulse rounded-xs" />
                <div className="border-t border-stone-200/80 my-2.5" />
                <div className="h-11 w-full bg-stone-200 animate-pulse rounded-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error State with Retry
  if (detailStatus === 'error' && !product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-stone-50 space-y-4 animate-fade-in">
        <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">Failed to Load Product</h2>
        <p className="text-xs text-stone-500 max-w-md">
          Unable to retrieve product details. Please try again.
        </p>
        <button
          onClick={retry}
          className="px-6 py-2.5 bg-stone-900 text-white rounded-xs text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  // 3. Not Found State
  if (detailStatus === 'notFound' || !product || !product.id) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-stone-50 animate-fade-in">
        <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 mb-2">Product Not Found</h2>
        <p className="text-xs text-stone-500 mb-6 max-w-md">The product you are looking for does not exist, is inactive, or has been removed.</p>
        <button
          onClick={onNavigateCollection || onNavigateHome}
          className="px-6 py-2.5 bg-stone-900 text-white rounded-xs text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors cursor-pointer"
        >
          Back to Shop
        </button>
      </div>
    );
  }

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

  const handleAddToCartClick = () => {
    if (!product) return;

    if (displayPricing.isOutOfStock) {
      showToast('This item is currently out of stock.', 'error');
      return;
    }

    // Validate option selections
    if (options && options.length > 0) {
      const missing = options.filter((opt: any) => !dropdownSelections[opt.id]);
      if (missing.length > 0) {
        const missingNames = missing.map((m: any) => m.name).join(', ');
        setDropdownError(`Please select ${missingNames}.`);
        showToast(`Please select ${missingNames}.`, 'error');
        return;
      }
    } else {
      if (
        product?.variants &&
        product.variants.some((v: any) => v.size && v.size !== 'Unstitched') &&
        !selectedSize
      ) {
        showToast('Please select a size.', 'error');
        return;
      }
      if (availableColors.length > 0 && !selectedColorId) {
        setColorError('Please select a color.');
        showToast('Please select a color.', 'error');
        return;
      }
    }

    const finalQty = Math.min(maxSelectableQty, quantity);
    const resolvedPrice =
      variantState.variant?.selling_price !== undefined && variantState.variant?.selling_price !== null
        ? Number(variantState.variant.selling_price)
        : Number(product.price) || 0;

    // Dynamically build option snapshot from current selections
    const optionsSnapshot: Record<string, string> = {};
    if (options && options.length > 0) {
      options.forEach((opt: any) => {
        const selectedValId = dropdownSelections[opt.id];
        if (selectedValId && Array.isArray(opt.product_option_values)) {
          const matchVal = opt.product_option_values.find((v: any) => v.id === selectedValId);
          if (matchVal && matchVal.value) {
            optionsSnapshot[opt.name] = matchVal.value;
          }
        }
      });
    }

    // Extract backward-compatible size and color
    let compatSize: string | undefined = undefined;
    let compatColor: CartItemColor | null = null;
    for (const [key, val] of Object.entries(optionsSnapshot)) {
      if (key.trim().toLowerCase() === 'size') {
        compatSize = val;
      } else if (key.trim().toLowerCase() === 'color') {
        compatColor = { id: '', name: val, code: null };
      }
    }

    const selectedVariantId = variantState.variant?.id || null;
    const selectedVariantSku = (variantState.variant as any)?.sku || null;

    const productPayload = {
      ...product,
      price: resolvedPrice,
      variantId: selectedVariantId,
      variant_id: selectedVariantId,
      variantSku: selectedVariantSku,
      variant_sku: selectedVariantSku,
      variantOptions: optionsSnapshot,
      variant_options: optionsSnapshot,
    };

    onAddToCart(
      productPayload,
      compatSize,
      finalQty,
      compatColor,
      selectedVariantId,
      optionsSnapshot,
      selectedVariantSku
    );
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 3000);
  };

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-white min-h-screen text-stone-900 pb-20 animate-fade-in">
      {/* 1. Breadcrumb Bar */}


      {/* Main PDP Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 md:pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 lg:gap-11 items-stretch">
          {/* LEFT COLUMN: Gallery & Images */}
          <div className="w-full lg:w-auto flex flex-col-reverse sm:flex-row gap-1 sm:gap-1.5 items-start justify-start shrink-0">
            {/* Thumbnails Sidebar */}
            <div className="flex sm:flex-col gap-1.5 sm:gap-2 overflow-x-auto sm:overflow-y-auto max-h-[560px] no-scrollbar shrink-0">
              {galleryImages.map((imgUrl: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedImageIndex(idx);
                    setOptionImageOverride(null);
                  }}
                  className={`relative w-16 h-20 sm:w-20 sm:h-25 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                    selectedImageIndex === idx && !optionImageOverride
                      ? 'border-stone-900 ring-2 ring-stone-900 ring-offset-1'
                      : 'border-stone-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Image
                    src={imgUrl}
                    alt={`Thumbnail view ${idx + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover object-center"
                  />
                </button>
              ))}
            </div>

            {/* Main Stage Image Viewer (Slightly increased max-w-[520px]) */}
            <div className="relative flex-1 sm:w-[520px] w-full max-w-[520px] shrink-0">
              <ProductMainImage
                src={currentMainImage}
                alt={product.title}
                brand={product.brand}
                onOpenZoom={() => setIsZoomOpen(true)}
              />
            </div>
          </div>

          {/* RIGHT COLUMN: Product Details & Buy Box */}
          <div className="w-full h-full flex flex-col justify-between lg:pl-2">
            {/* Top Product Information */}
            <div className="flex flex-col">
              {/* 1. Product Title */}
              <h1 className="font-brand-serif text-2xl sm:text-3xl font-normal text-stone-900 leading-tight">
                {product.title}
              </h1>

              {/* Minor horizontal line */}
              <div className="border-t border-stone-200/80 my-3 sm:my-3.5" />

              {/* 2. Reseller Info Card */}
              {(sellerData?.shop_name || sellerData?.store_image_url || product.resellerName || product.sellerStoreImageUrl) && (
                <div className="p-2.5 sm:p-3 rounded-lg border border-stone-200/80 bg-stone-50/70 flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xs">
                  <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full overflow-hidden shrink-0 border border-stone-200 bg-stone-100 flex items-center justify-center shadow-2xs">
                      {sellerImageUrl && !imgError ? (
                        <img
                          src={sellerImageUrl}
                          alt={storeName}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover rounded-full"
                          onError={() => setImgError(true)}
                        />
                      ) : (
                        <span className="text-xs sm:text-sm font-bold text-stone-700 uppercase">
                          {(storeName || 'S').slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] sm:text-xs lg:text-sm font-bold text-stone-900 truncate">
                          {storeName}
                        </span>
                      </div>
                      {sellerRating !== undefined && sellerRating !== null && Number(sellerRating) > 0 && (
                        <div className="flex items-center space-x-1.5 text-[9px] sm:text-[10px] lg:text-xs text-stone-500 mt-0.5">
                          <div className="flex items-center text-amber-600 font-bold">
                            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-3.5 lg:h-3.5 fill-amber-500 text-amber-500 mr-0.5 shrink-0" />
                            <span>{Number(sellerRating).toFixed(1)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {product.resellerId && onSelectReseller && (
                    <button
                      onClick={() => onSelectReseller(formatStoreSlug(product.seller?.shop_name || product.resellerName, product.resellerId!))}
                      className="text-[9px] sm:text-[10px] lg:text-xs font-bold text-stone-900 hover:text-black underline flex items-center space-x-1 px-2 sm:px-2.5 py-1 sm:py-1.5 bg-white border border-stone-200 rounded-xs hover:border-stone-400 transition-colors shadow-2xs shrink-0 cursor-pointer"
                    >
                      <span>Visit Store</span>
                      <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-3 lg:h-3 shrink-0" />
                    </button>
                  )}
                </div>
              )}

              {/* Minor horizontal line */}
              <div className="border-t border-stone-200/80 my-3 sm:my-3.5" />

              {/* 3. Price Box with Strikethrough & Discount Pill */}
              <div className="flex flex-wrap items-baseline gap-2.5 sm:gap-3">
                <span className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                  {displayPricing.priceText}
                </span>
                {displayPricing.compareAtPrice && displayPricing.compareAtPrice > (displayPricing.rawPrice || 0) && (
                  <span className="text-base sm:text-lg text-stone-400 line-through">
                    Rs. {displayPricing.compareAtPrice.toLocaleString()}
                  </span>
                )}
                {displayPricing.discountPercent && displayPricing.discountPercent > 0 && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {displayPricing.discountPercent}% OFF
                  </span>
                )}
                {displayPricing.isOutOfStock && (
                  <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    Out of stock
                  </span>
                )}
              </div>
              {/* Minor horizontal line */}
              <div className="border-t border-stone-200/80 my-2.5 sm:my-3" />

              {/* 4. Specifications Table (Dynamic height, capped so bottom section stays aligned with image) */}
              {specs && specs.length > 0 && (
                <div className="flex flex-col my-1">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5 shrink-0">
                    Specifications
                  </span>
                  <SpecificationsTable specs={specs} className="max-h-[190px] sm:max-h-[220px]" />
                </div>
              )}

              {/* Minor horizontal line between specs and variations if specs exist */}
              {specs && specs.length > 0 && (options.length > 0 || availableColors.length > 0 || (product?.variants && product.variants.length > 0)) && (
                <div className="border-t border-stone-200/80 my-2 sm:my-2.5" />
              )}

              {/* 5. Product Variations & Options Dropdowns (Placed below Specifications) */}
              {options && options.length > 0 ? (
                <div className="space-y-2.5 my-1.5 w-full">
                  <div className="flex flex-col gap-2.5 sm:gap-3 w-full">
                    {options.map((opt: any) => {
                      const selectedValId = dropdownSelections[opt.id];

                      return (
                        <div key={opt.id} className="w-full">
                          <div className="relative w-full">
                            <select
                              value={selectedValId || ''}
                              onChange={(e) => handleSelectOptionValue(opt.id, e.target.value)}
                              className="w-full appearance-none bg-white border border-stone-300 rounded-xs py-2 sm:py-2.5 pl-3.5 pr-9 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors cursor-pointer shadow-2xs"
                            >
                              <option value="" disabled>
                                Select {opt.name}
                              </option>
                              {opt.product_option_values?.map((val: any) => (
                                <option key={val.id} value={val.id}>
                                  {val.value}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {dropdownError && (
                    <p className="text-xs text-rose-600 font-medium">{dropdownError}</p>
                  )}
                </div>
              ) : (
                /* Legacy Variants / Colors fallback dropdowns (when product_options table has no records) */
                (availableColors.length > 0 || (product?.variants && product.variants.length > 0)) && (
                  <div className="space-y-2.5 my-1.5 w-full">
                    <div className="flex flex-col gap-2.5 sm:gap-3 w-full">
                      {/* Legacy Size Dropdown */}
                      {product?.variants &&
                        product.variants.some((v: any) => v.size && v.size !== 'Unstitched') && (
                          <div className="w-full">
                            <div className="relative w-full">
                              <select
                                value={selectedSize || ''}
                                onChange={(e) => setSelectedSize(e.target.value)}
                                className="w-full appearance-none bg-white border border-stone-300 rounded-xs py-2 sm:py-2.5 pl-3.5 pr-9 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors cursor-pointer shadow-2xs"
                              >
                                <option value="" disabled>
                                  Select Size
                                </option>
                                {Array.from(
                                  new Set(product.variants.map((v: any) => v.size).filter(Boolean))
                                ).map((sz: any) => (
                                  <option key={sz} value={sz}>
                                    {sz}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>
                        )}

                      {/* Legacy Color Dropdown */}
                      {availableColors.length > 0 && (
                        <div className="w-full">
                          <div className="relative w-full">
                            <select
                              value={selectedColorId || ''}
                              onChange={(e) => {
                                setSelectedColorId(e.target.value || null);
                                setColorError(null);
                              }}
                              className="w-full appearance-none bg-white border border-stone-300 rounded-xs py-2 sm:py-2.5 pl-3.5 pr-9 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors cursor-pointer shadow-2xs"
                            >
                              <option value="" disabled>
                                Select Color
                              </option>
                              {availableColors.map((colorItem) => (
                                <option key={colorItem.id} value={colorItem.id}>
                                  {colorItem.color_name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* BOTTOM SECTION: Add to Bag (Pinned to bottom of image) */}
            <div className="mt-auto pt-3 sm:pt-4 shrink-0">
              {/* Minor separator line */}
              <div className="border-t border-stone-200/80 mb-3 sm:mb-3.5" />

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
                  disabled={isOutOfStock}
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
                      : isOutOfStock
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
            </div>

            {/* Product Detail / Description (Hidden via single constant, code preserved) */}
            {SHOW_PRODUCT_DESCRIPTION && (
              <div className="border-t border-stone-200 divide-y divide-stone-200 mt-6">
                {(product.brand || product.condition || product.category || product.subcategory || product.fabric || product.color || product.defect) && (
                  <div className="py-4 border-b border-stone-200 divide-y divide-stone-200 bg-white text-xs">
                    {product.brand && (
                      <div className="p-3 flex justify-between">
                        <span className="text-stone-500 font-medium">Brand:</span>
                        <span className="text-stone-900 font-bold">{product.brand}</span>
                      </div>
                    )}
                    {product.condition && (
                      <div className="p-3 flex justify-between">
                        <span className="text-stone-500 font-medium">Condition:</span>
                        <span className="text-stone-900 font-bold capitalize">{product.condition}</span>
                      </div>
                    )}
                    {product.category && (
                      <div className="p-3 flex justify-between">
                        <span className="text-stone-500 font-medium">Category:</span>
                        <span className="text-stone-900 font-bold">{product.category}</span>
                      </div>
                    )}
                    {product.subcategory && (
                      <div className="p-3 flex justify-between">
                        <span className="text-stone-500 font-medium">Subcategory:</span>
                        <span className="text-stone-900 font-bold">{product.subcategory}</span>
                      </div>
                    )}
                    {product.fabric && (
                      <div className="p-3 flex justify-between">
                        <span className="text-stone-500 font-medium">Fabric Type:</span>
                        <span className="text-stone-900 font-bold">{product.fabric}</span>
                      </div>
                    )}
                    {product.pieceCount && (
                      <div className="p-3 flex justify-between">
                        <span className="text-stone-500 font-medium">Piece Count:</span>
                        <span className="text-stone-900 font-bold">{product.pieceCount}</span>
                      </div>
                    )}
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
                )}
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
              </div>
            )}
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
    space-x-1 sm:space-x-1.5

    px-2.5 sm:px-3 lg:px-3.5
    py-1.5 sm:py-2 lg:py-2

    bg-stone-900
    hover:bg-black
    text-white

    text-[9px] sm:text-[10px] lg:text-xs

    font-bold
    uppercase
    tracking-wide

    rounded-xs
    shadow-xs
    transition-all
    cursor-pointer

    min-w-fit
  "
            >
              <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-3.5 lg:h-3.5 text-amber-400 fill-amber-400 shrink-0" />

              <span className="whitespace-nowrap">
                Write a Review
              </span>
            </button>
          </div>


          {productReviews && productReviews.length > 0 ? (<div className="overflow-x-auto overflow-y-hidden scrollbar-thin pb-2"> <div className="flex flex-nowrap gap-4 sm:gap-5 lg:gap-5 w-max"> {productReviews.map((rev) => (<div key={rev.id} className=" shrink-0 w-[260px] sm:w-[280px] lg:w-[300px] p-4 sm:p-4.5 lg:p-5 rounded-lg border border-stone-200 bg-white flex flex-col justify-between " > <div> <div className="flex items-center justify-between mb-1.5 sm:mb-2"> <div className="flex text-amber-500"> {[...Array(rev.rating)].map((_, i) => (<Star key={i} className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-500 text-amber-500" />))} </div> <span className="text-[9px] sm:text-[10px] text-stone-400"> {rev.date} </span> </div> <p className="text-[10px] sm:text-xs text-stone-700 leading-relaxed mb-2.5 sm:mb-3"> "{rev.comment}" </p> {rev.resellerReply && (<div className="mt-2.5 sm:mt-3 p-2.5 sm:p-3 bg-amber-50/60 rounded-xs border-l-2 border-amber-500 text-[10px] sm:text-xs"> <span className="font-bold text-stone-900 block text-[9px] sm:text-[10px] mb-0.5"> Response from {product.resellerName || 'Seller'}: </span> <p className="text-stone-700 italic"> "{rev.resellerReply}" </p> </div>)} </div> <div className="pt-2.5 sm:pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-[10px] sm:text-xs mt-2.5 sm:mt-3"> <span className="font-bold text-stone-900 truncate"> {rev.userName} </span> {rev.verifiedPurchase && (<span className="text-[9px] sm:text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-xs border border-emerald-200 whitespace-nowrap"> ✓ Verified Buyer </span>)} </div> </div>))} </div> </div>) : (<div className="p-6 sm:p-7 bg-stone-50 border border-stone-200 rounded-lg text-center text-[10px] sm:text-xs text-stone-500 font-medium"> No reviews submitted yet for this collection item. </div>)}
        </div>

        {/* SPECIFICATION & DESCRIPTION SECTION */}
        <SpecificationDescription specs={specs} description={product.description || undefined} />
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
                src={currentMainImage}
                alt={product.title}
                loading="lazy"
                decoding="async"
                className="max-h-[72vh] sm:max-h-[80vh] w-auto object-contain rounded-md shadow-xl border border-stone-200/80 bg-white"
              />
            </div>

            {/* Gallery Thumbnail Selector inside Modal */}
            {galleryImages.length > 1 && (
              <div className="mt-3 sm:mt-4 flex items-center gap-2 overflow-x-auto max-w-full p-2 bg-white/80 border border-stone-200/80 rounded-lg shadow-2xs shrink-0">
                {galleryImages.map((imgUrl: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedImageIndex(idx);
                      setOptionImageOverride(null);
                    }}
                    className={`relative w-11 h-14 sm:w-14 sm:h-16 rounded-md overflow-hidden border-2 transition-all shrink-0 ${
                      selectedImageIndex === idx && !optionImageOverride
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
