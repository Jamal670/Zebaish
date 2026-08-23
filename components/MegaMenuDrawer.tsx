import React, { useState } from 'react';
import { X, Plus, Minus, Search, ChevronRight, Sparkles, ShoppingBag } from 'lucide-react';
import { MEGA_MENU_CATEGORIES, TRENDING_PRODUCTS } from '@/data/mockData';
import { Product } from '@/types';

interface MegaMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (categoryName: string) => void;
  onSelectProduct?: (product: Product) => void;
}

export const MegaMenuDrawer: React.FC<MegaMenuDrawerProps> = ({
  isOpen,
  onClose,
  onSelectCategory,
  onSelectProduct,
}) => {
  const [openAccordion, setOpenAccordion] = useState<string | null>('null');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  const handleCategoryClick = (catTitle: string) => {
    onSelectCategory(catTitle);
    onClose();
  };

  const bestSellerProduct = TRENDING_PRODUCTS[1] || TRENDING_PRODUCTS[0];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      {/* Backdrop with Blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 left-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white text-stone-900 shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-in-out border-r border-stone-200">
          {/* Header */}
          <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
            <div className="flex items-center space-x-2">
              <span className="font-script text-3xl font-normal text-stone-900">
                Zebaish
              </span>
              {/* <span className="text-[10px] uppercase bg-stone-900 text-white font-semibold px-2 py-0.5 rounded-xs tracking-wider">
                Menu
              </span> */}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded-full transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Box inside Mega Menu */}
          {/* <div className="p-4 bg-white border-b border-stone-100">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Unstitched, Ready to Wear, Couture..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-stone-100 text-xs font-medium text-stone-900 placeholder-stone-400 rounded-sm focus:outline-none focus:ring-1 focus:ring-stone-900 transition-all"
              />
            </div>
          </div> */}

          {/* Navigation Accordion Sections */}
          <div className="flex-1 overflow-y-auto px-5 py-4 divide-y divide-stone-100">
            {/* Quick Links */}
            <div className="pb-4 mb-2 flex items-center space-x-2 overflow-x-auto no-scrollbar text-xs font-semibold uppercase tracking-wider">
              <button
                onClick={() => handleCategoryClick('NEW ARRIVALS')}
                className="px-3 py-1.5 bg-stone-900 text-white rounded-xs shrink-0 hover:bg-stone-800 transition-colors flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>NEW ARRIVALS</span>
              </button>
              {/* <button
                onClick={() => handleCategoryClick('PROJECT MASTANI')}
                className="px-3 py-1.5 bg-stone-100 text-stone-800 hover:bg-stone-200 rounded-xs shrink-0 transition-colors"
              >
                PROJECT MASTANI
              </button> */}
              <button
                onClick={() => handleCategoryClick('SALE')}
                className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-xs shrink-0 transition-colors"
              >
                SALE
              </button>
            </div>

            {/* Category Accordions */}
            {MEGA_MENU_CATEGORIES.map((cat) => {
              const isExpanded = openAccordion === cat.id;
              return (
                <div key={cat.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleCategoryClick(cat.title)}
                      className="text-sm font-semibold tracking-wider text-stone-900 hover:text-stone-600 transition-colors text-left uppercase"
                    >
                      {cat.title}
                    </button>
                    <button
                      onClick={() => toggleAccordion(cat.id)}
                      className="p-1 text-stone-500 hover:text-stone-900 transition-colors"
                      aria-label={`Toggle ${cat.title}`}
                    >
                      {isExpanded ? (
                        <Minus className="w-4 h-4 text-stone-900" />
                      ) : (
                        <Plus className="w-4 h-4 text-stone-500" />
                      )}
                    </button>
                  </div>

                  {/* Accordion Sub-items */}
                  {isExpanded && (
                    <div className="mt-2 pl-3 border-l-2 border-stone-200 space-y-2 py-1 animate-fade-in">
                      {cat.items.map((subItem) => (
                        <button
                          key={subItem}
                          onClick={() => handleCategoryClick(`${cat.title} - ${subItem}`)}
                          className="flex items-center justify-between w-full text-left text-xs text-stone-600 hover:text-stone-900 hover:font-medium py-1 transition-colors"
                        >
                          <span>{subItem}</span>
                          <ChevronRight className="w-3 h-3 text-stone-400 opacity-0 hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Best Seller Featured Box */}
            {/* {bestSellerProduct && (
              <div className="pt-6 pb-2">
                <div className="text-[10px] font-bold tracking-widest text-stone-400 uppercase mb-3 flex items-center space-x-1">
                  <span>BEST SELLER HIGHLIGHT</span>
                  <div className="h-[1px] flex-1 bg-stone-200" />
                </div>
                <div
                  onClick={() => {
                    if (onSelectProduct) onSelectProduct(bestSellerProduct);
                    onClose();
                  }}
                  className="group bg-stone-50 rounded-sm p-3 border border-stone-200 flex items-center space-x-3 cursor-pointer hover:border-stone-400 transition-colors"
                >
                  <img
                    src={bestSellerProduct.image}
                    alt={bestSellerProduct.title}
                    className="w-16 h-20 object-cover object-top rounded-xs shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-red-600 uppercase bg-red-50 px-1.5 py-0.5 rounded-xs inline-block mb-1">
                      {bestSellerProduct.badge || 'HOT'}
                    </span>
                    <h4 className="text-xs font-semibold text-stone-900 truncate group-hover:text-stone-600">
                      {bestSellerProduct.title}
                    </h4>
                    <p className="text-xs font-bold text-stone-800 mt-1">
                      {bestSellerProduct.currency} {bestSellerProduct.price}
                    </p>
                    <span className="text-[10px] text-stone-500 underline underline-offset-2 mt-1 inline-block">
                      View Details &rarr;
                    </span>
                  </div>
                </div>
              </div>
            )} */}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-stone-900 text-stone-300 text-xs border-t border-stone-800 flex items-center justify-between">
            <span className="tracking-wider">Worldwide Express Shipping</span>
            <span className="text-stone-400 font-mono text-[10px]">Rs. / PKR</span>
          </div>
        </div>
      </div>
    </div>
  );
};
