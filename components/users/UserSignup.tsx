'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import supabase from '@/src/api/client';
import useAuth from '@/src/hooks/useAuth';

interface UserSignupProps {
  onSignupSuccess: () => void;
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
}

export const UserSignup: React.FC<UserSignupProps> = ({
  onSignupSuccess,
  onNavigateLogin,
  onNavigateHome,
}) => {
  const { user, refetchProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      onSignupSuccess();
    }
  }, [user, onSignupSuccess]);

  const validateField = (name: string, value: string): string => {
    const trimmed = value.trim();
    if (name === 'firstName') {
      if (!trimmed) return 'First name is required.';
    }
    if (name === 'lastName') {
      if (!trimmed) return 'Last name is required.';
    }
    if (name === 'phoneNo') {
      if (!trimmed) return 'Phone number is required.';
      if (!/^[0-9+\-\s()]{7,20}$/.test(trimmed)) {
        return 'Please enter a valid phone number.';
      }
    }
    if (name === 'email') {
      if (!trimmed) return 'Email address is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return 'Please enter a valid email address.';
      }
    }
    if (name === 'password') {
      if (!value) return 'Password is required.';
      if (value.length < 6) {
        return 'Password must be at least 6 characters.';
      }
    }
    return '';
  };

  const validateAll = (): boolean => {
    const fnErr = validateField('firstName', firstName);
    const lnErr = validateField('lastName', lastName);
    const phoneErr = validateField('phoneNo', phoneNo);
    const emailErr = validateField('email', email);
    const passErr = validateField('password', password);

    const newErrors: Record<string, string> = {};
    if (fnErr) newErrors.firstName = fnErr;
    if (lnErr) newErrors.lastName = lnErr;
    if (phoneErr) newErrors.phoneNo = phoneErr;
    if (emailErr) newErrors.email = emailErr;
    if (passErr) newErrors.password = passErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateAll()) {
      setErrorMessage('Please fix the errors before creating your account.');
      return;
    }

    setLoading(true);

    try {
      // 1. Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone_no: phoneNo.trim(),
          },
        },
      });

      if (authError) {
        console.error('Supabase signup error:', authError);
        setErrorMessage(authError.message || 'Failed to create account. Please try again.');
        setLoading(false);
        return;
      }

      const createdUser = authData?.user;

      if (createdUser) {
        // 2. Insert into public.users table
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: createdUser.id,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim(),
              phone_no: phoneNo.trim(),
            },
          ]);

        if (profileError) {
          console.warn('Profile insertion warning:', profileError.message);
        }

        await refetchProfile();
      }

      setLoading(false);
      onSignupSuccess();
    } catch (err: any) {
      console.error('Unexpected signup error:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred during signup.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen text-stone-900 pb-20 animate-fade-in w-full font-sans">
      

      <div className="max-w-md mx-auto px-4 pt-10 sm:pt-14">
        {/* Form Container */}
        <div className="w-full">
          <h1 className="text-2xl sm:text-3xl font-light text-center text-stone-900 mb-8 tracking-wide">
            Create account
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
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: '' }));
                }}
                onBlur={() => {
                  const err = validateField('firstName', firstName);
                  setErrors((prev) => ({ ...prev, firstName: err }));
                }}
                className={`w-full px-4 py-3 border text-sm rounded-md focus:outline-none transition-colors ${errors.firstName
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-stone-300 focus:border-stone-900'
                  }`}
              />
              {errors.firstName && (
                <p className="text-2xs text-red-600 font-medium mt-1 ml-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: '' }));
                }}
                onBlur={() => {
                  const err = validateField('lastName', lastName);
                  setErrors((prev) => ({ ...prev, lastName: err }));
                }}
                className={`w-full px-4 py-3 border text-sm rounded-md focus:outline-none transition-colors ${errors.lastName
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-stone-300 focus:border-stone-900'
                  }`}
              />
              {errors.lastName && (
                <p className="text-2xs text-red-600 font-medium mt-1 ml-1">{errors.lastName}</p>
              )}
            </div>

            <div>
              <input
                type="tel"
                placeholder="Phone Number (+923001234567)"
                value={phoneNo}
                onChange={(e) => {
                  setPhoneNo(e.target.value);
                  if (errors.phoneNo) setErrors((prev) => ({ ...prev, phoneNo: '' }));
                }}
                onBlur={() => {
                  const err = validateField('phoneNo', phoneNo);
                  setErrors((prev) => ({ ...prev, phoneNo: err }));
                }}
                className={`w-full px-4 py-3 border text-sm rounded-md focus:outline-none transition-colors ${errors.phoneNo
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-stone-300 focus:border-stone-900'
                  }`}
              />
              {errors.phoneNo && (
                <p className="text-2xs text-red-600 font-medium mt-1 ml-1">{errors.phoneNo}</p>
              )}
            </div>

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
                <p className="text-2xs text-red-600 font-medium mt-1 ml-1">{errors.email}</p>
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
                <p className="text-2xs text-red-600 font-medium mt-1 ml-1">{errors.password}</p>
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create</span>
              )}
            </button>
          </form>

          {/* Social Dividers & Options matching reference screenshot */}
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
              <span>Sign up with Google</span>
            </button>

            
          </div>

          <div className="mt-8 text-center text-xs text-stone-600">
            <span>Already have an account? </span>
            <button
              type="button"
              onClick={onNavigateLogin}
              className="font-bold text-stone-900 underline hover:text-black ml-1 cursor-pointer"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
