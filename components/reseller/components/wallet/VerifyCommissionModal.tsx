import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { GenericModal } from './GenericModal';
import { submitSellerCommissionVerification, uploadPaymentReceiptScreenshot } from '@/src/api/sellerWalletService';

export interface VerifyCommissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  payableAmount: number;
  eligibleBase: number;
  sellerId: string;
}

export const VerifyCommissionModal: React.FC<VerifyCommissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  payableAmount = 0,
  sellerId,
}) => {
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (payableAmount > 0) {
        setAmountStr(Math.round(payableAmount).toString());
      } else {
        setAmountStr('');
      }
      setErrorMsg(null);
    }
  }, [isOpen, payableAmount]);

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
    ];
    if (allowedKeys.includes(e.key) || (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()))) {
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const sanitized = rawValue.replace(/\D/g, '');
    setAmountStr(sanitized);
    if (errorMsg) setErrorMsg(null);
  };

  const numericAmount = parseInt(amountStr, 10) || 0;
  const isAmountLessThanPayable = amountStr !== '' && numericAmount < Math.round(payableAmount);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMsg('Invalid file format. Please upload a JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('File size exceeds 5MB limit. Please select a smaller screenshot.');
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Please enter a valid paid commission amount.');
      return;
    }

    if (isAmountLessThanPayable) {
      setErrorMsg(`Your payable amount is Rs. ${Math.round(payableAmount).toLocaleString()}. Please send and enter this exact amount.`);
      return;
    }

    if (!selectedFile && !previewUrl) {
      setErrorMsg('Please upload a valid payment receipt screenshot.');
      return;
    }

    setLoading(true);

    try {
      let imageUrl = previewUrl || '';
      if (selectedFile) {
        imageUrl = await uploadPaymentReceiptScreenshot(sellerId, selectedFile);
      }

      const result = await submitSellerCommissionVerification({
        sellerId,
        paidAmount: numericAmount,
        receiptImage: imageUrl,
        notes: note.trim() || undefined,
      });

      if (!result.success) {
        setErrorMsg(result.error || 'Failed to submit verification. Please try again.');
        setLoading(false);
        return;
      }

      setLoading(false);
      onClose();
      onSuccess(`Commission verification submitted for Rs. ${numericAmount.toLocaleString()} successfully!`);

      setAmountStr('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setNote('');
    } catch (err: any) {
      console.error('Error submitting commission verification:', err);
      setErrorMsg(err?.message || 'Failed to submit commission verification. Please try again.');
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    !amountStr ||
    numericAmount <= 0 ||
    isAmountLessThanPayable ||
    (!selectedFile && !previewUrl) ||
    loading;

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title="Verify Paid Commission"
      subtitle="Submit your bank transaction details & screenshot for verification"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs sm:text-sm">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Numeric Paid Amount Input */}
        <div>
          <label className="font-bold text-stone-900 block mb-1.5 uppercase tracking-wide">
            Enter Your Paid Amount <span className="text-red-600">*</span>
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 font-bold text-stone-500 text-sm">Rs.</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              placeholder={Math.round(payableAmount).toString() || '18500'}
              value={amountStr}
              onKeyDown={handleAmountKeyDown}
              onChange={handleAmountChange}
              className={`w-full pl-12 pr-4 py-3 border rounded-lg font-mono text-base font-bold text-stone-900 focus:outline-none transition-all min-h-[44px] ${isAmountLessThanPayable
                  ? 'border-red-400 bg-red-50/30 focus:border-red-600'
                  : 'border-stone-300 focus:border-stone-900 bg-stone-50/50'
                }`}
            />
          </div>

          {isAmountLessThanPayable ? (
            <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded-lg text-xs font-bold text-amber-900 flex items-start space-x-1.5">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Your payable amount is Rs. {Math.round(payableAmount).toLocaleString()}. Please send and enter this exact amount.
              </span>
            </div>
          ) : (
            <p className="text-xs text-stone-500 mt-1">
              Only digits allowed. Enter the exact amount transferred to Meezan Bank.
            </p>
          )}
        </div>

        {/* 2. Image Upload Field */}
        <div>
          <label className="font-bold text-stone-900 block mb-1.5 uppercase tracking-wide">
            Upload Payment Screenshot <span className="text-red-600">*</span>
          </label>

          {!previewUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-300 hover:border-amber-500 bg-stone-50 hover:bg-amber-50/30 rounded-xl p-5 sm:p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group"
            >
              <div className="p-3 bg-white group-hover:bg-amber-100/50 rounded-full text-stone-400 group-hover:text-amber-600 transition-colors shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-stone-900 block text-xs sm:text-sm">
                  Click to select payment receipt screenshot
                </span>
                <span className="text-xs text-stone-500 block mt-0.5">
                  Accepts JPG, PNG, WEBP (Max 5MB)
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="relative border border-stone-200 rounded-xl p-3 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-stone-300 bg-stone-200 shrink-0">
                  <img
                    src={previewUrl}
                    alt="Payment receipt preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="overflow-hidden">
                  <span className="font-bold text-stone-900 block truncate text-xs sm:text-sm">
                    {selectedFile?.name || 'receipt_screenshot.png'}
                  </span>
                  <span className="text-xs text-emerald-700 font-semibold flex items-center space-x-1 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Image Ready for Upload</span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer ml-2 shrink-0"
                title="Remove image"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* 3. Note */}
        <div>
          <label className="font-bold text-stone-900 block mb-1.5 uppercase tracking-wide flex items-center space-x-1.5">
            <FileText className="w-4 h-4 text-stone-500" />
            <span>Note / Transaction Reference (Optional)</span>
          </label>
          <textarea
            rows={5}
            placeholder="Add any extra details here (e.g. Transaction Reference ID #TRX-12345, EasyPaisa account number)..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full p-3 border border-stone-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-all bg-white leading-relaxed resize-y"
          />
        </div>

        {/* Submit Actions */}
        <div className="pt-3 border-t border-stone-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 font-semibold rounded-lg transition-colors cursor-pointer min-h-[42px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="px-6 py-2.5 bg-stone-900 hover:bg-black disabled:bg-stone-400 text-white font-bold uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed min-h-[42px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Submitting...</span>
              </>
            ) : (
              <span>Submit Verification</span>
            )}
          </button>
        </div>
      </form>
    </GenericModal>
  );
};
