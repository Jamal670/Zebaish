import React from 'react';
import Link from 'next/link';
import { Store, UserPlus } from 'lucide-react';

interface FooterProps {
  onNavigateReseller?: () => void;
  onNavigateSellerLogin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateReseller, onNavigateSellerLogin }) => {
  return (
    <footer className="bg-white text-stone-600 border-t border-stone-200 pt-12 md:pt-16 pb-8 px-4 md:px-8 text-xs leading-relaxed">
      <div className="max-w-7xl mx-auto">
        {/* Top Link Columns */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-x-4 gap-y-8 md:gap-12 pb-12 border-b border-stone-200">

          {/* Column 1: Contact Details */}
          <div className="col-span-1 md:col-span-5 space-y-1 text-stone-500 font-normal">
            <div className="font-script text-3xl font-normal text-stone-900 mb-2">Zebaish</div>
            <p className="text-stone-700">5.5 KM, Raiwind Road (Near Fatehbad Village)</p>
            <p className="text-stone-700">Lahore, Pakistan.</p>
            {/* <p className="pt-2">Call: +92 316 7156734</p> */}
            <p>WhatsApp: +92 316 7156734</p>
            <p>Email: help@zebaish.com</p>
          </div>

          {/* Column 2: Information */}
          <div className="col-span-1 md:col-span-3 space-y-2.5">
            <h3 className="text-stone-900 font-semibold text-lg mb-3">Information</h3>
            <ul className="space-y-1 font-normal text-stone-600">
              {/* <li><a href="#returns" className="hover:text-stone-900 transition-colors">Returns and Exchange</a></li> */}
              <li><Link href="/privacy" className="hover:text-stone-900 transition-colors">Privacy Policy</Link></li>
              <li><a href="#payment" className="hover:text-stone-900 transition-colors">Payment Process</a></li>
              {/* <li><a href="#faqs" className="hover:text-stone-900 transition-colors">FAQs</a></li> */}
              <li><Link href="/track" className="hover:text-stone-900 transition-colors">Track Your Order</Link></li>
              {/* <li><a href="#blogs" className="hover:text-stone-900 transition-colors">Blogs</a></li> */}
            </ul>
          </div>

          {/* Column 3: Customer Care */}
          <div className="col-span-2 md:col-span-4 space-y-2.5">
            <h3 className="text-stone-900 font-semibold text-lg mb-3">Customer Care & Sellers</h3>
            <ul className="space-y-1 font-normal text-stone-600">
              <li><Link href="/about" className="hover:text-stone-900 transition-colors">About Zebaish</Link></li>
              <li><Link href="/contact" className="hover:text-stone-900 transition-colors">Contact Us</Link></li>
              {/* <li><a href="#shipping" className="hover:text-stone-900 transition-colors">Shipping Policy</a></li> */}
              <li><Link href="/terms" className="hover:text-stone-900 transition-colors">Terms and Conditions</Link></li>
              <li><Link href="/reseller/login" className="hover:text-stone-900 transition-colors font-medium text-amber-700">Seller Login</Link></li>
              <li className="pt-3 border-t border-stone-200 flex flex-wrap gap-2.5 items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateReseller) {
                      onNavigateReseller();
                    } else if (onNavigateSellerLogin) {
                      onNavigateSellerLogin();
                    }
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-400 text-stone-950 hover:bg-amber-300 rounded-xs text-[11px] font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Become a seller</span>
                </button>
                <div className="flex space-x-4 text-stone-700">
                  <a href="https://www.youtube.com/@OfficialZebaish" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="hover:text-stone-900 transition-colors">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                  </a>
                  <a href="https://www.instagram.com/officialzebaish01/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-stone-900 transition-colors">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                  </a>
                  <a href="https://www.tiktok.com/@officialzebaish" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="hover:text-stone-900 transition-colors">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .56.04.83.1v-3.5a6.37 6.37 0 0 0-.83-.05A6.34 6.34 0 0 0 3 15.57a6.34 6.34 0 0 0 10.86 4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.43z" /></svg>
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Social Bar */}
        <div className="pt-3 flex justify-center text-stone-500 pb-0">
          <p className="text-center">
            © 2026 Zebaish Marketplace - Pakistan's Premier Designer Leftover Stock Hub.
          </p>
        </div>
      </div>
    </footer>
  );
};
