import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export interface CollapsibleSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  alwaysExpandedOnDesktop?: boolean;
}

export const CollapsibleSearchInput: React.FC<CollapsibleSearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  alwaysExpandedOnDesktop = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(Boolean(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isExpanded) {
      inputRef.current?.focus();
    }
  }, [isExpanded]);

  useEffect(() => {
    if (value && !isExpanded) {
      setIsExpanded(true);
    }
  }, [value]);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.relatedTarget && e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
      return;
    }
    if (!value || value.trim() === '') {
      setIsExpanded(false);
    }
  };

  const handleClear = () => {
    onChange('');
    setIsExpanded(false);
  };

  if (alwaysExpandedOnDesktop) {
    return (
      <div className={`relative flex items-center shrink-0 ${className}`}>
        {/* MOBILE VIEW (< sm): Collapsible Icon-to-Input */}
        <div className="sm:hidden">
          {!isExpanded ? (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="w-9 h-9 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-300 flex items-center justify-center text-stone-600 transition-all duration-300 cursor-pointer shrink-0"
              title="Search"
              aria-label="Expand Search"
            >
              <Search className="w-4 h-4" />
            </button>
          ) : (
            <div className="relative flex items-center transition-all duration-300 ease-in-out w-44">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={handleBlur}
                placeholder={placeholder}
                className="w-full pl-8 pr-8 py-2 border border-stone-300 rounded-lg text-xs bg-white focus:outline-none focus:border-stone-900 min-h-[36px] shadow-2xs text-stone-900"
              />
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 p-1 text-stone-400 hover:text-stone-700 rounded-full transition-colors cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* DESKTOP & TABLET VIEW (sm+): Always-Visible Input */}
        <div className="hidden sm:flex relative items-center w-56 lg:w-64">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-8 pr-8 py-2 border border-stone-300 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:border-stone-900 min-h-[38px] shadow-2xs text-stone-900"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2 p-1 text-stone-400 hover:text-stone-700 rounded-full transition-colors cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center shrink-0 ${className}`}>
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-300 flex items-center justify-center text-stone-600 transition-all duration-300 cursor-pointer shrink-0"
          title="Search"
          aria-label="Expand Search"
        >
          <Search className="w-4 h-4" />
        </button>
      ) : (
        <div className="relative flex items-center transition-all duration-300 ease-in-out w-40 sm:w-56 lg:w-64">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="w-full pl-8 pr-8 py-2 border border-stone-300 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:border-stone-900 min-h-[36px] sm:min-h-[40px] shadow-2xs text-stone-900"
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 p-1 text-stone-400 hover:text-stone-700 rounded-full transition-colors cursor-pointer"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CollapsibleSearchInput;
