'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Store, ArrowRight, CheckCircle2, User, Mail, Lock, AlertCircle, Loader2, FileText, Upload, X, ShieldCheck } from 'lucide-react';
import supabase from '@/src/api/client';
import { useAuth } from '@/src/hooks/useAuth';
import { Navbar } from '@/components/Navbar';
import { useApp } from '@/components/context/AppContext';

interface ResellerSignupProps {
  onSignupSuccess: () => void;
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
}

/**
 * Formats raw numeric input into Pakistani CNIC format: XXXXX-XXXXXXX-X (max 13 digits)
 */
export function formatCnic(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/**
 * Extracts clean 13-digit CNIC string without hyphens
 */
export function getCleanCnic(input: string): string {
  return input.replace(/\D/g, '').slice(0, 13);
}

/**
 * Formats phone input into +92 XXX XXXXXXX format
 */
export function formatPhone(input: string): string {
  let digits = input.replace(/\D/g, '');

  // Handle user typing or pasting with 92 or leading 0
  if (digits.startsWith('92')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, 10);

  if (digits.length === 0) return '+92 ';
  if (digits.length <= 3) return `+92 ${digits}`;
  return `+92 ${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/**
 * Extracts 10-digit phone string after +92
 */
export function getCleanPhoneDigits(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('92')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/**
 * Converts Supabase/Postgres technical errors into human-readable user messages
 */
function parseSupabaseError(err: any): string {
  if (!err) return 'An unexpected error occurred. Please try again.';

  const message = (err.message || err.error_description || String(err)).toLowerCase();
  const details = (err.details || '').toLowerCase();

  if (message.includes('already registered') || message.includes('already in use') || err.status === 422) {
    return 'An account with this email address already exists. Please log in instead.';
  }

  if (message.includes('cnic') || details.includes('cnic') || message.includes('sellers_cnic_key')) {
    return 'A seller account with this CNIC number is already registered.';
  }

  if (message.includes('phone') || details.includes('phone') || message.includes('sellers_phone_key')) {
    return 'This phone number is already registered with another seller account.';
  }

  if (message.includes('password') && message.includes('short')) {
    return 'Password must be at least 6 characters long.';
  }

  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return 'Unable to connect to server. Please check your internet connection and try again.';
  }

  return err.message || 'Registration failed. Please check your information and try again.';
}

export const ResellerSignup: React.FC<ResellerSignupProps> = ({
  onSignupSuccess,
  onNavigateLogin,
  onNavigateHome,
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

  const [formData, setFormData] = useState({
    fullName: '',
    shopName: '',
    cnic: '',
    phone: '+92 ',
    city: '',
    address: '',
    agreedToTerms: false,
  });

  const [cnicFrontFile, setCnicFrontFile] = useState<File | null>(null);
  const [cnicBackFile, setCnicBackFile] = useState<File | null>(null);

  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      onSignupSuccess();
    }
  }, [user, onSignupSuccess]);

  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'email':
        if (!email || !email.trim()) return 'Email address is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          return 'Please enter a valid email address.';
        }
        return '';
      case 'password':
        if (!password) return 'Password is required.';
        if (password.length < 6) return 'Password must be at least 6 characters long.';
        return '';
      case 'fullName':
        if (!value || !value.trim()) return 'Full Name is required.';
        if (!/^[a-zA-Z\s'.]{2,60}$/.test(value.trim())) {
          return 'Please enter a valid full name (letters and spaces only).';
        }
        return '';
      case 'shopName':
        if (!value || !value.trim()) return 'Shop name is required.';
        if (value.trim().length < 2) return 'Shop name must be at least 2 characters.';
        return '';
      case 'cnic': {
        const digits = getCleanCnic(value);
        if (!digits) return 'CNIC number is required.';
        if (digits.length !== 13) return 'CNIC must be exactly 13 digits (e.g. 35202-1234567-1).';
        return '';
      }
      case 'phone': {
        const digits = getCleanPhoneDigits(value);
        if (!digits) return 'Phone number is required.';
        if (digits.length !== 10) return 'Please enter a valid 10-digit mobile number (e.g. +92 300 1234567).';
        return '';
      }
      case 'city':
        if (!value || !value.trim()) return 'City is required.';
        return '';
      case 'address':
        if (!value || !value.trim()) return 'Warehouse / Shop address is required.';
        if (value.trim().length < 5) return 'Please enter a complete address (min 5 characters).';
        return '';
      case 'cnicFront':
        if (!value) return 'CNIC Front Image is required.';
        if (!(value instanceof File) || !value.type.startsWith('image/')) {
          return 'Please upload a valid image file (PNG, JPG, WEBP).';
        }
        if (value.size > 5 * 1024 * 1024) return 'CNIC Front image must be under 5MB.';
        return '';
      case 'cnicBack':
        if (!value) return 'CNIC Back Image is required.';
        if (!(value instanceof File) || !value.type.startsWith('image/')) {
          return 'Please upload a valid image file (PNG, JPG, WEBP).';
        }
        if (value.size > 5 * 1024 * 1024) return 'CNIC Back image must be under 5MB.';
        return '';
      case 'agreedToTerms':
        if (!value) return 'You must agree to the seller terms to register.';
        return '';
      default:
        return '';
    }
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {
      email: validateField('email', email),
      password: validateField('password', password),
      fullName: validateField('fullName', formData.fullName),
      shopName: validateField('shopName', formData.shopName),
      cnic: validateField('cnic', formData.cnic),
      phone: validateField('phone', formData.phone),
      city: validateField('city', formData.city),
      address: validateField('address', formData.address),
      cnicFront: validateField('cnicFront', cnicFrontFile),
      cnicBack: validateField('cnicBack', cnicBackFile),
      agreedToTerms: validateField('agreedToTerms', formData.agreedToTerms),
    };

    const filteredErrors: Record<string, string> = {};
    Object.keys(newErrors).forEach((key) => {
      if (newErrors[key]) {
        filteredErrors[key] = newErrors[key];
      }
    });

    setErrors(filteredErrors);
    return Object.keys(filteredErrors).length === 0;
  };

  const uploadCnicFile = async (file: File, side: 'front' | 'back', userId: string): Promise<string> => {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${userId}/cnic_${side}_${Date.now()}_${cleanFileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cnic')
      .upload(filePath, file, { upsert: true, cacheControl: '3600' });

    if (uploadError) {
      console.error(`CNIC ${side} image upload error:`, uploadError);
      throw new Error(`Failed to upload CNIC ${side} image: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('cnic')
      .getPublicUrl(uploadData?.path || filePath);

    return publicUrlData?.publicUrl || uploadData?.path || filePath;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Frontend validation check (includes CNIC Front + Back required files)
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
      // 2. Supabase Auth Signup
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        console.error('Supabase signup error:', authError);
        const userFriendlyMsg = parseSupabaseError(authError);
        setErrorMessage(userFriendlyMsg);

        if (userFriendlyMsg.includes('already registered')) {
          setErrors((prev) => ({ ...prev, email: 'Email is already registered.' }));
        }

        setLoading(false);
        return;
      }

      const authUser = authData.user;
      if (!authUser) {
        setErrorMessage('User authentication failed. No user record was returned by Supabase.');
        setLoading(false);
        return;
      }

      // 3. Upload CNIC Front and Back images to Supabase Storage bucket 'cnic-documents' in parallel
      let frontUrl = '';
      let backUrl = '';

      try {
        const [fUrl, bUrl] = await Promise.all([
          uploadCnicFile(cnicFrontFile!, 'front', authUser.id),
          uploadCnicFile(cnicBackFile!, 'back', authUser.id),
        ]);
        frontUrl = fUrl;
        backUrl = bUrl;
      } catch (uploadErr: any) {
        console.error('CNIC Document upload error:', uploadErr);
        setErrorMessage(uploadErr.message || 'Failed to upload CNIC identity verification images. Please try again.');
        setLoading(false);
        return;
      }

      // 4. Insert/upsert seller profile once with all seller data + persistent CNIC URLs
      const formattedCnic = formData.cnic.trim();
      const formattedPhone = formData.phone.trim();

      const { error: profileError } = await supabase
        .from('sellers')
        .upsert({
          id: authUser.id,
          email: authUser.email || email.trim(),
          full_name: formData.fullName.trim(),
          shop_name: formData.shopName.trim(),
          cnic: formattedCnic,
          phone: formattedPhone,
          city: formData.city.trim(),
          address: formData.address.trim(),
          cnic_img_front: frontUrl,
          cnic_img_back: backUrl,
          bank_name: null,
          account_title: null,
          iban: null,
          status: 'Active',
          created_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error('Reseller database profile insert error:', profileError);
        setErrorMessage(parseSupabaseError(profileError));
        setLoading(false);
        return;
      }

      await refetchProfile();
      setLoading(false);
      onSignupSuccess();
    } catch (err: any) {
      console.error('Unexpected signup error:', err);
      setErrorMessage(parseSupabaseError(err));
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
        {/* Banner Header */}
        <div className="bg-stone-900 text-white rounded-lg p-8 mb-8 text-center shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
          <span className="text-2xs font-bold tracking-[0.3em] uppercase text-amber-400 block mb-2">
            ZEBAISH SELLER PARTNERS
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-script mb-3">
            Monetize Brand Surplus & Factory Leftovers
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 max-w-xl mx-auto leading-relaxed">
            Join 350+ verified Pakistani boutique sellers liquidating authentic Khaadi, Sapphire, Maria B, and Gul Ahmed leftover stock to nationwide.
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
              <span>Register</span>
            </h2>
            <span className="text-xs text-stone-500">
              Already a seller?{' '}
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

          <form onSubmit={handleSubmit} className="space-y-6 text-xs" noValidate>
            {/* Account Credentials */}
            <div className="space-y-4">
              <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs border-b border-stone-100 pb-2 flex items-center space-x-2">
                <Mail className="w-4 h-4 text-stone-500" />
                <span>1. Account Credentials</span>
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
                  <label className="font-semibold text-stone-700 block mb-1">
                    Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="At least 6 characters"
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

            {/* Personal & Business Info */}
            <div className="space-y-4 pt-2">
              <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs border-b border-stone-100 pb-2 flex items-center space-x-2">
                <User className="w-4 h-4 text-stone-500" />
                <span>2. Personal & Business Details</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ali Raza"
                    value={formData.fullName}
                    onChange={(e) => {
                      setFormData({ ...formData, fullName: e.target.value });
                      if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                    }}
                    onBlur={() => {
                      const err = validateField('fullName', formData.fullName);
                      setErrors((prev) => ({ ...prev, fullName: err }));
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${errors.fullName ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                      }`}
                  />
                  {errors.fullName && <p className="text-xs text-red-600 font-medium mt-1">{errors.fullName}</p>}
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Business / Shop Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="The Clothing Studio"
                    value={formData.shopName}
                    onChange={(e) => {
                      setFormData({ ...formData, shopName: e.target.value });
                      if (errors.shopName) setErrors((prev) => ({ ...prev, shopName: '' }));
                    }}
                    onBlur={() => {
                      const err = validateField('shopName', formData.shopName);
                      setErrors((prev) => ({ ...prev, shopName: err }));
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${errors.shopName ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                      }`}
                  />
                  {errors.shopName && <p className="text-xs text-red-600 font-medium mt-1">{errors.shopName}</p>}
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    CNIC / National ID Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    placeholder="35202-XXXXXXX-X"
                    value={formData.cnic}
                    onChange={(e) => {
                      const formatted = formatCnic(e.target.value);
                      setFormData({ ...formData, cnic: formatted });
                      if (errors.cnic) setErrors((prev) => ({ ...prev, cnic: '' }));
                    }}
                    onBlur={() => {
                      const err = validateField('cnic', formData.cnic);
                      setErrors((prev) => ({ ...prev, cnic: err }));
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${errors.cnic ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                      }`}
                  />
                  {errors.cnic && <p className="text-xs text-red-600 font-medium mt-1">{errors.cnic}</p>}
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Phone Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+92 300 1234567"
                    value={formData.phone}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setFormData({ ...formData, phone: formatted });
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                    onBlur={() => {
                      const err = validateField('phone', formData.phone);
                      setErrors((prev) => ({ ...prev, phone: err }));
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${errors.phone ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                      }`}
                  />
                  {errors.phone && <p className="text-xs text-red-600 font-medium mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    City <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Lahore"
                    value={formData.city}
                    onChange={(e) => {
                      setFormData({ ...formData, city: e.target.value });
                      if (errors.city) setErrors((prev) => ({ ...prev, city: '' }));
                    }}
                    onBlur={() => {
                      const err = validateField('city', formData.city);
                      setErrors((prev) => ({ ...prev, city: err }));
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${errors.city ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                      }`}
                  />
                  {errors.city && <p className="text-xs text-red-600 font-medium mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Warehouse / Shop Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Shop #12, Liberty Market, Gulberg III"
                    value={formData.address}
                    onChange={(e) => {
                      setFormData({ ...formData, address: e.target.value });
                      if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
                    }}
                    onBlur={() => {
                      const err = validateField('address', formData.address);
                      setErrors((prev) => ({ ...prev, address: err }));
                    }}
                    className={`w-full p-2.5 border rounded-xs focus:outline-none ${errors.address ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                      }`}
                  />
                  {errors.address && <p className="text-xs text-red-600 font-medium mt-1">{errors.address}</p>}
                </div>
              </div>
            </div>

            {/* 3. CNIC Identity Verification */}
            <div className="space-y-4 pt-2">
              <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs border-b border-stone-100 pb-2 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-stone-500" />
                <span>3. CNIC Identity Verification</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* CNIC Front Image Upload */}
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    CNIC Front Image <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="file"
                    ref={frontInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setCnicFrontFile(file);
                      if (errors.cnicFront) {
                        const err = validateField('cnicFront', file);
                        setErrors((prev) => ({ ...prev, cnicFront: err }));
                      }
                    }}
                  />
                  {cnicFrontFile ? (
                    <div className="w-full min-h-[42px] px-3 py-2 border border-emerald-300 bg-emerald-50/60 rounded-xs flex items-center justify-between text-xs transition-colors">
                      <div className="flex items-center space-x-2 min-w-0 pr-2">
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate font-medium text-stone-900">{cnicFrontFile.name}</span>
                        <span className="text-stone-400 text-2xs shrink-0">({(cnicFrontFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCnicFrontFile(null);
                          if (frontInputRef.current) frontInputRef.current.value = '';
                        }}
                        className="text-stone-400 hover:text-red-600 p-1 rounded transition-colors shrink-0 cursor-pointer"
                        title="Remove CNIC Front Image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => frontInputRef.current?.click()}
                      className={`w-full min-h-[42px] px-3 py-2.5 border rounded-xs text-xs flex items-center justify-between transition-colors bg-white hover:bg-stone-50 cursor-pointer ${errors.cnicFront ? 'border-red-500 text-red-700' : 'border-stone-300 text-stone-500'
                        }`}
                    >
                      <span className="truncate">Choose CNIC Front Image...</span>
                      <Upload className="w-4 h-4 text-stone-400 shrink-0 ml-2" />
                    </button>
                  )}
                  {errors.cnicFront && <p className="text-xs text-red-600 font-medium mt-1">{errors.cnicFront}</p>}
                </div>

                {/* CNIC Back Image Upload */}
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    CNIC Back Image <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="file"
                    ref={backInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setCnicBackFile(file);
                      if (errors.cnicBack) {
                        const err = validateField('cnicBack', file);
                        setErrors((prev) => ({ ...prev, cnicBack: err }));
                      }
                    }}
                  />
                  {cnicBackFile ? (
                    <div className="w-full min-h-[42px] px-3 py-2 border border-emerald-300 bg-emerald-50/60 rounded-xs flex items-center justify-between text-xs transition-colors">
                      <div className="flex items-center space-x-2 min-w-0 pr-2">
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate font-medium text-stone-900">{cnicBackFile.name}</span>
                        <span className="text-stone-400 text-2xs shrink-0">({(cnicBackFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCnicBackFile(null);
                          if (backInputRef.current) backInputRef.current.value = '';
                        }}
                        className="text-stone-400 hover:text-red-600 p-1 rounded transition-colors shrink-0 cursor-pointer"
                        title="Remove CNIC Back Image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => backInputRef.current?.click()}
                      className={`w-full min-h-[42px] px-3 py-2.5 border rounded-xs text-xs flex items-center justify-between transition-colors bg-white hover:bg-stone-50 cursor-pointer ${errors.cnicBack ? 'border-red-500 text-red-700' : 'border-stone-300 text-stone-500'
                        }`}
                    >
                      <span className="truncate">Choose CNIC Back Image...</span>
                      <Upload className="w-4 h-4 text-stone-400 shrink-0 ml-2" />
                    </button>
                  )}
                  {errors.cnicBack && <p className="text-xs text-red-600 font-medium mt-1">{errors.cnicBack}</p>}
                </div>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="pt-2">
              <label className="flex items-start space-x-2 cursor-pointer text-stone-700">
                <input
                  type="checkbox"
                  required
                  checked={formData.agreedToTerms}
                  onChange={(e) => {
                    setFormData({ ...formData, agreedToTerms: e.target.checked });
                    if (errors.agreedToTerms) setErrors((prev) => ({ ...prev, agreedToTerms: '' }));
                  }}
                  className="mt-0.5 w-4 h-4 accent-black cursor-pointer"
                />
                <span>
                  I accept this{' '}
                  <Link
                    href="/privacy-policy"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-900 hover:text-black"
                  >
                    Privacy Policy
                  </Link>{' '}
                  and Terms & Conditions
                </span>
              </label>
              {errors.agreedToTerms && <p className="text-xs text-red-600 font-medium mt-1">{errors.agreedToTerms}</p>}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-stone-900 hover:bg-black disabled:bg-stone-500 text-white text-xs font-bold uppercase tracking-widest rounded-xs shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>CREATING SELLER ACCOUNT...</span>
                  </>
                ) : (
                  <>
                    <span>REGISTER NOW</span>
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

export default ResellerSignup;
