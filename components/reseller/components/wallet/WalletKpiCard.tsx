import React from 'react';
import { LucideIcon } from 'lucide-react';
import { format$ } from '../../data/mockWalletData';

export type KpiAccentColor = 'amber' | 'blue' | 'green' | 'dark' | 'neutral';

export interface WalletKpiCardProps {
  label: string;
  amount: number;
  icon: LucideIcon;
  subtext?: string;
  accent: KpiAccentColor;
}

export const WalletKpiCard: React.FC<WalletKpiCardProps> = ({
  label,
  amount,
  icon: Icon,
  subtext,
  accent,
}) => {
  const accentStyles: Record<KpiAccentColor, {
    cardBg: string;
    borderColor: string;
    iconBg: string;
    iconColor: string;
    amountColor: string;
    badgeBg?: string;
    badgeText?: string;
  }> = {
    amber: {
      cardBg: 'bg-amber-50/70 hover:bg-amber-50 border-amber-300/80 shadow-amber-500/5',
      borderColor: 'border-amber-300',
      iconBg: 'bg-amber-500 text-stone-950',
      iconColor: 'text-amber-950',
      amountColor: 'text-amber-900',
      badgeBg: 'bg-amber-200 text-amber-900 font-bold',
      badgeText: 'Action Required',
    },
    blue: {
      cardBg: 'bg-blue-50/60 hover:bg-blue-50 border-blue-200 shadow-blue-500/5',
      borderColor: 'border-blue-200',
      iconBg: 'bg-blue-100 text-blue-700',
      iconColor: 'text-blue-700',
      amountColor: 'text-blue-900',
      badgeBg: 'bg-blue-100 text-blue-800',
      badgeText: 'Under Review',
    },
    green: {
      cardBg: 'bg-emerald-50/60 hover:bg-emerald-50 border-emerald-200 shadow-emerald-500/5',
      borderColor: 'border-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-700',
      iconColor: 'text-emerald-700',
      amountColor: 'text-emerald-950',
      badgeBg: 'bg-emerald-100 text-emerald-800',
      badgeText: 'Confirmed',
    },
    dark: {
      cardBg: 'bg-stone-900 hover:bg-stone-850 border-stone-800 text-white shadow-xl',
      borderColor: 'border-stone-800',
      iconBg: 'bg-stone-800 text-amber-400',
      iconColor: 'text-amber-400',
      amountColor: 'text-white',
      badgeBg: 'bg-amber-400/20 text-amber-300 border border-amber-400/30',
      badgeText: 'Lifetime',
    },
    neutral: {
      cardBg: 'bg-white hover:bg-stone-50 border-stone-200 shadow-xs',
      borderColor: 'border-stone-200',
      iconBg: 'bg-stone-100 text-stone-700',
      iconColor: 'text-stone-700',
      amountColor: 'text-stone-900',
    },
  };

  const style = accentStyles[accent] || accentStyles.neutral;

  return (
    <div
      className={`min-w-[200px] sm:min-w-[240px] lg:min-w-[260px] flex-1 p-4 sm:p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between scroll-snap-align-start shrink-0 ${style.cardBg}`}
    >
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span
            className={`text-2xs sm:text-xs font-semibold uppercase tracking-wider ${accent === 'dark' ? 'text-stone-300' : 'text-stone-600'
              }`}
          >
            {label}
          </span>
          <div className={`p-1.5 sm:p-2 rounded-lg ${style.iconBg} shadow-2xs shrink-0`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="mt-1">
          <div className={`text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight font-mono ${style.amountColor}`}>
            {format$(amount)}
          </div>
        </div>
      </div>

      <div className="mt-3.5 pt-2.5 border-t border-black/5 flex items-center justify-between">
        {subtext ? (
          <span
            className={`text-2xs sm:text-xs font-medium truncate ${accent === 'dark' ? 'text-stone-400' : 'text-stone-500'
              }`}
          >
            {subtext}
          </span>
        ) : (
          <span />
        )}

        {style.badgeText && (
          <span className={`text-2xs uppercase font-bold px-2 py-0.5 rounded-md shrink-0 ml-1 ${style.badgeBg}`}>
            {style.badgeText}
          </span>
        )}
      </div>
    </div>
  );
};
