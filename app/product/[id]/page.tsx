'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProductDetailPage } from '@/components/ProductDetailPage';
import { ALL_PRODUCTS } from '@/data/mockData';
import { useApp } from '@/components/context/AppContext';
import { Product, Review } from '@/types';
import useAuth from '@/src/hooks/useAuth';
import { fetchProductById, fetchProductReviews, fetchWishlistRecommendations } from '@/src/api/collectionService';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const { user } = useAuth();

  const {
    handleAddToCart,
    handleToggleWishlist,
    wishlistIds,
  } = useApp();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProgressiveData() {
      if (!productId) {
        if (isMounted) setLoading(false);
        return;
      }

      setLoading(true);

      // 1. FIRST QUERY: Fetch product main data and render product UI immediately
      const res = await fetchProductById(productId);
      if (!isMounted) return;

      setProduct(res.product);
      setLoading(false); // Product UI renders immediately!

      if (!res.product) return;

      // 2. SECOND QUERY: Fetch 5 reviews & reviewer names from users table
      const reviewsData = await fetchProductReviews(productId, 5);
      if (!isMounted) return;
      setReviews(reviewsData);

      // 3. THIRD QUERY: Fetch wishlist recommendations for logged-in user
      if (user?.id) {
        const recsData = await fetchWishlistRecommendations(user.id, productId);
        if (isMounted) {
          setRelatedProducts(recsData);
        }
      } else {
        if (isMounted) setRelatedProducts([]);
      }
    }

    loadProgressiveData();

    return () => {
      isMounted = false;
    };
  }, [productId, user?.id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-stone-800" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Loading Product Details...
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
        <p className="text-stone-500 mb-6">The product you are looking for does not exist or has been removed.</p>
        <Link
          href="/shop"
          className="px-6 py-2.5 bg-stone-900 text-white rounded-md text-sm font-semibold uppercase tracking-wider hover:bg-black transition-colors"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  const handleSelectProduct = (relProduct: Product) => {
    router.push(`/product/${relProduct.id}`);
  };

  const handleSelectReseller = (resellerId: string) => {
    router.push(`/store/${resellerId}`);
  };

  const handleNavigateHome = () => {
    router.push('/');
  };

  const handleNavigateCollection = () => {
    const cat = product.brand || product.category || 'Surplus';
    router.push(`/shop?category=${encodeURIComponent(cat)}`);
  };

  return (
    <ProductDetailPage
      product={product}
      reviews={reviews}
      relatedProducts={relatedProducts}
      onAddToCart={handleAddToCart}
      onToggleWishlist={handleToggleWishlist}
      isWishlisted={wishlistIds.includes(product.id)}
      onSelectProduct={handleSelectProduct}
      onSelectReseller={handleSelectReseller}
      onNavigateHome={handleNavigateHome}
      onNavigateCollection={handleNavigateCollection}
    />
  );
}
