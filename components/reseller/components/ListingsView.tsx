import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Edit3, Package, ShieldAlert } from 'lucide-react';
import { Product } from '@/types';
import supabase from '@/src/api/client';
import useAuth from '@/src/hooks/useAuth';
import useSellerStatus from '@/src/hooks/useSellerStatus';
import { ResponsiveTable, ColumnDef } from './common/ResponsiveTable';
import { CollapsibleSearchInput } from './common/CollapsibleSearchInput';

interface ListingsViewProps {
  myListings?: (Product & { isDeactivated?: boolean; isSoldOut?: boolean })[];
  toggleDeactivate?: (id: string) => void;
  toggleSoldOut?: (id: string) => void;
  onDeleteListing?: (id: string) => void;
  onEditListing?: (listing: any) => void;
  onRestockListing?: (listing: any) => void;
}

export const ListingsView: React.FC<ListingsViewProps> = ({
  toggleDeactivate,
  toggleSoldOut,
  onDeleteListing,
  onEditListing,
  onRestockListing,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const {
    status: sellerStatus,
    isRestricted,
    messages: restrictionMessages,
    badgeText,
    formattedRestrictedUntil,
  } = useSellerStatus();
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Fetch product listings from Supabase for the authenticated seller
  const fetchProducts = async () => {
    if (!user?.id) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images (*),
          product_variants (*)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching Supabase products:', error.message);
        setErrorMessage('Failed to load collection listings. Please try again.');
      } else if (data) {
        setDbProducts(data);
      }
    } catch (err: any) {
      console.error('Unexpected error fetching products:', err);
      setErrorMessage('Network error while loading collections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user?.id]);

  const activeItems = dbProducts.map((p) => {
    const thumb =
      p.product_images?.find((img: any) => img.is_thumbnail)?.image_url ||
      p.product_images?.[0]?.image_url ||
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80';

    const variants = p.product_variants || [];
    const totalVariantStock = variants.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 0), 0);

    return {
      id: p.id,
      title: p.suit_title || p.title || 'Untitled Suit',
      brand: p.brand || 'Unbranded',
      fabric: p.fabric || 'Fabric N/A',
      category: p.category || 'Unstitched',
      subcategory: p.subcategory || '',
      stitchingStatus: p.category || 'Unstitched',
      pieceCount: p.piece_count || 1,
      quantity: totalVariantStock,
      originalPrice: p.original_retail_price || p.originalPrice || 0,
      price: p.surplus_selling_price || p.price || 0,
      status: p.status,
      isDeactivated: p.status === 'Inactive',
      isSoldOut: p.status === 'Sold Out',
      image: thumb,
      rawProduct: p,
    };
  });

  const filteredListings = activeItems.filter(
    (item) =>
      item.title?.toLowerCase().includes(filterText.toLowerCase()) ||
      item.brand?.toLowerCase().includes(filterText.toLowerCase())
  );

  const totalPages = Math.ceil(filteredListings.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedListings = filteredListings.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterText]);

  const handleToggleDeactivate = async (id: string, currentIsDeactivated?: boolean) => {
    if (!user?.id) return;
    const newStatus = currentIsDeactivated ? 'Active' : 'Inactive';
    const { error } = await supabase
      .from('products')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('seller_id', user.id);

    if (!error) {
      setDbProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
      );
    } else {
      alert(`Could not update listing status: ${error.message}`);
    }
    if (toggleDeactivate) toggleDeactivate(id);
  };

  const handleToggleSoldOut = async (id: string, currentIsSoldOut?: boolean) => {
    if (!user?.id) return;
    const newStatus = currentIsSoldOut ? 'Active' : 'Sold Out';
    const { error } = await supabase
      .from('products')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('seller_id', user.id);

    if (!error) {
      setDbProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
      );
    } else {
      alert(`Could not update listing status: ${error.message}`);
    }
    if (toggleSoldOut) toggleSoldOut(id);
  };

  const handleDeleteListing = async (id: string) => {
    if (!user?.id) return;
    if (!confirm('Are you sure you want to delete this collection listing?')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('seller_id', user.id);

    if (!error) {
      setDbProducts((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert(`Failed to delete listing: ${error.message}`);
    }
    if (onDeleteListing) onDeleteListing(id);
  };

  const columns: ColumnDef<typeof activeItems[0]>[] = [
    {
      header: 'Suit Image & Title',
      cell: (row) => (
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <img
            src={row.image}
            alt={row.title}
            className="w-8 h-10 sm:w-10 sm:h-12 object-cover rounded-xs border border-stone-200 bg-stone-100 shrink-0"
          />
          <span className="font-bold text-stone-900 line-clamp-1 text-xs sm:text-sm lg:text-base">{row.title}</span>
        </div>
      ),
    },
    {
      header: 'Brand',
      cell: (row) => <span className="font-bold text-stone-700 text-xs sm:text-sm lg:text-base">{row.brand}</span>,
    },
    {
      header: 'Category',
      cell: (row) => (
        <div className="text-xs sm:text-sm lg:text-base text-stone-600">
          <span className="font-semibold block">{row.category}</span>
          <span className="text-[10px] sm:text-xs text-stone-400 block">{row.subcategory || row.fabric}</span>
        </div>
      ),
    },
    {
      header: 'Stock Qty',
      cell: (row) => (
        <span className="bg-stone-100 border border-stone-200 px-2 py-1 text-xs sm:text-sm rounded-xs font-semibold whitespace-nowrap">
          {row.quantity} {row.quantity === 1 ? 'pc' : 'pcs'}
        </span>
      ),
    },
    {
      header: 'Discounted Price',
      cell: (row) => <span className="text-stone-400 line-through text-[10px] sm:text-xs lg:text-sm whitespace-nowrap">RS. {Number(row.price).toLocaleString()}</span>,
    },
    {
      header: 'Retail Price',
      cell: (row) => <span className="font-extrabold text-stone-900 text-xs sm:text-sm lg:text-base whitespace-nowrap">RS. {Number(row.originalPrice).toLocaleString()}</span>,
    },
    {
      header: 'Status',
      cell: (row) =>
        row.isDeactivated ? (
          <span className="bg-stone-200 text-stone-700 font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-full whitespace-nowrap">
            Inactive
          </span>
        ) : row.isSoldOut ? (
          <span className="bg-red-100 text-red-800 font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-full uppercase whitespace-nowrap">
            Sold Out
          </span>
        ) : (
          <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-full whitespace-nowrap">
            Active
          </span>
        ),
    },
    {
      header: 'Reviews',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (item) => (
        <button
          onClick={() => router.push(`/dashboard/reviews?productId=${item.id}`)}
          className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-stone-900 hover:bg-black text-white text-[9px] sm:text-xs lg:text-xs font-bold uppercase rounded-md transition-colors shadow-2xs min-h-[28px] sm:min-h-[32px]"
          title="View product customer reviews"
        >
          View
        </button>
      ),
    },
    {
      header: 'Actions',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (item) => {
        if (isRestricted) {
          return (
            <div className="flex items-center justify-center">
              <span
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-[8px] sm:text-[10px] lg:text-[10px] font-bold rounded-full bg-red-50 text-red-700 border border-red-200"
                title={restrictionMessages.join(' | ') || `Account is restricted. Product actions are disabled.`}
              >
                <ShieldAlert className="w-3 h-3 text-red-600 shrink-0" />
                <span>Restricted ({badgeText})</span>
              </span>
            </div>
          );
        }

        return (
          <div className="flex flex-nowrap items-center justify-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap">
            {!item.isSoldOut && (
              <button
                onClick={() => handleToggleDeactivate(item.id, item.isDeactivated)}
                className={`px-2 py-1 sm:px-2.5 sm:py-1.5 text-[9px] sm:text-xs lg:text-xs font-bold uppercase rounded-xs border transition-colors cursor-pointer shrink-0 flex items-center justify-center ${item.isDeactivated
                  ? 'bg-green-100 hover:bg-green-200 text-green-800 border-green-200'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                  }`}
              >
                {item.isDeactivated ? 'Active' : 'Inactive'}
              </button>
            )}

            {!item.isDeactivated && (
              <button
                onClick={() => {
                  if (item.isSoldOut && onRestockListing) {
                    onRestockListing(item.rawProduct || item);
                  } else {
                    handleToggleSoldOut(item.id, item.isSoldOut);
                  }
                }}
                className={`px-2 py-1 sm:px-2.5 sm:py-1.5 text-[9px] sm:text-xs lg:text-xs font-bold uppercase rounded-xs border transition-colors cursor-pointer shrink-0 flex items-center justify-center ${item.isSoldOut
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                  }`}
              >
                {item.isSoldOut ? 'Restock' : 'Sold Out'}
              </button>
            )}

            <button
              onClick={() => onEditListing && onEditListing(item.rawProduct || item)}
              className="p-1.5 sm:p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              title="Edit Collection Details & Photos"
              aria-label="Edit Collection Details"
            >
              <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-600" />
            </button>

            <button
              onClick={() => handleDeleteListing(item.id)}
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
      <div className="pb-4 border-b border-stone-200 flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base sm:text-xl lg:text-2xl font-bold uppercase tracking-wider text-stone-900 flex items-center space-x-2 truncate">
            <span className="truncate">My Inventory ({filteredListings.length})</span>
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-stone-500 shrink-0" />}
          </h3>
        </div>

        {/* Controls Container: Search + Refresh always in one row */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <CollapsibleSearchInput
            value={filterText}
            onChange={setFilterText}
            placeholder="Search by brand or title..."
          />
          <button
            onClick={fetchProducts}
            className="hidden sm:inline-flex items-center justify-center p-2.5 sm:px-3.5 sm:py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-sm font-semibold rounded-lg border border-stone-300 transition-colors cursor-pointer min-h-[36px] sm:min-h-[40px] shrink-0"
            title="Refresh Listings"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
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

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Table */}
      <ResponsiveTable
        columns={columns}
        data={paginatedListings}
        keyExtractor={(r) => r.id}
        isLoading={loading}
        emptyTitle="No Collections Found"
        emptySubtitle="You haven't added any suit collections yet. Click 'Add New Collection' to list your first collection!"
        forceTableMode
      />

      {/* Pagination Footer */}
      {filteredListings.length > 0 && (
        <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-stone-600">
          {/* <div>
            Showing <span className="font-bold text-stone-900">{startIndex + 1}</span> to{' '}
            <span className="font-bold text-stone-900">
              {Math.min(startIndex + itemsPerPage, filteredListings.length)}
            </span>{' '}
            of <span className="font-bold text-stone-900">{filteredListings.length}</span> listings
          </div> */}
          <div></div>

          <div className="flex items-center space-x-2">
            <button
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
    </div>
  );
};

export default ListingsView;

