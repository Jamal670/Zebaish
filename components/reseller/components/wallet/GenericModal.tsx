import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface GenericModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}

export const GenericModal: React.FC<GenericModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Focus trap on modal mount
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog Content Container (Fluid width w-[94vw] sm:w-full max-w-cap & max-h-[85vh] sm:max-h-[90vh]) */}
      <div
        ref={modalRef}
        tabIndex={0}
        className={`relative w-[94vw] sm:w-full ${maxWidth} bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-stone-200 z-10 flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-hidden focus:outline-none`}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
            <div>
              {title && (
                <h3 className="text-sm sm:text-base lg:text-lg font-bold text-stone-900 uppercase tracking-wide">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-2xs sm:text-xs text-stone-500 mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close Modal"
              className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Modal Body (Scrollable inner content) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
