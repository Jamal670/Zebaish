'use client';

import React, { useState, useId } from 'react';
import { ProductOption } from '@/lib/product/types';

export interface VariationDropdownsProps {
  options?: ProductOption[];
  onSelectionChange?: (
    selected: Record<string, string>,
    changedOptionId?: string,
    changedValueId?: string
  ) => void;
  unselectedOptionIds?: string[];
  inlineError?: string | null;
  isLoading?: boolean;
}

/**
 * Dedicated client component for product variation dropdowns.
 * Isolated state prevents unnecessary re-renders of parent/gallery.
 */
export function VariationDropdowns({
  options,
  onSelectionChange,
  unselectedOptionIds = [],
  inlineError,
  isLoading = false,
}: VariationDropdownsProps) {
  const baseId = useId();
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div className="space-y-3 mb-4 w-full">
        <div className="h-10 w-full bg-stone-200 animate-pulse rounded-xs" />
        <div className="h-10 w-full bg-stone-200 animate-pulse rounded-xs" />
      </div>
    );
  }

  if (!options || options.length === 0) {
    return null;
  }

  const handleChange = (optionId: string, valueId: string) => {
    const updated = {
      ...selectedMap,
      [optionId]: valueId,
    };
    setSelectedMap(updated);
    onSelectionChange?.(updated, optionId, valueId);
  };

  return (
    <div className="space-y-3 mb-4 w-full">
      {options.map((option) => {
        const selectId = `${baseId}-opt-${option.id}`;
        const isInvalid = unselectedOptionIds.includes(option.id);
        const currentValue = selectedMap[option.id] || '';

        const sortedValues = [...(option.product_option_values || [])].sort(
          (a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0)
        );

        return (
          <div key={option.id} className="w-full">
            <label
              htmlFor={selectId}
              className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
            >
              {option.name}
            </label>

            <div className="relative">
              <select
                id={selectId}
                value={currentValue}
                aria-invalid={isInvalid}
                onChange={(e) => handleChange(option.id, e.target.value)}
                className={`w-full px-3 py-2.5 bg-white border rounded-xs text-xs sm:text-sm font-medium text-stone-900 transition-colors cursor-pointer appearance-none focus:outline-none focus:ring-1 ${
                  isInvalid
                    ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-600 focus:ring-rose-600'
                    : 'border-stone-300 hover:border-stone-400 focus:border-stone-900 focus:ring-stone-900'
                }`}
              >
                <option value="" disabled>
                  Select {option.name}
                </option>
                {sortedValues.map((val) => (
                  <option key={val.id} value={val.id}>
                    {val.value}
                  </option>
                ))}
              </select>

              {/* Native Select Arrow Indicator */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-stone-500">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        );
      })}

      {inlineError && (
        <p className="text-xs text-rose-600 font-semibold animate-fade-in" role="alert">
          {inlineError}
        </p>
      )}
    </div>
  );
}
