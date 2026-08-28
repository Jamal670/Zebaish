import React, { useState } from 'react';
import { Store, ArrowRight, Mail, AlertCircle, Loader2, CheckCircle2, KeyRound } from 'lucide-react';
import supabase from '@/src/api/client';
import { Navbar } from '@/components/Navbar';
import { useApp } from '@/components/context/AppContext';

interface ResellerFgtPassProps {
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
}

export const ResellerFgtPass: React.FC<ResellerFgtPassProps> = ({
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

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string>('');

  const validateEmail = (value: string): string => {
    if (!value || !value.trim()) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return 'Please enter a valid email address.';
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      setErrorMessage('Please enter a valid email address.');
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
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/reseller/login`
        : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('Supabase password reset error:', error);
        setErrorMessage(error.message || 'Failed to send password reset email. Please try again.');
        setLoading(false);
        return;
      }

      setSuccessMessage(
        'Password reset link has been sent to your email address! Please check your inbox and follow the instructions to reset your password.'
      );
      setLoading(false);
    } catch (err: any) {
      console.error('Unexpected password reset error:', err);
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
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-script mb-3">
            Reset Your Seller Password
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 max-w-xl mx-auto leading-relaxed">
            Enter your registered seller email address below to receive instant password reset instructions.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs text-stone-300">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Zero Listing Monthly Fee</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Direct Bank / EasyPaisa Payouts</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Automated TCS / Leopards Pickup</span>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white border border-stone-200 rounded-lg p-6 sm:p-10 shadow-sm">
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-stone-200">
            <h2 className="text-base font-bold uppercase tracking-wider text-stone-900 flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              <span>Forgot Password</span>
            </h2>
            <span className="text-xs text-stone-500">
              Remember your password?{' '}
              <button
                type="button"
                onClick={onNavigateLogin}
                className="font-bold text-stone-900 underline hover:text-black cursor-pointer"
              >
                Log In Here
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
                  <p className="font-bold text-emerald-900 mb-1">Check Your Email</p>
                  <p>{successMessage}</p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onNavigateLogin}
                  className="w-full py-4 bg-stone-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xs shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <span>RETURN TO SELLER LOGIN</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 text-xs" noValidate>
              <div className="space-y-4">
                <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs border-b border-stone-100 pb-2 flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-stone-500" />
                  <span>Account Email</span>
                </h3>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Email Address <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="reseller@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError('');
                      }}
                      onBlur={() => {
                        const err = validateEmail(email);
                        setEmailError(err);
                      }}
                      className={`w-full p-2.5 pl-9 border rounded-xs focus:outline-none ${emailError ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                        }`}
                    />
                    <Mail className="w-4 h-4 text-stone-400 absolute left-2.5 top-3" />
                  </div>
                  {emailError && <p className="text-2xs text-red-600 font-medium mt-1">{emailError}</p>}
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
                      <span>SENDING RESET LINK...</span>
                    </>
                  ) : (
                    <>
                      <span>SEND RESET LINK</span>
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
export default ResellerFgtPass;
