'use client';

import React from 'react';
import { useReseller } from '@/components/reseller/context/ResellerContext';
import { PayoutsView } from '@/components/reseller/components/PayoutsView';

export default function PayoutsPage() {
  const { storeSettings } = useReseller();
  return <PayoutsView iban={storeSettings.iban} />;
}
