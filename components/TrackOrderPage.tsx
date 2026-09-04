'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  PackageSearch,
  Search,
  ArrowLeft,
  Loader2,
  AlertCircle,
  PackageCheck,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Building2,
} from 'lucide-react';
import { trackOrderByNumber, PublicTrackOrderResult } from '@/src/api/orderService';

export const TrackOrderPage: React.FC = () => {
  const [orderInput, setOrderInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<PublicTrackOrderResult | null>(null);

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Stale-result guard: Clear previous result/error immediately upon submit
    setValidationError(null);
    setServerError(null);
    setNotFound(false);
    setOrderResult(null);

    const cleanInput = orderInput.trim();

    // 2. Empty input validation (no network request fired)
    if (!cleanInput) {
      setValidationError('Please enter your Order ID to track your shipment.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await trackOrderByNumber(cleanInput);

      if (res.error) {
        setServerError(res.error);
      } else if (!res.data) {
        setNotFound(true);
      } else {
        setOrderResult(res.data);
      }
    } catch (err: any) {
      setServerError('Unable to connect to server. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatusBadge = (status: 'ORDER PLACED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED') => {
    switch (status) {
      case 'ORDER PLACED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
            <Clock className="w-3.5 h-3.5" />
            <span>ORDER PLACED</span>
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
            <Truck className="w-3.5 h-3.5" />
            <span>SHIPPED</span>
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>DELIVERED</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 shadow-2xs">
            <XCircle className="w-3.5 h-3.5" />
            <span>CANCELLED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-900 border border-stone-300 shadow-2xs">
            <PackageCheck className="w-3.5 h-3.5" />
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 animate-fade-in w-full">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        {/* Header Hero */}
        <div className="bg-stone-900 text-white rounded-lg p-8 sm:p-10 mb-8 text-center shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
          <div className="inline-flex items-center space-x-2 bg-amber-400/10 text-amber-400 px-3.5 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-4 border border-amber-400/20">
            <PackageSearch className="w-4 h-4" />
            <span>Shipment Tracking</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-script mb-3 text-white">
            Track Your Order
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 max-w-xl mx-auto leading-relaxed">
            Enter your customer Order ID below to view real-time delivery status, order details, and item summaries.
          </p>
        </div>

        {/* Search Form Card */}
        <div className="bg-white border border-stone-200 rounded-lg p-6 sm:p-8 shadow-sm mb-8">
          <form onSubmit={handleTrackSubmit} className="space-y-4">
            <label htmlFor="order-id-input" className="block text-xs font-bold text-stone-700 uppercase tracking-wide">
              Order ID / Order Number
            </label>
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  id="order-id-input"
                  type="text"
                  value={orderInput}
                  onChange={(e) => {
                    setOrderInput(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="Enter your Order ID (e.g. ORD-172535...)"
                  disabled={isLoading}
                  className={`w-full pl-10 pr-4 py-2.5 bg-stone-50 border rounded-xs text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors ${validationError ? 'border-red-500 bg-red-50/20' : 'border-stone-300'
                    }`}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-xs text-xs uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                    <span>Tracking...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Track</span>
                  </>
                )}
              </button>
            </div>

            {/* Inline validation message */}
            {validationError && (
              <p className="text-xs text-red-600 font-medium flex items-center space-x-1.5 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{validationError}</span>
              </p>
            )}
          </form>
        </div>

        {/* Not Found State */}
        {notFound && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 sm:p-8 text-center text-amber-900 shadow-sm animate-fade-in space-y-3">
            <div className="inline-flex p-3 bg-amber-100 rounded-full text-amber-700">
              <PackageSearch className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-amber-950">Order Not Found</h2>
            <p className="text-xs sm:text-sm text-stone-700 max-w-md mx-auto leading-relaxed">
              Order not found. Please check your Order ID and try again.
            </p>
          </div>
        )}

        {/* Network / Server Error State */}
        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 sm:p-8 text-center text-red-900 shadow-sm animate-fade-in space-y-3">
            <div className="inline-flex p-3 bg-red-100 rounded-full text-red-700">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-red-950">Unable to Fetch Order</h2>
            <p className="text-xs sm:text-sm text-red-800 max-w-md mx-auto leading-relaxed">
              {serverError}
            </p>
          </div>
        )}

        {/* Success Result Display */}
        {orderResult && (
          <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden animate-fade-in space-y-6 p-6 sm:p-8">
            {/* Header / Summary Bar */}
            <div className="border-b border-stone-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <div className="text-[10px] sm:text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                  Order Reference
                </div>

                <div className="text-base sm:text-lg md:text-xl font-bold text-stone-900 font-mono tracking-tight break-all sm:break-normal">
                  {orderResult.orderNumber}
                </div>

                <div className="text-[10px] sm:text-xs text-stone-500 mt-1">
                  Placed on:{' '}
                  {new Date(orderResult.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <div className="flex items-center justify-start shrink-0 whitespace-nowrap">
                {renderStatusBadge(orderResult.orderStatus)}
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wider border-b border-stone-100 pb-2">
                Ordered Items ({orderResult.items.reduce((sum, i) => sum + i.quantity, 0)})
              </h2>
              <div className="divide-y divide-stone-100">
                {orderResult.items.map((item, idx) => (
                  <div key={idx} className="py-3.5 flex items-start space-x-4">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-16 h-20 object-cover rounded-xs border border-stone-200 shrink-0 bg-stone-100"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=600&auto=format&fit=crop';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                        {item.title}
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Brand: <span className="font-medium text-stone-700">{item.brand}</span>
                      </p>
                      <div className="flex items-center space-x-3 text-xs text-stone-600 mt-1.5">
                        <span>Qty: {item.quantity}</span>
                        <span>Price: Rs. {item.price.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs sm:text-sm font-bold text-stone-900">
                        Rs. {item.subtotal.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment & Order Summary */}
            <div className="bg-stone-50 border border-stone-200 rounded-md p-4 sm:p-5 flex flex-col sm:flex-row justify-between gap-4 text-xs sm:text-sm">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 text-stone-700">
                  <CreditCard className="w-4 h-4 text-stone-500 shrink-0" />
                  <span>
                    Payment Method:{' '}
                    <strong className="text-stone-900">{orderResult.paymentMethod}</strong>
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-stone-700">
                  <Building2 className="w-4 h-4 text-stone-500 shrink-0" />
                  <span>
                    Payment Status:{' '}
                    <strong className="text-stone-900">{orderResult.paymentStatus}</strong>
                  </span>
                </div>
              </div>
              <div className="sm:text-right border-t sm:border-t-0 border-stone-200 pt-3 sm:pt-0">
                <div className="text-xs text-stone-500 uppercase tracking-wider font-semibold">
                  Total Amount
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-stone-900 mt-0.5">
                  Rs. {orderResult.totalAmount.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackOrderPage;
