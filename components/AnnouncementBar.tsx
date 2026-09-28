import React from 'react';

export const AnnouncementBar: React.FC = () => {
  return (
    <div className="bg-[#050505] text-[#d0d0d0] text-[9px] sm:text-[10px] lg:text-xs font-medium tracking-wider uppercase py-2 px-4 md:px-8">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <a href="#order-tracking" className="hover:text-white transition-colors">
            ORDER TRACKING
          </a>
          <span className="text-stone-700">|</span>
          <a href="#contact-us" className="hover:text-white transition-colors">
            CONTACT US
          </a>
        </div>
        <div className="hidden sm:flex items-center space-x-3 sm:space-x-4 text-[9px] sm:text-[10px] lg:text-xs">
          <a href="https://www.instagram.com/officialzebaish01/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
            INSTAGRAM
          </a>
          <span className="text-stone-700">|</span>
          <a href="https://www.tiktok.com/@officialzebaish" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
            TIKTOK
          </a>
          <span className="text-stone-700">|</span>
          <a href="https://www.youtube.com/@OfficialZebaish" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
            YOUTUBE
          </a>
        </div>
      </div>
    </div>
  );
};
