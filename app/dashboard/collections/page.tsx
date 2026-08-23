'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useReseller } from '@/components/reseller/context/ResellerContext';
import { ListingsView } from '@/components/reseller/components/ListingsView';

export default function CollectionsPage() {
  const {
    myListings,
    toggleDeactivate,
    toggleSoldOut,
    handleDeleteListing,
    setEditingListing,
    setFormMode,
  } = useReseller();
  const router = useRouter();

  return (
    <ListingsView
      myListings={myListings}
      toggleDeactivate={toggleDeactivate}
      toggleSoldOut={toggleSoldOut}
      onDeleteListing={handleDeleteListing}
      onEditListing={(listing) => {
        setEditingListing(listing);
        setFormMode('edit');
        router.push('/dashboard/add-collection');
      }}
      onRestockListing={(listing) => {
        setEditingListing(listing);
        setFormMode('restock');
        router.push('/dashboard/add-collection');
      }}
    />
  );
}
