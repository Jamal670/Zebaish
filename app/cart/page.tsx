'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CartPage } from '@/components/CartPage';
import { useApp } from '@/components/context/AppContext';

export default function CartRoutePage() {
  const router = useRouter();
  const {
    cartItems,
    handleUpdateQuantity,
    handleRemoveCartItem,
  } = useApp();

  const handleProceedToCheckout = () => {
    router.push('/checkout');
  };

  const handleNavigateHome = () => {
    router.push('/');
  };

  return (
    <CartPage
      cartItems={cartItems}
      onUpdateQuantity={handleUpdateQuantity}
      onRemoveItem={handleRemoveCartItem}
      onProceedToCheckout={handleProceedToCheckout}
      onNavigateHome={handleNavigateHome}
    />
  );
}
