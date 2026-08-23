import React from 'react';
import { SellerPaymentRecord } from '@/src/api/sellerWalletService';
import { format$ } from '../../data/mockWalletData';
import { Eye, Image as ImageIcon, ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, FileQuestion } from 'lucide-react';
import { ResponsiveTable, ColumnDef } from '../common/ResponsiveTable';

export interface CommissionHistoryTableProps {
  records: SellerPaymentRecord[];
  totalRecords: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onViewScreenshot: (url: string) => void;
  onViewDetail: (paymentId: string) => void;
}

export const CommissionHistoryTable: React.FC<CommissionHistoryTableProps> = ({
  records,
  totalRecords,
  currentPage,
  totalPages,
  isLoading,
  onPageChange,
  onViewScreenshot,
  onViewDetail,
}) => {
  const renderStatusBadge = (status: SellerPaymentRecord['status']) => {
    switch (status) {
      case 'Submitted':
      case 'Pending':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-700 shrink-0" />
            <span>Submitted</span>
          </span>
        );
      case 'Verified':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
            <span>Verified</span>
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-red-100 text-red-900 border border-red-300">
            <XCircle className="w-3 h-3 text-red-700 shrink-0" />
            <span>Rejected</span>
          </span>
        );
      default:
        return null;
    }
  };

  const formatPaymentDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const columns: ColumnDef<SellerPaymentRecord>[] = [
    {
      header: 'Sr #',
      cell: (_, idx) => (
        <span className="font-mono font-bold text-stone-500 text-xs sm:text-sm">
          #{(currentPage - 1) * 5 + idx + 1}
        </span>
      ),
    },
    {
      header: 'Sales',
      cell: (row) => (
        <span className="font-mono font-extrabold text-stone-900 text-xs sm:text-sm">
          {format$(row.gross_amount)}
        </span>
      ),
    },
    {
      header: 'Commission %',
      cell: (row) => <span className="font-bold text-stone-900 text-xs sm:text-sm">{row.commission_percentage || 5.00}%</span>,
    },
    {
      header: 'Paid Amount',
      cell: (row) => (
        <span className="font-mono font-extrabold text-stone-900 text-xs sm:text-sm">
          {format$(row.net_amount || row.gross_amount - row.commission_amount)}
        </span>
      ),
    },
    {
      header: 'Commission Amount',
      cell: (row) => (
        <span className="font-mono font-bold text-amber-700 text-xs sm:text-sm">
          {format$(row.commission_amount)}
        </span>
      ),
    },
    {
      header: 'Status',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (row) => renderStatusBadge(row.status),
    },
    {
      header: 'Image',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (row) => (
        <button
          type="button"
          onClick={() => onViewScreenshot(row.receipt_image)}
          className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-stone-900 hover:bg-black text-white text-[10px] sm:text-xs font-bold uppercase rounded-md transition-colors shadow-2xs min-h-[28px] sm:min-h-[32px]"
          title="View screenshot"
        >
          <span>View</span>
        </button>
      ),
    },
    {
      header: 'Action',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (row) => (
        <button
          type="button"
          onClick={() => onViewDetail(row.id)}
          className="p-1.5 sm:p-2 text-stone-600 hover:text-stone-950 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center min-h-[32px] sm:min-h-[34px] shrink-0"
          title="View details & orders"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
    {
      header: 'Date',
      headerClassName: 'text-right',
      className: 'text-right font-medium text-stone-600 text-xs sm:text-sm whitespace-nowrap',
      cell: (row) => formatPaymentDate(row.created_at),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-stone-200">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-stone-900 uppercase tracking-wide">
            Commission Payment History
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Log of all platform commission submissions and verification statuses
          </p>
        </div>
        <span className="text-xs font-semibold text-stone-500">
          Total: <strong className="text-stone-900">{totalRecords}</strong> Submissions
        </span>
      </div>

      <ResponsiveTable
        columns={columns}
        data={records}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyTitle="No Commission History Found"
        emptySubtitle="You haven't submitted any commission payments yet. When you pay your platform balance, your submission records will appear here."
        forceTableMode={true}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-stone-200 text-xs">
          <span className="text-stone-500">
            Page <strong className="text-stone-900">{currentPage}</strong> of{' '}
            <strong className="text-stone-900">{totalPages}</strong>
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={currentPage === 1 || isLoading}
              onClick={() => onPageChange(currentPage - 1)}
              className="p-2 border border-stone-300 rounded-md bg-white hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 cursor-pointer min-h-[36px]"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages || isLoading}
              onClick={() => onPageChange(currentPage + 1)}
              className="p-2 border border-stone-300 rounded-md bg-white hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 cursor-pointer min-h-[36px]"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
