import { SellerOrderStatus } from '@/types';

export interface CourierOption {
  label: string;
  value: string;
}

/**
 * Reusable list of common Pakistani courier companies with "Others" as the last option.
 */
export const COURIER_OPTIONS: CourierOption[] = [
  { label: 'TCS', value: 'TCS' },
  { label: 'Leopards', value: 'Leopards' },
  { label: 'M&P', value: 'M&P' },
  { label: 'Trax', value: 'Trax' },
  { label: 'PostEx', value: 'PostEx' },
  { label: 'Call Courier', value: 'Call Courier' },
  { label: 'Others', value: 'Others' },
];

export const OTHER_COURIER_VALUE = 'Others';

/**
 * Helper function to check if changing to a status requires courier details via modal.
 */
export function isCourierModalRequired(targetStatus: SellerOrderStatus): boolean {
  return targetStatus === 'Shipped' || targetStatus === 'Delivered';
}
