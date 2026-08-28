'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import supabase from '@/src/api/client';
import useAuth from '@/src/hooks/useAuth';

interface UserLoginProps {
  onLoginSuccess: () => void;
  onNavigateSignup: () => void;
  onNavigateHome: () => void;
}

export const UserLogin: React.FC<UserLoginProps> = ({
  onLoginSuccess,
  onNavigateSignup,
  onNavigateHome,
}) => {
  const { user, refetchProfile } = useAuth();
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
          setErrorMessage('Invalid email address or password. Please check your details and try again.');
        } else if (msg.toLowerCase().includes('email not confirmed')) {
          setErrorMessage('Your email address has not been verified yet. Please check your inbox.');
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
    <div className="bg-white min-h-screen text-stone-900 pb-20 animate-fade-in w-full font-sans">
      {/* Top Header / Breadcrumb
      <div className="bg-stone-50 border-b border-stone-200 py-3 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-medium text-stone-500 uppercase tracking-wider">
          <button onClick={onNavigateHome} className="hover:text-stone-900 transition-colors">
            Home
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-stone-900 font-bold">Login</span>
        </div>
      </div> */}

      <div className="max-w-md mx-auto px-4 pt-10 sm:pt-14">
        {/* Form Container */}
        <div className="w-full">
          <h1 className="text-2xl sm:text-3xl font-light text-center text-stone-900 mb-8 tracking-wide">
            Login
          </h1>

          {errorMessage && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2.5 text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                onBlur={() => {
                  const err = validateField('email', email);
                  setErrors((prev) => ({ ...prev, email: err }));
                }}
                className={`w-full px-4 py-3 border text-sm rounded-md focus:outline-none transition-colors ${errors.email
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-stone-300 focus:border-stone-900'
                  }`}
              />
              {errors.email && (
                <p className="text-xs text-red-600 font-medium mt-1 ml-1">{errors.email}</p>
              )}
            </div>

            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                onBlur={() => {
                  const err = validateField('password', password);
                  setErrors((prev) => ({ ...prev, password: err }));
                }}
                className={`w-full px-4 py-3 border text-sm rounded-md focus:outline-none transition-colors ${errors.password
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-stone-300 focus:border-stone-900'
                  }`}
              />
              {errors.password && (
                <p className="text-xs text-red-600 font-medium mt-1 ml-1">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-stone-950 hover:bg-black disabled:bg-stone-500 text-white text-sm font-semibold rounded-md shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer mt-6"
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

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setErrorMessage('Social login with Google requires OAuth configuration in your Supabase dashboard.');
              }}
              className="w-full py-3 border border-stone-300 rounded-md flex items-center justify-center space-x-3 text-sm font-bold text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer"
            >
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
              <span>Login with Google</span>
            </button>

          
          </div>

          <div className="mt-8 text-center text-xs text-stone-600">
            <span>Don't have an account? </span>
            <button
              type="button"
              onClick={onNavigateSignup}
              className="font-bold text-stone-900 underline hover:text-black ml-1 cursor-pointer"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
