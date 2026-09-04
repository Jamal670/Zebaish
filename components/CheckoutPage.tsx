import React, { useState, useEffect } from 'react';
import { ShieldCheck, Truck, CreditCard, Banknote, Smartphone, CheckCircle, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { CartItem, Order, CustomerOrderItem } from '@/types';
import useAuth from '@/src/hooks/useAuth';
import { placeOrder } from '@/src/api/orderService';

interface CheckoutPageProps {
  cartItems: CartItem[];
  onCompleteOrder: (orderId: string, orderNumber: string, createdOrders?: Order[]) => void;
  onNavigateHome: () => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  cartItems,
  onCompleteOrder,
  onNavigateHome,
}) => {
  const { user, userProfile } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<'Cash on Delivery' | 'JazzCash' | 'EasyPaisa' | 'Bank Card'>('Cash on Delivery');

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

  // Auto-fill logged-in user details if available
  useEffect(() => {
    if (user || userProfile) {
      const fn = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() ||
        user?.user_metadata?.first_name || '';

      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || fn || '',
        email: prev.email || userProfile?.email || user?.email || '',
        phone: prev.phone || userProfile?.phone_no || user?.user_metadata?.phone_no || '',
      }));
    }
  }, [user, userProfile]);

  const subtotal = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const shippingFee = subtotal > 150 ? 0 : 15;
  const grandTotal = subtotal + shippingFee;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);

    // 1. Checkout Validation
    if (!validateCheckoutForm()) {
      setSubmitError('Please fill out all required fields correctly before placing your order.');
      return;
    }

    if (cartItems.length === 0) {
      setSubmitError('Your cart is empty.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. Perform DB order placement (Logged in or Guest flow)
      const result = await placeOrder({
        userId: user?.id || null,
        customerInfo: {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          city: formData.city,
          address: formData.address,
          postalCode: formData.postalCode,
          paymentMethod,
        },
        cartItems,
      });

      if (!result.success) {
        // Validation/stock/DB failure: Do NOT modify cart or product stock in UI
        setSubmitError(result.error || 'Failed to place order. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const generatedId = result.orderId || result.orderNumber || `ORD-${Date.now()}`;
      const orderNum = result.orderNumber || generatedId;

      // Build local order representations for UI
      const resellerGroups: Record<string, { items: CustomerOrderItem[]; resellerName: string }> = {};

      cartItems.forEach((item) => {
        const resId = item.product.resellerId || 'reseller-1';
        const resName = item.product.resellerName || 'Ayesha Luxury Surplus';
        if (!resellerGroups[resId]) {
          resellerGroups[resId] = { items: [], resellerName: resName };
        }
        resellerGroups[resId].items.push({
          title: item.product.title,
          brand: item.product.brand,
          price: item.product.price,
          quantity: item.quantity,
          image: item.product.image,
          size: item.size || 'Unstitched',
          productId: item.product.id,
          resellerId: resId,
        });
      });

      const newOrders: Order[] = Object.entries(resellerGroups).map(([resId, group], index) => {
        const orderSubtotal = group.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const tracking = `TCS-${Math.floor(1000000 + Math.random() * 9000000)}`;

        return {
          id: index === 0 ? generatedId : `${generatedId}-${index + 1}`,
          date: 'Today, Just Now',
          createdAt: new Date().toISOString(),
          items: group.items,
          totalAmount: orderSubtotal + (orderSubtotal > 150 ? 0 : 15),
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
          paymentMethod,
          resellerId: resId,
          resellerName: group.resellerName,
        };
      });

      setIsSubmitting(false);

      // Notify parent to clear cart & navigate to Order Success page
      onCompleteOrder(generatedId, orderNum, newOrders);
    } catch (err: any) {
      console.error('Checkout error:', err);
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

        <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Global submit error alert banner */}
            {submitError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-[10px] sm:text-xs flex items-center space-x-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Address Form */}
            <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs space-y-4">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-900 flex items-center space-x-2">
                <Truck className="w-4 h-4 text-stone-600" />
                <span>1. Delivery Address (Pakistan & Global)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-stone-700 text-[10px] sm:text-xs block mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => {
                      setFormData({ ...formData, fullName: e.target.value });
                      if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${fieldErrors.fullName ? 'border-red-500 bg-red-50/20' : 'border-stone-300 focus:border-stone-900'
                      }`}
                    placeholder="Ali Raza"
                  />
                  {fieldErrors.fullName && (
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">{fieldErrors.fullName}</span>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Mobile Phone (for TCS SMS) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${fieldErrors.phone ? 'border-red-500 bg-red-50/20' : 'border-stone-300 focus:border-stone-900'
                      }`}
                    placeholder="+92 300 1234567"
                  />
                  {fieldErrors.phone && (
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">{fieldErrors.phone}</span>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-stone-700 block mb-1">Email Address <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${fieldErrors.email ? 'border-red-500 bg-red-50/20' : 'border-stone-300 focus:border-stone-900'
                      }`}
                    placeholder="ali@gmail.com"
                  />
                  {fieldErrors.email && (
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">{fieldErrors.email}</span>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">City <span className="text-red-500">*</span></label>
                  <select
                    value={formData.city}
                    onChange={(e) => {
                      setFormData({ ...formData, city: e.target.value });
                      if (fieldErrors.city) setFieldErrors({ ...fieldErrors, city: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none bg-white ${fieldErrors.city ? 'border-red-500 bg-red-50/20' : 'border-stone-300 focus:border-stone-900'
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
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">{fieldErrors.city}</span>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Postal Code <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => {
                      setFormData({ ...formData, postalCode: e.target.value });
                      if (fieldErrors.postalCode) setFieldErrors({ ...fieldErrors, postalCode: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${fieldErrors.postalCode ? 'border-red-500 bg-red-50/20' : 'border-stone-300 focus:border-stone-900'
                      }`}
                    placeholder="54000"
                  />
                  {fieldErrors.postalCode && (
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">{fieldErrors.postalCode}</span>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-stone-700 block mb-1">Street Address / House No <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => {
                      setFormData({ ...formData, address: e.target.value });
                      if (fieldErrors.address) setFieldErrors({ ...fieldErrors, address: '' });
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${fieldErrors.address ? 'border-red-500 bg-red-50/20' : 'border-stone-300 focus:border-stone-900'
                      }`}
                    placeholder="House 42, Block B, DHA Phase 5"
                  />
                  {fieldErrors.address && (
                    <span className="text-red-600 text-[11px] mt-1 font-medium block">{fieldErrors.address}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-stone-600" />
                <span>2. Payment Method</span>
              </h2>

              <div className="space-y-3">
                {/* Option 1: Cash on Delivery */}
                <label
                  onClick={() => setPaymentMethod('Cash on Delivery')}
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${paymentMethod === 'Cash on Delivery'
                    ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                    : 'border-stone-200 hover:border-stone-300'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'Cash on Delivery'}
                      onChange={() => setPaymentMethod('Cash on Delivery')}
                      className="accent-black"
                    />
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">Cash on Delivery (COD)</span>
                      <span className="text-[11px] text-stone-500">Pay cash directly to TCS courier upon delivery across Pakistan</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-xs">
                    Popular
                  </span>
                </label>

                {/* Option 2: JazzCash Mobile Wallet */}
                <label
                  onClick={() => setPaymentMethod('JazzCash')}
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${paymentMethod === 'JazzCash'
                    ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                    : 'border-stone-200 hover:border-stone-300'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'JazzCash'}
                      onChange={() => setPaymentMethod('JazzCash')}
                      className="accent-black"
                    />
                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-800 flex items-center justify-center shrink-0 font-bold text-xs">
                      JC
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">JazzCash Mobile Wallet</span>
                      <span className="text-[11px] text-stone-500">Instant payment prompt sent to your registered JazzCash phone</span>
                    </div>
                  </div>
                  <Smartphone className="w-4 h-4 text-stone-400" />
                </label>

                {/* Option 3: EasyPaisa */}
                <label
                  onClick={() => setPaymentMethod('EasyPaisa')}
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${paymentMethod === 'EasyPaisa'
                    ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                    : 'border-stone-200 hover:border-stone-300'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'EasyPaisa'}
                      onChange={() => setPaymentMethod('EasyPaisa')}
                      className="accent-black"
                    />
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold text-xs">
                      EP
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">EasyPaisa Mobile Account</span>
                      <span className="text-[11px] text-stone-500">Fast 1-tap authorization from EasyPaisa mobile app</span>
                    </div>
                  </div>
                  <Smartphone className="w-4 h-4 text-stone-400" />
                </label>

                {/* Option 4: Bank Card */}
                <label
                  onClick={() => setPaymentMethod('Bank Card')}
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${paymentMethod === 'Bank Card'
                    ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                    : 'border-stone-200 hover:border-stone-300'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'Bank Card'}
                      onChange={() => setPaymentMethod('Bank Card')}
                      className="accent-black"
                    />
                    <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-800 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">Credit / Debit Card (Visa, Mastercard, PayPak)</span>
                      <span className="text-[11px] text-stone-500">3D Secure encrypted online payment portal</span>
                    </div>
                  </div>
                  <CreditCard className="w-4 h-4 text-stone-400" />
                </label>
              </div>
            </div>
          </div>

          {/* Right Summary Sidebar (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-stone-200 rounded-lg p-6 shadow-sm sticky top-24 space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 pb-3 border-b border-stone-200">
                REVIEW ORDER ITEMS ({cartItems.length})
              </h2>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {cartItems.map((item) => (
                  <div key={`${item.product.id}-${item.size}`} className="flex gap-3 text-xs">
                    <img
                      src={item.product.image}
                      alt={item.product.title}
                      className="w-12 h-16 object-cover object-top rounded-xs border border-stone-200"
                    />
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-stone-500 uppercase">{item.product.brand}</span>
                      <p className="font-semibold text-stone-900 line-clamp-1">{item.product.title}</p>
                      <span className="text-stone-500 text-[11px]">Qty: {item.quantity} • {item.size || 'Unstitched'}</span>
                    </div>
                    <span className="font-bold text-stone-900">
                      Rs. {(item.product.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-xs border-t border-b border-stone-200 py-4">
                <div className="flex justify-between text-stone-600">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-stone-900">Rs. {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Delivery / Shipping</span>
                  <span>{shippingFee === 0 ? <strong className="text-emerald-700">FREE</strong> : `Rs. ${shippingFee}`}</span>
                </div>
              </div>

              <div className="flex justify-between items-baseline text-stone-900 font-extrabold text-base">
                <span>Total Amount Due</span>
                <span>Rs. {grandTotal.toLocaleString()}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || cartItems.length === 0}
                className="w-full py-4 bg-stone-900 hover:bg-black text-white rounded-xs text-xs font-bold uppercase tracking-widest shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
};
