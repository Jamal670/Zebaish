import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ALL_PRODUCTS, MOCK_RESELLER_ORDERS, MOCK_REVIEWS } from '@/data/mockData';
import { useAuth } from '@/src/hooks/useAuth';
import { Product, Review, Order } from '@/types';

export interface ResellerContextType {
  myListings: (Product & { isDeactivated?: boolean; isSoldOut?: boolean })[];
  setMyListings: React.Dispatch<
    React.SetStateAction<(Product & { isDeactivated?: boolean; isSoldOut?: boolean })[]>
  >;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  allReviews: Review[];
  storeSettings: {
    storeName: string;
    logoUrl: string;
    bannerUrl: string;
    storeImageUrl?: string;
    responseTime: string;
    warehouseAddress: string;
    iban: string;
    emailNotifications: boolean;
    smsNotifications: boolean;
    bio: string;
  };
  setStoreSettings: React.Dispatch<
    React.SetStateAction<{
      storeName: string;
      logoUrl: string;
      bannerUrl: string;
      storeImageUrl?: string;
      responseTime: string;
      warehouseAddress: string;
      iban: string;
      emailNotifications: boolean;
      smsNotifications: boolean;
      bio: string;
    }>
  >;
  editingListing: any | null;
  setEditingListing: (listing: any | null) => void;
  formMode: 'create' | 'edit' | 'restock';
  setFormMode: (mode: 'create' | 'edit' | 'restock') => void;
  currentStatus: 'Active' | 'Pending Verification';
  setCurrentStatus: (status: 'Active' | 'Pending Verification') => void;
  toggleDeactivate: (id: string) => void;
  toggleSoldOut: (id: string) => void;
  handleDeleteListing: (id: string) => void;
}

const ResellerContext = createContext<ResellerContextType | undefined>(undefined);

export const ResellerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { resellerProfile } = useAuth();

  const [currentStatus, setCurrentStatus] = useState<'Active' | 'Pending Verification'>('Active');
  const [editingListing, setEditingListing] = useState<any | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'restock'>('create');

  const [myListings, setMyListings] = useState<
    (Product & { isDeactivated?: boolean; isSoldOut?: boolean })[]
  >(ALL_PRODUCTS.slice(0, 6));

  const [allReviews] = useState<Review[]>(MOCK_REVIEWS);
  const [orders, setOrders] = useState<Order[]>(MOCK_RESELLER_ORDERS);

  const [storeSettings, setStoreSettings] = useState<{
    storeName: string;
    logoUrl: string;
    bannerUrl: string;
    storeImageUrl?: string;
    responseTime: string;
    warehouseAddress: string;
    iban: string;
    emailNotifications: boolean;
    smsNotifications: boolean;
    bio: string;
  }>({
    storeName:
      (resellerProfile as any)?.shop_name ||
      (resellerProfile as any)?.shopName ||
      'Ayesha Luxury Surplus',
    logoUrl:
      resellerProfile?.store_image_url ||
      resellerProfile?.avatar_url ||
      'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png',
    storeImageUrl:
      resellerProfile?.store_image_url ||
      resellerProfile?.avatar_url ||
      'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png',
    bannerUrl:
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
    responseTime: 'Under 1 hour',
    warehouseAddress: resellerProfile?.address || 'Shop #12, Liberty Market, Gulberg III, Lahore',
    iban: resellerProfile?.iban || 'PK36MEZN00000012345678',
    emailNotifications: true,
    smsNotifications: true,
    bio: 'Verified reseller of premium Pakistani designer surplus. Direct factory leftovers at 50-70% off retail.',
  });

  useEffect(() => {
    const shop = (resellerProfile as any)?.shop_name || (resellerProfile as any)?.shopName;
    const storeImg = resellerProfile?.store_image_url || resellerProfile?.avatar_url;
    if (resellerProfile) {
      setStoreSettings((prev) => ({
        ...prev,
        storeName: shop || prev.storeName,
        storeImageUrl: storeImg || prev.storeImageUrl || prev.logoUrl,
        warehouseAddress: resellerProfile.address || prev.warehouseAddress,
        iban: resellerProfile.iban || prev.iban,
      }));
    }
  }, [resellerProfile]);

  const toggleDeactivate = (id: string) => {
    setMyListings((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isDeactivated: !item.isDeactivated } : item))
    );
  };

  const toggleSoldOut = (id: string) => {
    setMyListings((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, isSoldOut: !item.isSoldOut, inStock: item.isSoldOut ? true : false }
          : item
      )
    );
  };

  const handleDeleteListing = (id: string) => {
    setMyListings((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <ResellerContext.Provider
      value={{
        myListings,
        setMyListings,
        orders,
        setOrders,
        allReviews,
        storeSettings,
        setStoreSettings,
        editingListing,
        setEditingListing,
        formMode,
        setFormMode,
        currentStatus,
        setCurrentStatus,
        toggleDeactivate,
        toggleSoldOut,
        handleDeleteListing,
      }}
    >
      {children}
    </ResellerContext.Provider>
  );
};

export const useReseller = () => {
  const context = useContext(ResellerContext);
  if (!context) {
    throw new Error('useReseller must be used within a ResellerProvider');
  }
  return context;
};
