'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, AlertCircle, RefreshCw, Edit3 } from 'lucide-react';
import { useProductInformationQuery } from '@/src/hooks/useQueries';
import { toProductInformation } from './common/productDisplayHelpers';
import { useListingDraft } from '../context/ListingDraftContext';

interface ProductInformationModalProps {
  productId: string | null;
  sellerId?: string;
  onClose: () => void;
  onEdit?: (productId: string) => void;
}

export const ProductInformationModal: React.FC<ProductInformationModalProps> = ({
  productId,
  sellerId,
  onClose,
  onEdit,
}) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // TanStack Query v5: Details query runs only on click (enabled: !!productId && !!sellerId)
  const {
    data: rawData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useProductInformationQuery(productId, sellerId);

  // Pure mapper converts raw product details into clean UI-ready format with proper sorting and formatting
  const mappedInfo = useMemo(() => {
    return rawData ? toProductInformation(rawData) : null;
  }, [rawData]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Save previous active element on open to restore focus on close, and lock body scroll
  useEffect(() => {
    if (!productId) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the modal container or the first focusable element
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [productId]);

  // Keyboard navigation: Escape to close and Tab focus trap
  useEffect(() => {
    if (!productId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [productId, onClose]);

  const { goToEdit } = useListingDraft();

  if (!mounted || !productId) return null;

  // Edit action connects to the shared goToEdit helper
  const handleEditClick = () => {
    onClose();
    if (onEdit) {
      onEdit(productId);
    } else {
      goToEdit(productId);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-info-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-2xl bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden focus:outline-hidden"
      >
        {/* Fixed Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-stone-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <h2
              id="product-info-modal-title"
              className="text-sm sm:text-base md:text-lg font-bold uppercase tracking-wider text-stone-900 truncate"
            >
              Product Information
            </h2>
            {isFetching && !isLoading && (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-400 shrink-0" aria-label="Refreshing data" />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer shrink-0"
            aria-label="Close product information modal"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto min-w-0 p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* 1. Loading Skeleton State (uses isLoading so background refresh does not blank content) */}
          {isLoading && (
            <div className="space-y-4 animate-pulse" aria-busy="true" aria-live="polite">
              {/* Detail skeleton */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-3">
                <div className="h-5 bg-stone-200 rounded w-1/3"></div>
                <div className="h-4 bg-stone-200 rounded w-2/3"></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="h-12 bg-stone-200 rounded"></div>
                  <div className="h-12 bg-stone-200 rounded"></div>
                  <div className="h-12 bg-stone-200 rounded"></div>
                  <div className="h-12 bg-stone-200 rounded"></div>
                </div>
              </div>

              {/* Variations skeleton */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2.5">
                <div className="h-5 bg-stone-200 rounded w-1/4"></div>
                <div className="h-8 bg-stone-200 rounded w-full"></div>
                <div className="h-8 bg-stone-200 rounded w-full"></div>
              </div>

              {/* Defect & Description skeleton */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-3">
                <div className="h-5 bg-stone-200 rounded w-1/3"></div>
                <div className="h-12 bg-stone-200 rounded"></div>
                <div className="h-12 bg-stone-200 rounded"></div>
              </div>
            </div>
          )}

          {/* 2. Error State */}
          {!isLoading && isError && (
            <div className="p-4 sm:p-5 bg-red-50 border border-red-200 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm font-bold text-red-900">Failed to load product details</p>
                <p className="text-xs text-red-700 mt-1">
                  {error?.message || 'A network error occurred. Please try again.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded-md transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* 3. Empty / Not Found State */}
          {!isLoading && !isError && !mappedInfo && (
            <div className="p-8 text-center bg-stone-50 rounded-xl border border-stone-200 space-y-2">
              <p className="text-sm font-bold text-stone-800">Product not found</p>
              <p className="text-xs text-stone-500">
                This listing may have been deleted or is not associated with your seller account.
              </p>
            </div>
          )}

          {/* 4. Loaded Content (Three Visually Distinct Sections) */}
          {!isLoading && !isError && mappedInfo && (
            <>
              {/* SECTION 1: DETAIL */}
              <section className="p-4 sm:p-5 rounded-xl border border-stone-200 bg-white shadow-2xs space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                    Listing Title
                  </span>
                  <h3 className="text-sm sm:text-base lg:text-lg font-bold text-stone-900 break-words">
                    {mappedInfo.title}
                  </h3>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="p-2.5 sm:p-3 bg-stone-50 rounded-lg border border-stone-200/80 flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Price</span>
                    <span className="text-xs sm:text-sm font-extrabold text-stone-900 mt-1 break-words">
                      {mappedInfo.priceText}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-stone-50 rounded-lg border border-stone-200/80 flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Quantity</span>
                    <span className="text-xs sm:text-sm font-extrabold text-stone-900 mt-1">
                      {mappedInfo.quantityText}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-stone-50 rounded-lg border border-stone-200/80 flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Status</span>
                    <div className="mt-1">
                      <span className={mappedInfo.statusConfig.badgeClassName}>
                        {mappedInfo.statusConfig.label}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-stone-50 rounded-lg border border-stone-200/80 flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Views</span>
                    <span className="text-xs sm:text-sm font-extrabold text-stone-900 mt-1">
                      {mappedInfo.views}
                    </span>
                  </div>
                </div>

                {/* Combined Attributes: Category attributes first, then Custom attributes */}
                <div className="pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-700 block mb-2.5">
                    Attributes & Specifications
                  </span>
                  {mappedInfo.attributes.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">No additional attributes</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5">
                      {mappedInfo.attributes.map((attr) => (
                        <div
                          key={attr.id}
                          className="p-2 sm:p-2.5 bg-stone-50 rounded-lg border border-stone-100 flex flex-col min-w-0"
                        >
                          <span className="text-[10px] sm:text-[11px] font-semibold text-stone-500 uppercase tracking-wider truncate">
                            {attr.name}
                          </span>
                          <span className="text-xs sm:text-sm font-medium text-stone-900 break-words mt-0.5">
                            {attr.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION 2: VARIATIONS */}
              <section className="p-4 sm:p-5 rounded-xl border border-stone-200 bg-white shadow-2xs space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
                  Variations{mappedInfo.variants.length > 0 ? ` (${mappedInfo.variants.length})` : ''}
                </h4>

                {mappedInfo.variants.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">No variations</p>
                ) : (
                  <div className="overflow-x-auto min-w-0 rounded-lg border border-stone-200">
                    <table className="w-full text-left text-xs border-collapse" aria-label="Product variations">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider text-[10px]">
                          <th scope="col" className="py-2.5 px-3 w-10 text-center">#</th>
                          <th scope="col" className="py-2.5 px-3 min-w-[140px]">Name</th>
                          <th scope="col" className="py-2.5 px-3 text-right">Price</th>
                          <th scope="col" className="py-2.5 px-3 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 bg-white">
                        {mappedInfo.variants.map((v, index) => {
                          const isInactive = !v.is_active;
                          return (
                            <tr
                              key={v.id || index}
                              className={`transition-colors hover:bg-stone-50/70 ${isInactive ? 'text-stone-400 bg-stone-50/40' : 'text-stone-800'}`}
                            >
                              <td className="py-2.5 px-3 text-center tabular-nums text-stone-400 font-medium w-10">
                                {index + 1}
                              </td>
                              <td className="py-2.5 px-3 min-w-[140px] break-words font-medium">
                                <span className={isInactive ? 'text-stone-400' : 'text-stone-900'}>
                                  {v.combination_key}
                                </span>
                                {isInactive && (
                                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-500 border border-stone-200 align-middle">
                                    Inactive
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">
                                {v.priceFormatted}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">
                                {v.quantityFormatted}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* SECTION 3: DEFECT & DESCRIPTION */}
              <section className="p-4 sm:p-5 rounded-xl border border-stone-200 bg-white shadow-2xs space-y-4">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
                  Defect & Description
                </h4>

                {/* Defect */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block">
                    Defect / Condition Details
                  </span>
                  <p className="text-xs sm:text-sm text-stone-800 whitespace-pre-wrap break-words leading-relaxed bg-stone-50 p-2.5 sm:p-3 rounded-lg border border-stone-100">
                    {mappedInfo.defect}
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block">
                    Description
                  </span>
                  <p className="text-xs sm:text-sm text-stone-800 whitespace-pre-wrap break-words leading-relaxed bg-stone-50 p-2.5 sm:p-3 rounded-lg border border-stone-100">
                    {mappedInfo.description}
                  </p>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-stone-200 bg-stone-50/80 backdrop-blur-xs flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleEditClick}
            className="w-full sm:w-auto order-1 sm:order-2 inline-flex items-center justify-center space-x-1.5 px-4 py-2 sm:px-5 sm:py-2.5 bg-stone-900 hover:bg-black text-white text-xs sm:text-sm font-bold uppercase rounded-lg transition-colors shadow-2xs cursor-pointer text-center"
            title="Edit Collection Details & Photos"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto order-2 sm:order-1 px-4 py-2 sm:px-5 sm:py-2.5 bg-white hover:bg-stone-100 text-stone-700 text-xs sm:text-sm font-semibold rounded-lg border border-stone-300 transition-colors cursor-pointer text-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ProductInformationModal;
