import React, { useState } from 'react';
import { SellerOrderStatus } from '@/types';
import { ALLOWED_TRANSITIONS, normalizeOrderStatus } from '@/src/constants/orderWorkflow';

export interface StatusDropdownProps {
  sellerOrderId: string;
  sellerId: string;
  orderNumber: string;
  currentStatus: SellerOrderStatus;
  onStatusChange: (
    sellerOrderId: string,
    newStatus: SellerOrderStatus,
    orderNumber: string,
    courierDetails?: { courierName: string; trackingNumber: string }
  ) => Promise<boolean>;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const getStatusBadgeStyle = (status: string): { bg: string; text: string; border: string } => {
  const norm = normalizeOrderStatus(status);
  switch (norm) {
    case 'Pending':
    case 'Confirmed':
    case 'Processing':
      return {
        bg: 'bg-blue-50 hover:bg-blue-100',
        text: 'text-blue-800 font-semibold',
        border: 'border-blue-200',
      };
    case 'Shipped':
      return {
        bg: 'bg-indigo-50 hover:bg-indigo-100',
        text: 'text-indigo-800 font-semibold',
        border: 'border-indigo-200',
      };
    case 'Delivered':
      return {
        bg: 'bg-emerald-50 hover:bg-emerald-100',
        text: 'text-emerald-800 font-semibold',
        border: 'border-emerald-200',
      };
    case 'Refund':
    case 'refund':
      return {
        bg: 'bg-amber-50 hover:bg-amber-100',
        text: 'text-amber-900 font-semibold',
        border: 'border-amber-300',
      };
    case 'Cancelled':
      return {
        bg: 'bg-rose-50 hover:bg-rose-100',
        text: 'text-rose-800 font-semibold',
        border: 'border-rose-200',
      };
    default:
      return {
        bg: 'bg-stone-50 hover:bg-stone-100',
        text: 'text-stone-800 font-medium',
        border: 'border-stone-200',
      };
  }
};

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  sellerOrderId,
  sellerId,
  orderNumber,
  currentStatus,
  onStatusChange,
  disabled = false,
  size = 'sm',
}) => {
  const [updating, setUpdating] = useState(false);

  const normCurrent = normalizeOrderStatus(currentStatus);
  const style = getStatusBadgeStyle(normCurrent);
  const allowedNext = ALLOWED_TRANSITIONS[normCurrent] || ALLOWED_TRANSITIONS[currentStatus] || [];

  const pyClass = size === 'sm' ? 'py-1 px-2.5 text-[8px] sm:text-[10px] lg:text-[10px]' : 'py-1.5 px-3 text-[9px] sm:text-xs lg:text-xs';

  // Terminal state: render static badge without select options
  if (allowedNext.length === 0) {
    return (
      <span
        className={`inline-flex items-center rounded-full border ${pyClass} ${style.bg} ${style.text} ${style.border} font-semibold tracking-tight`}
      >
        {normCurrent}
      </span>
    );
  }

  const availableOptions = [normCurrent, ...allowedNext.filter((st) => st !== normCurrent)];

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as SellerOrderStatus;
    if (newStatus === normCurrent || updating) return;

    setUpdating(true);
    try {
      await onStatusChange(sellerOrderId, newStatus, orderNumber);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <select
        value={normCurrent}
        disabled={disabled || updating}
        onChange={handleChange}
        className={`
          appearance-none rounded-full cursor-pointer transition-all border shadow-2xs focus:outline-none focus:ring-2 focus:ring-stone-400
          ${pyClass}
          ${style.bg} ${style.text} ${style.border}
          ${updating ? 'opacity-50 cursor-wait animate-pulse' : ''}
          ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          pr-6 font-medium tracking-tight
        `}
      >
        {availableOptions.map((st) => (
          <option key={st} value={st} className="bg-white text-stone-900 font-normal">
            {st}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-stone-500">
        <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>
    </div>
  );
};
