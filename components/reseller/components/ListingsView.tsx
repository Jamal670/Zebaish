'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Edit3,
  ShieldAlert,
  Eye,
  Image as ImageIcon,
  Check,
  X,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import supabase from '@/src/api/client';
import useAuth from '@/src/hooks/useAuth';
import useSellerStatus from '@/src/hooks/useSellerStatus';
import { useSellerProductsQuery } from '@/src/hooks/useQueries';
import { ResponsiveTable, ColumnDef } from './common/ResponsiveTable';
import { CollapsibleSearchInput } from './common/CollapsibleSearchInput';
import { ProductInformationModal } from './ProductInformationModal';
import { ConfirmDialog } from './common/ConfirmDialog';
import { useListingDraft } from '../context/ListingDraftContext';
import { deleteProduct, setProductStatus, mapStatusUpdateError } from '@/src/api/productService';
import {
  formatProductPrice,
  formatProductQty,
  getProductStatusConfig,
  StatusBadgeConfig,
} from './common/productDisplayHelpers';

interface ListingsViewProps {
  myListings?: any[];
  toggleDeactivate?: (id: string) => void;
  toggleSoldOut?: (id: string) => void;
  onDeleteListing?: (id: string) => void;
  onEditListing?: (listing: any) => void;
  onRestockListing?: (listing: any) => void;
}

interface RawProductRow {
  id: string;
  title: string | null;
  status: string | null;
  inventory_mode: string | null;
  selling_price: number | null;
  quantity: number | null;
  cached_min_variant_price: number | null;
  cached_max_variant_price: number | null;
  cached_total_variant_quantity: number | null;
  views: number | null;
  created_at: string;
  product_images?: Array<{
    id: string;
    storage_path: string | null;
    image_url: string | null;
    alt_text: string | null;
    is_thumbnail: boolean | null;
  }>;
}

interface DisplayProductRow {
  id: string;
  title: string;
  status: string;
  rawStatus: string | null;
  inventory_mode: string | null;
  isDeactivated: boolean;
  isSoldOut: boolean;
  isArchived: boolean;
  statusConfig: StatusBadgeConfig;
  priceText: string;
  qty: number;
  views: number;
  thumbnailUrl: string | null;
  rawProduct: RawProductRow;
}

type StatusFilterType = 'all' | 'active' | 'inactive' | 'sold_out' | 'draft' | 'archived';

function ProductThumbnail({ url, alt }: { url: string | null; alt: string }) {
  const [hasError, setHasError] = useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [url]);

  if (!url || hasError) {
    return (
      <div
        className="w-8 h-10 sm:w-10 sm:h-12 rounded-xs border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center text-stone-300 shrink-0"
        aria-hidden="true"
      >
        <ImageIcon className="w-4 h-4 text-stone-400" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      onError={() => setHasError(true)}
      className="w-8 h-10 sm:w-10 sm:h-12 object-cover rounded-xs border border-stone-200 bg-stone-100 shrink-0"
    />
  );
}

export const ListingsView: React.FC<ListingsViewProps> = ({
  toggleDeactivate,
  toggleSoldOut,
  onDeleteListing,
  onEditListing,
  onRestockListing,
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { goToEdit } = useListingDraft();
  const { user } = useAuth();
  const sellerId = user?.id;

  const {
    isRestricted,
    messages: restrictionMessages,
    badgeText,
    formattedRestrictedUntil,
  } = useSellerStatus();

  // Modal & Dialog state
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Search & Filter state
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // TanStack Query v5: Replaces previous useEffect
  // Key: ['seller-products', sellerId], staleTime: 5 min, gcTime: 10 min
  const {
    data: products = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useSellerProductsQuery(sellerId);

  const activeItems: DisplayProductRow[] = useMemo(() => {
    return (products as RawProductRow[]).map((p) => {
      // 1. Thumbnail resolution: check embedded product_images[0]
      const thumbRecord =
        Array.isArray(p.product_images) && p.product_images.length > 0 ? p.product_images[0] : null;
      let thumbnailUrl: string | null = null;
      if (thumbRecord?.image_url && thumbRecord.image_url.trim().length > 0) {
        thumbnailUrl = thumbRecord.image_url.trim();
      } else if (thumbRecord?.storage_path && thumbRecord.storage_path.trim().length > 0) {
        const { data } = supabase.storage.from('productImages').getPublicUrl(thumbRecord.storage_path.trim());
        thumbnailUrl = data?.publicUrl || null;
      }

      // 2. Shared status configuration & price/qty helpers
      const statusConfig = getProductStatusConfig(p.status);

      return {
        id: p.id,
        title: p.title || 'Untitled Listing',
        status: statusConfig.label,
        rawStatus: p.status,
        inventory_mode: p.inventory_mode,
        isDeactivated: statusConfig.isDeactivated,
        isSoldOut: statusConfig.isSoldOut,
        isArchived: statusConfig.isArchived,
        statusConfig,
        priceText: formatProductPrice(p),
        qty: formatProductQty(p),
        views: p.views !== undefined && p.views !== null && !isNaN(Number(p.views)) ? Number(p.views) : 0,
        thumbnailUrl,
        rawProduct: p,
      };
    });
  }, [products]);

  // Dynamic counts for status tabs
  const counts = useMemo(() => {
    const c = { all: activeItems.length, active: 0, inactive: 0, sold_out: 0, draft: 0, archived: 0 };
    for (const item of activeItems) {
      const s = (item.rawStatus || '').toLowerCase().trim();
      if (s === 'active') c.active++;
      else if (s === 'inactive') c.inactive++;
      else if (s === 'sold_out') c.sold_out++;

    }
    return c;
  }, [activeItems]);

  const filteredListings = useMemo(() => {
    let items = activeItems;

    // Apply status filter tab
    if (statusFilter !== 'all') {
      items = items.filter((item) => {
        const s = (item.rawStatus || '').toLowerCase().trim();
        return s === statusFilter;
      });
    }

    // Apply text search
    const q = filterText.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q)
    );
  }, [activeItems, statusFilter, filterText]);

  const totalPages = Math.ceil(filteredListings.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedListings = useMemo(() => {
    return filteredListings.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredListings, startIndex, itemsPerPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterText, statusFilter]);

  // Single place that refreshes every cache holding a product's status,
  // so the badge in this table and the query cache always stay in sync.
  const invalidateProductStatusCaches = (productId: string) => {
    queryClient.invalidateQueries({ queryKey: ['seller-products', sellerId] });
    queryClient.invalidateQueries({ queryKey: ['sellerProducts', sellerId] });
    queryClient.invalidateQueries({ queryKey: ['product-information', sellerId, productId] });
    queryClient.invalidateQueries({ queryKey: ['product-edit', sellerId, productId] });
    queryClient.invalidateQueries({ queryKey: ['product', productId] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['storefront'] });
  };

  // Writes the confirmed status into the seller list cache immediately,
  // so the row reflects the change without waiting for the background refetch.
  const applyStatusToSellerProductsCache = (productId: string, status: string) => {
    queryClient.setQueryData<RawProductRow[]>(['seller-products', sellerId], (prev) =>
      Array.isArray(prev) ? prev.map((p) => (p.id === productId ? { ...p, status } : p)) : prev
    );
  };

  // TanStack Mutation for Product Status (Active <-> Inactive)
  // Strictly verifies database returned row before changing state.
  const statusMutation = useMutation({
    mutationFn: async ({ productId, newStatus }: { productId: string; newStatus: 'active' | 'inactive' }) => {
      if (!sellerId) throw new Error('Seller authentication required.');
      return await setProductStatus(productId, sellerId, newStatus);
    },
    onMutate: ({ productId }) => {
      setStatusPendingId(productId);
    },
    onSuccess: (_updatedRow, { productId, newStatus }) => {
      applyStatusToSellerProductsCache(productId, newStatus);
      invalidateProductStatusCaches(productId);

      const actionLabel = newStatus === 'active' ? 'activated' : 'deactivated';
      showToast(`Listing ${actionLabel} successfully.`, 'success');
      if (toggleDeactivate) toggleDeactivate(productId);
    },
    onError: (err: any) => {
      console.error('[statusMutation] Failed to update product status:', err);
      const friendlyMsg = mapStatusUpdateError(err);
      showToast(friendlyMsg, 'error');
    },
    onSettled: () => {
      setStatusPendingId(null);
    },
  });

  const handleToggleSoldOut = async (id: string, currentIsSoldOut?: boolean) => {
    if (!sellerId) return;
    const newStatus = currentIsSoldOut ? 'active' : 'sold_out';
    const { data: updatedRow, error: updateError } = await supabase
      .from('products')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('seller_id', sellerId)
      .select('id, status, updated_at')
      .maybeSingle();

    if (!updateError && updatedRow) {
      applyStatusToSellerProductsCache(id, newStatus);
      invalidateProductStatusCaches(id);
      showToast(`Listing marked as ${newStatus === 'sold_out' ? 'Sold Out' : 'Active'}.`, 'success');
      if (toggleSoldOut) toggleSoldOut(id);
    } else {
      console.error('[handleToggleSoldOut] Error:', updateError);
      const friendlyMsg = mapStatusUpdateError(updateError);
      showToast(friendlyMsg, 'error');
    }
  };

  // Edit navigation targets — identical to the previous inline behaviour.
  const navigateToEdit = (productId: string) => {
    if (onEditListing) {
      onEditListing(productId);
    } else {
      goToEdit(productId);
    }
  };

  /**
   * Edit action: the listing is set to 'active' in the products table before the edit
   * screen opens. No write happens when the listing is already active, and archived
   * listings keep their status. Navigation is aborted whenever the status update fails.
   *
   * Restock is intentionally left untouched: it is offered for sold-out listings, which
   * usually sit at 0 stock and are rejected by the check_active_product_inventory trigger;
   * saving the restock already activates the product.
   */
  const handleEditListingWithActivation = async (row: DisplayProductRow) => {
    const alreadyActive = (row.rawStatus || '').toLowerCase().trim() === 'active';

    // Skip the database write when nothing needs to change.
    if (alreadyActive || row.isArchived) {
      navigateToEdit(row.id);
      return;
    }

    if (!sellerId) {
      showToast('Seller authentication required.', 'error');
      return;
    }

    setStatusPendingId(row.id);
    try {
      await setProductStatus(row.id, sellerId, 'active');
      applyStatusToSellerProductsCache(row.id, 'active');
      invalidateProductStatusCaches(row.id);
      if (toggleDeactivate) toggleDeactivate(row.id);
      navigateToEdit(row.id);
    } catch (err) {
      console.error('[handleEditListingWithActivation] Failed to activate listing:', err);
      showToast(mapStatusUpdateError(err), 'error');
    } finally {
      setStatusPendingId(null);
    }
  };

  // Columns strictly matching Section 4:
  // Details · Image & Title · Price · QTY · Views · Status · Reviews · Action
  const columns: ColumnDef<DisplayProductRow>[] = [
    {
      header: 'Details',
      headerClassName: 'text-center w-12',
      className: 'text-center w-12',
      cell: (row) => (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedProductId(row.id);
            }}
            className="p-1 sm:p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-stone-400"
            title="View product information"
            aria-label="View product information"
          >
            <Eye className="w-4 h-4 text-stone-500 hover:text-stone-900" aria-hidden="true" />
          </button>
        </div>
      ),
    },
    {
      header: 'Image & Title',
      cell: (row) => (
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <ProductThumbnail url={row.thumbnailUrl} alt={row.title} />
          <span
            className="font-bold text-stone-900 truncate text-xs sm:text-sm lg:text-base max-w-[160px] sm:max-w-xs block"
            title={row.title}
          >
            {row.title}
          </span>
        </div>
      ),
    },
    {
      header: 'Price',
      cell: (row) => (
        <span className="font-extrabold text-stone-900 text-xs sm:text-sm lg:text-base whitespace-nowrap">
          {row.priceText}
        </span>
      ),
    },
    {
      header: 'QTY',
      cell: (row) => (
        <span className="bg-stone-100 border border-stone-200 px-2 py-1 text-xs sm:text-sm rounded-xs font-semibold whitespace-nowrap">
          {row.qty}
        </span>
      ),
    },
    {
      header: 'Views',
      cell: (row) => (
        <span className="font-extrabold text-stone-900 text-xs sm:text-sm lg:text-base whitespace-nowrap">
          {row.views}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <span className={row.statusConfig.badgeClassName}>
          {row.statusConfig.label}
        </span>
      ),
    },
    {
      header: 'Reviews',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (item) => (
        <button
          type="button"
          onClick={() => router.push(`/dashboard/reviews?productId=${item.id}`)}
          className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-stone-900 hover:bg-black text-white text-[9px] sm:text-xs lg:text-xs font-bold uppercase rounded-md transition-colors shadow-2xs min-h-[28px] sm:min-h-[32px] cursor-pointer"
          title="View product customer reviews"
        >
          View
        </button>
      ),
    },
    {
      header: 'Action',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (item) => {
        if (isRestricted) {
          return (
            <div className="flex items-center justify-center">
              <span
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-[8px] sm:text-[10px] lg:text-[10px] font-bold rounded-full bg-red-50 text-red-700 border border-red-200"
                title={restrictionMessages.join(' | ') || 'Account is restricted. Product actions are disabled.'}
              >
                <ShieldAlert className="w-3 h-3 text-red-600 shrink-0" />
                <span>Restricted ({badgeText})</span>
              </span>
            </div>
          );
        }

        const isRowPending = statusPendingId === item.id;
        const isArchived = item.isArchived;

        return (
          <div className="flex flex-nowrap items-center justify-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap">
            {/* Active / Inactive Toggle (Hidden for Archived products) */}
            {!isArchived && !item.isSoldOut && (
              <button
                type="button"
                disabled={isRowPending}
                onClick={() => {
                  const newStatus = item.isDeactivated ? 'active' : 'inactive';
                  statusMutation.mutate({ productId: item.id, newStatus });
                }}
                className={`px-2 py-1 sm:px-2.5 sm:py-1.5 text-[9px] sm:text-xs lg:text-xs font-bold uppercase rounded-xs border transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                  item.isDeactivated
                    ? 'bg-green-100 hover:bg-green-200 text-green-800 border-green-200'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                }`}
                title={item.isDeactivated ? 'Activate listing' : 'Deactivate listing'}
              >
                {isRowPending && <RefreshCw className="w-3 h-3 animate-spin shrink-0" aria-hidden="true" />}
                <span>{item.isDeactivated ? 'Active' : 'Inactive'}</span>
              </button>
            )}

            {/* Restock / Sold Out Toggle (Hidden for Archived or Inactive products) */}
            {!isArchived && !item.isDeactivated && (
              <button
                type="button"
                onClick={() => {
                  if (item.isSoldOut) {
                    if (onRestockListing) {
                      onRestockListing(item.id);
                    } else {
                      router.push(`/dashboard/add-collection?id=${item.id}&mode=restock`);
                    }
                  } else {
                    handleToggleSoldOut(item.id, item.isSoldOut);
                  }
                }}
                className={`px-2 py-1 sm:px-2.5 sm:py-1.5 text-[9px] sm:text-xs lg:text-xs font-bold uppercase rounded-xs border transition-colors cursor-pointer shrink-0 flex items-center justify-center ${
                  item.isSoldOut
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                {item.isSoldOut ? 'Restock' : 'Sold Out'}
              </button>
            )}

            {/* Edit Button (sets the listing to 'active' before opening the edit screen) */}
            <button
              type="button"
              disabled={isRowPending}
              onClick={() => {
                void handleEditListingWithActivation(item);
              }}
              className="p-1.5 sm:p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              title="Edit Collection Details & Photos"
              aria-label="Edit Collection Details"
            >
              <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-600" />
            </button>

            {/* Delete Button (Triggers Reusable ConfirmDialog) */}
            <button
              type="button"
              onClick={() => setPendingDelete({ id: item.id, title: item.title })}
              className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              title="Delete Listing"
              aria-label="Delete Listing"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-800" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden p-4 sm:p-6 space-y-4">
      {/* Header Bar */}
      <div className="pb-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base sm:text-xl lg:text-2xl font-bold uppercase tracking-wider text-stone-900 flex items-center space-x-2 truncate">
            <span className="truncate">My Inventory ({filteredListings.length})</span>
            {(isLoading || isFetching) && <RefreshCw className="w-4 h-4 animate-spin text-stone-500 shrink-0" />}
          </h3>
        </div>

        {/* Controls Container: Search + Refresh */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <CollapsibleSearchInput
            value={filterText}
            onChange={setFilterText}
            placeholder="Search by title or status..."
          />
          <button
            type="button"
            onClick={() => refetch()}
            className="hidden sm:inline-flex items-center justify-center p-2.5 sm:px-3.5 sm:py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-sm font-semibold rounded-lg border border-stone-300 transition-colors cursor-pointer min-h-[36px] sm:min-h-[40px] shrink-0"
            title="Refresh Listings"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading || isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Filter Tabs with Dynamic Counts */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
        {[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'active', label: 'Active', count: counts.active },
          { key: 'inactive', label: 'Inactive', count: counts.inactive },
          { key: 'sold_out', label: 'Sold out', count: counts.sold_out },

        ].map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key as StatusFilterType)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                isActive
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-stone-700 text-white' : 'bg-stone-200 text-stone-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {isRestricted && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-2 font-medium">
          <div className="flex items-center space-x-2 font-bold text-red-900 text-xs sm:text-sm">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
            <span>Account Access Restricted ({badgeText}):</span>
          </div>
          <div className="space-y-1.5 pl-6">
            {restrictionMessages.map((msg, index) => (
              <div key={index} className="flex items-start space-x-2 leading-relaxed">
                {restrictionMessages.length > 1 && <span className="font-bold shrink-0">•</span>}
                <span>{msg}</span>
              </div>
            ))}
            {formattedRestrictedUntil && (
              <span className="block text-[11px] font-semibold text-red-900 mt-1">
                Restriction active until: {formattedRestrictedUntil}
              </span>
            )}
          </div>
        </div>
      )}

      {isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error?.message || 'Failed to load collection listings. Please try again.'}</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded text-xs transition-colors cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <ResponsiveTable
        columns={columns}
        data={paginatedListings}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyTitle={isError ? 'Unable to display listings' : 'No Collections Found'}
        emptySubtitle={
          isError
            ? 'A network or database error occurred. Click Retry above to reload.'
            : statusFilter !== 'all'
            ? `You have no products with status "${statusFilter}".`
            : "You haven't added any suit collections yet. Click 'Add New Collection' to list your first collection!"
        }
        forceTableMode
      />

      {/* Pagination Footer */}
      {filteredListings.length > 0 && (
        <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-stone-600">
          <div></div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 border border-stone-300 rounded-md bg-white text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer min-h-[36px]"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs sm:text-sm font-bold text-stone-800 px-2">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 border border-stone-300 rounded-md bg-white text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer min-h-[36px]"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Product Information Modal: Opens only when selectedProductId is set */}
      {selectedProductId && (
        <ProductInformationModal
          productId={selectedProductId}
          sellerId={sellerId}
          onClose={() => setSelectedProductId(null)}
          onEdit={onEditListing}
        />
      )}

      {/* Reusable ConfirmDialog for Safe Product Deletion */}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        variant="danger"
        title="Delete product?"
        description={
          <div className="space-y-2">
            <p>
              Are you sure you want to delete{' '}
              <span className="font-bold text-stone-900">
                "{pendingDelete?.title || 'this product'}"
              </span>
              ?
            </p>
            <p className="text-xs text-stone-500">
              This action cannot be undone. All variants, images, attributes, and inventory records will be permanently removed.
            </p>
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete || !sellerId) {
            throw new Error('You must be signed in as a seller to delete a listing.');
          }

          try {
            await deleteProduct(pendingDelete.id);

            // Invalidate seller products list and remove cached details for the deleted product
            queryClient.invalidateQueries({ queryKey: ['seller-products', sellerId] });
            queryClient.invalidateQueries({ queryKey: ['sellerProducts', sellerId] });
            queryClient.removeQueries({ queryKey: ['product-information', sellerId, pendingDelete.id] });
            queryClient.removeQueries({ queryKey: ['product-edit', sellerId, pendingDelete.id] });
            queryClient.removeQueries({ queryKey: ['product', pendingDelete.id] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['storefront'] });

            if (onDeleteListing) onDeleteListing(pendingDelete.id);
            showToast('Product deleted successfully.', 'success');
          } catch (err: any) {
            // Re-throw so ConfirmDialog displays the error inline
            throw err;
          }
        }}
      />

      {/* Toast Notification Container */}
      {toastMessage && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 border animate-in slide-in-from-bottom duration-200 ${
            toastType === 'error' ? 'bg-red-900 border-red-800' : 'bg-stone-900 border-stone-800'
          }`}
        >
          <div
            className={`p-1 rounded-full ${
              toastType === 'error' ? 'bg-red-700 text-red-100' : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {toastType === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          </div>
          <span className="leading-snug">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-stone-400 hover:text-white cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ListingsView;
