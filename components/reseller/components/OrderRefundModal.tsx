import React, { useState } from 'react';
import { X, AlertCircle, Loader2, RefreshCw, Upload, Image as ImageIcon } from 'lucide-react';
import { refundSellerOrder } from '@/src/api/sellerOrdersService';

export interface OrderRefundModalProps {
  isOpen: boolean;
  orderNumber: string;
  sellerOrderId: string;
  sellerId: string;
  onClose: () => void;
  onSuccess: (sellerOrderId: string, orderNumber: string) => void;
}

export const OrderRefundModal: React.FC<OrderRefundModalProps> = ({
  isOpen,
  orderNumber,
  sellerOrderId,
  sellerId,
  onClose,
  onSuccess,
}) => {
  const [parcelFile, setParcelFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [refundNote, setRefundNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setParcelFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      if (error) setError(null);
    }
  };

  const handleClearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setParcelFile(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcelFile || !refundNote.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const res = await refundSellerOrder(sellerOrderId, sellerId, parcelFile, refundNote.trim());

    if (res.success) {
      handleClearFile();
      setRefundNote('');
      setIsSubmitting(false);
      onSuccess(sellerOrderId, orderNumber);
      onClose();
    } else {
      setError(res.error || 'Failed to process refund submission. Please try again.');
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
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden space-y-4 p-5 sm:p-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm sm:text-base lg:text-base">
            <RefreshCw className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Submit Refund Details — Order #{orderNumber}</span>
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
          <p className="text-[10px] sm:text-xs lg:text-xs text-stone-600 leading-relaxed">
            Please upload a photo of the returned parcel and provide details for Order <strong>#{orderNumber}</strong>.
          </p>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-[10px] sm:text-xs lg:text-xs text-rose-800 flex items-center space-x-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Parcel Image Upload Field */}
          <div className="space-y-1.5">
            <label className="block text-[10px] sm:text-xs lg:text-xs font-bold text-stone-900 uppercase tracking-wider">
              Please upload an image of the parcel <span className="text-rose-600">*</span>
            </label>

            {previewUrl ? (
              <div className="relative rounded-lg border border-stone-200 overflow-hidden bg-stone-50 p-2 flex items-center space-x-3">
                <img
                  src={previewUrl}
                  alt="Parcel Preview"
                  className="w-16 h-16 object-cover rounded-md border border-stone-300 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs lg:text-xs font-semibold text-stone-800 truncate">{parcelFile?.name}</p>
                  <p className="text-[9px] sm:text-[10px] lg:text-[10px] text-stone-500">
                    {parcelFile ? `${(parcelFile.size / 1024).toFixed(1)} KB` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearFile}
                  disabled={isSubmitting}
                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer bg-stone-50/50 hover:bg-amber-50/30 transition-all text-center">
                <Upload className="w-6 h-6 text-stone-400 mb-1" />
                <span className="text-[10px] sm:text-xs lg:text-xs font-bold text-stone-700">Click to upload parcel image</span>
                <span className="text-[9px] sm:text-[10px] lg:text-[10px] text-stone-500 mt-0.5">PNG, JPG, or WEBP up to 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Refund Note Field */}
          <div className="space-y-1.5">
            <label htmlFor="refund-note" className="block text-[10px] sm:text-xs lg:text-xs font-bold text-stone-900 uppercase tracking-wider">
              Refund Note / Reason <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="refund-note"
              rows={3}
              value={refundNote}
              onChange={(e) => {
                setRefundNote(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Describe parcel condition, reason for return, or customer complaint..."
              disabled={isSubmitting}
              className="w-full p-3 text-[10px] sm:text-xs lg:text-xs border border-stone-300 rounded-lg bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all resize-none"
              required
            />
          </div>

          {/* Modal Footer / Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-stone-300 rounded-lg text-2xs sm:text-xs lg:text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer min-h-[38px] disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!parcelFile || !refundNote.trim() || isSubmitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white text-2xs sm:text-xs lg:text-xs font-bold uppercase rounded-lg transition-colors cursor-pointer min-h-[38px] flex items-center space-x-2 disabled:cursor-not-allowed shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Uploading Image & Submitting...</span>
                </>
              ) : (
                <span>Submit Refund</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
