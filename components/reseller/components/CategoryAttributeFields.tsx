'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, Plus, X, Loader2, RefreshCw } from 'lucide-react';
import { CategoryAttributeDefinition } from '@/src/api/categoryService';

export interface SelectOptionItem {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  id?: string;
  label?: string;
  required?: boolean;
  multiple?: boolean;
  value: string | string[];
  options?: (string | SelectOptionItem)[];
  extraOptions?: string[];
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyMessage?: string;
  allowCustomAdd?: boolean;
  error?: string;
  onChange: (value: any, selectedItem?: SelectOptionItem) => void;
  onAddExtraOption?: (newOption: string) => void;
}

/**
 * Universal SearchableSelect component supporting both single and multi selection,
 * sticky top search, sticky bottom custom option adding with inline input,
 * portal-based overflow clipping protection, and full keyboard accessibility.
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  label,
  required,
  multiple = false,
  value,
  options = [],
  extraOptions = [],
  placeholder = 'Select an option',
  disabled = false,
  isLoading = false,
  isError = false,
  errorMessage = 'Failed to load options',
  onRetry,
  emptyMessage = 'No options available',
  allowCustomAdd = false,
  error,
  onChange,
  onAddExtraOption,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Normalize options into { value, label } items
  const normalizedOptions = useMemo(() => {
    const list: SelectOptionItem[] = [];
    const seen = new Set<string>();

    const add = (item: string | SelectOptionItem) => {
      let val = '';
      let lbl = '';
      if (typeof item === 'string') {
        val = item.trim();
        lbl = item.trim();
      } else if (item && typeof item === 'object') {
        val = String(item.value ?? item.label ?? '').trim();
        lbl = String(item.label ?? item.value ?? '').trim();
      }
      if (!val) return;
      const key = val.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ value: val, label: lbl });
      }
    };

    options.forEach(add);
    extraOptions.forEach(add);

    // Keep selected values visible even if not in list
    if (multiple && Array.isArray(value)) {
      value.forEach((v) => {
        if (v && !seen.has(v.toLowerCase())) {
          add(v);
        }
      });
    } else if (!multiple && typeof value === 'string' && value) {
      if (!seen.has(value.toLowerCase())) {
        add(value);
      }
    }

    return list;
  }, [options, extraOptions, multiple, value]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const q = searchTerm.trim().toLowerCase();
    return normalizedOptions.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, searchTerm]);

  // Calculate position coordinates for the floating portal
  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownMaxHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < dropdownMaxHeight && rect.top > dropdownMaxHeight;
    const top = showAbove ? rect.top - dropdownMaxHeight - 6 : rect.bottom + 6;
    const width = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setCoords({ top, left, width });
  }, []);

  // Update coords on open, resize, or scroll
  useEffect(() => {
    if (!isOpen) return;
    updateCoords();
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen, updateCoords]);

  // Click-outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // Focus management on open/close
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(-1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
      setShowInlineAdd(false);
      setCustomInput('');
      setAddError(null);
    }
  }, [isOpen]);

  // Focus inline add input when opened
  useEffect(() => {
    if (showInlineAdd) {
      setTimeout(() => {
        addInputRef.current?.focus();
      }, 50);
    }
  }, [showInlineAdd]);

  // Selection handlers
  const handleSelectOption = (opt: SelectOptionItem) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const exists = currentValues.some((v) => v.toLowerCase() === opt.value.toLowerCase());
      if (exists) {
        onChange(currentValues.filter((v) => v.toLowerCase() !== opt.value.toLowerCase()));
      } else {
        onChange([...currentValues, opt.value]);
      }
    } else {
      onChange(opt.value, opt);
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  const handleClearSingle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Add custom option flow
  const handleConfirmAdd = (textToAdd?: string) => {
    const raw = (textToAdd !== undefined ? textToAdd : customInput).trim().replace(/\s+/g, ' ');
    if (!raw) {
      setAddError('Please enter a value');
      return;
    }
    if (raw.length > 100) {
      setAddError('Max 100 characters allowed');
      return;
    }

    const lower = raw.toLowerCase();
    const existing = normalizedOptions.find(
      (o) => o.value.toLowerCase() === lower || o.label.toLowerCase() === lower
    );

    if (existing) {
      handleSelectOption(existing);
    } else {
      if (onAddExtraOption) {
        onAddExtraOption(raw);
      }
      if (multiple) {
        const currentValues = Array.isArray(value) ? value : [];
        if (!currentValues.some((v) => v.toLowerCase() === lower)) {
          onChange([...currentValues, raw]);
        }
      } else {
        onChange(raw, { value: raw, label: raw });
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    setCustomInput('');
    setShowInlineAdd(false);
    setAddError(null);
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(filteredOptions.length - 1);
      return;
    }

    if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        e.preventDefault();
        handleSelectOption(filteredOptions[activeIndex]);
      }
    }
  };

  // Trigger label formatting
  const getTriggerDisplay = () => {
    if (isLoading) return 'Loading…';
    if (multiple) {
      const arr = Array.isArray(value) ? value : [];
      if (arr.length === 0) return placeholder;
      const firstLabel =
        normalizedOptions.find((o) => o.value.toLowerCase() === arr[0].toLowerCase())?.label || arr[0];
      if (arr.length === 1) {
        return firstLabel;
      }
      return `${firstLabel} (+${arr.length - 1})`;
    }

    if (typeof value === 'string' && value) {
      const match = normalizedOptions.find((o) => o.value === value || o.label === value);
      return match ? match.label : value;
    }
    return placeholder;
  };

  const hasValue = multiple
    ? Array.isArray(value) && value.length > 0
    : typeof value === 'string' && value.trim().length > 0;

  const hasExactSearchMatch = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return normalizedOptions.some((o) => o.label.toLowerCase() === q || o.value.toLowerCase() === q);
  }, [normalizedOptions, searchTerm]);

  return (
    <div className="min-w-0 relative">
      {label && (
        <label
          htmlFor={id}
          className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs truncate"
          title={label}
        >
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] flex items-center justify-between text-left transition-colors cursor-pointer disabled:bg-stone-100 disabled:cursor-not-allowed ${
          error
            ? 'border-red-500 focus:border-red-600 text-stone-900'
            : 'border-stone-300 hover:border-stone-400 focus:border-stone-900 text-stone-900'
        }`}
      >
        <div className="flex-1 min-w-0 mr-2 flex items-center overflow-hidden">
          <span
            className={`text-xs sm:text-sm font-semibold truncate ${
              hasValue ? 'text-stone-900' : 'text-stone-400'
            }`}
          >
            {getTriggerDisplay()}
          </span>
          {multiple && Array.isArray(value) && value.length > 1 && (
            <span className="shrink-0 ml-1.5 bg-stone-100 text-stone-800 text-2xs font-bold px-1.5 py-0.5 rounded-full border border-stone-200">
              {value.length}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1 shrink-0 text-stone-400">
          {!multiple && hasValue && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClearSingle}
              className="p-0.5 hover:text-stone-700 cursor-pointer mr-0.5 rounded"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-stone-600" />
          ) : (
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-stone-900' : ''}`}
            />
          )}
        </div>
      </button>

      {/* Inline Error Message */}
      {error && <p className="text-xs text-red-600 font-medium mt-1">{error}</p>}

      {/* Query Error State with Inline Retry */}
      {isError && (
        <div className="flex items-center space-x-2 mt-1.5 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <span className="truncate">{errorMessage}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 flex items-center space-x-1 font-bold text-red-800 hover:text-red-950 underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Floating Dropdown Panel (Portaled to prevent clipping from overflow-hidden parents) */}
      {isOpen &&
        !disabled &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-multiselectable={multiple}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
            }}
            className="bg-white border border-stone-300 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Sticky Search Header */}
            <div className="sticky top-0 bg-white border-b border-stone-200 p-2 z-10 shrink-0">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Search ${label ? label.toLowerCase() : 'options'}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
                        handleSelectOption(filteredOptions[activeIndex]);
                      } else if (allowCustomAdd && searchTerm.trim() && !hasExactSearchMatch) {
                        handleConfirmAdd(searchTerm);
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsOpen(false);
                      triggerRef.current?.focus();
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
                    }
                  }}
                  className="w-full pl-8 pr-7 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white placeholder-stone-400"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 p-0.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable List of Options (max-h-60) */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 max-h-60 min-h-[80px]">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => {
                  const isSelected = multiple
                    ? Array.isArray(value) && value.some((v) => v.toLowerCase() === opt.value.toLowerCase())
                    : typeof value === 'string' &&
                      (value === opt.value || value.toLowerCase() === opt.label.toLowerCase());
                  const isActive = idx === activeIndex;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectOption(opt)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-between cursor-pointer min-h-[36px] ${
                        isSelected
                          ? 'bg-stone-900 text-white font-bold'
                          : isActive
                          ? 'bg-stone-100 text-stone-900'
                          : 'text-stone-800 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="p-3 text-center text-xs text-stone-500 font-medium">
                  {searchTerm ? `No matches for "${searchTerm}"` : emptyMessage}
                </div>
              )}
            </div>

            {/* Sticky Bottom: Add Custom Option Flow */}
            {allowCustomAdd && (
              <div className="sticky bottom-0 bg-stone-50 border-t border-stone-200 p-2 z-10 shrink-0">
                {/* Search Term Shortcut to Add */}
                {searchTerm.trim() && !hasExactSearchMatch && !showInlineAdd && (
                  <button
                    type="button"
                    onClick={() => handleConfirmAdd(searchTerm)}
                    className="w-full mb-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-md transition-colors flex items-center justify-between cursor-pointer text-left"
                  >
                    <span className="truncate">Add &ldquo;{searchTerm.trim()}&rdquo;</span>
                    <Plus className="w-3.5 h-3.5 shrink-0 ml-1.5 text-stone-600" />
                  </button>
                )}

                {showInlineAdd ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-1.5">
                      <input
                        ref={addInputRef}
                        type="text"
                        maxLength={100}
                        placeholder={`Add custom ${label ? label.toLowerCase() : 'option'}...`}
                        value={customInput}
                        onChange={(e) => {
                          setCustomInput(e.target.value);
                          if (addError) setAddError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleConfirmAdd();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setShowInlineAdd(false);
                            setCustomInput('');
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-white border border-stone-300 rounded-md text-xs text-stone-900 focus:outline-none focus:border-stone-900 placeholder-stone-400 min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => handleConfirmAdd()}
                        disabled={!customInput.trim()}
                        className="px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowInlineAdd(false);
                          setCustomInput('');
                          setAddError(null);
                        }}
                        className="px-2 py-1.5 border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs rounded-md cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {addError && <p className="text-2xs text-red-600 font-medium">{addError}</p>}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineAdd(true);
                      setCustomInput(searchTerm.trim());
                    }}
                    className="w-full py-1.5 px-2.5 text-xs font-bold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-md flex items-center justify-center space-x-1.5 transition-colors cursor-pointer border border-dashed border-stone-300 hover:border-stone-500"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add custom {label ? label.toLowerCase() : 'value'}</span>
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

// ==========================================
// DYNAMIC ATTRIBUTE FIELD RENDERERS (BY TYPE)
// ==========================================

export interface DynamicAttributeFieldProps {
  attribute: CategoryAttributeDefinition;
  value: any;
  extraOptions?: string[];
  error?: string;
  onChange: (value: any) => void;
  onAddExtraOption?: (newOption: string) => void;
}

/**
 * Dispatches to the appropriate attribute input based on attribute.data_type:
 * - text: standard text input (max length 200)
 * - number: decimal input mode, no NaN, no negative
 * - boolean: Yes/No toggle buttons
 * - select: SearchableSelect (multiple = false)
 * - multi_select: SearchableSelect (multiple = true)
 * - unknown: falls back to text with console warning
 */
export const DynamicAttributeField: React.FC<DynamicAttributeFieldProps> = ({
  attribute,
  value,
  extraOptions = [],
  error,
  onChange,
  onAddExtraOption,
}) => {
  const dataType = (attribute.data_type || 'text').trim().toLowerCase();

  // 1. Text Field
  if (dataType === 'text') {
    return (
      <div className="min-w-0">
        <label
          htmlFor={`field-attr-${attribute.id}`}
          className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs truncate"
          title={attribute.name}
        >
          {attribute.name} {attribute.is_required && <span className="text-red-600">*</span>}
        </label>
        <input
          id={`field-attr-${attribute.id}`}
          type="text"
          maxLength={200}
          placeholder={`Enter ${attribute.name}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] text-xs sm:text-sm font-semibold bg-white transition-colors ${
            error
              ? 'border-red-500 focus:border-red-600'
              : 'border-stone-300 hover:border-stone-400 focus:border-stone-900'
          }`}
        />
        {error && <p className="text-xs text-red-600 font-medium mt-1">{error}</p>}
      </div>
    );
  }

  // 2. Number Field (decimal input mode, allow empty while typing, no NaN)
  if (dataType === 'number') {
    return (
      <div className="min-w-0">
        <label
          htmlFor={`field-attr-${attribute.id}`}
          className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs truncate"
          title={attribute.name}
        >
          {attribute.name} {attribute.is_required && <span className="text-red-600">*</span>}
        </label>
        <input
          id={`field-attr-${attribute.id}`}
          type="text"
          inputMode="decimal"
          placeholder={`Enter ${attribute.name}`}
          value={typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''}
          onChange={(e) => {
            const raw = e.target.value;
            // Allow empty string or digits with at most one decimal point
            if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
              onChange(raw);
            }
          }}
          className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] text-xs sm:text-sm font-semibold bg-white transition-colors ${
            error
              ? 'border-red-500 focus:border-red-600'
              : 'border-stone-300 hover:border-stone-400 focus:border-stone-900'
          }`}
        />
        {error && <p className="text-xs text-red-600 font-medium mt-1">{error}</p>}
      </div>
    );
  }

  // 3. Boolean Field (Yes / No toggle matching design system, unset until touched)
  if (dataType === 'boolean') {
    const isBool = typeof value === 'boolean';
    return (
      <div className="min-w-0">
        <label
          className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs truncate"
          title={attribute.name}
        >
          {attribute.name} {attribute.is_required && <span className="text-red-600">*</span>}
        </label>
        <div className="flex items-center space-x-2.5 min-h-[42px]">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg border transition-all cursor-pointer ${
              isBool && value === true
                ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                : 'bg-white text-stone-700 border-stone-300 hover:border-stone-600'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg border transition-all cursor-pointer ${
              isBool && value === false
                ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                : 'bg-white text-stone-700 border-stone-300 hover:border-stone-600'
            }`}
          >
            No
          </button>
          {isBool && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-2xs text-stone-400 hover:text-stone-700 underline cursor-pointer ml-1"
              title="Clear selection"
            >
              Clear
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600 font-medium mt-1">{error}</p>}
      </div>
    );
  }

  // 4. Select Field (Single searchable select)
  if (dataType === 'select') {
    return (
      <SearchableSelect
        id={`field-attr-${attribute.id}`}
        label={attribute.name}
        required={attribute.is_required}
        multiple={false}
        value={typeof value === 'string' ? value : ''}
        options={attribute.options || []}
        extraOptions={extraOptions}
        placeholder={`Select ${attribute.name}`}
        allowCustomAdd={true}
        error={error}
        onChange={(val) => onChange(val)}
        onAddExtraOption={onAddExtraOption}
      />
    );
  }

  // 5. Multi-Select Field
  if (dataType === 'multi_select') {
    const arrayValue = Array.isArray(value)
      ? value
      : typeof value === 'string' && value.trim()
      ? [value.trim()]
      : [];

    return (
      <SearchableSelect
        id={`field-attr-${attribute.id}`}
        label={attribute.name}
        required={attribute.is_required}
        multiple={true}
        value={arrayValue}
        options={attribute.options || []}
        extraOptions={extraOptions}
        placeholder={`Select ${attribute.name}`}
        allowCustomAdd={true}
        error={error}
        onChange={(val) => onChange(val)}
        onAddExtraOption={onAddExtraOption}
      />
    );
  }

  // 6. Unknown data_type: log warning and fallback to text input
  console.warn(
    `Unknown category attribute data_type "${attribute.data_type}" for attribute "${attribute.name}". Falling back to text input.`
  );

  return (
    <div className="min-w-0">
      <label
        htmlFor={`field-attr-${attribute.id}`}
        className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs truncate"
        title={attribute.name}
      >
        {attribute.name} {attribute.is_required && <span className="text-red-600">*</span>}
      </label>
      <input
        id={`field-attr-${attribute.id}`}
        type="text"
        maxLength={200}
        placeholder={`Enter ${attribute.name}`}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] text-xs sm:text-sm font-semibold bg-white transition-colors ${
          error
            ? 'border-red-500 focus:border-red-600'
            : 'border-stone-300 hover:border-stone-400 focus:border-stone-900'
        }`}
      />
      {error && <p className="text-xs text-red-600 font-medium mt-1">{error}</p>}
    </div>
  );
};
