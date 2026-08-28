import React, { useState } from 'react';
import { Copy, Check, Building2, Info, ArrowRight, ShieldCheck } from 'lucide-react';
import { GenericModal } from './GenericModal';
import { format$ } from '../../data/mockWalletData';

export interface HowToPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  payableAmount: number;
  onOpenVerifyModal: () => void;
  iban?: string;
  bankName?: string;
  accountTitle?: string;
}

export const HowToPayModal: React.FC<HowToPayModalProps> = ({
  isOpen,
  onClose,
  payableAmount,
  onOpenVerifyModal,
  iban = 'PK36MEZN0001234567890123',
  bankName = 'Meezan Bank',
  accountTitle = 'Zebaish Surplus Marketplace Ltd.',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyIBAN = async () => {
    try {
      await navigator.clipboard.writeText(iban.replace(/\s+/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy IBAN to clipboard:', err);
    }
  };

  const handleProceedToVerify = () => {
    onClose();
    onOpenVerifyModal();
  };

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title="How to Pay Platform Commission"
      subtitle="Follow these simple steps to settle your marketplace commission balance"
      maxWidth="max-w-xl"
    >
      <div className="space-y-5 text-xs sm:text-sm">
        {/* Payable Amount Highlight Banner */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-950">
          <div>
            <span className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-amber-800 block">
              Current Payable Commission
            </span>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-amber-900">
              {format$(payableAmount)}
            </span>
          </div>
          <span className="px-3 py-1 bg-amber-200 text-amber-900 text-xs font-bold uppercase rounded-full">
            Due Now
          </span>
        </div>

        {/* Bank & IBAN Details Card */}
        <div className="bg-stone-900 text-white rounded-xl p-4 sm:p-5 shadow-lg relative overflow-hidden space-y-3.5">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-bold text-xs sm:text-sm text-stone-100">{bankName}</span>
            </div>
            <span className="text-2xs uppercase font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              Official Escrow Account
            </span>
          </div>

          <div>
            <span className="text-2xs uppercase font-medium text-stone-400 block mb-0.5">
              Account Title
            </span>
            <span className="text-xs sm:text-sm font-semibold text-stone-200 block">
              {accountTitle}
            </span>
          </div>

          <div>
            <span className="text-2xs uppercase font-medium text-stone-400 block mb-1">
              International Bank Account Number (IBAN)
            </span>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-stone-950 p-3 rounded-lg border border-stone-800 gap-2">
              <span className="font-mono text-xs sm:text-sm font-bold tracking-wider text-amber-300 select-all overflow-x-auto">
                {iban}
              </span>
              <button
                type="button"
                onClick={handleCopyIBAN}
                className={`px-3 py-2 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shrink-0 cursor-pointer min-h-[38px] ${copied
                    ? 'bg-emerald-500 text-stone-950 scale-105'
                    : 'bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700'
                  }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy IBAN</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Dual Language Step-by-Step Instructions */}
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
            <h4 className="font-bold text-stone-900 flex items-center space-x-1.5 uppercase tracking-wide">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Step-by-Step Payment Process (English)</span>
            </h4>
            <ol className="list-decimal pl-5 space-y-1.5 text-stone-600 leading-relaxed">
              <li>
                <strong>Copy the IBAN</strong> listed above and open your online banking application (Meezan, HBL, JazzCash, EasyPaisa, etc.).
              </li>
              <li>
                Transfer the exact <strong>Payable Amount ({format$(payableAmount)})</strong> to the Zebaish official bank account.
              </li>
              <li>
                Take a clear <strong>screenshot of your payment receipt</strong> showing the transaction ID and date.
              </li>
              <li>
                Return to this page, click <strong>"Verify Commission"</strong>, attach your receipt screenshot, and submit.
              </li>
            </ol>
          </div>

          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-right dir-rtl">
            <h4 className="font-bold text-stone-900 flex items-center justify-end space-x-1.5 space-x-reverse tracking-wide">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>طریقہ کار (Urdu Instructions)</span>
            </h4>
            <ol className="list-decimal pr-5 space-y-1.5 text-stone-700 leading-relaxed text-xs">
              <li>
                اوپر دیا گیا <strong>IBAN کاپی کریں</strong> اور اپنی آن لائن بینکنگ ایپ یا EasyPaisa/JazzCash کھولیں۔
              </li>
              <li>
                زیبائش کے آفیشل اکاؤنٹ میں <strong>قابلِ ادا کمیشن رقم ({format$(payableAmount)})</strong> منتقل کریں۔
              </li>
              <li>
                ٹرانزیکشن کی رسید یا اسکرین کا <strong>واضح اسکرین شاٹ لیں</strong>۔
              </li>
              <li>
                اس ویب سائٹ پر واپس آئیں، <strong>"کمیشن کی تصدیق کریں" (Verify Commission)</strong> پر کلک کریں، رسید کا اسکرین شاٹ اپ لوڈ کریں اور فارم جمع کرائیں۔
              </li>
            </ol>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 font-semibold text-xs rounded-lg transition-colors cursor-pointer min-h-[42px]"
          >
            Got It, Close
          </button>

          <button
            type="button"
            onClick={handleProceedToVerify}
            className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer min-h-[42px]"
          >
            <span>Proceed to Verify Commission</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </GenericModal>
  );
};
