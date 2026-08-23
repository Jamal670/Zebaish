import React, { useState } from 'react';
import { X, AlertCircle, Loader2, Ban } from 'lucide-react';
import { cancelSellerOrder } from '@/src/api/sellerOrdersService';

export interface OrderCancellationModalProps {
  isOpen: boolean;
  orderNumber: string;
  sellerOrderId: string;
  sellerId: string;
  onClose: () => void;
  onSuccess: (sellerOrderId: string, orderNumber: string) => void;
}

export const OrderCancellationModal: React.FC<OrderCancellationModalProps> = ({
  isOpen,
  orderNumber,
  sellerOrderId,
  sellerId,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const res = await cancelSellerOrder(sellerOrderId, sellerId, trimmed);

    if (res.success) {
      setReason('');
      setIsSubmitting(false);
      onSuccess(sellerOrderId, orderNumber);
      onClose();
    } else {
      setError(res.error || 'Failed to cancel order. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xl max-w-md w-full overflow-hidden space-y-4 p-5 sm:p-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center space-x-2 text-rose-900 font-bold text-base sm:text-lg">
            <Ban className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Cancel Order #{orderNumber}</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Please provide a valid cancellation reason for cancelling Order <strong>#{orderNumber}</strong>. This information will be saved for audit records.
          </p>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center space-x-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="cancellation-reason" className="block text-xs font-bold text-stone-900 uppercase tracking-wider">
              Cancellation Reason <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="cancellation-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="E.g., Out of stock, Customer requested cancellation, Invalid address..."
              disabled={isSubmitting}
              className="w-full p-3 text-xs sm:text-sm border border-stone-300 rounded-lg bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all resize-none"
              required
            />
          </div>

          {/* Modal Footer / Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer min-h-[38px] disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || isSubmitting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold uppercase rounded-lg transition-colors cursor-pointer min-h-[38px] flex items-center space-x-2 disabled:cursor-not-allowed shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <span>Confirm Cancellation</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
