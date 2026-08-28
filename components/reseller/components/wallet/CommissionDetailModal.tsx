import React, { useState, useEffect, useCallback } from 'react';
import { GenericModal } from './GenericModal';
import { fetchSellerPaymentDetail, PaymentDetailResponse } from '@/src/api/sellerWalletService';
import { format$ } from '../../data/mockWalletData';
import { CheckCircle2, Clock, XCircle, ShoppingBag, Loader2, Percent, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponsiveTable, ColumnDef } from '../common/ResponsiveTable';

export interface CommissionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string | null;
  sellerId: string;
  onViewScreenshot?: (url: string) => void;
}

export const CommissionDetailModal: React.FC<CommissionDetailModalProps> = ({
  isOpen,
  onClose,
  paymentId,
  sellerId,
  onViewScreenshot,
}) => {
  const [detail, setDetail] = useState<PaymentDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [orderPage, setOrderPage] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadOrderDetail = useCallback(async (pageToLoad = 1) => {
    if (!paymentId || !sellerId) return;

    try {
      if (pageToLoad === 1) {
        setLoading(true);
      } else {
        setLoadingOrders(true);
      }
      setErrorMsg(null);

      const data = await fetchSellerPaymentDetail({
        paymentId,
        sellerId,
        orderPage: pageToLoad,
        orderPageSize: 5,
      });

      setDetail(data);
      setOrderPage(pageToLoad);
    } catch (err) {
      console.error('Error fetching payment detail:', err);
      setErrorMsg('Failed to load payment details. Please try again.');
    } finally {
      setLoading(false);
      setLoadingOrders(false);
    }
  }, [paymentId, sellerId]);

  useEffect(() => {
    if (isOpen && paymentId && sellerId) {
      loadOrderDetail(1);
    } else {
      setDetail(null);
      setOrderPage(1);
    }
  }, [isOpen, paymentId, sellerId, loadOrderDetail]);

  if (!isOpen) return null;

  const payment = detail?.payment_summary;
  const cycle = detail?.cycle_summary;
  const orders = detail?.orders || [];
  const ordersPag = detail?.orders_pagination || {
    total_orders: orders.length,
    page: orderPage,
    page_size: 5,
    total_pages: 1,
    has_more: false,
  };

  const statusConfig = {
    Pending: {
      bg: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: Clock,
      label: 'Submitted for Verification',
    },
    Submitted: {
      bg: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: Clock,
      label: 'Submitted for Verification',
    },
    Verified: {
      bg: 'bg-emerald-100 text-emerald-950 border-emerald-300',
      icon: CheckCircle2,
      label: 'Verified & Confirmed',
    },
    Rejected: {
      bg: 'bg-red-100 text-red-900 border-red-300',
      icon: XCircle,
      label: 'Submission Rejected',
    },
  };

  const statusKey = payment?.status || 'Submitted';
  const currentStatus = statusConfig[statusKey] || statusConfig.Submitted;
  const StatusIcon = currentStatus.icon;

  const placeholderImg = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80';

  type OrderItemType = (typeof orders)[0];

  const orderColumns: ColumnDef<OrderItemType>[] = [
    {
      header: 'Suit Image & Title',
      cell: (item) => (
        <div className="flex items-center space-x-3">
          <img
            src={item.thumbnail_url || placeholderImg}
            alt={item.product_title}
            className="w-10 h-12 object-cover object-top rounded border border-stone-200 bg-stone-100 shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = placeholderImg;
            }}
          />
          <span className="font-bold text-stone-900 line-clamp-1">{item.product_title}</span>
        </div>
      ),
    },
    {
      header: 'Brand',
      cell: (item) => <span className="font-semibold text-stone-700">{item.brand || 'Designer Surplus'}</span>,
    },
    {
      header: 'Sold Qty',
      headerClassName: 'text-center',
      className: 'text-center font-mono font-bold text-stone-900',
      cell: (item) => item.quantity,
    },
    {
      header: 'Price',
      headerClassName: 'text-right',
      className: 'text-right font-mono font-semibold text-stone-900',
      cell: (item) => format$(item.price),
    },
    {
      header: 'Status',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (item) => (
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-2xs sm:text-xs font-bold uppercase ${item.status === 'Delivered'
              ? 'bg-emerald-100 text-emerald-800'
              : item.status === 'Shipped'
                ? 'bg-blue-100 text-blue-800'
                : item.status === 'Cancelled'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-amber-100 text-amber-800'
            }`}
        >
          {item.status}
        </span>
      ),
    },
  ];

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={payment ? `Commission Details — #${payment.id.substring(0, 8)}` : 'Commission Details'}
      subtitle={payment ? `Submitted on ${new Date(payment.created_at).toLocaleString()}` : 'Loading details...'}
      maxWidth="max-w-4xl"
    >
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-stone-700 mx-auto" />
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
            Loading payment summary & related orders...
          </p>
        </div>
      ) : errorMsg || !payment ? (
        <div className="py-12 text-center text-red-600 space-y-2">
          <p className="text-xs font-medium">{errorMsg || 'Could not load payment record details.'}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs uppercase font-bold min-h-[38px]"
          >
            Close
          </button>
        </div>
      ) : (
        <div className="space-y-5 text-xs sm:text-sm">
          {/* TOP SECTION — Summary Card */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="font-bold text-stone-900 text-xs sm:text-sm">
                  {new Date(payment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {cycle && (
                  <span className="text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>Cycle: Month {cycle.month} / {cycle.year} ({cycle.status})</span>
                  </span>
                )}
              </div>

              <div className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center space-x-1.5 ${currentStatus.bg}`}>
                <StatusIcon className="w-4 h-4 shrink-0" />
                <span>{currentStatus.label}</span>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-white p-3 rounded-lg border border-stone-200">
                <span className="text-2xs uppercase font-bold text-stone-500 block">Gross Sales Sum</span>
                <span className="text-sm sm:text-base font-extrabold font-mono text-stone-900">{format$(payment.gross_amount)}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-stone-200">
                <span className="text-2xs uppercase font-bold text-stone-500 block">Commission Rate</span>
                <span className="text-sm sm:text-base font-extrabold text-amber-700 flex items-center space-x-1">
                  <Percent className="w-4 h-4 inline shrink-0" />
                  <span>{payment.commission_percentage || 5.00}%</span>
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-stone-200">
                <span className="text-2xs uppercase font-bold text-amber-700 block">Paid Amount</span>
                <span className="text-sm sm:text-base font-extrabold font-mono text-amber-900">
                  {format$(payment.net_amount || payment.commission_amount)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-stone-200 flex flex-col justify-between">
                <span className="text-2xs uppercase font-bold text-stone-500 block">Payment Proof</span>
                {payment.receipt_image && onViewScreenshot && (
                  <button
                    type="button"
                    onClick={() => onViewScreenshot(payment.receipt_image)}
                    className="text-amber-700 font-bold hover:underline text-left text-xs inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <span>View Receipt Image</span>
                  </button>
                )}
              </div>
            </div>

            {payment.notes && (
              <div className={`p-3.5 rounded-lg border text-xs leading-relaxed ${payment.status === 'Rejected'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : payment.status === 'Verified'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}>
                <span className="font-bold block mb-0.5">Verification Notes:</span>
                <p>{payment.notes}</p>
              </div>
            )}
          </div>

          {/* Paid Amount Related to Orders (INNER PAGINATED, 5 PER BATCH) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-stone-900 text-xs sm:text-sm uppercase tracking-wide flex items-center space-x-2">
                <ShoppingBag className="w-4 h-4 text-stone-600 shrink-0" />
                <span>Paid Amount Related to Orders</span>
              </h4>
              <span className="text-xs text-stone-500">
                Total: <strong className="text-stone-900">{ordersPag.total_orders}</strong> marketplace order items
              </span>
            </div>

            <ResponsiveTable
              columns={orderColumns}
              data={orders}
              keyExtractor={(item, idx) => `${item.product_id}-${idx}`}
              isLoading={loadingOrders}
              emptyTitle="No Related Orders"
              emptySubtitle="No related order items were found for this commission payment."
            />

            {/* Inner Orders Pagination Controls (5 per page) */}
            {ordersPag.total_pages > 1 && (
              <div className="flex items-center justify-between pt-2 text-xs text-stone-600">
                <span>
                  Order Page <strong className="text-stone-900">{ordersPag.page}</strong> of{' '}
                  <strong className="text-stone-900">{ordersPag.total_pages}</strong>
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={ordersPag.page === 1 || loadingOrders}
                    onClick={() => loadOrderDetail(ordersPag.page - 1)}
                    className="p-1.5 border border-stone-300 rounded-md bg-white hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 cursor-pointer min-h-[32px]"
                    title="Previous Order Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={ordersPag.page === ordersPag.total_pages || loadingOrders}
                    onClick={() => loadOrderDetail(ordersPag.page + 1)}
                    className="p-1.5 border border-stone-300 rounded-md bg-white hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 cursor-pointer min-h-[32px]"
                    title="Next Order Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-stone-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-stone-900 hover:bg-black text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer min-h-[40px]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </GenericModal>
  );
};

export default CommissionDetailModal;
