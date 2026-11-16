/**
 * Formats a numeric price into Pakistani Rupee standard format:
 * e.g. 4999 -> "Rs. 4,999"
 */
export function formatPrice(n: number): string {
  if (typeof n !== 'number' || isNaN(n)) return 'Rs. 0';
  return `Rs. ${Math.round(n).toLocaleString('en-PK')}`;
}

