import React, { useEffect, useState, useMemo } from 'react';
import { SellerOrderDetail, SellerOrderItemDetail, SellerOrderStatus } from '@/types';
import { fetchSellerOrderDetail } from '@/src/api/sellerOrdersService';
import { StatusDropdown } from './StatusDropdown';
import { formatPaymentMethod } from './OrdersTable';

export interface OrderDetailModalProps {
  isOpen: boolean;
  orderId: string | null;
  sellerId: string;
  onClose: () => void;
  onStatusChange: (
    sellerOrderId: string,
    newStatus: SellerOrderStatus,
    orderNumber: string,
    courierDetails?: { courierName: string; trackingNumber: string }
  ) => Promise<boolean>;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  isOpen,
  orderId,
  sellerId,
  onClose,
  onStatusChange,
}) => {
  const [detail, setDetail] = useState<SellerOrderDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !orderId) {
      setDetail(null);
      setLoading(true);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchSellerOrderDetail(sellerId, orderId)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load order detail:', err);
          setError('Failed to load order details. Please try again.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, orderId, sellerId]);

  // Group items by product_id so each unique product has its own dynamic headers
  const productGroups = useMemo(() => {
    if (!detail?.items || detail.items.length === 0) return [];

    const map = new Map<
      string,
      {
        productId: string;
        productTitle: string;
        items: SellerOrderItemDetail[];
        optionKeys: string[];
      }
    >();

    detail.items.forEach((item) => {
      const pId = item.product_id || item.id;
      if (!map.has(pId)) {
        map.set(pId, {
          productId: pId,
          productTitle: item.product_title || 'Product',
          items: [],
          optionKeys: [],
        });
      }
      map.get(pId)!.items.push(item);
    });

    map.forEach((group) => {
      const keysSet = new Set<string>();
      group.items.forEach((item) => {
        let snap = item.variant_options_snapshot;
        if (typeof snap === 'string') {
          try {
            snap = JSON.parse(snap);
          } catch {
            snap = null;
          }
        }
        if (snap && typeof snap === 'object') {
          Object.keys(snap).forEach((k) => {
            if (k && k.trim()) keysSet.add(k.trim());
          });
        }
      });

      // If no dynamic options snapshot exists, check legacy size/color
      if (keysSet.size === 0) {
        const hasLegacySize = group.items.some(
          (it) => it.size && it.size.trim() && it.size.toLowerCase() !== 'unstitched' && it.size !== '—'
        );
        const hasLegacyColor = group.items.some(
          (it) => it.color && it.color.trim() && it.color !== '—'
        );
        if (hasLegacySize) keysSet.add('Size');
        if (hasLegacyColor) keysSet.add('Color');
      }

      group.optionKeys = Array.from(keysSet);
    });

    return Array.from(map.values());
  }, [detail?.items]);

  if (!isOpen) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleModalStatusChange = async (
    sellerOrderId: string,
    newStatus: SellerOrderStatus,
    orderNum: string,
    courierDetails?: { courierName: string; trackingNumber: string }
  ): Promise<boolean> => {
    const ok = await onStatusChange(sellerOrderId, newStatus, orderNum, courierDetails);
    if (ok && detail) {
      setDetail({
        ...detail,
        status: newStatus,
        courier_name: courierDetails?.courierName || detail.courier_name,
        tracking_number: courierDetails?.trackingNumber || detail.tracking_number,
        updated_at: new Date().toISOString(),
      });
    }
    return ok;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="relative bg-white w-[92vw] sm:w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[85vh] rounded-xl shadow-2xl overflow-hidden border border-stone-200 flex flex-col">
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-3 truncate">
            <span className="font-mono text-2xs sm:text-xs text-amber-400 bg-stone-800 border border-stone-700 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-sm uppercase tracking-wider font-bold shrink-0">
              ORDER DETAIL
            </span>
            <h2 className="text-sm sm:text-base lg:text-lg font-bold tracking-tight text-stone-100 truncate">
              {detail ? `#${detail.order_number}` : 'Loading Order...'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors hover:bg-stone-800 shrink-0"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-stone-800">
          {loading ? (
            /* Skeleton Loading State */
            <div className="space-y-4 sm:space-y-6 animate-pulse">
              <div className="h-20 bg-stone-100 rounded-lg p-4 flex justify-between items-center">
                <div className="h-6 w-1/3 bg-stone-200 rounded-sm" />
                <div className="h-6 w-1/4 bg-stone-200 rounded-full" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-32 bg-stone-100 rounded-lg" />
                <div className="h-32 bg-stone-100 rounded-lg" />
              </div>
              <div className="h-40 bg-stone-100 rounded-lg" />
            </div>
          ) : error || !detail ? (
            /* Error / Empty State */
            <div className="p-6 sm:p-8 text-center bg-stone-50 border border-stone-200 rounded-lg text-stone-700">
              <p className="font-semibold text-xs sm:text-sm mb-2 text-stone-900">No record found</p>
              <button
                onClick={onClose}
                className="mt-3 px-4 py-2 bg-stone-900 text-white rounded-md text-xs sm:text-sm font-bold uppercase tracking-wider hover:bg-black transition-colors"
              >
                Close Window
              </button>
            </div>
          ) : (
            <>
              {/* SECTION 1: ORDER SUMMARY */}
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xs sm:text-xs text-stone-500 uppercase tracking-wide font-bold">Order Number</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-stone-900">#{detail.order_number}</span>
                  </div>
                  <div className="mt-1 text-2xs sm:text-xs text-stone-500 space-x-2 sm:space-x-3">
                    <span>Placed: <strong className="text-stone-700">{formatDate(detail.created_at)}</strong></span>
                    <span>Updated: <strong className="text-stone-700">{formatDate(detail.updated_at)}</strong></span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-3">
                  <span className="text-2xs sm:text-xs font-semibold text-stone-500 uppercase tracking-wider">Status:</span>
                  <StatusDropdown
                    sellerOrderId={detail.seller_order_id}
                    sellerId={detail.seller_id}
                    orderNumber={detail.order_number}
                    currentStatus={detail.status}
                    onStatusChange={handleModalStatusChange}
                    size="sm"
                  />
                </div>
              </div>

              {/* SECTION 2 & 3: CUSTOMER & SHIPPING DETAILS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {/* 2. Customer Details */}
                <div className="border border-stone-200 rounded-lg p-3.5 sm:p-4 space-y-2 bg-white shadow-2xs">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <h3 className="text-xs sm:text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-stone-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Customer Details
                    </h3>
                    <span
                      className={`text-2xs font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${detail.customer.is_registered
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-100 text-stone-600'
                        }`}
                    >
                      {detail.customer.is_registered ? 'Registered User' : 'Guest Checkout'}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm space-y-1 pt-1">
                    <p><span className="text-stone-400">Name:</span> <strong className="text-stone-900">{detail.customer.name}</strong></p>
                    <p><span className="text-stone-400">Email:</span> <span className="font-mono text-stone-800">{detail.customer.email}</span></p>
                    <p><span className="text-stone-400">Phone:</span> <span className="font-mono text-stone-800">{detail.customer.phone}</span></p>
                  </div>
                </div>

                {/* 3. Shipping Details */}
                <div className="border border-stone-200 rounded-lg p-3.5 sm:p-4 space-y-2 bg-white shadow-2xs">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <h3 className="text-xs sm:text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-stone-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Shipping Address
                    </h3>
                    <span className="text-2xs font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full uppercase shrink-0">
                      {detail.shipping.city}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm space-y-1 pt-1 text-stone-800">
                    <p className="font-medium leading-relaxed">{detail.shipping.address}</p>
                    <p className="text-stone-500 text-2xs sm:text-xs">
                      City: <strong className="text-stone-900">{detail.shipping.city}</strong> &bull; Postal Code: <strong className="text-stone-900">{detail.shipping.postal_code || 'N/A'}</strong>
                    </p>
                    {(detail.courier_name || detail.tracking_number) && (
                      <div className="pt-2 border-t border-stone-100 mt-1">
                        <p className="text-xs text-stone-600 font-semibold flex items-center space-x-1">
                          <span>Courier: <strong className="text-amber-800 font-bold">{detail.courier_name || 'N/A'}</strong></span>
                          {detail.tracking_number && (
                            <span className="ml-2 font-mono text-stone-800 text-2xs bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                              Trk: {detail.tracking_number}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 4: ITEMS PURCHASED */}
              <div className="border border-stone-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                <div className="bg-stone-50 px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-stone-200 flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-stone-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Items Purchased
                  </h3>
                  <span className="text-2xs sm:text-xs text-stone-500 font-semibold">
                    {detail.items.length} {detail.items.length === 1 ? 'Item' : 'Items'}
                  </span>
                </div>

                <div className="overflow-x-auto divide-y divide-stone-200">
                  {productGroups.map((group, groupIdx) => {
                    const isMultipleProducts = productGroups.length > 1;

                    return (
                      <div key={group.productId || groupIdx} className="w-full">
                        {isMultipleProducts && (
                          <div className="bg-stone-50/90 px-3.5 py-2 sm:px-4 sm:py-2.5 border-b border-stone-200 flex items-center justify-between text-2xs sm:text-xs">
                            <span className="font-bold text-stone-800">
                              Product: <span className="font-semibold text-stone-700">{group.productTitle}</span>
                            </span>
                            <span className="text-stone-500 font-mono">
                              {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        )}

                        <table className="w-full text-left text-xs sm:text-sm min-w-[550px]">
                          <thead className="bg-stone-100/70 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider text-2xs sm:text-xs whitespace-nowrap">
                            <tr>
                              <th className="py-2.5 px-3 sm:py-3 sm:px-4">Product Title</th>
                              {/* Dynamic Headers from variant_options_snapshot keys (e.g. Color, Size, Storage, RAM) */}
                              {group.optionKeys.map((key) => (
                                <th key={key} className="py-2.5 px-3 sm:py-3 sm:px-4">{key}</th>
                              ))}
                              <th className="py-2.5 px-3 sm:py-3 sm:px-4 text-center">Qty</th>
                              <th className="py-2.5 px-3 sm:py-3 sm:px-4 text-right">Unit Price</th>
                              <th className="py-2.5 px-3 sm:py-3 sm:px-4 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 text-xs sm:text-sm lg:text-base">
                            {group.items.map((item) => {
                              let snap: Record<string, string> = {};
                              if (typeof item.variant_options_snapshot === 'string') {
                                try {
                                  snap = JSON.parse(item.variant_options_snapshot);
                                } catch {
                                  snap = {};
                                }
                              } else if (item.variant_options_snapshot && typeof item.variant_options_snapshot === 'object') {
                                snap = item.variant_options_snapshot;
                              }

                              const resolvedUnitPrice =
                                item.variant_price !== undefined && item.variant_price !== null && item.variant_price > 0
                                  ? item.variant_price
                                  : item.price;
                              const lineSubtotal = resolvedUnitPrice * item.quantity;

                              return (
                                <tr key={item.id} className="hover:bg-stone-50/50">
                                  {/* Product Title & SKU */}
                                  <td className="py-2.5 px-3 sm:py-3 sm:px-4 font-semibold text-stone-900">
                                    <div>{item.product_title}</div>
                                    {item.variant_sku_snapshot && (
                                      <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                                        SKU: {item.variant_sku_snapshot}
                                      </div>
                                    )}
                                  </td>

                                  {/* Dynamic Variant Option Values */}
                                  {group.optionKeys.map((key) => {
                                    let displayVal = snap[key];
                                    if (!displayVal) {
                                      const matchingKey = Object.keys(snap).find(
                                        (k) => k.toLowerCase() === key.toLowerCase()
                                      );
                                      if (matchingKey) displayVal = snap[matchingKey];
                                    }
                                    if (!displayVal) {
                                      if (key.toLowerCase() === 'size') {
                                        const isUnstitched =
                                          (item.category || '').trim().toLowerCase() === 'unstitched' ||
                                          (item.size || '').trim().toLowerCase() === 'unstitched';
                                        displayVal = isUnstitched ? '—' : (item.size?.trim() || '—');
                                      } else if (key.toLowerCase() === 'color') {
                                        displayVal = item.color?.trim() || '—';
                                      }
                                    }

                                    return (
                                      <td
                                        key={key}
                                        className="py-2.5 px-3 sm:py-3 sm:px-4 text-stone-700 font-medium whitespace-nowrap"
                                      >
                                        {displayVal || '—'}
                                      </td>
                                    );
                                  })}

                                  {/* QTY from order_items */}
                                  <td className="py-2.5 px-3 sm:py-3 sm:px-4 text-center font-mono font-bold text-stone-800">
                                    {item.quantity}
                                  </td>

                                  {/* Price from product_variants (or item.price fallback) */}
                                  <td className="py-2.5 px-3 sm:py-3 sm:px-4 text-right font-mono text-stone-700 whitespace-nowrap">
                                    Rs. {resolvedUnitPrice.toLocaleString()}
                                  </td>

                                  {/* Subtotal */}
                                  <td className="py-2.5 px-3 sm:py-3 sm:px-4 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                                    Rs. {lineSubtotal.toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotal Footer */}
                <div className="bg-stone-50 border-t border-stone-200 px-3.5 py-2.5 sm:px-4 sm:py-3 flex justify-between items-center text-xs sm:text-sm font-bold">
                  <span className="uppercase tracking-wider text-stone-600">Seller Share Subtotal:</span>
                  <span className="font-mono text-stone-900 text-xs sm:text-sm lg:text-base">
                    Rs. {detail.seller_total.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* SECTION 5: PAYMENT DETAILS */}
              <div className="border border-stone-200 rounded-lg p-3.5 sm:p-4 bg-stone-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="space-y-1">
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900 uppercase tracking-wider">Payment Information</h3>
                  <div className="flex items-center space-x-2 sm:space-x-3 text-xs sm:text-sm">
                    <span className="text-stone-500">Method: <strong className="text-stone-900">{formatPaymentMethod(detail.payment.method)}</strong></span>
                    <span>&bull;</span>
                    <span className="text-stone-500">
                      Status:{' '}
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-2xs sm:text-xs uppercase ${detail.payment.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : detail.payment.status === 'Pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                      >
                        {detail.payment.status}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-2xs font-bold text-stone-400 uppercase tracking-widest block">YOUR SELLER SHARE</span>
                  <span className="text-base sm:text-lg lg:text-xl font-bold text-stone-900 font-mono">
                    Rs. {detail.seller_total.toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-stone-100 border-t border-stone-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 bg-stone-900 text-white rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider hover:bg-black transition-colors min-h-[36px]"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
