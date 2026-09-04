import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { SellerOrderRow, SellerOrderStatus } from '@/types';
import { fetchSellerOrders, updateSellerOrderStatus } from '@/src/api/sellerOrdersService';
import { StatusDropdown } from './StatusDropdown';
import { OrderDetailModal } from './OrderDetailModal';
import { CourierDetailsModal } from './CourierDetailsModal';
import { OrderCancellationModal } from './OrderCancellationModal';
import { OrderRefundModal } from './OrderRefundModal';
import { isCourierModalRequired } from '@/src/constants/courierOptions';
import { DISPLAY_FILTER_STATUSES } from '@/src/constants/orderWorkflow';
import { CollapsibleSearchInput } from './common/CollapsibleSearchInput';

export interface OrdersTableProps {
  sellerId: string;
}

export interface ToastState {
  id: string;
  message: string;
  type: 'success' | 'error';
}

export const OrdersTable: React.FC<OrdersTableProps> = ({ sellerId }) => {
  const [orders, setOrders] = useState<SellerOrderRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter & Pagination States
  const [specificStatus, setSpecificStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Sorting State
  const [sortBy, setSortBy] = useState<'created_at' | 'seller_total' | 'customer_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Courier Interception Modal State
  const [pendingCourierTarget, setPendingCourierTarget] = useState<{
    sellerOrderId: string;
    newStatus: SellerOrderStatus;
    orderNumber: string;
  } | null>(null);

  // Cancellation Modal State
  const [pendingCancellationTarget, setPendingCancellationTarget] = useState<{
    sellerOrderId: string;
    orderNumber: string;
  } | null>(null);

  // Refund Modal State
  const [pendingRefundTarget, setPendingRefundTarget] = useState<{
    sellerOrderId: string;
    orderNumber: string;
  } | null>(null);

  // Toast Notifications State
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const fetchSortBy = sortBy === 'customer_name' ? 'created_at' : sortBy;
      const res = await fetchSellerOrders({
        sellerId,
        statusFilter: specificStatus,
        search: searchQuery,
        page,
        pageSize,
        sortBy: fetchSortBy,
        sortOrder,
      });
      setOrders(res.orders || []);
      setTotalCount(res.total_count || 0);
    } catch (err) {
      console.warn('Unable to load orders from database, setting empty state:', err);
      setOrders([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [sellerId, specificStatus, searchQuery, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const sortedOrders = useMemo(() => {
    if (sortBy === 'customer_name') {
      return [...orders].sort((a, b) => {
        const nameA = (a.customer_name || '').toLowerCase();
        const nameB = (b.customer_name || '').toLowerCase();
        if (sortOrder === 'asc') return nameA.localeCompare(nameB);
        return nameB.localeCompare(nameA);
      });
    }
    return orders;
  }, [orders, sortBy, sortOrder]);

  // Execute status update with optional courier details
  const executeStatusUpdate = async (
    sellerOrderId: string,
    newStatus: SellerOrderStatus,
    orderNumber: string,
    courierDetails?: { courierName: string; trackingNumber: string }
  ): Promise<boolean> => {
    const originalOrders = [...orders];

    setOrders((prev) =>
      prev.map((ord) =>
        ord.seller_order_id === sellerOrderId
          ? {
            ...ord,
            seller_order_status: newStatus,
            courier_name: courierDetails?.courierName || ord.courier_name,
            tracking_number: courierDetails?.trackingNumber || ord.tracking_number,
            order_updated_at: new Date().toISOString(),
          }
          : ord
      )
    );

    const res = await updateSellerOrderStatus(sellerOrderId, sellerId, newStatus, courierDetails);

    if (res.success) {
      addToast(`Order #${orderNumber} marked as ${newStatus}`, 'success');
      loadOrders();
      return true;
    } else {
      setOrders(originalOrders);
      addToast(res.error || `Failed to update status for Order #${orderNumber}`, 'error');
      return false;
    }
  };

  // Intercepting status change handler
  const handleStatusChange = async (
    sellerOrderId: string,
    newStatus: SellerOrderStatus,
    orderNumber: string,
    courierDetails?: { courierName: string; trackingNumber: string }
  ): Promise<boolean> => {
    // Intercept 'Cancelled': open cancellation modal first
    if (newStatus === 'Cancelled') {
      setPendingCancellationTarget({
        sellerOrderId,
        orderNumber,
      });
      return false;
    }

    // Intercept 'Refund' or 'refund': open refund modal first
    if (newStatus === 'Refund' || (newStatus as string).toLowerCase() === 'refund') {
      setPendingRefundTarget({
        sellerOrderId,
        orderNumber,
      });
      return false;
    }

    // If courier details already provided or transition does not require courier details, execute immediately
    if (courierDetails || !isCourierModalRequired(newStatus)) {
      return executeStatusUpdate(sellerOrderId, newStatus, orderNumber, courierDetails);
    }

    // Intercept 'Shipped' or 'Delivered': open courier modal first
    setPendingCourierTarget({
      sellerOrderId,
      newStatus,
      orderNumber,
    });

    return false;
  };

  // Callback when seller submits CourierDetailsModal
  const handleCourierModalSubmit = async (
    courierName: string,
    trackingNumber: string
  ): Promise<boolean> => {
    if (!pendingCourierTarget) return false;

    const { sellerOrderId, newStatus, orderNumber } = pendingCourierTarget;
    const ok = await executeStatusUpdate(sellerOrderId, newStatus, orderNumber, {
      courierName,
      trackingNumber,
    });

    if (ok) {
      setPendingCourierTarget(null);
    }
    return ok;
  };

  const handleCancellationSuccess = (sellerOrderId: string, orderNumber: string) => {
    addToast(`Order #${orderNumber} cancelled successfully`, 'success');
    loadOrders();
  };

  const handleRefundSuccess = (sellerOrderId: string, orderNumber: string) => {
    addToast(`Refund submitted for Order #${orderNumber}`, 'success');
    loadOrders();
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* TOAST CONTAINER */}
      <div className="fixed bottom-5 right-5 z-50 space-y-2 max-w-md pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-lg shadow-xl border text-xs font-semibold tracking-wide animate-slide-up ${toast.type === 'success'
                ? 'bg-stone-900 text-amber-400 border-stone-800'
                : 'bg-rose-900 text-rose-100 border-rose-800'
              }`}
          >
            <div className="flex items-center space-x-2">
              {toast.type === 'success' ? (
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-rose-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="ml-4 text-stone-400 hover:text-white"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* HEADER & CONTROLS CONTAINER */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3 sm:space-y-4">
        {/* TITLE + SEARCH ROW */}
        <div className="flex flex-row items-center justify-between gap-3 overflow-x-auto whitespace-nowrap pb-1">
          <h2 className="text-base sm:text-xl lg:text-xl font-bold text-stone-900 uppercase tracking-wider shrink-0">
            All Orders
          </h2>

          <CollapsibleSearchInput
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              setPage(1);
            }}
            placeholder="Search Order # or Customer..."
            alwaysExpandedOnDesktop
          />
        </div>

        {/* FILTER / SORT CONTROLS ROW */}
        <div className="flex flex-row items-center justify-end gap-2 sm:gap-3 overflow-x-auto whitespace-nowrap pt-2 border-t border-stone-100">
          {/* Status Dropdown */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <select
              value={specificStatus}
              onChange={(e) => {
                setSpecificStatus(e.target.value);
                setPage(1);
              }}
              className="min-w-[120px] sm:min-w-[140px] px-2.5 py-1.5 sm:px-3 sm:py-2 border border-stone-300 rounded-lg text-xs sm:text-sm font-medium bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 cursor-pointer min-h-[36px]"
            >
              {DISPLAY_FILTER_STATUSES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="min-w-[110px] sm:min-w-[130px] px-2.5 py-1.5 sm:px-3 sm:py-2 border border-stone-300 rounded-lg text-xs sm:text-sm font-medium bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 cursor-pointer min-h-[36px]"
            >
              <option value="created_at">Order Date</option>
              <option value="seller_total">Amount</option>
              <option value="customer_name">Customer Name</option>
            </select>

            <button
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              className="p-2 border border-stone-300 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors flex items-center justify-center min-h-[36px] min-w-[36px]"
              aria-label="Toggle sort order"
            >
              {sortOrder === 'asc' ? (
                <ArrowUp className="w-4 h-4 text-stone-700" />
              ) : (
                <ArrowDown className="w-4 h-4 text-stone-700" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm min-w-[750px] lg:min-w-0">
            <thead className="bg-stone-900 text-stone-200 font-bold uppercase tracking-wider text-xs sm:text-sm border-b border-stone-800 whitespace-nowrap">
              <tr>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Order #</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Customer Name</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Phone No</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">City</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Item Name</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4 text-center">Items</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4 text-right">Amount</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Payment</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4 text-center">Status</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Arrival Date</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Updated Date</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs sm:text-sm lg:text-base">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-3 sm:px-4"><div className="h-4 bg-stone-200 rounded-sm w-20" /></td>
                    <td className="py-3.5 px-3 sm:px-4"><div className="h-4 bg-stone-200 rounded-sm w-28" /></td>
                    <td className="py-3.5 px-3 sm:px-4"><div className="h-4 bg-stone-200 rounded-sm w-24" /></td>
                    <td className="py-3.5 px-3 sm:px-4"><div className="h-4 bg-stone-200 rounded-sm w-16" /></td>
                    <td className="py-3.5 px-3 sm:px-4"><div className="h-4 bg-stone-200 rounded-sm w-36" /></td>
                    <td className="py-3.5 px-3 sm:px-4 text-center"><div className="h-4 bg-stone-200 rounded-sm w-8 mx-auto" /></td>
                    <td className="py-3.5 px-3 sm:px-4 text-right"><div className="h-4 bg-stone-200 rounded-sm w-20 ml-auto" /></td>
                    <td className="py-3.5 px-3 sm:px-4"><div className="h-4 bg-stone-200 rounded-full w-24" /></td>
                    <td className="py-3.5 px-3 sm:px-4 text-center"><div className="h-6 bg-stone-200 rounded-full w-24 mx-auto" /></td>
                    <td className="py-3.5 px-3 sm:px-4"><div className="h-4 bg-stone-200 rounded-sm w-12" /></td>
                    <td className="py-3.5 px-3 sm:px-4"><div className="h-4 bg-stone-200 rounded-sm w-16" /></td>
                    <td className="py-3.5 px-3 sm:px-4 text-center"><div className="h-7 bg-stone-200 rounded-md w-14 mx-auto" /></td>
                  </tr>
                ))
              ) : sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-stone-500">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900">No records found</h4>
                      <p className="text-xs text-stone-500">
                        There are currently no orders matching your selected filters. Try switching filters or clearing your search.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedOrders.map((ord) => (
                  <tr key={ord.seller_order_id} className="hover:bg-stone-50/70 transition-colors">
                    {/* 1. Order # */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 font-mono font-bold text-stone-900 whitespace-nowrap text-xs sm:text-sm">
                      #{ord.order_number}
                    </td>

                    {/* 2. Customer Name */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 font-semibold text-stone-800 text-xs sm:text-sm lg:text-base">
                      {ord.customer_name}
                    </td>

                    {/* 3. Phone No */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 font-mono text-stone-600 whitespace-nowrap text-xs sm:text-sm">
                      {ord.customer_phone}
                    </td>

                    {/* 4. City */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-stone-700 whitespace-nowrap text-xs sm:text-sm">
                      {ord.city}
                    </td>

                    {/* 5. Item Name */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-stone-700 max-w-xs truncate text-xs sm:text-sm" title={ord.aggregated_items}>
                      {ord.aggregated_items}
                    </td>

                    {/* 6. Items */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-center font-mono font-bold text-stone-900 text-xs sm:text-sm">
                      {ord.total_items_qty}
                    </td>

                    {/* 7. Amount */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-right font-mono font-bold text-stone-900 whitespace-nowrap text-xs sm:text-sm lg:text-base">
                      Rs. {ord.seller_total.toLocaleString()}
                    </td>

                    {/* 8. Payment */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-2xs sm:text-xs font-bold bg-stone-100 text-stone-800 border border-stone-200">
                        {ord.payment_method}
                      </span>
                    </td>

                    {/* 9. Status */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-center">
                      <StatusDropdown
                        sellerOrderId={ord.seller_order_id}
                        sellerId={ord.seller_id}
                        orderNumber={ord.order_number}
                        currentStatus={ord.seller_order_status}
                        onStatusChange={handleStatusChange}
                        size="sm"
                      />
                      {(ord.courier_name || ord.tracking_number) && (
                        <div className="mt-1 text-2xs text-stone-600 font-mono flex flex-col items-center">
                          <span className="font-semibold text-amber-900">{ord.courier_name}</span>
                          {ord.tracking_number && <span className="text-stone-500">#{ord.tracking_number}</span>}
                        </div>
                      )}
                    </td>

                    {/* 10. Arrival Date */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-stone-500 whitespace-nowrap italic text-2xs sm:text-xs">
                      {new Date(ord.order_created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>

                    {/* 11. Updated Date */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-stone-500 whitespace-nowrap text-2xs sm:text-xs">
                      {formatRelativeTime(ord.order_updated_at)}
                    </td>

                    {/* 12. Action View Button */}
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedOrderId(ord.order_id);
                          setIsModalOpen(true);
                        }}
                        className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-stone-900 hover:bg-black text-white text-2xs sm:text-xs font-bold uppercase rounded-md transition-colors shadow-2xs min-h-[28px] sm:min-h-[32px]"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION FOOTER */}
      {totalPages > 1 && (
        <div className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center justify-between text-xs sm:text-sm shadow-2xs">
          <span className="text-stone-500">
            Showing <strong className="text-stone-900">{(page - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-stone-900">{Math.min(page * pageSize, totalCount)}</strong> of{' '}
            <strong className="text-stone-900">{totalCount}</strong> orders
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-stone-300 rounded-lg text-stone-700 font-medium hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[36px]"
            >
              Previous
            </button>
            <span className="font-mono font-bold text-stone-800 px-1">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-stone-300 rounded-lg text-stone-700 font-medium hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[36px]"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ORDER DETAIL MODAL */}
      <OrderDetailModal
        isOpen={isModalOpen}
        orderId={selectedOrderId}
        sellerId={sellerId}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrderId(null);
        }}
        onStatusChange={handleStatusChange}
      />

      {/* COURIER DETAILS INTERCEPTION MODAL */}
      <CourierDetailsModal
        isOpen={!!pendingCourierTarget}
        orderNumber={pendingCourierTarget?.orderNumber || ''}
        targetStatus={pendingCourierTarget?.newStatus || null}
        onClose={() => setPendingCourierTarget(null)}
        onSubmit={handleCourierModalSubmit}
      />

      {/* CANCELLATION REASON MODAL */}
      <OrderCancellationModal
        isOpen={!!pendingCancellationTarget}
        orderNumber={pendingCancellationTarget?.orderNumber || ''}
        sellerOrderId={pendingCancellationTarget?.sellerOrderId || ''}
        sellerId={sellerId}
        onClose={() => setPendingCancellationTarget(null)}
        onSuccess={handleCancellationSuccess}
      />

      {/* REFUND DETAILS MODAL */}
      <OrderRefundModal
        isOpen={!!pendingRefundTarget}
        orderNumber={pendingRefundTarget?.orderNumber || ''}
        sellerOrderId={pendingRefundTarget?.sellerOrderId || ''}
        sellerId={sellerId}
        onClose={() => setPendingRefundTarget(null)}
        onSuccess={handleRefundSuccess}
      />
    </div>
  );
};

