import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PackagePlus,
  Package,
  ShoppingBag,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  ArrowUpRight,
  Store,
  Star,
  Menu,
  X,
} from 'lucide-react';
import { useReseller } from '../context/ResellerContext';
import { useAuth } from '@/src/hooks/useAuth';
import { fetchSellerPayableAmount } from '@/src/api/sellerWalletService';
import { format$ } from '../data/mockWalletData';

export interface ResellerSidebarProps {
  onLogout: () => void;
  onNavigateHome: () => void;
}

export const ResellerSidebar: React.FC<ResellerSidebarProps> = ({
  onLogout,
  onNavigateHome,
}) => {
  const pathname = usePathname();
  const { storeSettings, setEditingListing, setFormMode } = useReseller();
  const { user, resellerProfile } = useAuth();
  const sellerId = user?.id || resellerProfile?.id || '';

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [payableAmount, setPayableAmount] = useState<number | null>(null);
  const [imgError, setImgError] = useState(false);

  const DEFAULT_STORE_IMAGE =
    'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png';

  const storeImageUrl =
    storeSettings.storeImageUrl ||
    (resellerProfile as any)?.store_image_url ||
    (resellerProfile as any)?.avatar_url ||
    storeSettings.logoUrl ||
    DEFAULT_STORE_IMAGE;

  useEffect(() => {
    setImgError(false);
  }, [storeImageUrl]);

  useEffect(() => {
    let isMounted = true;
    if (sellerId) {
      fetchSellerPayableAmount(sellerId).then((amount) => {
        if (isMounted) {
          setPayableAmount(amount);
        }
      });
    } else {
      setPayableAmount(null);
    }
    return () => {
      isMounted = false;
    };
  }, [sellerId, resellerProfile]);

  // Close drawer when route changes or ESC key is pressed
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileDrawerOpen(false);
      }
    };
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileDrawerOpen]);

  const navItems = [
    {
      label: 'Overview',
      href: '/dashboard/overview',
      icon: LayoutDashboard,
      aliases: ['/dashboard'],
    },
    {
      label: 'Add New Collection',
      href: '/dashboard/add-collection',
      icon: PackagePlus,
      onClick: () => {
        setEditingListing(null);
        setFormMode('create');
      },
    },
    {
      label: 'Active Collections',
      href: '/dashboard/collections',
      icon: Package,
    },
    {
      label: 'Orders & Dispatch',
      href: '/dashboard/orders',
      icon: ShoppingBag,
    },
    {
      label: 'Customer Reviews',
      href: '/dashboard/reviews',
      icon: Star,
    },
    {
      label: 'Sales Analytics',
      href: '/dashboard/analytics',
      icon: BarChart3,
    },
    {
      label: 'Payouts & Wallet',
      href: '/dashboard/payouts',
      icon: Wallet,
    },
    {
      label: 'Store Settings',
      href: '/dashboard/settings',
      icon: Settings,
    },
  ];

  const isNavActive = (item: typeof navItems[0]) => {
    if (pathname === item.href) return true;
    if (item.aliases && item.aliases.includes(pathname)) return true;
    return false;
  };

  const renderNavContent = () => (
    <div className="flex flex-col justify-between h-full bg-stone-900 text-white">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-stone-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-full bg-amber-400 text-stone-950 font-extrabold flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={imgError ? DEFAULT_STORE_IMAGE : (storeImageUrl || DEFAULT_STORE_IMAGE)}
                  alt={storeSettings.storeName || 'Store Logo'}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-amber-400 tracking-widest uppercase block mb-0.5">
                  ZEBAISH SELLER
                </span>
                <div className="flex items-center justify-between gap-2 min-w-0 w-full">
                  <span
                    className="text-[11px] font-bold text-white tracking-wider truncate whitespace-nowrap min-w-0 flex-1"
                    title={storeSettings.storeName}
                  >
                    {storeSettings.storeName}
                  </span>

                  {sellerId ? (
                    <Link
                      href={`/store/${sellerId}`}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 hover:text-amber-300 text-[10px] font-bold rounded border border-amber-400/30 transition-colors shrink-0 whitespace-nowrap cursor-pointer"
                      title="Visit Store"
                    >
                      <span>Visit Store</span>
                      <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
                    </Link>
                  ) : (
                    <button
                      onClick={() => {
                        setIsMobileDrawerOpen(false);
                        onNavigateHome();
                      }}
                      className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 hover:text-amber-300 text-[10px] font-bold rounded border border-amber-400/30 transition-colors shrink-0 whitespace-nowrap cursor-pointer"
                      title="Visit Store"
                    >
                      <span>Visit Store</span>
                      <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Close button for mobile drawer */}
            <button
              onClick={() => setIsMobileDrawerOpen(false)}
              aria-label="Close Sidebar Drawer"
              className="lg:hidden p-1 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {payableAmount !== null && payableAmount > 0 && (
            <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-xs">
              <span className="text-2xs font-bold text-stone-400 uppercase tracking-wider">
                Payable Amount
              </span>
              <span className="font-mono font-bold text-amber-400 text-xs">
                {format$(payableAmount)}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1 text-xs font-semibold">
          {navItems.map((item) => {
            const active = isNavActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  setIsMobileDrawerOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xs transition-colors cursor-pointer ${active
                  ? 'bg-amber-400 text-stone-950 font-bold shadow-2xs'
                  : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-stone-800 space-y-2 text-xs shrink-0">
        <button
          onClick={() => {
            setIsMobileDrawerOpen(false);
            onNavigateHome();
          }}
          className="w-full flex items-center justify-between px-3 py-2 text-stone-400 hover:text-white transition-colors cursor-pointer"
        >
          <span>View Marketplace Home</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setIsMobileDrawerOpen(false);
            onLogout();
          }}
          className="w-full flex items-center space-x-2 px-3 py-2 text-red-400 hover:bg-red-950/40 rounded-xs transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* TABLET & MOBILE TOP NAVIGATION BAR (Visible on screens < lg) */}
      <div className="lg:hidden bg-stone-900 text-white border-b border-stone-800 p-3.5 flex items-center justify-between sticky top-0 z-40 shadow-sm gap-2">
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            aria-label="Open Navigation Drawer"
            className="p-1.5 text-stone-300 hover:text-white hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-full bg-amber-400 text-stone-950 font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
              <img
                src={imgError ? DEFAULT_STORE_IMAGE : (storeImageUrl || DEFAULT_STORE_IMAGE)}
                alt={storeSettings.storeName || 'Store Logo'}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 truncate whitespace-nowrap min-w-0 flex-1">
              {storeSettings.storeName}
            </span>
          </div>
        </div>

        {sellerId ? (
          <Link
            href={`/store/${sellerId}`}
            className="inline-flex items-center space-x-1 px-2 py-1 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 text-[10px] font-bold rounded border border-amber-400/30 transition-colors shrink-0 whitespace-nowrap cursor-pointer"
            title="Visit Store"
          >
            <span>Visit Store</span>
            <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
          </Link>
        ) : (
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center space-x-1 px-2 py-1 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 text-[10px] font-bold rounded border border-amber-400/30 transition-colors shrink-0 whitespace-nowrap cursor-pointer"
            title="Visit Store"
          >
            <span>Visit Store</span>
            <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
          </button>
        )}
      </div>

      {/* DESKTOP FIXED SIDEBAR (Visible on screens >= lg) */}
      <aside className="hidden lg:flex flex-col h-screen w-64 bg-stone-900 text-white shrink-0 border-r border-stone-800 sticky top-0 self-start">
        {renderNavContent()}
      </aside>

      {/* TABLET & MOBILE RESPONSIVE SLIDE DRAWER (Visible when open on screens < lg) */}
      {isMobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="lg:hidden fixed inset-0 z-50 flex animate-fade-in"
        >
          {/* Backdrop Overlay */}
          <div
            onClick={() => setIsMobileDrawerOpen(false)}
            className="fixed inset-0 bg-stone-900/70 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Sliding Drawer Content */}
          <div className="relative w-72 max-w-[80vw] bg-stone-900 h-full shadow-2xl z-10 animate-slide-right">
            {renderNavContent()}
          </div>
        </div>
      )}
    </>
  );
};
