import React, { useState, useEffect } from 'react';
import { Truck, X, Loader2, AlertCircle } from 'lucide-react';
import { COURIER_OPTIONS, OTHER_COURIER_VALUE } from '@/src/constants/courierOptions';
import { SellerOrderStatus } from '@/types';

export interface CourierDetailsModalProps {
  isOpen: boolean;
  orderNumber: string;
  targetStatus: SellerOrderStatus | null;
  onClose: () => void;
  onSubmit: (courierName: string, trackingNumber: string) => Promise<boolean>;
}

export const CourierDetailsModal: React.FC<CourierDetailsModalProps> = ({
  isOpen,
  orderNumber,
  targetStatus,
  onClose,
  onSubmit,
}) => {
  const [selectedCourier, setSelectedCourier] = useState<string>('');
  const [manualCourierName, setManualCourierName] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset form when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setSelectedCourier('');
      setManualCourierName('');
      setTrackingNumber('');
      setSubmitting(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !targetStatus) return null;

  const isOthersSelected = selectedCourier === OTHER_COURIER_VALUE;

  // Resolve final courier name to send to backend
  const resolvedCourierName = isOthersSelected ? manualCourierName.trim() : selectedCourier;

  // Form validity check
  const isCourierValid = isOthersSelected ? manualCourierName.trim().length > 0 : selectedCourier.length > 0;
  const isTrackingValid = trackingNumber.trim().length > 0;
  const isFormValid = isCourierValid && isTrackingValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const ok = await onSubmit(resolvedCourierName, trackingNumber.trim());
      if (ok) {
        setSubmitting(false);
        onClose();
      } else {
        setSubmitting(false);
        setErrorMsg('Failed to update courier details. Please try again.');
      }
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err?.message || 'An error occurred while saving courier details.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-stone-200 flex flex-col">
        {/* MODAL HEADER */}
        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base lg:text-base font-bold text-white tracking-tight">
                Courier & Dispatch Details
              </h3>
              <p className="text-[9px] sm:text-xs lg:text-xs text-stone-400">
                Order <strong className="text-amber-400">#{orderNumber}</strong> &rarr; Mark as{' '}
                <strong className="text-white uppercase">{targetStatus}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors hover:bg-stone-800 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL FORM BODY */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-[10px] sm:text-xs lg:text-xs text-stone-800">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="text-[10px] sm:text-xs lg:text-xs font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* FIELD 1: CHOOSE COURIER COMPANY */}
          <div className="space-y-1.5">
            <label htmlFor="courier-select" className="block text-[10px] sm:text-xs lg:text-xs font-bold uppercase tracking-wider text-stone-700">
              Courier Company <span className="text-red-500">*</span>
            </label>
            <select
              id="courier-select"
              value={selectedCourier}
              disabled={submitting}
              onChange={(e) => {
                setSelectedCourier(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900 font-medium text-xs sm:text-sm disabled:opacity-50"
            >
              <option value="" disabled>
                -- Select Courier Service --
              </option>
              {COURIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* CONDITIONAL MANUAL COURIER INPUT (REVEALED WHEN "OTHERS" IS SELECTED) */}
          {isOthersSelected && (
            <div className="space-y-1.5 animate-fade-in pl-2 border-l-2 border-amber-400">
              <label htmlFor="manual-courier-input" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Specify Courier Name <span className="text-red-500">*</span>
              </label>
              <input
                id="manual-courier-input"
                type="text"
                value={manualCourierName}
                disabled={submitting}
                onChange={(e) => {
                  setManualCourierName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="e.g. Swyft Logistics, Local Cargo, Rider"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900 text-xs sm:text-sm disabled:opacity-50"
              />
            </div>
          )}

          {/* FIELD 2: TRACKING NUMBER (TEXT INPUT FOR ALPHANUMERIC STRINGS) */}
          <div className="space-y-1.5">
            <label htmlFor="tracking-number-input" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
              Tracking Number <span className="text-red-500">*</span>
            </label>
            <input
              id="tracking-number-input"
              type="text"
              value={trackingNumber}
              disabled={submitting}
              onChange={(e) => {
                setTrackingNumber(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="e.g. TCS-784930129, LEOP-90123"
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900 text-xs sm:text-sm font-mono disabled:opacity-50"
            />
            <p className="text-[11px] text-stone-500">
              Alphanumeric tracking ID issued by courier partner
            </p>
          </div>

          {/* MODAL FOOTER BUTTONS */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2.5 border border-stone-300 rounded-xl text-stone-700 hover:bg-stone-100 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 text-stone-950" />
                  <span>Submit & Update Status</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
