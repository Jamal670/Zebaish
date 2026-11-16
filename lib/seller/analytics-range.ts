/**
 * Date range definitions and helper mappings for seller analytics
 */

export type DateRange = '7D' | '30D' | '90D' | 'ALL';

export function rangeToDays(range: DateRange): number | null {
  switch (range) {
    case '7D':
      return 7;
    case '30D':
      return 30;
    case '90D':
      return 90;
    case 'ALL':
      return null;
    default:
      return 30;
  }
}

export interface DateRangeOption {
  id: DateRange;
  label: string;
}

export const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { id: '7D', label: '7D' },
  { id: '30D', label: '30D' },
  { id: '90D', label: '90D' },
  { id: 'ALL', label: 'All' },
];

