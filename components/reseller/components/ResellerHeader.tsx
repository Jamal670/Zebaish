import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CheckCircle2, Plus } from 'lucide-react';
import { useReseller } from '../context/ResellerContext';

export interface PageMeta {
  title: string;
  description: string;
}

export const DASHBOARD_PAGE_META: Record<string, PageMeta> = {
  '/dashboard': {
    title: 'Overview',
    description: "Get a complete snapshot of your store's performance, sales, orders, and customer activity.",
  },
  '/dashboard/overview': {
    title: 'Overview',
    description: "Get a complete snapshot of your store's performance, sales, orders, and customer activity.",
  },
  '/dashboard/add-collection': {
    title: 'Add New Collection',
    description: 'Create and publish a new product collection to showcase your inventory to customers.',
  },
  '/dashboard/collections': {
    title: 'Active Collections',
    description: 'Manage, update, and monitor all of your live product collections from one place.',
  },
  '/dashboard/orders': {
    title: 'Orders & Dispatch',
    description: 'Review incoming orders, update fulfillment status, and manage product dispatch efficiently.',
  },
  '/dashboard/reviews': {
    title: 'Customer Reviews',
    description: 'View customer feedback, monitor ratings, and respond to reviews to improve buyer satisfaction.',
  },
  '/dashboard/analytics': {
    title: 'Sales Analytics',
    description: 'Analyze sales trends, revenue insights, and business performance with detailed reports.',
  },
  '/dashboard/payouts': {
    title: 'Payouts & Wallet',
    description: 'Track your earnings, commission deductions, payment history, and pending payouts.',
  },
  '/dashboard/settings': {
    title: 'Store Settings',
    description: 'Update your store profile, business information, and account preferences.',
  },
};

export const ResellerHeader: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { currentStatus, setCurrentStatus, setEditingListing, setFormMode } = useReseller();

  // Find page meta for active pathname or fallback
  const meta = DASHBOARD_PAGE_META[pathname] || DASHBOARD_PAGE_META['/dashboard/overview'];

  const handleAddNewCollection = () => {
    setEditingListing(null);
    setFormMode('create');
    router.push('/dashboard/add-collection');
  };

  return (
    <header className="pb-5 sm:pb-6 mb-6 sm:mb-8 border-b border-stone-300 space-y-2.5 sm:space-y-3">
      {/* Top Header Row: Title on Left, Action Buttons on Right */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold uppercase tracking-tight text-stone-900 leading-tight">
          {meta.title}
        </h1>

        <div className="flex items-center gap-2 shrink-0">
          {currentStatus === 'Pending Verification' && (
            <button
              className="flex items-center justify-center gap-1.5
               px-2.5 py-1.5
               sm:px-4 sm:py-2.5
               text-2xs sm:text-xs
               whitespace-nowrap
               rounded-xs
               bg-stone-900 hover:bg-black
               text-white font-bold uppercase tracking-wider"
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>ADD NEW COLLECTION</span>
            </button>
          )}

          <button
            onClick={handleAddNewCollection}
            className="flex items-center justify-center gap-1.5
               px-2.5 py-1.5
               sm:px-4 sm:py-2.5
               text-2xs sm:text-xs
               whitespace-nowrap
               rounded-xs
               bg-stone-900 hover:bg-black
               text-white font-bold uppercase tracking-wider"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>ADD NEW COLLECTION</span>
          </button>
        </div>
      </div>

      {/* Description Paragraph Below Top Row */}
      <p className="text-xs md:text-xs lg:text-sm text-stone-600 leading-relaxed max-w-3xl">
        {meta.description}
      </p>
    </header>
  );
};

export default ResellerHeader;

