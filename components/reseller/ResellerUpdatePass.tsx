'use client';

import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, AlertCircle, Loader2, CheckCircle2, KeyRound, Eye, EyeOff } from 'lucide-react';
import supabase from '@/src/api/client';
import { Navbar } from '@/components/Navbar';
import { useApp } from '@/components/context/AppContext';

interface ResellerUpdatePassProps {
  onSuccess: () => void;
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
}

export const ResellerUpdatePass: React.FC<ResellerUpdatePassProps> = ({
  onSuccess,
  onNavigateLogin,
  onNavigateHome,
}) => {
  const {
    cartItems,
    wishlistIds,
    setIsMegaMenuOpen,
    setIsSearchOpen,
    setIsCartOpen,
  } = useApp();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string>('');

  const validatePassword = (val: string): string => {
    if (!val) return 'Password is required.';
    if (val.length < 6) return 'Password must be at least 6 characters long.';
    return '';
  };

  const validateConfirm = (val: string, pass: string): string => {
    if (!val) return 'Please confirm your new password.';
    if (val !== pass) return 'Passwords do not match.';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const pErr = validatePassword(password);
    const cErr = validateConfirm(confirmPassword, password);

    if (pErr || cErr) {
      setPasswordError(pErr);
      setConfirmError(cErr);
      setErrorMessage('Please fix the errors below before proceeding.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        console.error('Supabase update password error:', error);
        setErrorMessage(error.message || 'Failed to update password. Please try again or request a new reset link.');
        setLoading(false);
        return;
      }

      setSuccessMessage('Your password has been updated successfully! You can now log in with your new password.');
      setLoading(false);

      // Automatically sign out recovery session so user logs in with new password
      await supabase.auth.signOut();
    } catch (err: any) {
      console.error('Unexpected password update error:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 animate-fade-in w-full">
      {/* Navbar Header */}
      <Navbar
        onOpenMenu={() => setIsMegaMenuOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenCart={() => setIsCartOpen(true)}
        cartCount={cartItems.reduce((acc, i) => acc + i.quantity, 0)}
        wishlistCount={wishlistIds.length}
        onNavigateHome={onNavigateHome}
        hasDarkHero={false}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24">
        {/* Black Banner Header */}
        <div className="bg-stone-900 text-white rounded-lg p-8 mb-8 text-center shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
          <span className="text-2xs font-bold tracking-[0.3em] uppercase text-amber-400 block mb-2">
            ZEBAISH SELLER PORTAL
          </span>
          <h1 className="text-lg sm:text-2xl lg:text-2xl font-extrabold tracking-tight font-script mb-3">
            Set Your New Password
          </h1>
          <p className="text-[9px] sm:text-xs lg:text-sm text-stone-300 max-w-xl mx-auto leading-relaxed">
            Please enter your new password below to secure your seller account.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-6 text-[10px] sm:text-xs text-stone-300">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Enhanced Account Security</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Instant Dashboard Access</span>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white border border-stone-200 rounded-lg p-6 sm:p-10 shadow-sm">
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-stone-200">
            <h2 className="text-xs sm:text-sm lg:text-base font-bold uppercase tracking-wider text-stone-900 flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              <span>Update Password</span>
            </h2>
            <span className="text-xs text-stone-500">
              <button
                type="button"
                onClick={onNavigateLogin}
                className="font-bold text-stone-900 underline hover:text-black cursor-pointer"
              >
                Back to Login
              </button>
            </span>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xs flex items-center space-x-2 text-xs text-red-700 font-medium animate-shake">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage ? (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xs text-xs text-emerald-800 font-medium leading-relaxed flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-900 mb-1">Password Successfully Updated!</p>
                  <p>{successMessage}</p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onNavigateLogin}
                  className="w-full py-4 bg-stone-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xs shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <span>PROCEED TO SELLER LOGIN</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 text-xs" noValidate>
              <div className="space-y-4">
                <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs border-b border-stone-100 pb-2 flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-stone-500" />
                  <span>New Credentials</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">
                      New Password <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Min 6 characters"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (passwordError) setPasswordError('');
                        }}
                        onBlur={() => {
                          const err = validatePassword(password);
                          setPasswordError(err);
                        }}
                        className={`w-full p-2.5 pl-9 pr-9 border rounded-xs focus:outline-none ${passwordError ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                          }`}
                      />
                      <Lock className="w-4 h-4 text-stone-400 absolute left-2.5 top-3" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-3 text-stone-400 hover:text-stone-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordError && <p className="text-xs text-red-600 font-medium mt-1">{passwordError}</p>}
                  </div>

                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">
                      Confirm New Password <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (confirmError) setConfirmError('');
                        }}
                        onBlur={() => {
                          const err = validateConfirm(confirmPassword, password);
                          setConfirmError(err);
                        }}
                        className={`w-full p-2.5 pl-9 pr-9 border rounded-xs focus:outline-none ${confirmError ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                          }`}
                      />
                      <Lock className="w-4 h-4 text-stone-400 absolute left-2.5 top-3" />
                    </div>
                    {confirmError && <p className="text-xs text-red-600 font-medium mt-1">{confirmError}</p>}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-stone-900 hover:bg-black disabled:bg-stone-500 text-white text-xs font-bold uppercase tracking-widest rounded-xs shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>UPDATING PASSWORD...</span>
                    </>
                  ) : (
                    <>
                      <span>UPDATE PASSWORD</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResellerUpdatePass;
