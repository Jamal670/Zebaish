'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useReseller } from '@/components/reseller/context/ResellerContext';
import { NewListingForm } from '@/components/reseller/components/NewListingForm';
import { Loader2 } from 'lucide-react';

function AddCollectionContent() {
  const { editingListing, formMode, setEditingListing, setFormMode } = useReseller();
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleFinish = () => {
    setEditingListing(null);
    setFormMode('create');
    router.push('/dashboard/collections');
  };

  const paramId = searchParams.get('id');
  const paramMode = (searchParams.get('mode') as 'create' | 'edit' | 'restock') || formMode;

  return (
    <NewListingForm
      editingListing={editingListing}
      productId={paramId || editingListing?.id}
      mode={paramMode}
      onSuccess={handleFinish}
      onCancel={handleFinish}
    />
  );
}

export default function AddCollectionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-stone-800" />
          <p className="text-xs font-medium text-stone-500">Loading form...</p>
        </div>
      }
    >
      <AddCollectionContent />
    </Suspense>
  );
}
