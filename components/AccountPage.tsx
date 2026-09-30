import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Heart, User, Truck, CheckCircle2, Star, LogOut, Loader2, ArrowRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { Product, Order, Review, CustomerOrderItem } from '@/types';
import useAuth from '@/src/hooks/useAuth';
import supabase from '@/src/api/client';

interface AccountPageProps {
  initialTab?: 'orders' | 'wishlist' | 'profile';
  wishlistIds: string[];
  customerOrders?: Order[];
  reviews?: Review[];
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
  onNavigateHome: () => void;
  onSubmitReview?: (review: Review) => void;
}

interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  seller_id: string;
  product_title: string;
  brand: string;
  quantity: number;
  price: number;
  subtotal: number;
  thumbnail_url: string;
}

interface DbOrder {
  id: string;
  order_number: string;
  created_at: string;
  order_status: string;
  courier_name?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  subtotal: number;
  items: DbOrderItem[];
}

const mapOrderStatusLabel = (rawStatus: string): { label: string; badgeStyle: string } => {
  const s = (rawStatus || '').trim().toLowerCase();
  if (s === 'pending' || s === 'confirmed' || s === 'processing') {
    return { label: 'ORDER PLACED', badgeStyle: 'bg-amber-100 text-amber-900 border border-amber-300' };
  }
  if (s === 'shipped') {
    return { label: 'SHIPPED', badgeStyle: 'bg-indigo-100 text-indigo-900 border border-indigo-300' };
  }
  if (s === 'delivered') {
    return { label: 'DELIVERED', badgeStyle: 'bg-emerald-100 text-emerald-800 border border-emerald-300' };
  }
  if (s === 'cancelled') {
    return { label: 'CANCELLED', badgeStyle: 'bg-rose-100 text-rose-800 border border-rose-300' };
  }
  if (s === 'refund') {
    return { label: 'REFUND', badgeStyle: 'bg-purple-100 text-purple-900 border border-purple-300' };
  }
  return { label: (rawStatus || 'ORDER PLACED').toUpperCase(), badgeStyle: 'bg-amber-100 text-amber-900 border border-amber-300' };
};

const formatOrderDate = (isoString?: string): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.slice(0, 10);
    return d.toISOString().split('T')[0];
  } catch {
    return (isoString || '').slice(0, 10);
  }
};

import { useQuery } from '@tanstack/react-query';

export const AccountPage: React.FC<AccountPageProps> = ({
  initialTab = 'orders',
  wishlistIds,
  reviews = [],
  onQuickView,
  onAddToCart,
  onToggleWishlist,
  onSelectProduct,
  onNavigateHome,
  onSubmitReview,
}) => {
  const router = useRouter();
  const { user, userProfile, logout, refetchProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'profile'>(initialTab);

  // Profile State
  const [profileData, setProfileData] = useState({
    firstName: userProfile?.first_name || user?.user_metadata?.first_name || 'Customer',
    lastName: userProfile?.last_name || user?.user_metadata?.last_name || 'User',
    email: userProfile?.email || user?.email || '',
    phone: userProfile?.phone_no || user?.user_metadata?.phone_no || '',
    city: 'Lahore',
    address: 'House 42, Block B, DHA Phase 5, Lahore, Pakistan',
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // TanStack Query for User Orders
  const { data: dbOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['userOrders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: rawOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (ordersErr || !rawOrders || rawOrders.length === 0) return [];

      const orderIds = rawOrders.map((o: any) => o.id);
      const [itemsRes, sellerOrdersRes] = await Promise.all([
        supabase.from('order_items').select('*').in('order_id', orderIds),
        supabase.from('seller_orders').select('order_id, seller_id, courier_name, tracking_number, status').in('order_id', orderIds),
      ]);

      const orderItems = itemsRes.data || [];
      const rawSellerOrders = sellerOrdersRes.data || [];

      const sellerOrdersByOrderId: Record<string, { courier_name?: string; tracking_number?: string; status?: string }[]> = {};
      rawSellerOrders.forEach((so: any) => {
        if (!sellerOrdersByOrderId[so.order_id]) {
          sellerOrdersByOrderId[so.order_id] = [];
        }
        sellerOrdersByOrderId[so.order_id].push({
          courier_name: so.courier_name,
          tracking_number: so.tracking_number,
          status: so.status,
        });
      });

      const productIds = Array.from(new Set(orderItems.map((item: any) => item.product_id).filter(Boolean)));
      let validProductIds = new Set<string>();

      if (productIds.length > 0) {
        const { data: validProds } = await supabase.from('products').select('id').in('id', productIds);
        if (validProds) {
          validProds.forEach((p: any) => validProductIds.add(p.id));
        }
      }

      const itemsByOrderId: Record<string, DbOrderItem[]> = {};
      orderItems.forEach((item: any) => {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        itemsByOrderId[item.order_id].push({
          id: item.id,
          order_id: item.order_id,
          product_id: item.product_id,
          seller_id: item.seller_id,
          product_title: validProductIds.has(item.product_id) ? (item.product_title || 'Designer Suit') : '[Product No Longer Available]',
          brand: item.brand || 'Luxury Brand',
          quantity: item.quantity || 1,
          price: Number(item.price) || 0,
          subtotal: Number(item.subtotal) || 0,
          thumbnail_url: item.thumbnail_url || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80',
        });
      });

      return rawOrders.map((o: any) => {
        const soList = sellerOrdersByOrderId[o.id] || [];
        const firstWithCourier = soList.find((so) => so.courier_name || so.tracking_number);
        const resolvedCourier = firstWithCourier?.courier_name || o.courier_name || undefined;
        const resolvedTracking = firstWithCourier?.tracking_number || o.tracking_number || undefined;

        return {
          id: o.id,
          order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
          created_at: o.created_at,
          order_status: o.order_status || 'Pending',
          courier_name: resolvedCourier,
          tracking_number: resolvedTracking,
          estimated_delivery: o.estimated_delivery || undefined,
          subtotal: Number(o.total_amount || o.subtotal || 0),
          items: itemsByOrderId[o.id] || [],
        };
      });
    },
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000,
  });

  // TanStack Query for User Wishlist Products
  const { data: wishlistProducts = [], isLoading: wishlistLoading } = useQuery({
    queryKey: ['userWishlistProducts', user?.id, wishlistIds],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: rawWishlists } = await supabase.from('wishlists').select('id').eq('user_id', user.id);
      if (!rawWishlists || rawWishlists.length === 0) return [];

      const wishlistIdsList = rawWishlists.map((w: any) => w.id);
      const { data: rawWishItems } = await supabase.from('wishlist_items').select('product_id').in('wishlist_id', wishlistIdsList);
      if (!rawWishItems || rawWishItems.length === 0) return [];

      const pIds = Array.from(new Set(rawWishItems.map((item: any) => item.product_id).filter(Boolean)));
      if (pIds.length === 0) return [];

      const { data: rawProducts } = await supabase
        .from('products')
        .select(`*, product_variants (id, size, quantity)`)
        .in('id', pIds);

      if (!rawProducts || rawProducts.length === 0) return [];

      const validPIds = rawProducts.map((p: any) => p.id);
      const imageMap: Record<string, string[]> = {};
      const { data: rawImages } = await supabase
        .from('product_images')
        .select('product_id, image_url, is_thumbnail')
        .in('product_id', validPIds);

      if (rawImages) {
        rawImages.forEach((img: any) => {
          if (!imageMap[img.product_id]) imageMap[img.product_id] = [];
          if (img.is_thumbnail) imageMap[img.product_id].unshift(img.image_url);
          else imageMap[img.product_id].push(img.image_url);
        });
      }

      return rawProducts.map((p: any) => {
        const imgs = imageMap[p.id] || [];
        const mainImg = imgs[0] || p.image_url || 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?q=80&w=800&auto=format&fit=crop';
        return {
          id: p.id,
          title: p.suit_title || 'Branded Leftover Suit',
          brand: p.brand || 'Luxury Brand',
          price: Number(p.price) || 0,
          originalPrice: Number(p.original_price) > Number(p.price) ? Number(p.original_price) : undefined,
          currency: 'Rs.',
          image: mainImg,
          hoverImage: imgs[1] || mainImg,
          additionalImages: imgs,
          badge: p.badge || undefined,
          category: p.category || 'Unstitched',
          subcategory: p.subcategory || '',
          stitchingStatus: p.stitching_status || 'Unstitched',
          pieceCount: p.piece_count || '3-Piece',
          fabric: p.fabric || 'Lawn',
          color: p.color || 'Multi',
          occasion: p.occasion || 'Casual',
          description: p.description || '',
          inStock: true,
          listingStatus: 'Active In Stock' as const,
          resellerId: p.seller_id,
          resellerName: p.reseller_name || 'Verified Reseller',
          variants: Array.isArray(p.product_variants)
            ? p.product_variants.map((v: any) => ({
                id: v.id,
                size: v.size,
                quantity: Number(v.quantity) || 0,
              }))
            : [],
        };
      });
    },
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000,
  });

  // Fetch real User Profile from DB
  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;
    const userEmail = user.email || '';
    let isMounted = true;

    async function loadUserProfileFromDb() {
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (dbUser && isMounted) {
          setProfileData((prev) => ({
            ...prev,
            firstName: dbUser.first_name || userProfile?.first_name || prev.firstName,
            lastName: dbUser.last_name || userProfile?.last_name || prev.lastName,
            email: dbUser.email || userEmail || prev.email,
            phone: dbUser.phone_no || userProfile?.phone_no || prev.phone,
            city: dbUser.city || prev.city,
            address: dbUser.address || prev.address,
          }));
        }
      } catch (err) {
        console.error('Error fetching user record from DB:', err);
      }
    }

    loadUserProfileFromDb();

    return () => {
      isMounted = false;
    };
  }, [user?.id, userProfile]);

  // Modal for review
  const [reviewModalTarget, setReviewModalTarget] = useState<{
    orderId: string;
    orderItemId: string;
    productId: string;
    sellerId: string;
    title: string;
    brand: string;
    thumbnailUrl: string;
  } | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [checkingReviewKey, setCheckingReviewKey] = useState<string | null>(null);
  const [reviewedProductIds, setReviewedProductIds] = useState<Set<string>>(new Set());
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fullName = `${profileData.firstName} ${profileData.lastName}`.trim() || 'Customer User';

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    if (user?.id) {
      try {
        const { error } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            first_name: profileData.firstName.trim(),
            last_name: profileData.lastName.trim(),
            email: profileData.email.trim(),
            phone_no: profileData.phone.trim(),
            city: profileData.city.trim(),
            address: profileData.address.trim(),
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error('Error saving user profile:', error);
        } else {
          await refetchProfile();
        }
      } catch (err) {
        console.error('Unexpected error saving user profile:', err);
      }
    }

    setIsSaving(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const handleOrderAgain = (productId: string) => {
    router.push(`/product/${productId}`);
  };

  // Open review modal after checking user_id + product_id review eligibility on click
  const handleOpenReviewModal = async (orderId: string, item: DbOrderItem) => {
    if (!user?.id) return;
    const userId = user.id;

    if (reviewedProductIds.has(item.product_id)) {
      setNoticeMessage('You have already reviewed this product.');
      setTimeout(() => setNoticeMessage(null), 4000);
      return;
    }

    setCheckingReviewKey(`${userId}-${item.product_id}`);
    try {
      // Query DB for existing review matching user_id + product_id
      const { data: existingRev, error: checkErr } = await supabase
        .from('reviews')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', item.product_id)
        .maybeSingle();

      if (checkErr) {
        console.error('Error checking existing review:', checkErr);
      }

      if (existingRev) {
        setReviewedProductIds((prev) => new Set(prev).add(item.product_id));
        setNoticeMessage('You have already reviewed this product.');
        setTimeout(() => setNoticeMessage(null), 4000);
        setCheckingReviewKey(null);
        return;
      }

      // Fetch seller_id from products record first if available, otherwise from item.seller_id
      let resolvedSellerId = item.seller_id || '';
      if (item.product_id) {
        const { data: prodData } = await supabase
          .from('products')
          .select('seller_id')
          .eq('id', item.product_id)
          .maybeSingle();

        if (prodData?.seller_id) {
          resolvedSellerId = prodData.seller_id;
        }
      }

      setReviewModalTarget({
        orderId,
        orderItemId: item.id,
        productId: item.product_id,
        sellerId: resolvedSellerId,
        title: item.product_title,
        brand: item.brand,
        thumbnailUrl: item.thumbnail_url,
      });
      setRating(5);
      setComment('');
      setReviewError(null);
    } catch (err) {
      console.error('Unexpected error checking review eligibility:', err);
    } finally {
      setCheckingReviewKey(null);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalTarget || !user?.id) return;

    if (rating < 1 || rating > 5) {
      setReviewError('Please select a rating between 1 and 5 stars.');
      return;
    }

    if (!comment.trim()) {
      setReviewError('Please write your review before submitting.');
      return;
    }

    const userId = user.id;
    const { orderId, orderItemId, productId } = reviewModalTarget;

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      // 1. Double check existing review before insert
      const { data: existingRev } = await supabase
        .from('reviews')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .maybeSingle();

      if (existingRev) {
        setReviewedProductIds((prev) => new Set(prev).add(productId));
        setIsSubmittingReview(false);
        setReviewModalTarget(null);
        setNoticeMessage('You have already reviewed this product.');
        setTimeout(() => setNoticeMessage(null), 4000);
        return;
      }

      // 2. Verify actual purchase from loaded user orders
      const localOrder = dbOrders.find((o) => o.id === orderId);
      const localItem = localOrder?.items.find((i) => i.id === orderItemId && i.product_id === productId);

      if (!localOrder || !localItem) {
        setReviewError('You can only submit reviews for products in your actual purchases.');
        setIsSubmittingReview(false);
        return;
      }

      // Resolve seller_id (Preferred: products.seller_id, Fallback: order_items.seller_id)
      let targetSellerId = reviewModalTarget.sellerId || localItem.seller_id || '';

      if (!targetSellerId) {
        const { data: prodData } = await supabase
          .from('products')
          .select('seller_id')
          .eq('id', productId)
          .maybeSingle();

        if (prodData?.seller_id) {
          targetSellerId = prodData.seller_id;
        } else {
          const { data: itemData } = await supabase
            .from('order_items')
            .select('seller_id')
            .eq('id', orderItemId)
            .maybeSingle();

          if (itemData?.seller_id) {
            targetSellerId = itemData.seller_id;
          }
        }
      }

      if (!targetSellerId) {
        setReviewError('Unable to identify the seller for this product.');
        setIsSubmittingReview(false);
        return;
      }

      // 3. Insert review into `reviews` table including seller_id
      let insertPayload: Record<string, any> = {
        product_id: productId,
        order_item_id: orderItemId,
        user_id: userId,
        seller_id: targetSellerId,
        rating: rating,
        review: comment.trim(),
        status: 'Pending',
      };

      let { error: insertErr } = await supabase
        .from('reviews')
        .insert(insertPayload);

      // Fallback Retry 1: If DB schema does not have `order_item_id` column
      if (insertErr && (insertErr.message?.includes('order_item_id') || insertErr.details?.includes('order_item_id') || insertErr.code === 'PGRST204')) {
        console.warn('Retrying review insertion without order_item_id column...');
        delete insertPayload.order_item_id;
        const retryRes = await supabase
          .from('reviews')
          .insert(insertPayload);
        insertErr = retryRes.error;
      }

      // Fallback Retry 2: If DB schema does not have `status` column
      if (insertErr && (insertErr.message?.includes('status') || insertErr.details?.includes('status'))) {
        console.warn('Retrying review insertion without status column...');
        delete insertPayload.status;
        const retryRes = await supabase
          .from('reviews')
          .insert(insertPayload);
        insertErr = retryRes.error;
      }

      if (insertErr) {
        const errMsg = insertErr.message || insertErr.details || JSON.stringify(insertErr);
        console.error('Error inserting review:', errMsg);
        if (insertErr.code === '23505' || errMsg.includes('unique') || errMsg.includes('duplicate') || errMsg.includes('already exists')) {
          setReviewedProductIds((prev) => new Set(prev).add(productId));
          setIsSubmittingReview(false);
          setReviewModalTarget(null);
          setNoticeMessage('You have already reviewed this product.');
          setTimeout(() => setNoticeMessage(null), 4000);
          return;
        }
        setReviewError(`Failed to submit review: ${errMsg}`);
        setIsSubmittingReview(false);
        return;
      }

      // 4. Success response
      setReviewedProductIds((prev) => new Set(prev).add(productId));
      setIsSubmittingReview(false);
      setReviewModalTarget(null);
      setComment('');
      setRating(5);
      setSuccessMessage('Your review has been submitted successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Unexpected error submitting review:', err);
      setReviewError('An unexpected error occurred. Please try again.');
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-10">
        {/* Global Notifications */}
        {noticeMessage && (
          <div className="mb-6 p-3.5 sm:p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-[10px] sm:text-xs lg:text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in">
            <span>{noticeMessage}</span>
            <button onClick={() => setNoticeMessage(null)} className="text-amber-700 hover:text-amber-950 font-bold ml-4 text-[10px] sm:text-xs lg:text-sm">✕</button>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-3.5 sm:p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-[10px] sm:text-xs lg:text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-950 font-bold ml-4 text-[10px] sm:text-xs lg:text-sm">✕</button>
          </div>
        )}

        {/* Header Profile Summary */}
        <div className="bg-stone-900 text-white rounded-lg p-5 sm:p-6 lg:p-7 mb-6 sm:mb-8 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* User Details */}
          <div className="flex items-center space-x-3.5 sm:space-x-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-400 text-stone-950 font-bold text-base sm:text-lg flex items-center justify-center shrink-0">
              {fullName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight font-script truncate">
                Welcome back, {fullName}
              </h1>

              <p className="text-xs sm:text-sm text-stone-400 mt-0.5 truncate">
                {profileData.email}
                {profileData.phone ? ` • ${profileData.phone}` : ''}
              </p>
            </div>
          </div>

          {/* Logout */}
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={handleLogout}
              className="bg-stone-800 hover:bg-stone-700 text-white font-semibold px-3.5 py-2 rounded-md flex items-center justify-center space-x-1.5 border border-stone-700 transition-colors cursor-pointer text-xs sm:text-sm w-full sm:w-auto"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher Bar */}
        <div className="bg-white border border-stone-200 rounded-lg p-1.5 mb-6 sm:mb-8 flex space-x-1.5 sm:space-x-2 shadow-2xs">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xs text-xs sm:text-sm lg:text-base font-bold uppercase tracking-wide sm:tracking-wider flex items-center justify-center space-x-2 transition-all ${activeTab === 'orders'
              ? 'bg-stone-900 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
              }`}
          >
            <span>Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('wishlist')}
            className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xs text-xs sm:text-sm lg:text-base font-bold uppercase tracking-wide sm:tracking-wider flex items-center justify-center space-x-2 transition-all ${activeTab === 'wishlist'
              ? 'bg-stone-900 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
              }`}
          >
            <span>Wishlist</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xs text-xs sm:text-sm lg:text-base font-bold uppercase tracking-wide sm:tracking-wider flex items-center justify-center space-x-2 transition-all ${activeTab === 'profile'
              ? 'bg-stone-900 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100'
              }`}
          >
            <span>Profile</span>
          </button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-4 sm:space-y-6">
            {ordersLoading ? (
              <div className="bg-white border border-stone-200 rounded-lg p-8 sm:p-12 text-center my-4 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-stone-700 mx-auto" />
                <p className="text-xs sm:text-sm lg:text-base font-semibold uppercase tracking-wider text-stone-600">
                  Loading Your Orders...
                </p>
              </div>
            ) : dbOrders.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-lg p-8 sm:p-12 text-center my-4">
                <Package className="w-10 h-10 sm:w-12 sm:h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-sm sm:text-base lg:text-lg font-bold text-stone-900 uppercase tracking-wider">No Orders Placed Yet</h3>
                <button
                  onClick={onNavigateHome}
                  className="mt-5 sm:mt-6 inline-block bg-stone-900 text-white text-xs sm:text-sm lg:text-base font-bold px-5 sm:px-6 py-2.5 sm:py-3 rounded-xs uppercase tracking-wider hover:bg-black transition-colors"
                >
                  EXPLORE SURPLUS CATALOG
                </button>
              </div>
            ) : (
              dbOrders.map((order) => {
                const statusMeta = mapOrderStatusLabel(order.order_status);
                const formattedDate = formatOrderDate(order.created_at);
                const courierName = (order.courier_name || '').trim();
                const trackingNumber = (order.tracking_number || '').trim();
                const hasCourierAndTracking = Boolean(courierName && trackingNumber);

                return (
                  <div key={order.id} className="bg-white border border-stone-200 rounded-lg p-4 sm:p-6 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-stone-200 gap-2">
                      <div>
                        <span className="text-[10px] sm:text-xs lg:text-sm font-bold text-stone-400 uppercase tracking-widest block">
                          ORDER REF
                        </span>
                        <h3 className="text-xs sm:text-sm lg:text-base font-extrabold text-stone-900 font-mono">{order.order_number}</h3>
                        <span className="text-[10px] sm:text-xs lg:text-sm text-stone-500">Placed on {formattedDate}</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-xs sm:text-sm lg:text-base font-bold text-stone-900">
                          Subtotal: Rs. {order.subtotal.toLocaleString()}
                        </span>
                        <span
                          className={`text-[10px] sm:text-xs lg:text-sm font-extrabold uppercase px-2.5 sm:px-3 py-1 rounded-full ${statusMeta.badgeStyle}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    {/* Tracking Bar - Displayed ONLY when BOTH seller_orders.courier_name AND seller_orders.tracking_number exist and are non-empty */}
                    {hasCourierAndTracking && (
                      <div className="p-0.5 bg-stone-50 rounded-xs border border-stone-200 text-[10px] sm:text-xs lg:text-sm text-stone-700">
                        <span>
                          TrackId: <strong className="font-mono font-medium">{trackingNumber}</strong>
                          {' - '}
                          <strong className="font-medium">{courierName}</strong>
                        </span>
                      </div>
                    )}

                    {/* Order Items */}
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-row items-center justify-between text-xs sm:text-sm lg:text-base p-3 bg-stone-50/60 rounded-xs border border-stone-100 gap-3"
                        >
                          {/* Left Side - Product Information */}
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <img
                              src={item.thumbnail_url}
                              alt={item.product_title}
                              className="w-12 h-16 sm:w-14 sm:h-20 object-cover object-top rounded-xs border border-stone-200 shrink-0"
                            />

                            <div className="min-w-0">
                              <span className="text-[10px] sm:text-xs lg:text-sm font-bold text-stone-400 uppercase">
                                {item.brand}
                              </span>

                              <p className="font-semibold text-stone-900 text-xs sm:text-sm lg:text-base truncate">
                                {item.product_title}
                              </p>

                              <span className="text-stone-500 text-[10px] sm:text-xs lg:text-sm whitespace-nowrap">
                                Qty: {item.quantity} • Price: Rs. {item.price.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Right Side - Buttons, Always Vertically Centered */}
                          <div className="flex items-center justify-center shrink-0">
                            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar">
                              <button
                                onClick={() => handleOrderAgain(item.product_id)}
                                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-[10px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider rounded-xs transition-colors shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <span className="whitespace-nowrap">Order Again</span>
                                <ArrowRight className="w-3 h-3 shrink-0" />
                              </button>

                              <button
                                onClick={() => handleOpenReviewModal(order.id, item)}
                                disabled={checkingReviewKey === `${user?.id}-${item.product_id}`}
                                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-white border border-stone-300 hover:border-stone-900 text-stone-800 hover:text-black text-[10px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider rounded-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                              >
                                {checkingReviewKey === `${user?.id}-${item.product_id}` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-700 shrink-0" />
                                ) : (
                                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                )}

                                <span className="whitespace-nowrap">Write a Review</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Review Modal */}
        {reviewModalTarget && (
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
                  onClick={() => setReviewModalTarget(null)}
                  className="p-1 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-700 text-xs sm:text-sm lg:text-base"
                >
                  ✕
                </button>
              </div>

              {/* Product Information Summary */}
              <div className="flex items-center space-x-3 p-3 bg-stone-50 rounded-xs border border-stone-200 mb-4">
                <img
                  src={reviewModalTarget.thumbnailUrl}
                  alt={reviewModalTarget.title}
                  className="w-12 h-16 sm:w-14 sm:h-18 object-cover object-top rounded-xs border border-stone-200 shrink-0"
                />
                <div>
                  <span className="text-[10px] sm:text-xs lg:text-sm font-bold text-stone-400 uppercase block">{reviewModalTarget.brand}</span>
                  <h4 className="text-xs sm:text-sm lg:text-base font-semibold text-stone-900 line-clamp-2">{reviewModalTarget.title}</h4>
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
                    onClick={() => setReviewModalTarget(null)}
                    disabled={isSubmittingReview}
                    className="px-3.5 sm:px-4 py-2 border border-stone-300 text-stone-700 font-bold uppercase tracking-wider text-xs sm:text-sm lg:text-base rounded-xs hover:bg-stone-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="px-4 sm:px-5 py-2 bg-stone-900 hover:bg-black text-white font-bold uppercase tracking-wider text-xs sm:text-sm lg:text-base rounded-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
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

        {/* TAB 2: WISHLIST */}
        {activeTab === 'wishlist' && (
          <div>
            {wishlistLoading ? (
              <div className="bg-white border border-stone-200 rounded-lg p-8 sm:p-12 text-center my-4 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-stone-700 mx-auto" />
                <p className="text-xs sm:text-sm lg:text-base font-semibold uppercase tracking-wider text-stone-600">
                  Loading...
                </p>
              </div>
            ) : wishlistProducts.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-lg p-8 sm:p-12 text-center my-4">
                <Heart className="w-10 h-10 sm:w-12 sm:h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-sm sm:text-base lg:text-lg font-bold text-stone-900 uppercase">Your Wishlist is Empty</h3>
                <button
                  onClick={onNavigateHome}
                  className="mt-5 sm:mt-6 inline-block bg-stone-900 text-white text-xs sm:text-sm lg:text-base font-bold px-5 sm:px-6 py-2.5 sm:py-3 rounded-xs uppercase tracking-wider hover:bg-black transition-colors"
                >
                  BROWSE SURPLUS CATALOG
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {wishlistProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onQuickView={onQuickView}
                    onAddToCart={onAddToCart}
                    onToggleWishlist={onToggleWishlist}
                    isWishlisted={true}
                    onSelectProduct={onSelectProduct}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROFILE & ADDRESSES */}
        {activeTab === 'profile' && (
          <div className="bg-white border border-stone-200 rounded-lg p-5 sm:p-8 max-w-2xl mx-auto shadow-2xs">
            <h2 className="text-sm sm:text-base lg:text-lg font-bold uppercase tracking-wider text-stone-900 mb-5 sm:mb-6 pb-2 border-b border-stone-200">
              EDIT ACCOUNT PROFILE
            </h2>

            <form onSubmit={handleProfileSave} className="space-y-4 text-xs sm:text-sm lg:text-base">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1 text-xs sm:text-sm lg:text-base">First Name</label>
                  <input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    className="w-full p-2.5 sm:p-3 border border-stone-300 rounded-xs focus:outline-none focus:border-stone-900 text-xs sm:text-sm lg:text-base"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1 text-xs sm:text-sm lg:text-base">Last Name</label>
                  <input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                    className="w-full p-2.5 sm:p-3 border border-stone-300 rounded-xs focus:outline-none focus:border-stone-900 text-xs sm:text-sm lg:text-base"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1 text-xs sm:text-sm lg:text-base">Email Address</label>
                <input
                  type="email"
                  readOnly
                  disabled
                  value={profileData.email}
                  className="w-full p-2.5 sm:p-3 border border-stone-200 bg-stone-100 text-stone-600 rounded-xs cursor-not-allowed text-xs sm:text-sm lg:text-base"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1 text-xs sm:text-sm lg:text-base">Phone Number</label>
                <input
                  type="text"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="w-full p-2.5 sm:p-3 border border-stone-300 rounded-xs focus:outline-none focus:border-stone-900 text-xs sm:text-sm lg:text-base"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1 text-xs sm:text-sm lg:text-base">City</label>
                <input
                  type="text"
                  value={profileData.city}
                  onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                  className="w-full p-2.5 sm:p-3 border border-stone-300 rounded-xs focus:outline-none focus:border-stone-900 text-xs sm:text-sm lg:text-base"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1 text-xs sm:text-sm lg:text-base">Default Shipping Address</label>
                <textarea
                  rows={3}
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  className="w-full p-2.5 sm:p-3 border border-stone-300 rounded-xs focus:outline-none focus:border-stone-900 text-xs sm:text-sm lg:text-base"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 bg-stone-900 hover:bg-black disabled:bg-stone-500 text-white text-xs sm:text-sm lg:text-base font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer"
                >
                  {isSaving ? 'SAVING...' : isSaved ? 'PROFILE SAVED ✓' : 'SAVE CHANGES'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
