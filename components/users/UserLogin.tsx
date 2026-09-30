'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Store, UserPlus, Lock, Mail } from 'lucide-react';
import supabase from '@/src/api/client';
import useAuth from '@/src/hooks/useAuth';

interface UserLoginProps {
  onLoginSuccess: () => void;
  onNavigateUserSignup?: () => void;
  onNavigateResellerSignup?: () => void;
  onNavigateSignup?: () => void;
  onNavigateHome: () => void;
  onNavigateForgotPass?: () => void;
}

export const UserLogin: React.FC<UserLoginProps> = ({
  onLoginSuccess,
  onNavigateUserSignup,
  onNavigateResellerSignup,
  onNavigateSignup,
  onNavigateHome,
  onNavigateForgotPass,
}) => {
  const router = useRouter();
  const { user, role, sellerStatus, resellerProfile, refetchProfile, logout } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      onLoginSuccess();
    }
  }, [user, onLoginSuccess]);

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectTo = `${origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google login error:', error);
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('provider is not enabled') || msg.includes('unsupported provider') || msg.includes('disabled')) {
          setErrorMessage('Google Authentication is not enabled yet in your Supabase Dashboard. Go to Supabase Dashboard -> Authentication -> Providers -> Google and toggle it ON.');
        } else {
          setErrorMessage(error.message || 'Failed to connect with Google. Please try again.');
        }
        setGoogleLoading(false);
      }
    } catch (err: any) {
      console.error('Unexpected Google login error:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred during Google login.');
      setGoogleLoading(false);
    }
  };

  const validateField = (name: string, value: string): string => {
    const trimmed = value.trim();
    if (name === 'email') {
      if (!trimmed) return 'Email address is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
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
    const passErr = validateField('password', password);

    const newErrors: Record<string, string> = {};
    if (emailErr) newErrors.email = emailErr;
    if (passErr) newErrors.password = passErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateAll()) {
      setErrorMessage('Please enter a valid email and password.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Supabase login error:', error);
        const msg = error.message || '';
        if (msg.toLowerCase().includes('invalid login credentials') || error.status === 400) {
          setErrorMessage('Invalid credentials.');
        } else if (msg.toLowerCase().includes('email not confirmed')) {
          setErrorMessage('Your email address has not been verified yet. Please check your inbox for the confirmation link.');
        } else {
          setErrorMessage(error.message || 'Authentication failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      if (data?.user) {
        const profileData = await refetchProfile(data.user);

        if (profileData.role === 'seller') {
          const status = (profileData.sellerStatus || profileData.resellerProfile?.status || 'active').toLowerCase();
          if (status === 'suspended') {
            setErrorMessage('Your seller account is currently suspended. Please contact support at help@zebaish.com.');
            await logout();
            setLoading(false);
            return;
          }
          if (status === 'inactive') {
            setErrorMessage('Your seller account is currently inactive. Please contact support.');
            await logout();
            setLoading(false);
            return;
          }
          setLoading(false);
          router.replace('/dashboard');
          return;
        } else {
          setLoading(false);
          router.replace('/account');
          return;
        }
      }

      setLoading(false);
      onLoginSuccess();
    } catch (err: any) {
      console.error('Unexpected login error:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred during login.');
      setLoading(false);
    }
  };

  const handleForgotPassClick = () => {
    if (onNavigateForgotPass) {
      onNavigateForgotPass();
    } else {
      router.push('/reseller/forgot-password');
    }
  };

  const handleUserSignupClick = () => {
    if (onNavigateUserSignup) {
      onNavigateUserSignup();
    } else if (onNavigateSignup) {
      onNavigateSignup();
    } else {
      router.push('/signup');
    }
  };

  const handleResellerSignupClick = () => {
    if (onNavigateResellerSignup) {
      onNavigateResellerSignup();
    } else {
      router.push('/reseller/signup');
    }
  };

  return (
    <div className="bg-white min-h-screen text-stone-900 pb-20 animate-fade-in w-full font-sans">
      <div className="max-w-md mx-auto px-4 pt-10 sm:pt-14">
        {/* Form Container */}
        <div className="w-full">
          <h1 className="text-lg sm:text-2xl lg:text-2xl font-light text-center text-stone-900 mb-2 tracking-wide">
            Login
          </h1>
         

          {errorMessage && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2.5 text-[10px] sm:text-xs text-red-700 font-medium animate-shake">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Email</label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  onBlur={() => {
                    const err = validateField('email', email);
                    setErrors((prev) => ({ ...prev, email: err }));
                  }}
                  className={`w-full px-4 py-3 pl-10 border text-xs sm:text-sm rounded-md focus:outline-none transition-colors ${errors.email
                      ? 'border-red-500 focus:border-red-600'
                      : 'border-stone-300 focus:border-stone-900'
                    }`}
                />
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
              </div>
              {errors.email && (
                <p className="text-xs text-red-600 font-medium mt-1 ml-1">{errors.email}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-stone-700">Password</label>
                
              </div>
              <div className="relative">
                <input
                  type="password"
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
                  className={`w-full px-4 py-3 pl-10 border text-xs sm:text-sm rounded-md focus:outline-none transition-colors ${errors.password
                      ? 'border-red-500 focus:border-red-600'
                      : 'border-stone-300 focus:border-stone-900'
                    }`}
                />
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
              </div>
              <button
  type="button"
  onClick={handleForgotPassClick}
  className="block w-full text-right text-xs text-stone-500 hover:text-stone-900 hover:underline cursor-pointer mt-1"
>
  Forgot password?
</button>
              {errors.password && (
                <p className="text-xs text-red-600 font-medium mt-1 ml-1">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-stone-950 hover:bg-black disabled:bg-stone-500 text-white text-xs font-bold uppercase tracking-wider rounded-md shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          {/* Social Dividers & Options */}
          <div className="relative my-8 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <span className="relative bg-white px-3 text-xs text-stone-400 font-medium uppercase tracking-wider">
              OR
            </span>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              disabled={loading || googleLoading}
              onClick={handleGoogleLogin}
              className="w-full py-3 border border-stone-300 rounded-md flex items-center justify-center space-x-3 text-xs sm:text-sm font-bold text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-stone-700" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.14C3.25 21.27 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.59H1.27C.46 8.21 0 10.05 0 12s.46 3.79 1.27 5.41l4.01-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.73 1.27 6.59l4.01 3.14c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Separate Signup Options */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleUserSignupClick}
                className="w-full py-3 border border-stone-300 rounded-md flex items-center justify-center space-x-3 text-xs sm:text-sm font-bold text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                <UserPlus className="w-5 h-5 text-stone-700" />
                <span>Sign Up as Customer</span>
              </button>

              <button
                type="button"
                onClick={handleResellerSignupClick}
                className="w-full py-3 bg-amber-400 hover:bg-amber-300 border border-amber-500 text-stone-950 rounded-md flex items-center justify-center space-x-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
              >
                <Store className="w-5 h-5 text-stone-950" />
                <span>Become a Seller</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
