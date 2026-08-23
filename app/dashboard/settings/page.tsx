'use client';

import React from 'react';
import { useReseller } from '@/components/reseller/context/ResellerContext';
import { SettingsView } from '@/components/reseller/components/SettingsView';

export default function SettingsPage() {
  const { storeSettings, setStoreSettings } = useReseller();
  return (
    <SettingsView
      storeSettings={storeSettings}
      setStoreSettings={setStoreSettings}
    />
  );
}
