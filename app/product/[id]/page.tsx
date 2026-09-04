'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProductDetailPage } from '@/components/ProductDetailPage';
import { ALL_PRODUCTS } from '@/data/mockData';
import { useApp } from '@/components/context/AppContext';
import { Product, Review } from '@/types';
import useAuth from '@/src/hooks/useAuth';
import { fetchProductById, fetchProductReviews } from '@/src/api/collectionService';
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
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Primary 2-Query sequential loader effect (runs ONCE per productId)
  useEffect(() => {
    let isMounted = true;

    async function loadProductDataSequentially() {
      if (!productId) {
        if (isMounted) setLoading(false);
        return;
      }

      setLoading(true);
      setReviewsLoading(true);

      // ==========================================
      // QUERY 1 — Product Details (runs first, blocks initial render)
      // ==========================================
      let loadedProduct: Product | null = null;
      try {
        const res = await fetchProductById(productId);
        if (!isMounted) return;
        loadedProduct = res.product;
        setProduct(loadedProduct);
      } catch (err) {
        console.error('Error fetching Query 1 (Product Details):', err);
        if (isMounted) setProduct(null);
      } finally {
        // Render product UI immediately on Query 1 completion!
        if (isMounted) setLoading(false);
      }

      // If Query 1 returned no product, DO NOT fire Query 2!
      if (!loadedProduct) {
        if (isMounted) setReviewsLoading(false);
        return;
      }

      // ==========================================
      // QUERY 2 — Reviews (runs strictly AFTER Query 1 succeeds)
      // ==========================================
      try {
        const reviewsData = await fetchProductReviews(productId, 5);
        if (isMounted) {
          setReviews(reviewsData);
        }
      } catch (err) {
        console.error('Error fetching Query 2 (Reviews):', err);
        if (isMounted) setReviews([]);
      } finally {
        if (isMounted) setReviewsLoading(false);
      }
    }

    loadProductDataSequentially();

    return () => {
      isMounted = false;
    };
  }, [productId]);

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
      reviewsLoading={reviewsLoading}
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
