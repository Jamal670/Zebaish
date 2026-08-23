import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, RotateCcw, Check, Star } from 'lucide-react';
import { FilterOptions } from '@/types';

export type { FilterOptions };

interface FiltersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onApplyFilters: (newFilters: FilterOptions) => void;
  onClearFilters: () => void;
  totalResultsCount: number;
}

const BRAND_OPTIONS = [
  'Khaadi',
  'Sapphire',
  'Gul Ahmed',
  'Nishat',
  'Maria B',
  'Alkaram',
  'Bareeze',
  'Ethnic',
  'Sana Safinaz',
  'Limelight',
  'Cross Stitch',
  'Others'
];

const STITCHING_OPTIONS = ['Unstitched', 'Stitched', 'Semi-Stitched', 'Ready to Wear'];
const PIECE_COUNT_OPTIONS = ['1-Piece', '2-Piece', '3-Piece'];
const FABRIC_OPTIONS = ['Lawn', 'Cambric', 'Khaddar', 'Cotton', 'Linen', 'Silk', 'Chiffon', 'Georgette', 'Organza', 'Velvet', 'Karandi', 'Jacquard', 'Net', 'Dobby', 'Viscose', 'Rayon', 'Satin', 'Crepe', 'Denim', 'Raw Silk', 'Banarsi',];
const COLOR_OPTIONS = [
  { name: 'Red', hex: '#dc2626' },
  { name: 'Pink', hex: '#f472b6' },
  { name: 'Gold', hex: '#eab308' },
  { name: 'Peacock/Emerald', hex: '#0f766e' },
  { name: 'Blue', hex: '#1d4ed8' },
  { name: 'Black', hex: '#18181b' },
  { name: 'White/Cream', hex: '#fef3c7' },
  { name: 'Purple/Lilac', hex: '#a855f7' },
  { name: 'Yellow', hex: '#facc15' },
];
const OCCASION_OPTIONS = ['Casual', 'Formal', 'Party Wear', 'Bridal', 'Festive/Eid'];
const SIZE_OPTIONS = ['Small', 'Medium', 'Large', 'XL'];
const DISCOUNT_OPTIONS = ['10-30%', '30-50%', '50%+'];

export const FiltersDrawer: React.FC<FiltersDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onClearFilters,
  totalResultsCount,
}) => {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    brand: true,
    stitching: true,
    piece: false,
    fabric: true,
    price: true,
    color: false,
    occasion: false,
    size: false,
    discount: false,
    rating: false,
    stock: true,
  });

  if (!isOpen) return null;

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleArrayFilter = (key: keyof FilterOptions, value: string) => {
    setLocalFilters((prev) => {
      const arr = (prev[key] as string[]) || [];
      const exists = arr.includes(value);
      const updated = exists ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: updated };
    });
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleClear = () => {
    onClearFilters();
    setLocalFilters({
      brands: [],
      stitchingStatuses: [],
      pieceCounts: [],
      fabrics: [],
      colors: [],
      occasions: [],
      sizes: [],
      priceRange: [0, 100000],
      discountRanges: [],
      minResellerRating: 0,
      inStockOnly: false,
      categories: [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white text-stone-900 shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-in-out">
          {/* Header */}
          <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold uppercase tracking-widest text-stone-900">
                FILTER
              </h2>
              {/* <span className="text-xs font-semibold text-stone-600 bg-stone-200 px-2 py-0.5 rounded-full">
                {totalResultsCount} Items
              </span> */}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-stone-500 hover:text-stone-900 rounded-full transition-colors"
              aria-label="Close filters"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Accordions */}
          <div className="flex-1 overflow-y-auto p-5 divide-y divide-stone-200 space-y-2">
            {/* 1. Brand Section */}
            <div className="pt-2 pb-4">
              <button
                onClick={() => toggleSection('brand')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900 py-1"
              >
                <span>Brand ({localFilters.brands?.length || 0})</span>
                {openSections.brand ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.brand && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {BRAND_OPTIONS.map((brand) => {
                    const checked = localFilters.brands?.includes(brand);
                    return (
                      <label
                        key={brand}
                        className="flex items-center space-x-2 text-xs font-medium text-stone-700 cursor-pointer hover:text-stone-900"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleArrayFilter('brands', brand)}
                          className="w-4 h-4 rounded-xs text-black border-stone-300 focus:ring-black accent-black"
                        />
                        <span>{brand}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Stitching Status */}
            {/* <div className="pt-4 pb-4">
              <button
                onClick={() => toggleSection('stitching')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900 py-1"
              >
                <span>Stitching Status</span>
                {openSections.stitching ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.stitching && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {STITCHING_OPTIONS.map((status) => {
                    const selected = localFilters.stitchingStatuses?.includes(status);
                    return (
                      <button
                        key={status}
                        onClick={() => toggleArrayFilter('stitchingStatuses', status)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selected
                            ? 'bg-black text-white border-black font-semibold'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-400'
                          }`}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>
              )}
            </div> */}

            {/* 3. Piece Count
            <div className="pt-4 pb-4">
              <button
                onClick={() => toggleSection('piece')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900 py-1"
              >
                <span>Piece Count</span>
                {openSections.piece ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.piece && (
                <div className="mt-3 flex gap-2">
                  {PIECE_COUNT_OPTIONS.map((count) => {
                    const selected = localFilters.pieceCounts?.includes(count);
                    return (
                      <button
                        key={count}
                        onClick={() => toggleArrayFilter('pieceCounts', count)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selected
                            ? 'bg-black text-white border-black font-semibold'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-400'
                          }`}
                      >
                        {count}
                      </button>
                    );
                  })}
                </div>
              )}
            </div> */}

            {/* 4. Fabric Type */}
            <div className="pt-4 pb-4">
              <button
                onClick={() => toggleSection('fabric')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900 py-1"
              >
                <span>Fabric Type ({localFilters.fabrics?.length || 0})</span>

                {openSections.fabric ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {openSections.fabric && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {FABRIC_OPTIONS.map((fab) => {
                    const checked = localFilters.fabrics?.includes(fab);

                    return (
                      <label
                        key={fab}
                        className="flex items-center space-x-2 text-xs font-medium text-stone-700 cursor-pointer hover:text-stone-900"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleArrayFilter('fabrics', fab)}
                          className="w-4 h-4 rounded-xs text-black border-stone-300 focus:ring-black accent-black"
                        />

                        <span>{fab}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Color Swatches */}
            {/* <div className="pt-4 pb-4">
              <button
                onClick={() => toggleSection('color')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900 py-1"
              >
                <span>Color</span>
                {openSections.color ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.color && (
                <div className="mt-3 grid grid-cols-5 gap-3">
                  {COLOR_OPTIONS.map((color) => {
                    const selected = localFilters.colors?.includes(color.name);
                    return (
                      <button
                        key={color.name}
                        onClick={() => toggleArrayFilter('colors', color.name)}
                        className="flex flex-col items-center space-y-1 group"
                        title={color.name}
                      >
                        <div
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'border-black scale-110 shadow-sm' : 'border-stone-200 group-hover:scale-105'
                            }`}
                          style={{ backgroundColor: color.hex }}
                        >
                          {selected && (
                            <Check
                              className={`w-3.5 h-3.5 ${color.hex === '#fef3c7' || color.hex === '#facc15' ? 'text-stone-900' : 'text-white'
                                }`}
                            />
                          )}
                        </div>
                        <span className="text-[10px] text-stone-500 font-medium truncate max-w-full">
                          {color.name.split('/')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div> */}

            {/* 6. Occasion
            <div className="pt-4 pb-4">
              <button
                onClick={() => toggleSection('occasion')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900 py-1"
              >
                <span>Occasion</span>
                {openSections.occasion ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.occasion && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {OCCASION_OPTIONS.map((occ) => {
                    const selected = localFilters.occasions?.includes(occ);
                    return (
                      <button
                        key={occ}
                        onClick={() => toggleArrayFilter('occasions', occ)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selected
                            ? 'bg-black text-white border-black font-semibold'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-400'
                          }`}
                      >
                        {occ}
                      </button>
                    );
                  })}
                </div>
              )}
            </div> */}

            {/* 7. Price Range */}
            <div className="pt-4 pb-4">
              <button
                onClick={() => toggleSection('price')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900 py-1"
              >
                <span>Price Range (Rs.)</span>
                {openSections.price ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.price && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-600 font-semibold">
                    <span>Rs. {localFilters.priceRange ? localFilters.priceRange[0].toLocaleString() : 0}</span>
                    <span>Rs. {localFilters.priceRange ? localFilters.priceRange[1].toLocaleString() : '100,000'}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100000"
                    step="500"
                    value={localFilters.priceRange ? localFilters.priceRange[1] : 100000}
                    onChange={(e) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        priceRange: [prev.priceRange ? prev.priceRange[0] : 0, parseInt(e.target.value)],
                      }))
                    }
                    className="w-full accent-black cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* 8. Size */}
            <div className="pt-4 pb-4">
              <button
                onClick={() => toggleSection('size')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900 py-1"
              >
                <span>Size</span>

                {openSections.size ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {openSections.size && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((sz) => {
                    const selected = localFilters.sizes?.includes(sz);

                    return (
                      <button
                        key={sz}
                        onClick={() => toggleArrayFilter('sizes', sz)}
                        className={`
              text-xs
              w-15 h-10
              rounded-md
              border
              flex
              items-center
              justify-center
              font-medium
              transition-all
              ${selected
                            ? 'bg-black text-white border-black font-semibold'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-400'
                          }
            `}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 9. Discount %
            <div className="pt-4 pb-4">
              <button
                onClick={() => toggleSection('discount')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900 py-1"
              >
                <span>Discount %</span>
                {openSections.discount ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.discount && (
                <div className="mt-3 flex gap-2">
                  {DISCOUNT_OPTIONS.map((disc) => {
                    const selected = localFilters.discountRanges?.includes(disc);
                    return (
                      <button
                        key={disc}
                        onClick={() => toggleArrayFilter('discountRanges', disc)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selected
                            ? 'bg-red-600 text-white border-red-600 font-semibold'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-400'
                          }`}
                      >
                        {disc}
                      </button>
                    );
                  })}
                </div>
              )}
            </div> */}

            {/* 10. Reseller Rating */}
            <div className="pt-4 pb-4">
              <button
                onClick={() => toggleSection('rating')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900 py-1"
              >
                <span>Reseller Rating</span>
                {openSections.rating ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.rating && (
                <div className="mt-3 space-y-2">
                  {[4.5, 4.0, 3.5].map((stars) => {
                    const selected = localFilters.minResellerRating === stars;
                    return (
                      <button
                        key={stars}
                        onClick={() =>
                          setLocalFilters((prev) => ({
                            ...prev,
                            minResellerRating: selected ? 0 : stars,
                          }))
                        }
                        className={`w-full text-xs px-3 py-2 rounded-xs border flex items-center justify-between transition-all ${selected
                          ? 'bg-stone-900 text-white border-black font-semibold'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-300'
                          }`}
                      >
                        <div className="flex items-center space-x-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{stars}★ & above</span>
                        </div>
                        {selected && <Check className="w-4 h-4 text-white" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 11. Availability */}
            {/* <div className="pt-4 pb-6">
              <button
                onClick={() => toggleSection('stock')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-900 py-1"
              >
                <span>Availability</span>
                {openSections.stock ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {openSections.stock && (
                <div className="mt-3">
                  <label className="flex items-center space-x-2 text-xs font-medium text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localFilters.inStockOnly}
                      onChange={(e) =>
                        setLocalFilters((prev) => ({ ...prev, inStockOnly: e.target.checked }))
                      }
                      className="w-4 h-4 rounded-xs text-black border-stone-300 focus:ring-black accent-black"
                    />
                    <span>In Stock Only</span>
                  </label>
                </div>
              )}
            </div>  */}
          </div>

          {/* Footer Actions */}
          <div className="p-5 border-t border-stone-200 bg-stone-50 flex items-center space-x-3">
            <button
              onClick={handleClear}
              className="flex-1 py-3 px-4 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-xs text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
            <button
              onClick={handleApply}
              className="flex-1 py-3 px-4 bg-stone-900 hover:bg-black text-white rounded-xs text-xs font-bold uppercase tracking-wider shadow-md transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
