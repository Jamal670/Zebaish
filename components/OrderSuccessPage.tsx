'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Package,
  Truck,
  ArrowRight,
  ShoppingBag,
  Clock,
  MapPin,
  CreditCard,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { fetchOrderByIdOrNumber, FetchedOrderSummary } from '@/src/api/orderService';

export const OrderSuccessPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderId = searchParams.get('order_id') || searchParams.get('id') || '';
  const orderNumberParam = searchParams.get('order_number') || searchParams.get('orderNumber') || '';

  const targetIdentifier = orderId || orderNumberParam;

  const [orderSummary, setOrderSummary] = useState<FetchedOrderSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;

    async function loadOrder() {
      if (!targetIdentifier) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await fetchOrderByIdOrNumber(targetIdentifier);
        if (!isCancelled) {
          setOrderSummary(data);
        }
      } catch (err) {
        console.error('Error fetching order summary for success page:', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      isCancelled = true;
    };
  }, [targetIdentifier]);

  const displayOrderNumber = orderSummary?.orderNumber || orderNumberParam || orderId || 'ORD-000000';
  const displayStatus = orderSummary?.orderStatus || 'Pending';
  const itemsCount = orderSummary?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const subtotal = orderSummary?.items?.reduce((sum, item) => sum + item.subtotal, 0) || orderSummary?.totalAmount || 0;
  const shippingFee = subtotal > 150 ? 0 : (subtotal > 0 ? 15 : 0);
  const grandTotal = orderSummary?.totalAmount || (subtotal + shippingFee);

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 animate-fade-in">


      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10">
        {/* Main Success Hero Card */}
        <div className="bg-white border border-stone-200 rounded-lg p-6 sm:p-10 shadow-sm text-center mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500" />

          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <span className="inline-block bg-emerald-50 text-emerald-800 text-[10px] sm:text-[11px] lg:text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-200 mb-3">
            Order Confirmed
          </span>

          <h1 className="text-lg sm:text-2xl lg:text-2xl font-extrabold text-stone-900 tracking-tight mb-2">
            Congratulations! Your Order Has Been Placed.
          </h1>

          <p className="text-[10px] sm:text-xs lg:text-sm text-stone-600 max-w-lg mx-auto mb-6 leading-relaxed">
            Thank you for shopping with Zebaish. We have received your order and are currently verifying item dispatch details.
          </p>

          <div className="inline-flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 bg-stone-50 border border-stone-200 rounded-md px-6 py-3 text-[10px] sm:text-xs">
            <div>
              <span className="text-stone-500 font-medium">Order Number:</span>{' '}
              <strong className="text-stone-900 font-mono text-xs sm:text-sm tracking-wider">{displayOrderNumber}</strong>
            </div>
            <div className="hidden sm:block text-stone-300">|</div>
            <div>
              <span className="text-stone-500 font-medium">Current Status:</span>{' '}
              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-xs border border-amber-200">
                {displayStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => router.push('/account?tab=orders')}
            className="w-full py-3.5 px-6 bg-stone-900 hover:bg-black text-white rounded-xs text-2xs sm:text-xs lg:text-sm font-bold uppercase tracking-widest flex items-center justify-center space-x-2 transition-all shadow-sm group cursor-pointer"
          >
            <Package className="w-4 h-4 text-amber-400" />
            <span>Track Your Order</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => router.replace('/')}
            className="w-full py-3.5 px-6 bg-white hover:bg-stone-100 text-stone-900 border border-stone-300 rounded-xs text-2xs sm:text-xs lg:text-sm font-bold uppercase tracking-widest flex items-center justify-center space-x-2 transition-all shadow-2xs cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-stone-600" />
            <span>Continue Shopping</span>
          </button>
        </div>

        {/* Order Details & Summary Card */}
        {loading ? (
          <div className="bg-white border border-stone-200 rounded-lg p-8 text-center shadow-2xs">
            <Loader2 className="w-6 h-6 animate-spin text-stone-600 mx-auto mb-2" />
            <p className="text-xs text-stone-500 font-medium">Fetching ordered items breakdown...</p>
          </div>
        ) : orderSummary && orderSummary.items && orderSummary.items.length > 0 ? (
          <div className="space-y-6">
            {/* Ordered Products Table */}
            <div className="bg-white border border-stone-200 rounded-lg p-6 shadow-2xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 pb-3 border-b border-stone-200 flex items-center justify-between">
                <span>ORDERED PRODUCTS SUMMARY ({itemsCount} ITEMS)</span>
                <span className="text-stone-500 font-normal">Reference: {displayOrderNumber}</span>
              </h2>

              <div className="divide-y divide-stone-100">
                {orderSummary.items.map((item) => (
                  <div key={item.id || `${item.productId}-${item.size}`} className="py-4 flex gap-4 text-xs items-center">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-16 h-20 object-cover object-top rounded-xs border border-stone-200 bg-stone-100 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-20 bg-stone-100 border border-stone-200 rounded-xs flex items-center justify-center shrink-0 text-stone-400">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                        {item.brand}
                      </span>
                      <h3 className="font-bold text-stone-900 truncate text-xs sm:text-sm">{item.title}</h3>
                      <div className="text-stone-500 text-[11px] mt-1 space-x-2">
                        <span>Size: <strong className="text-stone-800 font-semibold">{item.size}</strong></span>
                        <span>•</span>
                        <span>Quantity: <strong className="text-stone-800 font-semibold">{item.quantity}</strong></span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-stone-500 block">Rs. {item.price.toLocaleString()} each</span>
                      <span className="font-extrabold text-stone-900 text-xs sm:text-sm">
                        Rs. {item.subtotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Financial Footer */}
              <div className="bg-stone-50 border border-stone-200 rounded-xs p-4 mt-4 text-xs space-y-2">
                <div className="flex justify-between text-stone-600">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-stone-900">Rs. {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Standard Shipping & Delivery</span>
                  <span>{shippingFee === 0 ? <strong className="text-emerald-700">FREE</strong> : `Rs. ${shippingFee}`}</span>
                </div>
                <div className="flex justify-between text-stone-900 font-extrabold text-sm border-t border-stone-200 pt-2 mt-2">
                  <span>Total Amount</span>
                  <span className="text-stone-950">Rs. {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Delivery Info Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs space-y-2 text-xs">
                <h3 className="font-bold text-stone-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5 pb-2 border-b border-stone-100">
                  <MapPin className="w-4 h-4 text-stone-600" />
                  <span>Shipping & Contact Details</span>
                </h3>
                <p className="font-semibold text-stone-900">{orderSummary.customerName}</p>
                <p className="text-stone-600">{orderSummary.shippingAddress}, {orderSummary.city} {orderSummary.postalCode ? `(Postal: ${orderSummary.postalCode})` : ''}</p>
                <p className="text-stone-500">{orderSummary.customerPhone} {orderSummary.customerEmail ? `• ${orderSummary.customerEmail}` : ''}</p>
              </div>

              <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs space-y-2 text-xs">
                <h3 className="font-bold text-stone-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5 pb-2 border-b border-stone-100">
                  <CreditCard className="w-4 h-4 text-stone-600" />
                  <span>Payment & Dispatch Method</span>
                </h3>
                <div className="flex justify-between text-stone-700">
                  <span>Payment Mode:</span>
                  <strong className="text-stone-900">{orderSummary.paymentMethod}</strong>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>Payment Status:</span>
                  <strong className="text-amber-700">{orderSummary.paymentStatus}</strong>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>Est. Delivery:</span>
                  <strong className="text-stone-900">3-4 Business Days (TCS Express)</strong>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Security Seal */}
        <div className="mt-8 text-center text-xs text-stone-500 flex items-center justify-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>All orders are backed by Zebaish 100% Genuine Dispatch Guarantee</span>
        </div>
      </div>
    </div>
  );
};
