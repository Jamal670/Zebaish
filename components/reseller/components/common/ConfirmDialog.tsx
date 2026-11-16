'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    setMounted(true);
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset internal state when dialog opens or closes
  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setIsPending(false);
      isSubmittingRef.current = false;
    }
  }, [open]);

  // Handle focus, focus trap, and body scroll lock
  useEffect(() => {
    if (!open) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Set initial focus: Cancel button for danger variant (safer), Confirm button otherwise
    const timer = setTimeout(() => {
      if (variant === 'danger') {
        if (cancelButtonRef.current) {
          cancelButtonRef.current.focus();
        } else if (dialogRef.current) {
          dialogRef.current.focus();
        }
      } else {
        if (confirmButtonRef.current) {
          confirmButtonRef.current.focus();
        } else if (dialogRef.current) {
          dialogRef.current.focus();
        }
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [open, variant]);

  // Keyboard navigation: Escape key (blocked when pending) and Tab focus trap
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPending || isSubmittingRef.current) {
          // Block Esc dismissal while action is pending
          e.preventDefault();
          return;
        }
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

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
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, isPending, onClose]);

  if (!mounted || !open) return null;

  const handleConfirm = async () => {
    // Double-submit guard with ref
    if (isSubmittingRef.current || isPending) return;
    isSubmittingRef.current = true;
    setIsPending(true);
    setErrorMessage(null);

    try {
      await onConfirm();
      if (isMountedRef.current) {
        setIsPending(false);
        isSubmittingRef.current = false;
        onClose();
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setIsPending(false);
        isSubmittingRef.current = false;
        const msg = err?.message || 'An unexpected error occurred. Please try again.';
        setErrorMessage(msg);
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (isPending || isSubmittingRef.current) {
        // Block backdrop dismissal while action is pending
        return;
      }
      onClose();
    }
  };

  const isDanger = variant === 'danger';

  const modalContent = (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        tabIndex={-1}
        className="relative w-full max-w-lg bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden focus:outline-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2.5 truncate">
            {isDanger && (
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-red-600" aria-hidden="true" />
              </div>
            )}
            <h2
              id="confirm-dialog-title"
              className="text-base sm:text-lg font-bold uppercase tracking-wider text-stone-900 truncate"
            >
              {title}
            </h2>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 text-sm text-stone-600 leading-relaxed">
          <div id="confirm-dialog-description">{description}</div>

          {/* Inline Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-stone-200 bg-stone-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 shrink-0">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            disabled={isPending}
            onClick={handleConfirm}
            className={`w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 text-center shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 text-white border border-red-600'
                : 'bg-stone-900 hover:bg-black text-white border border-stone-900'
            }`}
          >
            {isPending && <RefreshCw className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
            <span>{isPending ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ConfirmDialog;

