import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface ScrollableStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconBgColor?: string;
  iconTextColor?: string;
  trend?: string;
  trendPositive?: boolean;
  borderAccent?: string;
  onClick?: () => void;
  loading?: boolean;
  sparkline?: React.ReactNode;
}

export const ScrollableStatCard: React.FC<ScrollableStatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-stone-100',
  iconTextColor = 'text-stone-700',
  trend,
  trendPositive = true,
  borderAccent,
  onClick,
  loading = false,
  sparkline,
}) => {
  if (loading) {
    return (
      <div className="shrink-0 snap-start min-w-[140px] sm:min-w-[180px] lg:min-w-[220px] p-3 sm:p-4 lg:p-5 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-3 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-3 w-16 bg-stone-200 rounded" />
          <div className="h-5 w-5 bg-stone-200 rounded-full" />
        </div>
        <div className="h-6 w-24 bg-stone-300 rounded" />
        <div className="h-3 w-20 bg-stone-200 rounded" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`shrink-0 snap-start min-w-[140px] sm:min-w-[180px] lg:min-w-[220px] bg-white p-3 sm:p-4 lg:p-5 rounded-xl border border-stone-200 shadow-2xs space-y-2 flex flex-col justify-between transition-all ${borderAccent ? `border-l-4 ${borderAccent}` : ''
        } ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.01]' : ''}`}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-stone-400 truncate">
            {title}
          </span>
          <div className={`p-1.5 sm:p-2 ${iconBgColor} ${iconTextColor} rounded-full shrink-0`}>
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>

        <div>
          <div className="text-base sm:text-xl lg:text-2xl font-black text-stone-900 font-mono tracking-tight">
            {value}
          </div>
          {trend && (
            <div
              className={`text-[10px] sm:text-xs font-bold mt-0.5 ${trendPositive ? 'text-emerald-700' : 'text-rose-600'
                }`}
            >
              {trend}
            </div>
          )}
        </div>
      </div>

      {sparkline && <div className="h-8 sm:h-10 w-full pt-1">{sparkline}</div>}

      {
        subtitle && (
          <span className="text-[10px] sm:text-xs font-semibold text-stone-500 block truncate pt-0.5">
            {subtitle}
          </span>
        )
      }
    </div >
  );
};
