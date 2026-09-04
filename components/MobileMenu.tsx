import React from 'react';
import { X, ChevronRight, Phone, Mail, Globe } from 'lucide-react';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (category: string) => void;
}

const MENU_CATEGORIES = [
  'New Arrivals',
  'Unstitched Lawn',
  'Luxury Pret',
  'Luxury Formals',
  'Couture',
  'M.Luxe Fabrics',
  'Kidswear',
  'Jewelry',
  'Accessories',
  'Order Tracking',
  'Blogs'
];

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  onSelectCategory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-xs bg-black text-white h-full shadow-2xl flex flex-col z-10 border-r border-stone-800">
        {/* Header */}
        <div className="p-5 border-b border-stone-800 flex items-center justify-between">
          <span className="font-script text-2xl sm:text-3xl font-normal text-white">
            Zebaish
          </span>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-white rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto py-4 px-5 space-y-1">
          {MENU_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                onSelectCategory(cat);
                onClose();
              }}
              className="w-full py-3 flex items-center justify-between text-stone-200 hover:text-white font-medium text-[10px] sm:text-xs uppercase tracking-widest border-b border-stone-900/60 transition-colors text-left"
            >
              <span>{cat}</span>
              <ChevronRight className="w-4 h-4 text-stone-600" />
            </button>
          ))}
        </div>

        {/* Footer Contact Info */}
        <div className="p-5 border-t border-stone-800 bg-stone-950 text-stone-400 text-[10px] sm:text-[11px] space-y-2">
          <div className="flex items-center space-x-2">
            <Globe className="w-3.5 h-3.5 text-stone-500" />
            <span>Region: Pakistan (Rs. PKR)</span>
          </div>
          <div className="flex items-center space-x-2">
            <Phone className="w-3.5 h-3.5 text-stone-500" />
            <span>+1 (424) 433-3993</span>
          </div>
          <div className="flex items-center space-x-2">
            <Mail className="w-3.5 h-3.5 text-stone-500" />
            <span>help@mariab.ae</span>
          </div>
        </div>
      </div>
    </div>
  );
};
