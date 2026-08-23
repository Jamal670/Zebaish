'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckoutPage } from '@/components/CheckoutPage';
import { useApp } from '@/components/context/AppContext';
import { useAuth } from '@/src/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function CheckoutRoutePage() {
  const router = useRouter();
  const { cartItems, clearCart } = useApp();
  const { role, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (role === 'seller') {
      // Authenticated Seller attempting to access Checkout -> Redirect to Seller Dashboard
      router.replace('/dashboard');
    }
  }, [role, loading, router]);

  if (loading || role === 'seller') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 text-stone-900">
        <Loader2 className="w-8 h-8 animate-spin text-stone-700 mb-3" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Loading Checkout...
        </p>
      </div>
    );
  }

  const handleCompleteOrder = (orderId: string, orderNumber: string) => {
    clearCart();
    router.push(`/order-success?order_id=${encodeURIComponent(orderId)}&order_number=${encodeURIComponent(orderNumber)}`);
  };

  const handleNavigateHome = () => {
    router.push('/');
  };

  return (
    <CheckoutPage
      cartItems={cartItems}
      onCompleteOrder={handleCompleteOrder}
      onNavigateHome={handleNavigateHome}
    />
  );
}
