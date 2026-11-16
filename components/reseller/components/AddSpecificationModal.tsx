'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus } from 'lucide-react';
import { CustomSpec } from '../context/ListingDraftContext';

interface AddSpecificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (spec: { name: string; value: string }) => void;
  existingSpecs: CustomSpec[];
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

const BUILT_IN_LABELS = [
  'title',
  'product title',
  'department',
  'category',
  'price',
  'compare price',
  'selling price',
  'retail price',
  'discounted price',
  'quantity',
  'description',
  'defect',
];

export const AddSpecificationModal: React.FC<AddSpecificationModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingSpecs,
  triggerButtonRef,
}) => {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [valueError, setValueError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Manage modal open/close states, focus management, body scroll lock
  useEffect(() => {
    if (!isOpen) {
      // Clear inputs whenever closed so opening again starts empty
      setName('');
      setValue('');
      setNameError(null);
      setValueError(null);
      return;
    }

    // Save previous active element to restore focus on close
    previousActiveElement.current = (document.activeElement as HTMLElement) || triggerButtonRef?.current || null;

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus Name input
    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);

    // Keydown listener for Esc and Tab trap
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);

      // Return focus to trigger button
      if (triggerButtonRef?.current) {
        triggerButtonRef.current.focus();
      } else if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose, triggerButtonRef]);

  if (!mounted || !isOpen) return null;

  const handleAdd = () => {
    const trimmedName = name.trim();
    const trimmedValue = value.trim();

    let hasError = false;

    // Validate Name
    if (!trimmedName) {
      setNameError('Specification name is required.');
      hasError = true;
    } else if (trimmedName.length > 40) {
      setNameError('Specification name cannot exceed 40 characters.');
      hasError = true;
    } else {
      const lowerName = trimmedName.toLowerCase();

      // Check unique among existing custom specs (case-insensitive)
      const isDuplicate = existingSpecs.some(
        (spec) => spec.name.trim().toLowerCase() === lowerName
      );
      if (isDuplicate) {
        setNameError('A specification with this name already exists.');
        hasError = true;
      }

      // Check against built-in labels (case-insensitive)
      const isBuiltIn = BUILT_IN_LABELS.includes(lowerName);
      if (isBuiltIn) {
        setNameError('Specification name cannot be a built-in label (Title, Department, Category, Price, Quantity, Description, Defect).');
        hasError = true;
      }
    }

    // Validate Value
    if (!trimmedValue) {
      setValueError('Specification value is required.');
      hasError = true;
    } else if (trimmedValue.length > 200) {
      setValueError('Specification value cannot exceed 200 characters.');
      hasError = true;
    }

    if (hasError) return;

    onAdd({ name: trimmedName, value: trimmedValue });
    setName('');
    setValue('');
    setNameError(null);
    setValueError(null);
    onClose();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="spec-modal-title"
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-md p-5 sm:p-6 z-10 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <h3
            id="spec-modal-title"
            className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-stone-900"
          >
            Add Product Specification
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="py-4 space-y-4">
          {/* Name Field */}
          <div>
            <label
              htmlFor="spec-modal-name"
              className="block font-bold text-stone-900 uppercase tracking-wide text-xs mb-1"
            >
              Name <span className="text-red-600">*</span>
            </label>
            <input
              id="spec-modal-name"
              ref={nameInputRef}
              type="text"
              maxLength={40}
              placeholder="Material, Pattern, Fit"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              onKeyDown={handleInputKeyDown}
              className={`w-full p-2.5 sm:p-3 border rounded-lg focus:outline-none min-h-[42px] text-xs sm:text-sm font-semibold transition-colors ${
                nameError
                  ? 'border-red-500 focus:border-red-600 bg-red-50/20'
                  : 'border-stone-300 focus:border-stone-900 bg-white'
              }`}
            />
            {nameError && (
              <p className="text-xs text-red-600 font-medium mt-1">{nameError}</p>
            )}
          </div>

          {/* Value Field */}
          <div>
            <label
              htmlFor="spec-modal-value"
              className="block font-bold text-stone-900 uppercase tracking-wide text-xs mb-1"
            >
              Value <span className="text-red-600">*</span>
            </label>
            <input
              id="spec-modal-value"
              type="text"
              maxLength={200}
              placeholder="100% Pure Lawn, Slim Fit"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (valueError) setValueError(null);
              }}
              onKeyDown={handleInputKeyDown}
              className={`w-full p-2.5 sm:p-3 border rounded-lg focus:outline-none min-h-[42px] text-xs sm:text-sm font-semibold transition-colors ${
                valueError
                  ? 'border-red-500 focus:border-red-600 bg-red-50/20'
                  : 'border-stone-300 focus:border-stone-900 bg-white'
              }`}
            />
            {valueError && (
              <p className="text-xs text-red-600 font-medium mt-1">{valueError}</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
          >
            <span>Add</span>
            {/* <Plus className="w-3.5 h-3.5" /> */}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AddSpecificationModal;
