/**
 * Project-Wide Responsive Typography System for Zebaish Marketplace
 * Derived from the design reference standard in `ResellerHeader.tsx`:
 * H1: `text-lg sm:text-2xl lg:text-2xl`
 * Body: `text-[9px] sm:text-xs lg:text-sm`
 */

export const TYPOGRAPHY = {
  /** Page titles, hero main headings */
  h1: 'text-lg sm:text-2xl lg:text-2xl font-extrabold uppercase tracking-tight',

  /** Section headings, major card headers */
  h2: 'text-base sm:text-lg lg:text-xl font-bold tracking-tight',

  /** Subsection headers, modal titles, card headers */
  h3: 'text-sm sm:text-base lg:text-lg font-bold tracking-tight',

  /** Secondary headings, item titles in cards/lists */
  h4: 'text-xs sm:text-sm lg:text-base font-bold tracking-normal',

  /** Primary body text, descriptions, paragraph text */
  body: 'text-[9px] sm:text-xs lg:text-sm font-normal leading-relaxed',

  /** Compact body text for cards and tight layout areas */
  bodyCompact: 'text-[11px] sm:text-xs lg:text-sm font-normal leading-relaxed',

  /** Small helper text, captions, timestamps, meta details */
  small: 'text-[9px] sm:text-[10px] lg:text-xs font-medium',

  /** Form labels, input field headers */
  label: 'text-[10px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider',

  /** Buttons, action triggers, CTA text */
  button: 'text-2xs sm:text-xs lg:text-sm font-bold uppercase tracking-wider',

  /** Status badges, category pills, discount tags */
  badge: 'text-[8px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-wider',

  /** Table body cell text */
  tableCell: 'text-[10px] sm:text-xs lg:text-sm font-normal',

  /** Navigation items, links, drawer menu links */
  navItem: 'text-[10px] sm:text-xs lg:text-sm font-medium',
} as const;

export default TYPOGRAPHY;
