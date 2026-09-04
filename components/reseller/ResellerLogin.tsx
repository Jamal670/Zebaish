'use client';

import React, { useState, useEffect } from 'react';
import { Store, Lock, ArrowRight, Mail, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import supabase from '@/src/api/client';
import { useAuth } from '@/src/hooks/useAuth';
import { Navbar } from '@/components/Navbar';
import { useApp } from '@/components/context/AppContext';

interface ResellerLoginProps {
  onLoginSuccess: () => void;
  onNavigateSignup: () => void;
  onNavigateHome: () => void;
  onNavigateForgotPass?: () => void;
}

export const ResellerLogin: React.FC<ResellerLoginProps> = ({
  onLoginSuccess,
  onNavigateSignup,
  onNavigateHome,
  onNavigateForgotPass,
}) => {
  const { user, refetchProfile } = useAuth();
  const {
    cartItems,
    wishlistIds,
    setIsMegaMenuOpen,
    setIsSearchOpen,
    setIsCartOpen,
  } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      onLoginSuccess();
    }
  }, [user, onLoginSuccess]);

  const validateField = (name: string, value: string): string => {
    if (name === 'email') {
      if (!value || !value.trim()) return 'Email address is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        return 'Please enter a valid email address.';
      }
    }
    if (name === 'password') {
      if (!value) return 'Password is required.';
    }
    return '';
  };

  const validateAll = (): boolean => {
    const emailErr = validateField('email', email);
    const passwordErr = validateField('password', password);

    const newErrors: Record<string, string> = {};
    if (emailErr) newErrors.email = emailErr;
    if (passwordErr) newErrors.password = passwordErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const isValid = validateAll();
    if (!isValid) {
      setErrorMessage('Please review and correct the highlighted fields.');
      return;
    }

    setLoading(true);

    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('dummy')) {
      setErrorMessage(
        'Missing API Key: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or invalid in your .env file.'
      );
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Supabase login error:', error);
        const msg = error.message || '';
        if (msg.toLowerCase().includes('invalid login credentials') || error.status === 400) {
          setErrorMessage('Invalid email address or password. Please check your credentials and try again.');
        } else if (msg.toLowerCase().includes('email not confirmed')) {
          setErrorMessage('Your email address has not been verified yet. Please check your inbox for the verification link.');
        } else {
          setErrorMessage(error.message || 'Authentication failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      if (data?.user) {
        await refetchProfile();
      }

      setLoading(false);
      onLoginSuccess();
    } catch (err: any) {
      console.error('Unexpected login error:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred during login.');
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
            Manage Your Inventory & Dispatches
          </h1>
          <p className="text-[9px] sm:text-xs lg:text-sm text-stone-300 max-w-xl mx-auto leading-relaxed">
            Access your verified seller dashboard, track active brand surplus listings, monitor TCS courier pickups, and check sales payouts.
          </p>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 text-xs text-stone-300">
            <div className="flex items-center justify-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Zero Listing Monthly Fee</span>
            </div>

            <div className="flex items-center justify-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Bank / EasyPaisa Payouts</span>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center justify-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Automated TCS / Leopards Pickup</span>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white border border-stone-200 rounded-lg p-6 sm:p-10 shadow-sm">
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-stone-200">
            <h2 className="text-base font-bold uppercase tracking-wider text-stone-900 flex items-center space-x-2">
              <Store className="w-5 h-5 text-amber-600" />
              <span>Login</span>
            </h2>
            <span className="text-xs text-stone-500">
              Don't have a seller account?{' '}
              <button
                type="button"
                onClick={onNavigateSignup}
                className="font-bold text-stone-900 underline hover:text-black cursor-pointer"
              >
                Register Here
              </button>
            </span>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xs flex items-center space-x-2 text-xs text-red-700 font-medium animate-shake">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 text-xs" noValidate>
            <div className="space-y-4">
              <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs border-b border-stone-100 pb-2 flex items-center space-x-2">
                <Mail className="w-4 h-4 text-stone-500" />
                <span>Account Credentials</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="reseller@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                      }}
                      onBlur={() => {
                        const err = validateField('email', email);
                        setErrors((prev) => ({ ...prev, email: err }));
                      }}
                      className={`w-full p-2.5 pl-9 border rounded-xs focus:outline-none ${errors.email ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                        }`}
                    />
                    <Mail className="w-4 h-4 text-stone-400 absolute left-2.5 top-3" />
                  </div>
                  {errors.email && <p className="text-xs text-red-600 font-medium mt-1">{errors.email}</p>}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-stone-700">
                      Password <span className="text-red-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateForgotPass) onNavigateForgotPass();
                        else window.location.href = '/reseller/forgot-password';
                      }}
                      className="text-xs text-stone-500 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                      }}
                      onBlur={() => {
                        const err = validateField('password', password);
                        setErrors((prev) => ({ ...prev, password: err }));
                      }}
                      className={`w-full p-2.5 pl-9 border rounded-xs focus:outline-none ${errors.password ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                        }`}
                    />
                    <Lock className="w-4 h-4 text-stone-400 absolute left-2.5 top-3" />
                  </div>
                  {errors.password && <p className="text-xs text-red-600 font-medium mt-1">{errors.password}</p>}
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
                    <span>LOGGING IN...</span>
                  </>
                ) : (
                  <>
                    <span>LOG IN</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
