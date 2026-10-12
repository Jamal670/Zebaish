import React from 'react';
import { CartItemColor as CartItemColorType } from '@/types';

interface CartItemColorProps {
  color?: CartItemColorType | null;
  className?: string;
}

/**
 * Unified presentational component for rendering a cart item's color swatch + name.
 * Used identically in CartDrawer, CartPage, and CheckoutPage.
 */
export const CartItemColor: React.FC<CartItemColorProps> = ({ color, className = '' }) => {
  // If no color or name is missing, render nothing (no empty gap or placeholder text)
  if (!color || !color.name) {
    return null;
  }

  // If code is null or unavailable, show neutral gray (#9CA3AF / stone-400)
  const swatchBg = color.code || '#9CA3AF';

  return (
    <div className={`inline-flex items-center gap-1.5 text-stone-600 max-w-full ${className}`}>
      <span
        aria-hidden="true"
        className="w-3.5 h-3.5 rounded-full shrink-0 border border-stone-300 shadow-2xs"
        style={{ backgroundColor: swatchBg }}
      />
      <span className="truncate text-xs capitalize text-stone-600 font-medium">
        {color.name}
      </span>
    </div>
  );
};
