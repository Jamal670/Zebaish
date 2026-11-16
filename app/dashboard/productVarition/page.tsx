'use client';

import React, { Suspense } from 'react';
import { ProductVarition } from '@/components/reseller/components/productVarition';
import { Loader2 } from 'lucide-react';

export default function ProductVariationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-stone-800" />
          <p className="text-xs font-medium text-stone-500">Loading variations...</p>
        </div>
      }
    >
      <ProductVarition />
    </Suspense>
  );
}
