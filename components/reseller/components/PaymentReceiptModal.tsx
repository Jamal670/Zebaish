import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  AlertCircle,
  Loader2,
  FileText,
  FileX,
  ExternalLink,
  CheckCircle,
  XCircle,
  Receipt,
  Clock,
} from 'lucide-react';
import supabase from '@/src/api/client';
import { getPaymentProofDisplayUrl } from '@/src/api/orderService';
import { formatOrderNumber } from './OrdersTable';

export interface PaymentReceiptModalProps {
  isOpen: boolean;
  sellerOrderId: string | null;
  orderNumber: string;
  onClose: () => void;
  onSuccess?: (sellerOrderId: string, decision: 'Accept' | 'Reject') => void;
  onError?: (message: string) => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  sellerOrderId,
  orderNumber,
  onClose,
  onSuccess,
  onError,
}) => {
  const queryClient = useQueryClient();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [imgError, setImgError] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [isUpdating, setIsUpdating] = useState<'Accept' | 'Reject' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // TanStack Query: fetch fresh status directly from backend for this sellerOrderId
  const {
    data: receipt,
    isLoading,
    isError,
    error: fetchError,
  } = useQuery({
    queryKey: ['shipping-receipt', sellerOrderId],
    queryFn: async () => {
      if (!sellerOrderId) return null;
      const { data, error } = await supabase
        .from('seller_orders')
        .select('shipping_amount, shipping_payment_status, payment_proof_url, Ship_pay_verified_at')
        .eq('id', sellerOrderId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: Boolean(isOpen && sellerOrderId),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Focus trap, Escape key handling, and body scroll lock
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isUpdating === null) {
          handleClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        previousFocusRef.current?.focus();
      };
    }
  }, [isOpen, isUpdating]);

  // Reset local errors on modal open / target switch
  useEffect(() => {
    setImgError(false);
    setActionError(null);
  }, [sellerOrderId, isOpen]);

  // Resolve display URL for payment receipt (handles private bucket signed URLs, public URLs, and bare paths)
  useEffect(() => {
    let isMounted = true;
    const rawProof = receipt?.payment_proof_url;

    if (!isOpen || !rawProof) {
      setResolvedUrl(null);
      setIsResolvingUrl(false);
      return;
    }

    setIsResolvingUrl(true);
    setImgError(false);

    getPaymentProofDisplayUrl(rawProof)
      .then((url) => {
        if (isMounted) {
          setResolvedUrl(url || rawProof);
          setIsResolvingUrl(false);
        }
      })
      .catch((err) => {
        console.warn('Could not resolve payment proof display URL:', err);
        if (isMounted) {
          setResolvedUrl(rawProof);
          setIsResolvingUrl(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [receipt?.payment_proof_url, isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isUpdating !== null) return;
    setActionError(null);
    onClose();
  };

  const currentStatus = receipt?.shipping_payment_status;
  const isPending = currentStatus === 'Pending';
  const canReview = isPending && !isLoading && !isError && isUpdating === null;

  const handleDecision = async (decision: 'Accept' | 'Reject') => {
    if (!canReview || !sellerOrderId) return;

    setIsUpdating(decision);
    setActionError(null);

    try {
      // Compare-and-set safeguard: matches only Pending rows
      const now = new Date().toISOString();
      const { data: updatedRows, error: updateErr } = await supabase
        .from('seller_orders')
        .update({
          shipping_payment_status: decision,
          Ship_pay_verified_at: now,
        })
        .eq('id', sellerOrderId)
        .eq('shipping_payment_status', 'Pending')
        .select('shipping_payment_status, Ship_pay_verified_at');

      if (updateErr) {
        const msg = updateErr.message || `Failed to ${decision.toLowerCase()} payment receipt.`;
        setActionError(msg);
        onError?.(msg);
        return;
      }

      // Check if 0 rows were updated (someone else already processed it)
      if (!updatedRows || updatedRows.length === 0) {
        const msg = 'This receipt was already processed.';
        setActionError(msg);
        onError?.(msg);
        queryClient.invalidateQueries({ queryKey: ['shipping-receipt', sellerOrderId] });
        return;
      }

      // Update local query cache immediately with fresh server-confirmed state
      queryClient.setQueryData(['shipping-receipt', sellerOrderId], (old: any) => ({
        ...old,
        shipping_payment_status: updatedRows[0].shipping_payment_status,
        Ship_pay_verified_at: updatedRows[0].Ship_pay_verified_at,
      }));

      onSuccess?.(sellerOrderId, decision);
    } catch (err: any) {
      console.error('Error reviewing shipping payment receipt:', err);
      const msg = err?.message || 'An unexpected error occurred while reviewing receipt.';
      setActionError(msg);
      onError?.(msg);
    } finally {
      setIsUpdating(null);
    }
  };

  const proofUrl = resolvedUrl || receipt?.payment_proof_url;
  const isPdf = typeof proofUrl === 'string' && proofUrl.toLowerCase().includes('.pdf');
  const isValidHttp = typeof proofUrl === 'string' && (proofUrl.startsWith('http://') || proofUrl.startsWith('https://') || proofUrl.startsWith('data:'));

  const renderStatusBadge = () => {
    if (isLoading) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-500 border border-stone-200">
          <Loader2 className="w-3 h-3 animate-spin mr-1 text-stone-400" />
          Checking...
        </span>
      );
    }

    if (!currentStatus) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
          Not Specified
        </span>
      );
    }

    if (currentStatus === 'Pending') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <Clock className="w-3 h-3 mr-1 text-amber-700" />
          Pending
        </span>
      );
    }

    if (currentStatus === 'Accept' || currentStatus === 'Accepted') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
          <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-700" />
          Accepted
        </span>
      );
    }

    if (currentStatus === 'Reject' || currentStatus === 'Rejected') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
          <XCircle className="w-3.5 h-3.5 mr-1 text-rose-700" />
          Rejected
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-800 border border-stone-200">
        {currentStatus}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-receipt-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden space-y-4 p-5 sm:p-6 outline-none"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center space-x-2 text-stone-900 font-bold text-sm sm:text-base">
            <Receipt className="w-5 h-5 text-amber-600 shrink-0" />
            <h3 id="payment-receipt-modal-title" className="tracking-tight">
              Payment Receipt
            </h3>
            <span
              className="text-stone-500 font-mono text-xs font-semibold cursor-help"
              title={orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`}
            >
              ({formatOrderNumber(orderNumber)})
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isUpdating !== null}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 text-xs sm:text-sm">
          {/* Status & Amount Highlight Row */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] sm:text-xs uppercase font-bold text-stone-500 tracking-wider block">
                Shipping Amount
              </span>
              <span className="text-base font-extrabold font-mono text-stone-900 block">
                Rs. {Number(receipt?.shipping_amount ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col items-end space-y-1">
              <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
                Status
              </span>
              {renderStatusBadge()}
            </div>
          </div>

          {/* Verified Timestamp Banner (if available) */}
          {receipt?.Ship_pay_verified_at && (
            <div className="text-[11px] text-stone-600 bg-stone-100/70 p-2 rounded-md border border-stone-200 flex items-center space-x-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <span>
                Verified on{' '}
                {new Date(receipt.Ship_pay_verified_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          {/* Error Display */}
          {(actionError || (isError && fetchError)) && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center space-x-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError || (fetchError as any)?.message || 'Failed to load receipt details.'}</span>
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading || isResolvingUrl ? (
            <div className="h-64 bg-stone-100 rounded-lg animate-pulse flex flex-col items-center justify-center space-y-2 border border-stone-200 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin text-stone-500" />
              <span className="text-xs font-semibold text-stone-500">Loading receipt proof...</span>
            </div>
          ) : isValidHttp && !imgError ? (
            isPdf ? (
              <div className="p-6 bg-stone-50 rounded-lg border border-stone-200 flex flex-col items-center justify-center space-y-3 text-center">
                <FileText className="w-10 h-10 text-amber-700" />
                <span className="text-xs font-bold text-stone-800">PDF Payment Document</span>
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
                >
                  <span>Open receipt</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-center bg-stone-950 p-2 rounded-lg border border-stone-800 max-h-72 sm:max-h-96 overflow-hidden">
                  <img
                    src={proofUrl}
                    alt="Payment receipt proof"
                    className="max-h-72 sm:max-h-96 w-full object-contain rounded"
                    onError={() => setImgError(true)}
                  />
                </div>
                <div className="flex justify-end">
                  <a
                    href={proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xs text-stone-500 hover:text-stone-900 inline-flex items-center space-x-1 font-medium transition-colors cursor-pointer"
                  >
                    <span>Open full image</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-stone-50 rounded-lg border border-dashed border-stone-300 text-stone-500 text-center space-y-2">
              <FileX className="w-8 h-8 text-stone-400" />
              <p className="text-xs font-bold text-stone-700">Receipt not available</p>
              <p className="text-[11px] text-stone-500 max-w-xs">
                {imgError
                  ? 'Could not load the receipt image. The file may be unavailable.'
                  : 'No payment proof was attached for this order.'}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer: Exactly two buttons in one row (Reject and Accept) */}
        <div className="flex flex-row items-center justify-end gap-3 pt-3 border-t border-stone-200">
          <button
            type="button"
            onClick={() => handleDecision('Reject')}
            disabled={!canReview}
            className="flex-1 sm:flex-none px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 shadow-2xs min-h-[38px] cursor-pointer"
          >
            {isUpdating === 'Reject' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Rejecting...</span>
              </>
            ) : (
              <span>Reject</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleDecision('Accept')}
            disabled={!canReview}
            className="flex-1 sm:flex-none px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 shadow-2xs min-h-[38px] cursor-pointer"
          >
            {isUpdating === 'Accept' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Accepting...</span>
              </>
            ) : (
              <span>Accept</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
