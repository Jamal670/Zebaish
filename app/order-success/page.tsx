'use client';

import React, { Suspense } from 'react';
import { OrderSuccessPage } from '@/components/OrderSuccessPage';
import { Loader2 } from 'lucide-react';

function OrderSuccessFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 text-stone-900">
      <Loader2 className="w-8 h-8 animate-spin text-stone-700 mb-3" />
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
        Loading Order Confirmation...
      </p>
    </div>
  );
}

export default function OrderSuccessRoutePage() {
  return (
    <Suspense fallback={<OrderSuccessFallback />}>
      <OrderSuccessPage />
    </Suspense>
  );
}
