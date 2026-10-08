import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Truck,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle,
  ChevronRight,
  AlertCircle,
  Loader2,
  Building2,
  Copy,
  Check,
  Upload,
  X,
  Eye,
  Volume2,
  Info,
  HelpCircle,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  FileText,
  CheckCircle2,
  Store,
  Layers,
  Play,
  Pause,
} from 'lucide-react';
import { CartItem, Order, CustomerOrderItem } from '@/types';
import useAuth from '@/src/hooks/useAuth';
import { placeOrder, uploadPaymentProof, deletePaymentProofs, SellerPaymentData } from '@/src/api/orderService';
import supabase from '@/src/api/client';
import { useQuery } from '@tanstack/react-query';
import { GenericModal } from '@/components/reseller/components/wallet/GenericModal';

export interface CheckoutPageProps {
  cartItems: CartItem[];
  onCompleteOrder: (orderId: string, orderNumber: string, createdOrders?: Order[]) => void;
  onNavigateHome: () => void;
}

export type SellerPaymentMethod = 'COD' | 'FULL' | 'DC';

export interface SellerInfo {
  id: string;
  shop_name: string;
  bank_name: string;
  account_title: string;
  iban: string;
  cod: boolean;
  advance_pay_full: boolean;
  advance_pay_dc: boolean;
  shipping_charges: number;
}

export interface SellerPaymentState {
  paymentMethod: SellerPaymentMethod | null;
  paymentScreenshot: File | string | null;
}

export type SellerStateMap = Record<string, SellerPaymentState>;

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  cartItems,
  onCompleteOrder,
  onNavigateHome,
}) => {
  const { user, userProfile } = useAuth();

  // Address & Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: 'Lahore',
    address: '',
    postalCode: '54000',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals & UI States
  const [isSinglePayModalOpen, setIsSinglePayModalOpen] = useState(false);
  const [isMultiPayModalOpen, setIsMultiPayModalOpen] = useState(false);
  const [previewImageModalUrl, setPreviewImageModalUrl] = useState<string | null>(null);
  const [copiedIbanSellerId, setCopiedIbanSellerId] = useState<string | null>(null);
  const [isPlayingAudioDemo, setIsPlayingAudioDemo] = useState(false);

  // Hidden File Input Ref for Screenshot Attachment
  const fileInputRefMap = useRef<Record<string, HTMLInputElement | null>>({});

  // Auto-fill logged-in user details if available
  useEffect(() => {
    if (user || userProfile) {
      const fn =
        `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() ||
        user?.user_metadata?.first_name ||
        '';

      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || fn || '',
        email: prev.email || userProfile?.email || user?.email || '',
        phone: prev.phone || userProfile?.phone_no || user?.user_metadata?.phone_no || '',
      }));
    }
  }, [user, userProfile]);

  // 1. Extract Unique Seller IDs from cart items
  const uniqueSellerIds = useMemo(() => {
    if (!cartItems || cartItems.length === 0) return [];
    const ids = cartItems
      .map(
        (item) =>
          item.product.resellerId ||
          (item.product as any).seller_id ||
          (item.product as any).sellerId ||
          (item.product.seller as any)?.id
      )
      .filter(Boolean);

    const unique = Array.from(new Set(ids)) as string[];
    return unique.length > 0 ? unique : ['default-seller'];
  }, [cartItems]);

  const isSingleSeller = uniqueSellerIds.length <= 1;

  // 2. Fetch Seller Settings & Bank Details via TanStack Query (Bulk database query)
  const { data: sellersMap = {}, isLoading: isLoadingSellers } = useQuery<Record<string, SellerInfo>>({
    queryKey: ['checkoutSellersInfo', uniqueSellerIds],
    queryFn: async () => {
      if (!uniqueSellerIds.length) return {};

      const uuidSellerIds = uniqueSellerIds.filter((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );

      let dbSellersMap: Record<string, any> = {};
      if (uuidSellerIds.length > 0) {
        const { data, error } = await supabase
          .from('sellers')
          .select(
            'id, shop_name, bank_name, account_title, iban, cod, advance_pay_full, advance_pay_dc, shipping_charges'
          )
          .in('id', uuidSellerIds);

        if (!error && data) {
          data.forEach((s: any) => {
            dbSellersMap[s.id] = s;
          });
        }
      }

      const result: Record<string, SellerInfo> = {};
      uniqueSellerIds.forEach((id) => {
        const dbSeller = dbSellersMap[id];
        const matchingItem = cartItems.find(
          (item) =>
            (item.product.resellerId ||
              (item.product as any).seller_id ||
              (item.product as any).sellerId ||
              (item.product.seller as any)?.id) === id
        );
        const shopName =
          dbSeller?.shop_name || matchingItem?.product.resellerName || 'Ayesha Luxury Surplus';

        let rawCod =
          dbSeller?.cod !== undefined && dbSeller?.cod !== null ? Boolean(dbSeller.cod) : true;
        let rawFull =
          dbSeller?.advance_pay_full !== undefined && dbSeller?.advance_pay_full !== null
            ? Boolean(dbSeller.advance_pay_full)
            : false;
        let rawDc =
          dbSeller?.advance_pay_dc !== undefined && dbSeller?.advance_pay_dc !== null
            ? Boolean(dbSeller.advance_pay_dc)
            : false;

        // Fallback: If all options are false, enable COD by default
        if (!rawCod && !rawFull && !rawDc) {
          rawCod = true;
        }

        const rawShipping = Number(dbSeller?.shipping_charges);
        const validShipping = isNaN(rawShipping) ? 150 : Math.max(0, Math.min(500, rawShipping));

        result[id] = {
          id,
          shop_name: shopName,
          bank_name: dbSeller?.bank_name || 'Meezan Bank',
          account_title: dbSeller?.account_title || `${shopName} Ltd`,
          iban: dbSeller?.iban || 'PK80MEZN0038020113013132',
          cod: rawCod,
          advance_pay_full: rawFull,
          advance_pay_dc: rawDc,
          shipping_charges: validShipping,
        };
      });

      return result;
    },
    enabled: uniqueSellerIds.length > 0,
    staleTime: 60 * 1000,
  });

  // 3. Per-Seller State Isolation ({ [sellerId]: { paymentMethod, paymentScreenshot } })
  const [sellerStateMap, setSellerStateMap] = useState<SellerStateMap>({});

  // Initialize or update state map defaults when seller data is loaded
  useEffect(() => {
    if (!sellersMap || Object.keys(sellersMap).length === 0) return;

    setSellerStateMap((prev) => {
      const updated = { ...prev };
      uniqueSellerIds.forEach((sId) => {
        const info = sellersMap[sId];
        if (!info) return;

        if (!updated[sId]) {
          let initialMethod: SellerPaymentMethod = 'COD';
          if (info.cod) {
            initialMethod = 'COD';
          } else if (info.advance_pay_full) {
            initialMethod = 'FULL';
          } else if (info.advance_pay_dc) {
            initialMethod = 'DC';
          }
          updated[sId] = {
            paymentMethod: initialMethod,
            paymentScreenshot: null,
          };
        }
      });
      return updated;
    });
  }, [sellersMap, uniqueSellerIds]);

  // Handle Payment Method Selection & Clear Stale Screenshot State (Section D)
  const handleSelectPaymentMethod = (sellerId: string, method: SellerPaymentMethod) => {
    setSellerStateMap((prev) => {
      const current = prev[sellerId];
      if (current?.paymentMethod === method) return prev;
      return {
        ...prev,
        [sellerId]: {
          paymentMethod: method,
          paymentScreenshot: null, // Clear screenshot state on payment method change!
        },
      };
    });


  };

  // Handle Screenshot Attachment for a specific seller
  const handleAttachScreenshot = (sellerId: string, file: File) => {
    setSellerStateMap((prev) => ({
      ...prev,
      [sellerId]: {
        ...(prev[sellerId] || { paymentMethod: 'FULL', paymentScreenshot: null }),
        paymentScreenshot: file,
      },
    }));
  };

  const handleRemoveScreenshot = (sellerId: string) => {
    setSellerStateMap((prev) => ({
      ...prev,
      [sellerId]: {
        ...(prev[sellerId] || { paymentMethod: 'FULL', paymentScreenshot: null }),
        paymentScreenshot: null,
      },
    }));
  };

  // Group Cart Items by Seller
  const cartItemsBySeller = useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    uniqueSellerIds.forEach((sId) => {
      groups[sId] = cartItems.filter((item) => {
        const itemSellerId =
          item.product.resellerId ||
          (item.product as any).seller_id ||
          (item.product as any).sellerId ||
          (item.product.seller as any)?.id ||
          'default-seller';
        return itemSellerId === sId;
      });
    });
    return groups;
  }, [cartItems, uniqueSellerIds]);

  // Financial Calculations per Seller & Overall Cart
  const sellerCalculations = useMemo(() => {
    const calcs: Record<
      string,
      { itemSubtotal: number; shippingFee: number; totalAmount: number; advanceAmount: number }
    > = {};

    uniqueSellerIds.forEach((sId) => {
      const items = cartItemsBySeller[sId] || [];
      const itemSubtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      const shippingFee = sellersMap[sId]?.shipping_charges ?? 150;
      const totalAmount = itemSubtotal + shippingFee;

      const method = sellerStateMap[sId]?.paymentMethod || 'COD';
      let advanceAmount = totalAmount;
      if (method === 'DC') {
        advanceAmount = shippingFee;
      } else if (method === 'COD') {
        advanceAmount = totalAmount;
      }

      calcs[sId] = {
        itemSubtotal,
        shippingFee,
        totalAmount,
        advanceAmount,
      };
    });

    return calcs;
  }, [cartItemsBySeller, uniqueSellerIds, sellersMap, sellerStateMap]);

  const totalCartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [cartItems]);

  const totalShippingFee = useMemo(() => {
    return uniqueSellerIds.reduce(
      (sum, sId) => sum + (sellersMap[sId]?.shipping_charges ?? 150),
      0
    );
  }, [uniqueSellerIds, sellersMap]);

  const grandTotal = totalCartSubtotal + totalShippingFee;

  // Single Seller helper shorthand
  const singleSellerId = uniqueSellerIds[0] || 'default-seller';
  const singleSellerInfo = sellersMap[singleSellerId];
  const singleSellerCalc = sellerCalculations[singleSellerId];
  const singleSellerState = sellerStateMap[singleSellerId] || {
    paymentMethod: 'COD',
    paymentScreenshot: null,
  };

  // One-click IBAN copy with toast feedback
  const handleCopyIBAN = async (sellerId: string, iban: string) => {
    try {
      await navigator.clipboard.writeText(iban.replace(/\s+/g, ''));
      setCopiedIbanSellerId(sellerId);
      setTimeout(() => setCopiedIbanSellerId(null), 2500);
    } catch (err) {
      console.error('Failed to copy IBAN:', err);
    }
  };

  // Convert screenshot File/string to URL for preview
  const getScreenshotPreviewUrl = (screenshot: File | string | null): string | null => {
    if (!screenshot) return null;
    if (typeof screenshot === 'string') return screenshot;
    return URL.createObjectURL(screenshot);
  };

  // Form Validation
  const validateCheckoutForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full Name is required.';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Please enter a valid full name.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Mobile phone number is required.';
    } else if (!/^[0-9+\-\s()]{7,20}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number.';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City selection is required.';
    }

    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Postal Code is required.';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Street address is required.';
    } else if (formData.address.trim().length < 5) {
      newErrors.address = 'Please enter a complete street address.';
    }

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Order Logic with Payment Proof Validation & Storage Upload
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);

    // 1. Checkout Form Validation
    if (!validateCheckoutForm()) {
      setSubmitError('Please fill out all required delivery fields correctly before placing your order.');
      return;
    }

    if (cartItems.length === 0) {
      setSubmitError('Your cart is empty.');
      return;
    }

    // 2. Validate Payment Screenshots for ALL FULL / DC Sellers
    const missingSellers: string[] = [];
    uniqueSellerIds.forEach((sId) => {
      const state = sellerStateMap[sId];
      const info = sellersMap[sId];
      const shopName = info?.shop_name || 'Seller Store';
      if ((state?.paymentMethod === 'FULL' || state?.paymentMethod === 'DC') && !state?.paymentScreenshot) {
        missingSellers.push(shopName);
      }
    });

    if (missingSellers.length > 0) {
      setSubmitError(
        `Please upload a payment screenshot proof for the following seller(s): ${missingSellers.join(', ')} before confirming your order.`
      );
      return;
    }

    setIsSubmitting(true);

    const uploadedPaths: string[] = [];
    const sellerPaymentsData: Record<string, SellerPaymentData> = {};

    try {
      // 3. Upload Payment Screenshots to Supabase Storage for FULL/DC Sellers
      for (const sId of uniqueSellerIds) {
        const state = sellerStateMap[sId];
        const info = sellersMap[sId];
        const shopName = info?.shop_name || 'Seller Store';
        const method = state?.paymentMethod || 'COD';
        const shippingFee = info?.shipping_charges ?? 200;

        let proofUrl: string | null = null;

        if ((method === 'FULL' || method === 'DC') && state?.paymentScreenshot) {
          const screenshot = state.paymentScreenshot;
          if (screenshot instanceof File) {
            const uploadRes = await uploadPaymentProof(screenshot, sId, shopName);
            if (uploadRes.error || !uploadRes.url) {
              if (uploadedPaths.length > 0) {
                await deletePaymentProofs(uploadedPaths);
              }
              setSubmitError(uploadRes.error || `Failed to upload payment screenshot for seller "${shopName}".`);
              setIsSubmitting(false);
              return;
            }
            proofUrl = uploadRes.url;
            if (uploadRes.path) {
              uploadedPaths.push(uploadRes.path);
            }
          } else if (typeof screenshot === 'string') {
            proofUrl = screenshot;
          }
        }

        sellerPaymentsData[sId] = {
          sellerId: sId,
          paymentMethod: method,
          paymentProofUrl: proofUrl,
          shippingFee,
        };
      }

      // 4. Place Order in Supabase
      const primaryMethodStr = isSingleSeller
        ? singleSellerState.paymentMethod === 'COD'
          ? 'Cash on Delivery'
          : singleSellerState.paymentMethod === 'FULL'
            ? 'Bank Transfer (Advance Full)'
            : 'Bank Transfer (Advance Delivery Charges)'
        : 'Multi-Seller Payment Plan';

      const result = await placeOrder({
        userId: user?.id || null,
        customerInfo: {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          city: formData.city,
          address: formData.address,
          postalCode: formData.postalCode,
          paymentMethod: primaryMethodStr as any,
        },
        cartItems,
        sellerPayments: sellerPaymentsData,
      });

      if (!result.success) {
        if (uploadedPaths.length > 0) {
          await deletePaymentProofs(uploadedPaths);
        }
        setSubmitError(result.error || 'Failed to place order. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const generatedId = result.orderId || result.orderNumber || `ORD-${Date.now()}`;
      const orderNum = result.orderNumber || generatedId;

      // Build seller-grouped orders array for Order Success Page
      const newOrders: Order[] = uniqueSellerIds.map((resId, index) => {
        const items = (cartItemsBySeller[resId] || []).map((item) => ({
          title: item.product.title,
          brand: item.product.brand,
          price: item.product.price,
          quantity: item.quantity,
          image: item.product.image,
          size: item.size || 'Unstitched',
          productId: item.product.id,
          resellerId: resId,
        }));

        const calc = sellerCalculations[resId] || { itemSubtotal: 0, shippingFee: 0, totalAmount: 0 };
        const sellerInfo = sellersMap[resId];
        const state = sellerStateMap[resId];
        const pData = sellerPaymentsData[resId];
        const tracking = `TCS-${Math.floor(1000000 + Math.random() * 9000000)}`;

        const selMethod =
          state?.paymentMethod === 'COD'
            ? 'Cash on Delivery'
            : state?.paymentMethod === 'FULL'
              ? 'Advance Full Payment'
              : 'Advance Delivery Charges';

        return {
          id: index === 0 ? generatedId : `${generatedId}-${index + 1}`,
          date: 'Today, Just Now',
          createdAt: new Date().toISOString(),
          items,
          shippingAmount: calc.shippingFee,
          totalAmount: calc.totalAmount,
          status: 'Order Placed',
          courierName: 'TCS Express',
          trackingNumber: tracking,
          estimatedDelivery: '3-4 Business Days',
          customerName: formData.fullName,
          customerCity: formData.city,
          customerAddress: formData.address,
          shippingAddress: {
            fullName: formData.fullName,
            phone: formData.phone,
            city: formData.city,
            address: formData.address,
          },
          paymentMethod: selMethod as any,
          paymentProofUrl: pData?.paymentProofUrl || null,
          shippingPaymentStatus: (state?.paymentMethod === 'FULL' || state?.paymentMethod === 'DC') ? 'Pending' : null,
          resellerId: resId,
          resellerName: sellerInfo?.shop_name || 'Seller Store',
        };
      });

      setIsSubmitting(false);

      // Notify parent to clear cart & navigate to Order Success page
      onCompleteOrder(generatedId, orderNum, newOrders);
    } catch (err: any) {
      console.error('Checkout error:', err);
      if (uploadedPaths.length > 0) {
        await deletePaymentProofs(uploadedPaths);
      }
      setSubmitError(err.message || 'An unexpected error occurred while placing your order.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <h1 className="text-lg sm:text-2xl lg:text-2xl font-extrabold text-stone-900 tracking-tight mb-8">
          CHECKOUT & DISPATCH DETAILS
        </h1>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col lg:grid lg:grid-cols-12 gap-8">
          {/* SECTION 1: Delivery Address Form (Order 1 on mobile/tablet, Left col row 1 on desktop) */}
          <div className="order-1 lg:order-none lg:col-span-7 lg:col-start-1 lg:row-start-1 space-y-6">
            {/* Global submit error alert banner */}
            {submitError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-[10px] sm:text-xs flex items-center space-x-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* SECTION 1: Delivery Address Form */}
            <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs space-y-4">
              <div className="pb-2 border-b border-stone-200">
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-900 flex items-center space-x-2">
                  <span>Delivery Address</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-stone-700 text-[10px] sm:text-xs block mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => {
                      setFormData({ ...formData, fullName: e.target.value });
                      if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${fieldErrors.fullName
                      ? 'border-red-500 bg-red-50/20'
                      : 'border-stone-300 focus:border-stone-900'
                      }`}
                    placeholder="Ali Raza"
                  />
                  {fieldErrors.fullName && (
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">
                      {fieldErrors.fullName}
                    </span>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Mobile Phone (for TCS SMS) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${fieldErrors.phone
                      ? 'border-red-500 bg-red-50/20'
                      : 'border-stone-300 focus:border-stone-900'
                      }`}
                    placeholder="+92 300 1234567"
                  />
                  {fieldErrors.phone && (
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">
                      {fieldErrors.phone}
                    </span>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-stone-700 block mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${fieldErrors.email
                      ? 'border-red-500 bg-red-50/20'
                      : 'border-stone-300 focus:border-stone-900'
                      }`}
                    placeholder="ali@gmail.com"
                  />
                  {fieldErrors.email && (
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">
                      {fieldErrors.email}
                    </span>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.city}
                    onChange={(e) => {
                      setFormData({ ...formData, city: e.target.value });
                      if (fieldErrors.city) setFieldErrors({ ...fieldErrors, city: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none bg-white ${fieldErrors.city
                      ? 'border-red-500 bg-red-50/20'
                      : 'border-stone-300 focus:border-stone-900'
                      }`}
                  >
                    <option value="">Select City</option>
                    <option value="Lahore">Lahore</option>
                    <option value="Karachi">Karachi</option>
                    <option value="Islamabad">Islamabad</option>
                    <option value="Rawalpindi">Rawalpindi</option>
                    <option value="Faisalabad">Faisalabad</option>
                    <option value="Peshawar">Peshawar</option>
                    <option value="Quetta">Quetta</option>
                    <option value="Multan">Multan</option>
                    <option value="Sialkot">Sialkot</option>
                  </select>
                  {fieldErrors.city && (
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">
                      {fieldErrors.city}
                    </span>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Postal Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => {
                      setFormData({ ...formData, postalCode: e.target.value });
                      if (fieldErrors.postalCode) setFieldErrors({ ...fieldErrors, postalCode: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${fieldErrors.postalCode
                      ? 'border-red-500 bg-red-50/20'
                      : 'border-stone-300 focus:border-stone-900'
                      }`}
                    placeholder="54000"
                  />
                  {fieldErrors.postalCode && (
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">
                      {fieldErrors.postalCode}
                    </span>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-stone-700 block mb-1">
                    Street Address / House No <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => {
                      setFormData({ ...formData, address: e.target.value });
                      if (fieldErrors.address) setFieldErrors({ ...fieldErrors, address: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${fieldErrors.address
                      ? 'border-red-500 bg-red-50/20'
                      : 'border-stone-300 focus:border-stone-900'
                      }`}
                    placeholder="House 42, Block B, DHA Phase 5"
                  />
                  {fieldErrors.address && (
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">
                      {fieldErrors.address}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-center w-full mt-5">
              <button
                  type="button"
                  onClick={() => setIsMultiPayModalOpen(true)}
                  className="w-full p-4 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg text-amber-950 text-xs sm:text-sm font-bold transition-all flex items-center justify-between cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center space-x-2">
                    <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>How to Pay Charges</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-700 shrink-0" />
                </button>
                </div>
            </div>
          </div>

          {/* SECTION 2: Payment Method Selection (Order 3 on mobile/tablet, Left col row 2 on desktop) */}
          <div className="order-3 lg:order-none lg:col-span-7 lg:col-start-1 lg:row-start-2 space-y-6">
            {isLoadingSellers ? (
              <div className="bg-white border border-stone-200 rounded-lg p-8 text-center space-y-3 shadow-2xs">
                <Loader2 className="w-6 h-6 animate-spin text-stone-600 mx-auto" />
                <p className="text-xs text-stone-500 font-medium">
                  Loading seller payment options & bank configuration...
                </p>
              </div>
            ) : isSingleSeller ? (
              /* SINGLE SELLER FLOW */
              <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center space-x-2">
                    <span>Payment Method</span>
                  </h2>
                </div>

                <div className="space-y-4">
                  {/* Single Seller Options Selection (Single Choice Radio) */}
                  <div className="space-y-3">
                    {/* Option: COD */}
                    {singleSellerInfo?.cod && (
                      <label
                        onClick={() => handleSelectPaymentMethod(singleSellerId, 'COD')}
                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${singleSellerState.paymentMethod === 'COD'
                          ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                          : 'border-stone-200 hover:border-stone-300'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name={`payment-${singleSellerId}`}
                            checked={singleSellerState.paymentMethod === 'COD'}
                            onChange={() => handleSelectPaymentMethod(singleSellerId, 'COD')}
                            className="accent-black cursor-pointer"
                          />
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                            <Banknote className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-stone-900 block">
                              Cash on Delivery (COD)
                            </span>
                            <span className="block h-auto text-[11px] leading-tight text-stone-500 mt-0.5">
                              Pay cash directly to TCS courier upon delivery across Pakistan
                            </span>
                          </div>
                        </div>

                      </label>
                    )}

                    {/* Option: FULL */}
                    {singleSellerInfo?.advance_pay_full && (
                      <label
                        onClick={() => handleSelectPaymentMethod(singleSellerId, 'FULL')}
                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${singleSellerState.paymentMethod === 'FULL'
                          ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                          : 'border-stone-200 hover:border-stone-300'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name={`payment-${singleSellerId}`}
                            checked={singleSellerState.paymentMethod === 'FULL'}
                            onChange={() => handleSelectPaymentMethod(singleSellerId, 'FULL')}
                            className="accent-black cursor-pointer"
                          />
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-amber-700" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-stone-900 block">
                              Advance Payment (Full Amount)
                            </span>
                            <span className="block h-auto text-[11px] leading-tight text-stone-500 mt-0.5">
                              Transfer full order amount in advance to seller bank account
                            </span>
                          </div>
                        </div>

                      </label>
                    )}

                    {/* Option: DC */}
                    {singleSellerInfo?.advance_pay_dc && (
                      <label
                        onClick={() => handleSelectPaymentMethod(singleSellerId, 'DC')}
                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${singleSellerState.paymentMethod === 'DC'
                          ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                          : 'border-stone-200 hover:border-stone-300'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name={`payment-${singleSellerId}`}
                            checked={singleSellerState.paymentMethod === 'DC'}
                            onChange={() => handleSelectPaymentMethod(singleSellerId, 'DC')}
                            className="accent-black cursor-pointer"
                          />
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                            <Truck className="w-4 h-4 text-blue-700" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-stone-900 block">
                              Advance Payment (Delivery Charges Only)
                            </span>
                            <span className="block h-auto text-[11px] leading-tight text-stone-500 mt-0.5">
                              Pay delivery fee in advance; pay rest on delivery (COD)
                            </span>
                          </div>
                        </div>

                      </label>
                    )}
                  </div>

                  {/* Trigger button to view Bank Details & Upload Screenshot Modal when FULL or DC is selected */}
                  {(singleSellerState.paymentMethod === 'FULL' ||
                    singleSellerState.paymentMethod === 'DC') && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setIsSinglePayModalOpen(true)}
                          className="w-full p-3.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-300 rounded-lg text-amber-950 text-xs font-bold transition-all flex items-center justify-between cursor-pointer shadow-2xs"
                        >
                          <div className="flex items-center space-x-2">
                            <Info className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>Click here to view "How to Pay Charges"</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-amber-700 shrink-0" />
                        </button>
                      </div>
                    )}
                </div>
              </div>
            ) : (
              <>  </>

              /*MULTI-SELLER FLOW: SIMPLE BUTTON ONLY */
              // <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
              //   <button
              //     type="button"
              //     onClick={() => setIsMultiPayModalOpen(true)}
              //     className="w-full p-4 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg text-amber-950 text-xs sm:text-sm font-bold transition-all flex items-center justify-between cursor-pointer shadow-2xs"
              //   >
              //     <div className="flex items-center space-x-2">
              //       <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
              //       <span>How to Pay Charges</span>
              //     </div>
              //     <ChevronRight className="w-4 h-4 text-amber-700 shrink-0" />
              //   </button>
              // </div>
            )}
          </div>

          {/* SECTION 3: Right Summary Sidebar & Review Area (Order 2 on mobile/tablet, Right col spanning rows 1-2 on desktop) */}
          <div className="order-2 lg:order-none lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2 space-y-4">
            <div className="bg-white border border-stone-200 rounded-lg p-4 sm:p-5 shadow-sm sticky top-20 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 pb-2.5 border-b border-stone-200 flex items-center justify-between">
                <span>REVIEW ORDER ITEMS</span>
              </h2>

              {/* MULTI-SELLER / SINGLE-SELLER GROUPED ITEMS DISPLAY */}
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                {uniqueSellerIds.map((sId) => {
                  const sItems = cartItemsBySeller[sId] || [];
                  const sInfo = sellersMap[sId];
                  const sCalc = sellerCalculations[sId];
                  const sState = sellerStateMap[sId] || {
                    paymentMethod: 'COD',
                    paymentScreenshot: null,
                  };

                  return (
                    <div
                      key={sId}
                      className="border border-stone-200 rounded-lg p-3 bg-stone-50/50 space-y-3"
                    >
                      {/* Seller Card Header */}
                      <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <Store className="w-3.5 h-3.5 text-stone-700 shrink-0" />
                          <span className="font-bold text-xs text-stone-900 truncate">
                            {sInfo?.shop_name || 'Seller Store'}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-stone-600 bg-stone-200 px-2 py-0.5 rounded-full shrink-0">
                          {sItems.length} {sItems.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      {/* Items for this seller */}
                      <div className="space-y-2">
                        {sItems.map((item) => (
                          <div
                            key={`${item.product.id}-${item.size}`}
                            className="flex gap-2.5 text-xs bg-white p-2 rounded-md border border-stone-200/80 items-center"
                          >
                            <img
                              src={item.product.image}
                              alt={item.product.title}
                              className="w-10 h-13 object-cover object-top rounded border border-stone-200 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-[9px] font-bold text-stone-500 uppercase block leading-tight">
                                {item.product.brand}
                              </span>
                              <p className="font-semibold text-stone-900 truncate text-[11px] leading-tight">
                                {item.product.title}
                              </p>
                              <span className="text-stone-500 text-[10px] block mt-0.5">
                                Qty: {item.quantity} • {item.size || 'Unstitched'}
                              </span>
                            </div>
                            <span className="font-bold text-stone-900 text-right shrink-0 text-xs">
                              Rs. {(item.product.price * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* SECTION A: Per-Seller Financial Summary & Amount to Pay */}
                      <div className="bg-white p-2.5 rounded-md border border-stone-200 text-xs space-y-1">
                        <div className="flex justify-between text-stone-600 text-[11px]">
                          <span>Seller Items Subtotal</span>
                          <span className="font-medium">
                            Rs. {sCalc?.itemSubtotal.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-stone-600 text-[11px]">
                          <span>Shipping Fee</span>
                          <span className="font-medium">
                            Rs. {sCalc?.shippingFee.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-stone-900 font-extrabold pt-1 border-t border-stone-100">
                          <span className="text-xs">Amount to Pay</span>
                          <span className="text-amber-800 font-mono text-xs sm:text-sm">
                            Rs. {sCalc?.advanceAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* SECTION C: Multi-Seller Payment Selection (Single Choice Radio) */}
                      {!isSingleSeller && (
                        <div className="space-y-1.5 pt-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 block">
                            Select Payment Option:
                          </span>

                          <div className="flex flex-wrap gap-1.5 text-2xs">
                            {sInfo?.cod && (
                              <button
                                type="button"
                                onClick={() => handleSelectPaymentMethod(sId, 'COD')}
                                className={`flex-1 min-w-[75px] py-1.5 px-2 rounded-md border font-bold flex items-center justify-center space-x-1 transition-all cursor-pointer ${sState.paymentMethod === 'COD'
                                  ? 'bg-stone-900 text-white border-stone-900 ring-1 ring-stone-900'
                                  : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
                                  }`}
                              >
                                <span>COD</span>
                              </button>
                            )}

                            {sInfo?.advance_pay_full && (
                              <button
                                type="button"
                                onClick={() => handleSelectPaymentMethod(sId, 'FULL')}
                                className={`flex-1 min-w-[75px] py-1.5 px-2 rounded-md border font-bold flex items-center justify-center space-x-1 transition-all cursor-pointer ${sState.paymentMethod === 'FULL'
                                  ? 'bg-stone-900 text-white border-stone-900 ring-1 ring-stone-900'
                                  : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
                                  }`}
                              >
                                <span>FULL</span>
                              </button>
                            )}

                            {sInfo?.advance_pay_dc && (
                              <button
                                type="button"
                                onClick={() => handleSelectPaymentMethod(sId, 'DC')}
                                className={`flex-1 min-w-[75px] py-1.5 px-2 rounded-md border font-bold flex items-center justify-center space-x-1 transition-all cursor-pointer ${sState.paymentMethod === 'DC'
                                  ? 'bg-stone-900 text-white border-stone-900 ring-1 ring-stone-900'
                                  : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
                                  }`}
                              >
                                <span>DC</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Per-Seller Bank Details & Screenshot Attachment (Shown ONLY in Multi-Seller flow for FULL or DC) */}
                      {!isSingleSeller && (sState.paymentMethod === 'FULL' || sState.paymentMethod === 'DC') && (
                        <div className="bg-stone-900 text-white rounded-md p-2.5 shadow-2xs space-y-2 border border-stone-800 text-2xs animate-fade-in">
                          {/* Non-wrapping horizontally scrollable top row for bank details */}
                          <div className="flex items-center justify-between border-b border-stone-800 pb-1.5 overflow-x-auto gap-2">
                            <span className="font-bold text-amber-400 shrink-0 text-xs">
                              {sInfo?.bank_name}
                            </span>
                            <span className="text-stone-300 shrink-0 truncate max-w-[130px] text-[10px]">
                              {sInfo?.account_title}
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-stone-950 p-1.5 px-2 rounded border border-stone-800 gap-2">
                            <span className="font-mono text-2xs text-amber-300 font-bold select-all truncate">
                              {sInfo?.iban}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyIBAN(sId, sInfo?.iban || '')}
                              className="p-1 text-amber-400 hover:text-amber-300 shrink-0 cursor-pointer"
                              title="Copy IBAN"
                            >
                              {copiedIbanSellerId === sId ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Screenshot Attachment area for this seller */}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            ref={(el) => {
                              fileInputRefMap.current[sId] = el;
                            }}
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleAttachScreenshot(sId, e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />

                          {!sState.paymentScreenshot ? (
                            <button
                              type="button"
                              onClick={() => fileInputRefMap.current[sId]?.click()}
                              className="w-full py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-[10px] uppercase tracking-wider rounded transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload Payment Screenshot</span>
                            </button>
                          ) : (
                            <div className="flex items-center justify-between bg-stone-950 p-1.5 rounded border border-stone-800">
                              <div className="flex items-center space-x-2">
                                <img
                                  src={getScreenshotPreviewUrl(sState.paymentScreenshot) || ''}
                                  alt="Proof"
                                  className="w-6 h-6 object-cover rounded border border-stone-700"
                                />
                                <span className="text-[10px] font-semibold text-emerald-400">
                                  Proof Uploaded
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImageModalUrl(
                                      getScreenshotPreviewUrl(sState.paymentScreenshot)
                                    )
                                  }
                                  className="p-1 text-stone-300 hover:text-white"
                                  title="View Screenshot"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => fileInputRefMap.current[sId]?.click()}
                                  className="p-1 text-amber-400 hover:text-amber-300"
                                  title="Change"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveScreenshot(sId)}
                                  className="p-1 text-red-400 hover:text-red-300"
                                  title="Remove"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* OVERALL ORDER TOTALS BREAKDOWN */}
              <div className="space-y-1.5 text-xs border-t border-b border-stone-200 py-3">
                <div className="flex justify-between text-stone-600">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-stone-900">
                    Rs. {totalCartSubtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Delivery / Shipping Total</span>
                  <span>
                    {isLoadingSellers ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500 inline" />
                    ) : (
                      `Rs. ${totalShippingFee.toLocaleString()}`
                    )}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-baseline text-stone-900 font-extrabold text-base">
                <span>Grand Total</span>
                <span>Rs. {grandTotal.toLocaleString()}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || cartItems.length === 0}
                className="w-full py-3.5 bg-stone-900 hover:bg-black text-white rounded-xs text-xs font-bold uppercase tracking-widest shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>DISPATCHING ORDER...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>CONFIRM & PLACE ORDER</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* MODAL 1: SINGLE-SELLER "HOW TO PAY CHARGES" MODAL */}
      <GenericModal
        isOpen={isSinglePayModalOpen}
        onClose={() => setIsSinglePayModalOpen(false)}
        title="How to Pay Charges"
        subtitle="Bank details & payment instructions for advance transfer"
        maxWidth="max-w-xl"
      >
        <div className="space-y-3.5 text-xs">
          {/* Concise Amount to Pay Highlight Banner */}
          <div className="p-2.5 px-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-amber-950">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-amber-900">
                Amount to Pay ({singleSellerInfo?.shop_name}):
              </span>
              <span className="text-base font-extrabold font-mono text-amber-950">
                Rs. {singleSellerCalc?.advanceAmount.toLocaleString()}
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 text-[10px] font-bold uppercase rounded-md border border-amber-300">
              {singleSellerState.paymentMethod === 'FULL'
                ? 'Advance Full'
                : singleSellerState.paymentMethod === 'DC'
                  ? 'Advance DC'
                  : 'COD'}
            </span>
          </div>

          {/* Compact Bank & IBAN Details Card */}
          <div className="bg-stone-900 text-white rounded-lg p-3 shadow-xs space-y-2 border border-stone-800 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <div className="flex items-center space-x-2 truncate">
                <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-bold text-white text-xs truncate">
                  {singleSellerInfo?.bank_name}
                </span>
                <span className="text-stone-400 text-[11px] truncate">
                  ({singleSellerInfo?.account_title})
                </span>
              </div>
              <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 shrink-0">
                Bank Details
              </span>
            </div>

            <div className="flex items-center justify-between bg-stone-950 px-3 py-1.5 rounded-md border border-stone-800 gap-2">
              <div className="flex items-center space-x-2 truncate">
                <span className="text-[10px] uppercase font-semibold text-stone-400 shrink-0">IBAN:</span>
                <span className="font-mono text-xs text-amber-300 font-bold select-all truncate">
                  {singleSellerInfo?.iban}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopyIBAN(singleSellerId, singleSellerInfo?.iban || '')
                }
                title="Copy IBAN"
                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center space-x-1 transition-all shrink-0 cursor-pointer ${copiedIbanSellerId === singleSellerId
                  ? 'bg-emerald-500 text-stone-950 scale-105'
                  : 'bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700'
                  }`}
              >
                {copiedIbanSellerId === singleSellerId ? (
                  <>
                    <Check className="w-3 h-3 text-stone-950" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy IBAN</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Compact Voice Instruction Bar */}
          <div className="p-2 px-3 bg-stone-100 border border-stone-200 rounded-lg flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => setIsPlayingAudioDemo(!isPlayingAudioDemo)}
                className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center transition-all shadow-2xs shrink-0 cursor-pointer"
              >
                {isPlayingAudioDemo ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 ml-0.5" />
                )}
              </button>
              <span className="text-xs font-bold text-stone-900">
                {isPlayingAudioDemo
                  ? 'Playing Voice Instructions (0:30)...'
                  : 'Listen to Voice Guide (Urdu/English)'}
              </span>
            </div>
            <Volume2 className="w-4 h-4 text-stone-400 shrink-0" />
          </div>

          {/* Detailed Bilingual Step-by-Step Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
              <h4 className="font-bold text-stone-900 flex items-center space-x-1.5 uppercase text-[11px] tracking-wide border-b border-stone-200 pb-1.5">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Payment Steps (English)</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1 text-stone-600 text-[11px] leading-relaxed">
                <li>
                  Copy the IBAN above and open your banking app (Meezan, HBL, JazzCash, EasyPaisa, etc.).
                </li>
                <li>
                  Transfer <strong>Rs. {singleSellerCalc?.advanceAmount.toLocaleString()}</strong> to the seller&apos;s account.
                </li>
                <li>
                  Take a clear screenshot of the transaction confirmation receipt.
                </li>
                <li>
                  Click <strong>"Upload Payment Screenshot"</strong> below to attach your proof, then click Done.
                </li>
              </ol>
            </div>

            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-2 text-right font-urdu" dir="rtl">
              <h4 className="font-bold text-stone-900 flex items-center justify-start space-x-1.5 space-x-reverse text-xs border-b border-stone-200 pb-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 ml-1" />
                <span>ادائیگی کی اہم ہدایات (Urdu)</span>
              </h4>
              <ol className="list-decimal pr-5 space-y-1 text-stone-800 text-[11px] leading-loose text-right">
                <li>
                  اوپر دیا گیا <strong>IBAN کاپی کریں</strong> اور اپنی آن لائن بینکنگ یا EasyPaisa/JazzCash ایپ کھولیں۔
                </li>
                <li>
                  سیلر کے اکاؤنٹ میں <strong>قابلِ ادا رقم (Rs. {singleSellerCalc?.advanceAmount.toLocaleString()})</strong> ٹرانسفر کریں۔
                </li>
                <li>
                  رقم کی منتقلی مکمل ہونے کا <strong>واضح اسکرین شاٹ لیں</strong>۔
                </li>
                <li>
                  نیچے <strong>"پیمنٹ اسکرین شاٹ اپ لوڈ کریں"</strong> پر کلک کر کے اپنی رسید منسلک کریں۔
                </li>
              </ol>
            </div>
          </div>

          {/* Compact Payment Screenshot Proof Attachment Box */}
          <div className="p-3 bg-stone-900 text-white rounded-lg shadow-2xs border border-stone-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Payment Proof Attachment
              </span>
              {singleSellerState.paymentScreenshot && (
                <span className="text-[10px] font-semibold text-emerald-400 flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>Proof Attached</span>
                </span>
              )}
            </div>

            {/* Hidden File Input for Single Seller */}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              ref={(el) => {
                fileInputRefMap.current[singleSellerId] = el;
              }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleAttachScreenshot(singleSellerId, e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {!singleSellerState.paymentScreenshot ? (
              <button
                type="button"
                onClick={() => fileInputRefMap.current[singleSellerId]?.click()}
                className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs uppercase tracking-wider rounded-md transition-all shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Payment Screenshot</span>
              </button>
            ) : (
              <div className="flex items-center justify-between bg-stone-950 p-2 rounded-md border border-stone-800">
                <div className="flex items-center space-x-2">
                  <img
                    src={getScreenshotPreviewUrl(singleSellerState.paymentScreenshot) || ''}
                    alt="Proof"
                    className="w-8 h-8 object-cover rounded border border-stone-700"
                  />
                  <span className="text-[11px] font-semibold text-stone-200">
                    Screenshot Attached
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewImageModalUrl(
                        getScreenshotPreviewUrl(singleSellerState.paymentScreenshot)
                      )
                    }
                    className="p-1 text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded"
                    title="View Full Screenshot"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRefMap.current[singleSellerId]?.click()}
                    className="p-1 text-amber-400 hover:text-amber-300 bg-stone-800 hover:bg-stone-700 rounded"
                    title="Change Screenshot"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveScreenshot(singleSellerId)}
                    className="p-1 text-red-400 hover:text-red-300 bg-stone-800 hover:bg-stone-700 rounded"
                    title="Remove Screenshot"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setIsSinglePayModalOpen(false)}
              className="px-5 py-2 bg-stone-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-md transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </GenericModal>

      {/* MODAL 2: MULTI-SELLER "HOW TO PAY YOUR CHARGES" MODAL */}
      <GenericModal
        isOpen={isMultiPayModalOpen}
        onClose={() => setIsMultiPayModalOpen(false)}
        title="How to Pay Your Charges"
        subtitle="Bank details & payment instructions for advance transfer"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 text-xs sm:text-sm">
          {/* Audio / Voice Instruction UI Placeholder */}
          <div className="p-3 bg-gradient-to-r from-amber-50 to-stone-50 border border-amber-200 rounded-xl flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 shadow-2xs">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-stone-900 block flex items-center space-x-1">
                  <span>Voice Payment Guide</span>
                  <span className="text-[9px] uppercase font-extrabold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full">
                    Audio Placeholder
                  </span>
                </span>
                <span className="text-[11px] text-stone-500 block">
                  Click to play voice instructions for payment & upload steps
                </span>
              </div>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold rounded-lg transition-all flex items-center space-x-1 shrink-0 cursor-pointer shadow-2xs"
            >
              <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
              <span>Listen</span>
            </button>
          </div>

          {/* English Instructions Card - Clear Points */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5 text-stone-800">
            <h4 className="font-bold text-xs uppercase tracking-wider text-stone-900 flex items-center space-x-1.5 border-b border-stone-200 pb-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>English Instructions</span>
            </h4>
            <ol className="list-decimal pl-4.5 space-y-1.5 text-xs text-stone-700 leading-relaxed font-medium">
              <li>
                Check the <strong>Amount to Pay</strong> shown for each seller in the <strong>Review Order Items</strong> section.
              </li>
              <li>
                Copy the <strong>IBAN</strong> provided for the respective seller.
              </li>
              <li>
                Send the required shipping charges to that seller using your <strong>bank account, Easypaisa, or JazzCash</strong>.
              </li>
              <li>
                Take a <strong>screenshot</strong> after completing each payment.
              </li>
              <li>
                Return to the checkout page and upload the <strong>payment screenshot separately for each seller</strong>.
              </li>
              <li>
                Make sure the screenshot clearly shows the successful payment before submitting it.
              </li>
            </ol>
          </div>

          {/* Urdu Instructions Card - Clear Points */}
          <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2.5 text-right dir-rtl font-urdu">
            <h4 className="font-bold text-xs uppercase tracking-wider text-stone-900 flex items-center justify-start space-x-1.5 space-x-reverse border-b border-amber-200/80 pb-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 ml-1.5" />
              <span>اردو ہدایات</span>
            </h4>
            <ol className="list-decimal pr-5 space-y-1.5 text-xs text-stone-800 leading-loose font-semibold">
              <li>
                <strong>Review Order Items</strong> سیکشن میں ہر سیلر کے <strong>Amount to Pay</strong> کو دیکھیں اور اسی کے مطابق ادائیگی کریں۔
              </li>
              <li>
                متعلقہ سیلر کے لیے فراہم کردہ <strong>IBAN کاپی کریں</strong>۔
              </li>
              <li>
                اپنے <strong>بینک اکاؤنٹ، EasyPaisa یا JazzCash</strong> کا استعمال کرتے ہوئے متعلقہ سیلر کو رقم بھیجیں۔
              </li>
              <li>
                ہر ادائیگی مکمل کرنے کے بعد اس کا <strong>اسکرین شاٹ (screenshot) لیں</strong>۔
              </li>
              <li>
                چیک آؤٹ پیج پر واپس آئیں اور ہر سیلر کے لیے <strong>الگ الگ پیمنٹ اسکرین شاٹ اپ لوڈ کریں</strong>۔
              </li>
              <li>
                یقینی بنائیں کہ اسکرین شاٹ سبمٹ کرنے سے پہلے اس میں ادائیگی کا ثبوت واضح نظر آرہا ہو۔
              </li>
            </ol>
          </div>

          <div className="flex justify-end pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setIsMultiPayModalOpen(false)}
              className="px-5 py-2 bg-stone-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </GenericModal>

      {/* MODAL 3: FULL SCREENSHOT PREVIEW MODAL */}
      <GenericModal
        isOpen={Boolean(previewImageModalUrl)}
        onClose={() => setPreviewImageModalUrl(null)}
        title="Payment Screenshot Proof"
        maxWidth="max-w-3xl"
      >
        {previewImageModalUrl && (
          <div className="space-y-4">
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-stone-950 p-2 rounded-lg border border-stone-800">
              <img
                src={previewImageModalUrl}
                alt="Uploaded Payment Receipt"
                className="max-w-full max-h-[65vh] object-contain rounded"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewImageModalUrl(null)}
                className="px-5 py-2 bg-stone-900 hover:bg-black text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </GenericModal>
    </div>
  );
};
