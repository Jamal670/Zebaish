import React from 'react';
import { SpecRow } from '@/lib/product/types';

// TODO(dynamic): products.description
export const PLACEHOLDER_DESCRIPTION =
  'Crafted with meticulous attention to detail, this premium garment offers exceptional breathability and effortless elegance. Designed for versatile styling across seasons, each piece showcases superior fabric texture and durable tailoring for everyday comfort.';

export interface SpecificationDescriptionProps {
  specs?: ReadonlyArray<SpecRow | { label: string; value: string }>;
  description?: string;
}

/**
 * Specifications table.
 * Shows 1 specification per row (Label | Value).
 * Flexibly grows to available height and is scrollable with the scrollbar visually hidden.
 */
export function SpecificationsTable({
  specs = [],
  className = '',
}: {
  specs?: ReadonlyArray<SpecRow | { label: string; value: string }>;
  className?: string;
  maxHeightClass?: string;
}) {
  if (!specs || specs.length === 0) {
    return null;
  }

  return (
    <div
      className={`border border-stone-200 rounded-lg overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-white shadow-2xs h-auto ${className}`}
    >
      <table className="w-full text-left text-xs border-collapse">
        <tbody className="divide-y divide-stone-200">
          {specs.map((spec, idx) => (
            <tr key={(spec as any).id || spec.label || idx} className="divide-x divide-stone-200 hover:bg-stone-50/50 transition-colors">
              {/* Column 1: Label */}
              <td className="w-1/3 sm:w-[28%] min-w-[85px] p-2 sm:p-2.5 bg-stone-50/80 font-medium text-stone-500 uppercase tracking-wider text-[10px] sm:text-[11px] whitespace-nowrap">
                {spec.label}
              </td>
              {/* Column 2: Value */}
              <td className="p-2 sm:p-2.5 text-stone-900 font-normal break-words text-[11px] sm:text-xs">
                {spec.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Static, server-compatible Specification & Description section for bottom of page.
 */
export function SpecificationDescription({
  specs = [],
  description,
  showSpecs = false,
}: SpecificationDescriptionProps & { showSpecs?: boolean }) {
  const hasSpecs = Boolean(specs && specs.length > 0);
  const displayDescription =
    description && description.trim().length > 0
      ? description.trim()
      : 'No description provided for this product.';

  return (
    <section className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-stone-200">
      <h2 className="font-brand-serif text-[15px] xs:text-base sm:text-xl lg:text-2xl font-normal text-stone-900 uppercase tracking-wide sm:tracking-wider mb-2 sm:mb-2.5">
        Product Description
      </h2>

      {showSpecs && hasSpecs && (
        <div className="mb-4">
          <SpecificationsTable specs={specs} />
        </div>
      )}

      {/* Description Subsection */}
      <div className="pt-1">
        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl whitespace-pre-line">
          {displayDescription}
        </p>
      </div>
    </section>
  );
}
