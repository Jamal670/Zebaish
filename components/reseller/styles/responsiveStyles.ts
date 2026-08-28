/**
 * Unified Responsive Typography, Spacing, & Layout System for Seller Dashboard
 */

export const TYPOGRAPHY = {
  // Page Titles (Overview, Payouts, Orders, Settings, etc.)
  pageTitle: 'text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-stone-900',
  
  // Section Headings (Card headers, modal sub-headers)
  sectionTitle: 'text-sm sm:text-base lg:text-lg font-bold uppercase tracking-wide text-stone-900',
  
  // Card Titles & Sub-headings
  cardTitle: 'text-xs sm:text-sm lg:text-base font-bold text-stone-900',
  
  // Body Text & Descriptions
  bodyText: 'text-xs sm:text-sm lg:text-base leading-relaxed text-stone-600',
  
  // Small Labels, Metadata, Captions
  captionText: 'text-2xs sm:text-xs lg:text-sm text-stone-500 font-medium',
  
  // Status Badges & Pills
  badgeText: 'text-2xs sm:text-xs font-bold uppercase tracking-wider',
  
  // Table Column Headers
  tableHeader: 'text-2xs sm:text-xs font-bold uppercase tracking-wider text-stone-700',
  
  // Table Data Cells
  tableCell: 'text-xs sm:text-sm font-medium text-stone-800',
  
  // Button Label Text
  buttonText: 'text-xs sm:text-sm font-bold uppercase tracking-wider',
};

export const LAYOUT = {
  // Main Page Outer Container
  pageContainer: 'p-3 sm:p-5 lg:p-8 max-w-8xl mx-auto space-y-5 sm:space-y-8 animate-fade-in text-stone-800',
  
  // Card Shell Padding & Border
  cardShell: 'bg-white border border-stone-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xs',
  
  // Responsive Grid Gaps
  gridGap: 'gap-3 sm:gap-4 lg:gap-6',
  
  // Responsive Columns
  gridCols4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6',
  gridCols3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6',
  gridCols2: 'grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-6',
  
  // Buttons with comfortable touch targets (min 42px)
  buttonPrimary: 'px-4 sm:px-6 py-2.5 sm:py-3 bg-stone-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider min-h-[42px] transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:bg-stone-400 disabled:cursor-not-allowed',
  buttonSecondary: 'px-4 sm:px-5 py-2.5 sm:py-3 bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 rounded-lg text-xs sm:text-sm font-semibold min-h-[42px] transition-all flex items-center justify-center space-x-2 cursor-pointer',
  buttonAccent: 'px-4 sm:px-6 py-2.5 sm:py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wider min-h-[42px] transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer',
  
  // Inputs & Select Controls
  inputField: 'w-full p-2.5 sm:p-3 text-xs sm:text-sm rounded-lg border border-stone-300 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-all min-h-[42px] bg-white',
  
  // Modal Backdrop & Shell
  modalContainer: 'w-[92vw] sm:w-full max-w-lg bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-stone-200 z-10 flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-hidden focus:outline-none',
};
