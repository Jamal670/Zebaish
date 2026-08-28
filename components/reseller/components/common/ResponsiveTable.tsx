import React from 'react';
import { FileQuestion } from 'lucide-react';

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  hideOnMobileLabel?: boolean;
}

export interface ResponsiveTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyIcon?: React.ReactNode;
  mobileCardHeader?: (item: T, index: number) => React.ReactNode;
  mobileCardFooter?: (item: T, index: number) => React.ReactNode;
  forceTableMode?: boolean;
}

export function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'No Records Found',
  emptySubtitle = 'There are no items to display right now.',
  emptyIcon,
  mobileCardHeader,
  mobileCardFooter,
  forceTableMode = false,
}: ResponsiveTableProps<T>) {
  if (isLoading) {
    return (
      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-stone-200 rounded w-1/4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-stone-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-8 sm:p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
          {emptyIcon || <FileQuestion className="w-6 h-6" />}
        </div>
        <h4 className="font-bold text-stone-900 text-xs sm:text-sm uppercase tracking-wide">
          {emptyTitle}
        </h4>
        <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
          {emptySubtitle}
        </p>
      </div>
    );
  }

  if (forceTableMode) {
    return (
      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[550px] sm:min-w-0">
            <thead className="bg-stone-900 text-stone-200 font-bold uppercase tracking-wider text-xs sm:text-sm border-b border-stone-800 whitespace-nowrap">
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={`py-3 px-3 sm:py-3.5 sm:px-4 ${col.headerClassName || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.map((row, rowIdx) => (
                <tr key={keyExtractor(row, rowIdx)} className="hover:bg-stone-50/80 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`py-3 px-3 sm:py-3.5 sm:px-4 text-stone-800 ${col.className || ''}`}>
                      {col.cell
                        ? col.cell(row, rowIdx)
                        : col.accessorKey
                          ? (row[col.accessorKey] as React.ReactNode)
                          : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* DESKTOP & TABLET VIEW (sm and up) */}
      <div className="hidden sm:block border border-stone-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead className="bg-stone-100 text-stone-700 font-bold uppercase tracking-wider text-2xs sm:text-xs border-b border-stone-200">
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={`py-3.5 px-4 font-bold text-stone-700 ${col.headerClassName || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.map((row, rowIdx) => (
                <tr key={keyExtractor(row, rowIdx)} className="hover:bg-stone-50/80 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`py-3.5 px-4 text-stone-800 ${col.className || ''}`}>
                      {col.cell
                        ? col.cell(row, rowIdx)
                        : col.accessorKey
                          ? (row[col.accessorKey] as React.ReactNode)
                          : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE STACKED CARDS VIEW (< sm breakpoint) */}
      <div className="sm:hidden space-y-3">
        {data.map((row, rowIdx) => (
          <div
            key={keyExtractor(row, rowIdx)}
            className="bg-white border border-stone-200 rounded-xl p-4 space-y-3 shadow-2xs"
          >
            {/* Custom Header for Mobile Card */}
            {mobileCardHeader && (
              <div className="border-b border-stone-100 pb-2.5">
                {mobileCardHeader(row, rowIdx)}
              </div>
            )}

            {/* Field Label: Value Pairs */}
            <div className="space-y-2 text-xs">
              {columns.map((col, colIdx) => {
                if (col.hideOnMobileLabel) return null;
                const cellContent = col.cell
                  ? col.cell(row, rowIdx)
                  : col.accessorKey
                    ? (row[col.accessorKey] as React.ReactNode)
                    : null;

                return (
                  <div key={colIdx} className="flex justify-between items-start gap-2">
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider shrink-0">
                      {col.header}:
                    </span>
                    <div className="text-right font-medium text-stone-900 overflow-hidden">
                      {cellContent}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Footer for Mobile Card */}
            {mobileCardFooter && (
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                {mobileCardFooter(row, rowIdx)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
