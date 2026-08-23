'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useReseller } from '@/components/reseller/context/ResellerContext';
import { NewListingForm } from '@/components/reseller/components/NewListingForm';

export default function AddCollectionPage() {
  const { editingListing, formMode, setEditingListing, setFormMode } = useReseller();
  const router = useRouter();

  const handleFinish = () => {
    setEditingListing(null);
    setFormMode('create');
    router.push('/dashboard/collections');
  };

  return (
    <NewListingForm
      editingListing={editingListing}
      mode={formMode}
      onSuccess={handleFinish}
      onCancel={handleFinish}
    />
  );
}
