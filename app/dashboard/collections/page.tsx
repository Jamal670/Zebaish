'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useReseller } from '@/components/reseller/context/ResellerContext';
import { useListingDraft } from '@/components/reseller/context/ListingDraftContext';
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
  const { goToEdit } = useListingDraft();
  const router = useRouter();

  return (
    <ListingsView
      myListings={myListings}
      toggleDeactivate={toggleDeactivate}
      toggleSoldOut={toggleSoldOut}
      onDeleteListing={handleDeleteListing}
      onEditListing={(listingOrId) => {
        const listingId = typeof listingOrId === 'string' ? listingOrId : (listingOrId?.id || '');
        setEditingListing(null);
        setFormMode('edit');
        if (listingId) {
          goToEdit(listingId);
        } else {
          router.push('/dashboard/add-collection');
        }
      }}
      onRestockListing={(listingOrId) => {
        const listingId = typeof listingOrId === 'string' ? listingOrId : (listingOrId?.id || '');
        setEditingListing(null);
        setFormMode('restock');
        router.push(listingId ? `/dashboard/add-collection?id=${listingId}&mode=restock` : '/dashboard/add-collection');
      }}
    />
  );
}
