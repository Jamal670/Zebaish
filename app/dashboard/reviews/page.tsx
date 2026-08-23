'use client';

import React, { Suspense } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { ReviewsView } from '@/components/reseller/components/ReviewsView';
import { Loader2 } from 'lucide-react';

function ReviewsPageContent() {
  const { resellerProfile, user } = useAuth();
  const activeSellerId = resellerProfile?.id || user?.id;

  return <ReviewsView sellerId={activeSellerId} />;
}

export default function ReviewsPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center shadow-2xs">
          <Loader2 className="w-8 h-8 animate-spin text-stone-700 mx-auto mb-3" />
          <p className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
            Loading Customer Reviews...
          </p>
        </div>
      }
    >
      <ReviewsPageContent />
    </Suspense>
  );
}
