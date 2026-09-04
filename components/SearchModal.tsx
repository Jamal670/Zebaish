import React, { useState } from 'react';
import { TRENDING_PRODUCTS, COUTURE_PRODUCTS } from '@/data/mockData';
import { Product } from '@/types';
import { Search, X, ShoppingBag } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const allProducts = [...TRENDING_PRODUCTS, ...COUTURE_PRODUCTS];
  const results = query.trim()
    ? allProducts.filter((p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase()) ||
        (p.fabric && p.fabric.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-white shadow-2xl rounded-md overflow-hidden z-10 text-stone-900 border border-stone-200">
        {/* Search Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center space-x-3 bg-stone-50">
          <Search className="w-5 h-5 text-stone-500" />
          <input
            type="text"
            autoFocus
            placeholder="Search products, fabrics, or collections..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-[11px] sm:text-xs lg:text-sm text-stone-900 focus:outline-none placeholder:text-stone-400"
          />
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results / Suggestions */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {query.trim() === '' ? (
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
                Popular Searches
              </p>
              <div className="flex flex-wrap gap-2">
                {['Embroidered Lawn', 'Raw Silk', 'Pret Tunic', 'Couture Gown', 'Unstitched 3-Piece'].map(
                  (term) => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] sm:text-xs rounded-full transition-colors"
                    >
                      {term}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : results.length === 0 ? (
            <p className="text-center py-8 text-[10px] sm:text-xs text-stone-500">
              No products found matching "{query}".
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((product) => (
                <div
                  key={product.id}
                  onClick={() => {
                    onSelectProduct(product);
                    onClose();
                  }}
                  className="flex space-x-3 p-2 hover:bg-stone-50 rounded-md cursor-pointer transition-colors border border-stone-100"
                >
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-16 h-20 object-cover object-top rounded-md bg-stone-100 shrink-0"
                  />
                  <div className="flex flex-col justify-center">
                    <span className="text-2xs uppercase text-stone-400 font-medium">
                      {product.category}
                    </span>
                    <h4 className="text-xs font-medium text-stone-800 line-clamp-1">
                      {product.title}
                    </h4>
                    <p className="text-xs font-semibold text-stone-900 mt-1">
                      {product.currency} {product.price}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
