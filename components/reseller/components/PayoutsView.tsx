import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import {
  fetchSellerWalletKpis,
  fetchSellerCommissionHistory,
  WalletKpiResponse,
  SellerPaymentRecord,
} from '@/src/api/sellerWalletService';
import { WalletKpiCard } from './wallet/WalletKpiCard';
import { HowToPayModal } from './wallet/HowToPayModal';
import { VerifyCommissionModal } from './wallet/VerifyCommissionModal';
import { ScreenshotPreviewModal } from './wallet/ScreenshotPreviewModal';
import { CommissionDetailModal } from './wallet/CommissionDetailModal';
import { CommissionHistoryTable } from './wallet/CommissionHistoryTable';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  Check,
  X,
  Wallet,
  Calendar,
} from 'lucide-react';

export interface PayoutsViewProps {
  iban?: string;
  bankName?: string;
  accountTitle?: string;
}

export const PayoutsView: React.FC<PayoutsViewProps> = ({
  iban = 'PK36MEZN0001234567890123',
  bankName = 'Meezan Bank',
  accountTitle = 'Zebaish Surplus Marketplace Ltd.',
}) => {
  const { user } = useAuth();
  const sellerId = user?.id || '';

  // Phase 1: Wallet KPI Summary State (fires first, renders first)
  const [kpis, setKpis] = useState<WalletKpiResponse | null>(null);
  const [loadingKpis, setLoadingKpis] = useState<boolean>(true);

  // Phase 2: Commission Payment History Table State (fires AFTER Phase 1)
  const [history, setHistory] = useState<SellerPaymentRecord[]>([]);
  const [totalHistoryRecords, setTotalHistoryRecords] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  const [isHowToPayOpen, setIsHowToPayOpen] = useState<boolean>(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [activeScreenshotUrl, setActiveScreenshotUrl] = useState<string | null>(null);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Phase 2 Load Function (History Table - 5 per page)
  const loadHistoryPage = useCallback(async (pageToLoad = 1) => {
    if (!sellerId) return;

    try {
      setLoadingHistory(true);
      const historyData = await fetchSellerCommissionHistory({
        sellerId,
        page: pageToLoad,
        pageSize: 5,
      });

      setHistory(historyData.records);
      setTotalHistoryRecords(historyData.total_count);
      setCurrentPage(historyData.page);
      setTotalPages(historyData.total_pages);
    } catch (err) {
      console.error('Failed to load seller payment history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [sellerId]);

  // Phase 1 Load Function (Wallet Summary - Renders Immediately)
  const loadWalletKpisFirst = useCallback(async () => {
    if (!sellerId) return;

    try {
      setLoadingKpis(true);
      // QUERY 1 — WALLET SUMMARY (Renders Immediately)
      const kpiData = await fetchSellerWalletKpis(sellerId);
      setKpis(kpiData);
      setLoadingKpis(false);

      // QUERY 2 — COMMISSION PAYMENT HISTORY TABLE (Fires AFTER Query 1 resolves & renders)
      loadHistoryPage(1);
    } catch (err) {
      console.error('Failed to load seller wallet KPIs:', err);
      setLoadingKpis(false);
      setLoadingHistory(false);
    }
  }, [sellerId, loadHistoryPage]);

  useEffect(() => {
    if (sellerId) {
      loadWalletKpisFirst();
    }
  }, [sellerId, loadWalletKpisFirst]);

  const handlePageChange = (newPage: number) => {
    loadHistoryPage(newPage);
  };

  const handleVerificationSuccess = (msg: string) => {
    showToast(msg);
    if (sellerId) {
      loadWalletKpisFirst();
    }
  };

  const currentCycle = kpis?.current_cycle;
  const payableAmount = currentCycle?.commission_remaining ?? currentCycle?.commission_amount ?? 0;
  const cycleStatus = currentCycle?.status || 'Unpaid';
  const cycleMonthYear = currentCycle
    ? `Month ${currentCycle.month} / ${currentCycle.year}`
    : 'Previous Calendar Month';

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12 max-w-8xl mx-auto px-2 sm:px-4">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white text-xs font-semibold px-5 py-3.5 rounded-xl shadow-2xl flex items-center space-x-3 border border-stone-800 animate-slide-up">
          <span className="p-1 bg-emerald-500/20 text-emerald-400 rounded-full">
            <Check className="w-4 h-4" />
          </span>
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-stone-400 hover:text-white p-1 ml-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PAGE HEADER BANNER */}
      <div className="bg-stone-900 text-white rounded-2xl p-5 sm:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-stone-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="flex items-center space-x-2">
            <span className="text-2xs font-extrabold uppercase tracking-[0.25em] text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded border border-amber-400/20">
              SELLER FINANCIAL CENTER
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight font-script">
            Wallet & Monthly Commission Management
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 max-w-xl leading-relaxed">
            Monitor seller earnings, calculate monthly platform commissions ({cycleMonthYear}), pay via Meezan Bank IBAN, and submit verification receipts.
          </p>
        </div>

        <div className="flex items-center space-x-3 bg-stone-950/80 p-3.5 rounded-xl border border-stone-800 shrink-0 relative z-10">
          <div className="p-2.5 bg-amber-400/10 text-amber-400 rounded-lg shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xs uppercase font-bold text-stone-400 block">Assigned Settlement Account</span>
            <span className="text-xs font-bold text-stone-100 block">{bankName}</span>
            <span className="text-xs font-mono text-amber-300 block">{iban}</span>
          </div>
        </div>
      </div>

      {/* SECTION 1 — TOP KPI CARDS ROW (QUERY 1 — RENDERS IMMEDIATELY) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-stone-700">
            Financial Overview & Previous Month Cycle
          </h2>
          <span className="text-xs text-stone-400 font-medium">
            Swipe left/right to view all KPI metrics
          </span>
        </div>

        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory focus:outline-none scrollbar-none select-none">
          {loadingKpis ? (
            [1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="min-w-[200px] sm:min-w-[240px] lg:min-w-[260px] h-36 bg-stone-100 rounded-xl animate-pulse border border-stone-200"
              />
            ))
          ) : (
            <>
              <WalletKpiCard
                label="Total Sales"
                amount={kpis?.total_sales ?? kpis?.total_available_payout ?? 0}
                icon={TrendingUp}
                subtext="Sum of all gross sales records"
                accent="dark"
              />

              <WalletKpiCard
                label="Remaining Commission"
                amount={kpis?.remaining_commission ?? payableAmount}
                icon={AlertTriangle}
                subtext={`Previous month (${cycleMonthYear})`}
                accent="amber"
              />

              <WalletKpiCard
                label="Submitted Payments"
                amount={kpis?.submitted_payments || 0}
                icon={Clock}
                subtext={`Submitted for ${cycleMonthYear}`}
                accent="blue"
              />

              <WalletKpiCard
                label="Verified Payments"
                amount={kpis?.verified_payments || 0}
                icon={CheckCircle2}
                subtext={`Verified for ${cycleMonthYear}`}
                accent="green"
              />
            </>
          )}
        </div>
      </section>

      {/* SECTION 2 — ACTION BUTTONS ROW */}
      <section className="bg-white border border-stone-200 rounded-xl p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="font-bold text-stone-900 text-xs sm:text-sm uppercase tracking-wide flex items-center justify-center sm:justify-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Platform Commission Settlement ({cycleMonthYear})</span>
          </h3>
          <p className="text-xs text-stone-500">
            Pay your outstanding commission balance via IBAN or submit payment verification details for {cycleMonthYear}.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsHowToPayOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-3 bg-white border border-stone-300 hover:bg-stone-50 text-stone-900 font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-2xs cursor-pointer min-h-[42px]"
          >
            <HelpCircle className="w-4 h-4 text-stone-600 shrink-0" />
            <span>How to Pay Commission</span>
          </button>

          <button
            type="button"
            onClick={() => setIsVerifyModalOpen(true)}
            className="w-full sm:w-auto px-6 py-2.5 sm:py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs sm:text-sm uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer min-h-[42px]"
          >
            <ShieldCheck className="w-4.5 h-4.5 shrink-0" />
            <span>Verify Commission</span>
          </button>
        </div>
      </section>

      {/* SECTION 4 — COMMISSION PAYMENT HISTORY TABLE (QUERY 2 — FIRES AFTER QUERY 1 RENDERS) */}
      <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-xs">
        <CommissionHistoryTable
          records={history}
          totalRecords={totalHistoryRecords}
          currentPage={currentPage}
          totalPages={totalPages}
          isLoading={loadingHistory}
          onPageChange={handlePageChange}
          onViewScreenshot={(url) => setActiveScreenshotUrl(url)}
          onViewDetail={(paymentId) => setActivePaymentId(paymentId)}
        />
      </section>

      <HowToPayModal
        isOpen={isHowToPayOpen}
        onClose={() => setIsHowToPayOpen(false)}
        payableAmount={payableAmount}
        onOpenVerifyModal={() => setIsVerifyModalOpen(true)}
        iban={iban}
        bankName={bankName}
        accountTitle={accountTitle}
      />

      <VerifyCommissionModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        onSuccess={handleVerificationSuccess}
        payableAmount={payableAmount}
        eligibleBase={currentCycle?.gross_amount || 0}
        sellerId={sellerId}
      />

      <ScreenshotPreviewModal
        isOpen={!!activeScreenshotUrl}
        onClose={() => setActiveScreenshotUrl(null)}
        imageUrl={activeScreenshotUrl}
      />

      <CommissionDetailModal
        isOpen={!!activePaymentId}
        onClose={() => setActivePaymentId(null)}
        paymentId={activePaymentId}
        sellerId={sellerId}
        onViewScreenshot={(url) => setActiveScreenshotUrl(url)}
      />
    </div>
  );
};

export default PayoutsView;
