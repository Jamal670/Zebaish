import { SellerOrderStatus } from '@/types';

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Pending: ['Shipped', 'Cancelled'],
  Confirmed: ['Shipped', 'Cancelled'],   // Treated as Pending
  Processing: ['Shipped', 'Cancelled'],  // Treated as Pending
  Shipped: ['Delivered', 'Refund'],      // Delivered & Refund
  Delivered: [],                         // Terminal
  Refund: [],                            // Terminal
  refund: [],                            // Terminal (casing variant)
  Cancelled: [],                         // Terminal
};

export const DISPLAY_FILTER_STATUSES: { label: string; value: string }[] = [
  { label: 'All Active Queue', value: 'All' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Shipped', value: 'Shipped' },
  { label: 'Delivered', value: 'Delivered' },
  { label: 'Refund', value: 'Refund' },
  { label: 'Cancelled', value: 'Cancelled' },
];

export function normalizeOrderStatus(status: string | null | undefined): string {
  if (!status) return 'Pending';
  const s = status.trim();
  if (s.toLowerCase() === 'refund') return 'Refund';
  if (s === 'Confirmed' || s === 'Processing') return 'Pending';
  return s;
}

export function isTransitionAllowed(currentStatus: string, newStatus: string): boolean {
  const normCurrent = normalizeOrderStatus(currentStatus);
  const normNew = newStatus.toLowerCase() === 'refund' ? 'Refund' : newStatus;
  const allowed = ALLOWED_TRANSITIONS[normCurrent] || ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(normNew) || allowed.includes(newStatus);
}
