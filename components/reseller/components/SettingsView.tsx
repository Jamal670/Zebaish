import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import {
  fetchSellerFullProfile,
  updateSellerProfile,
  uploadSellerAvatar,
  updateSellerPassword,
  updateSellerShippingCharges,
  StoreOverviewStats,
} from '@/src/api/sellerProfileService';
import { format$ } from '../data/mockWalletData';
import {
  User,
  ShieldCheck,
  Store,
  Lock,
  Eye,
  EyeOff,
  Upload,
  AlertCircle,
  Loader2,
  Save,
  Package,
  ShoppingBag,
  TrendingUp,
  Star,
  Calendar,
  MapPin,
  Phone,
  Mail,
  FileText,
  KeyRound,
  Check,
  X,
  Truck,
} from 'lucide-react';

export interface SettingsViewProps {
  storeSettings?: any;
  setStoreSettings?: React.Dispatch<React.SetStateAction<any>>;
}

export type ActiveProfileTab = 'profile' | 'security' | 'store';

export const SettingsView: React.FC<SettingsViewProps> = ({ setStoreSettings }) => {
  const { user, resellerProfile, refetchProfile } = useAuth();
  const sellerId = user?.id || resellerProfile?.id || '';

  const [activeTab, setActiveTab] = useState<ActiveProfileTab>('profile');

  const [loading, setLoading] = useState<boolean>(true);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [updatingPassword, setUpdatingPassword] = useState<boolean>(false);
  const [savingShipping, setSavingShipping] = useState<boolean>(false);

  const [stats, setStats] = useState<StoreOverviewStats | null>(null);

  const [originalData, setOriginalData] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    cnic: '',
    city: '',
    address: '',
    shop_name: '',
    bank_name: '',
    account_title: '',
    iban: '',
    avatar_url: '',
    store_image_url: '',
    status: 'Active',
    created_at: '',
  });

  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [passData, setPassData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPass, setShowPass] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Shipping Charges State for Store Overview Tab
  const [shippingChargesInput, setShippingChargesInput] = useState<string>('150');
  const [originalShippingCharges, setOriginalShippingCharges] = useState<number>(150);
  const [shippingError, setShippingError] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passErrors, setPassErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    let isMounted = true;
    if (sellerId) {
      setLoading(true);
      fetchSellerFullProfile(sellerId).then(({ profile, stats }) => {
        if (!isMounted) return;
        const initial = {
          full_name: profile.full_name || '',
          email: profile.email || user?.email || '',
          phone: profile.phone || '',
          cnic: profile.cnic || '35202-1234567-8',
          city: profile.city || '',
          address: profile.address || '',
          shop_name: profile.shop_name || '',
          bank_name: profile.bank_name || '',
          account_title: profile.account_title || '',
          iban: profile.iban || '',
          avatar_url:
            profile.avatar_url ||
            (profile as any).store_image_url ||
            'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png',
          store_image_url:
            (profile as any).store_image_url ||
            profile.avatar_url ||
            'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png',
          status: profile.status || 'Active',
          created_at: profile.created_at || new Date().toISOString(),
        };

        setFormData(initial);
        setOriginalData(initial);
        setAvatarPreview(initial.store_image_url || initial.avatar_url);
        setStats(stats);

        const initialShipping = stats?.shippingCharges ?? (profile.shipping_charges || 150);
        setShippingChargesInput(String(initialShipping));
        setOriginalShippingCharges(initialShipping);
        setLoading(false);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [sellerId, user?.email]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Please select a valid image file (JPG, PNG, WEBP)', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size exceeds 5MB limit', 'error');
      return;
    }

    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  // Status Badge Formatter
  const statusBadge = useMemo(() => {
    const s = (formData.status || '').trim().toLowerCase();
    if (s === 'active') {
      return {
        text: 'Active Seller',
        style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      };
    }
    if (s === 'inactive') {
      return {
        text: 'Inactive Seller',
        style: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      };
    }
    if (s === 'suspended') {
      return {
        text: 'Suspended Seller',
        style: 'bg-red-500/20 text-red-300 border-red-500/40',
      };
    }
    return {
      text: formData.status ? `${formData.status} Seller` : 'Active Seller',
      style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    };
  }, [formData.status]);

  // Is Changed Checks for 3 Tabs
  const isProfileChanged = useMemo(() => {
    if (avatarFile !== null) return true;
    if (!originalData) return false;
    return (
      formData.full_name.trim() !== (originalData.full_name || '').trim() ||
      formData.phone.trim() !== (originalData.phone || '').trim() ||
      formData.city.trim() !== (originalData.city || '').trim() ||
      formData.address.trim() !== (originalData.address || '').trim() ||
      formData.shop_name.trim() !== (originalData.shop_name || '').trim() ||
      formData.bank_name.trim() !== (originalData.bank_name || '').trim() ||
      formData.account_title.trim() !== (originalData.account_title || '').trim() ||
      formData.iban.trim() !== (originalData.iban || '').trim()
    );
  }, [formData, originalData, avatarFile]);

  const isSecurityChanged = useMemo(() => {
    return Boolean(
      passData.currentPassword.trim() &&
      passData.newPassword.trim() &&
      passData.confirmPassword.trim()
    );
  }, [passData]);

  const isStoreChanged = useMemo(() => {
    if (shippingError) return false;
    const num = Number(shippingChargesInput);
    if (isNaN(num) || shippingChargesInput.trim() === '') return false;
    if (num < 0 || num > 500) return false;
    return num !== originalShippingCharges;
  }, [shippingChargesInput, originalShippingCharges, shippingError]);

  const validateProfileForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.full_name.trim()) errs.full_name = 'Full Name is required.';
    if (!formData.phone.trim()) errs.phone = 'Phone Number is required.';
    if (!formData.city.trim()) errs.city = 'City is required.';
    if (!formData.address.trim()) errs.address = 'Warehouse Address is required.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProfileForm()) {
      showToast('Please correct the validation errors in the form.', 'error');
      return;
    }

    setSavingProfile(true);

    try {
      let finalUploadedUrl: string | undefined = undefined;

      if (avatarFile) {
        finalUploadedUrl = await uploadSellerAvatar(sellerId, avatarFile);
      }

      const updatePayload: Record<string, any> = {
        full_name: formData.full_name,
        phone: formData.phone,
        city: formData.city,
        address: formData.address,
        shop_name: formData.shop_name,
        bank_name: formData.bank_name,
        account_title: formData.account_title,
        iban: formData.iban,
      };

      if (finalUploadedUrl) {
        updatePayload.store_image_url = finalUploadedUrl;
      }

      const result = await updateSellerProfile(sellerId, updatePayload as any);

      if (!result.success) {
        showToast(result.error || 'Failed to update profile.', 'error');
        setSavingProfile(false);
        return;
      }

      const updatedState = {
        ...formData,
        ...(finalUploadedUrl ? { avatar_url: finalUploadedUrl, store_image_url: finalUploadedUrl } : {}),
      };
      setFormData(updatedState);
      setOriginalData(updatedState);
      setAvatarFile(null);
      setSavingProfile(false);

      if (setStoreSettings) {
        setStoreSettings((prev: any) => ({
          ...prev,
          storeName: formData.shop_name,
          ...(finalUploadedUrl ? { storeImageUrl: finalUploadedUrl, logoUrl: finalUploadedUrl } : {}),
          warehouseAddress: formData.address,
          iban: formData.iban,
        }));
      }

      refetchProfile();
      showToast('Seller Profile & Business Information updated successfully!');
    } catch (err: any) {
      console.error('Save profile error:', err);
      showToast(err?.message || 'Failed to update profile. Please try again.', 'error');
      setSavingProfile(false);
    }
  };

  const validatePasswordForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!passData.currentPassword) errs.currentPassword = 'Current password is required.';
    if (!passData.newPassword) {
      errs.newPassword = 'New password is required.';
    } else if (passData.newPassword.length < 6) {
      errs.newPassword = 'New password must be at least 6 characters.';
    }
    if (!passData.confirmPassword) {
      errs.confirmPassword = 'Please confirm your new password.';
    } else if (passData.newPassword !== passData.confirmPassword) {
      errs.confirmPassword = 'New password and confirm password do not match.';
    }

    setPassErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleUpdatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;

    setUpdatingPassword(true);

    try {
      const res = await updateSellerPassword(passData.currentPassword, passData.newPassword);

      if (!res.success) {
        setPassErrors({ currentPassword: res.error || 'Password update failed.' });
        showToast(res.error || 'Failed to update password.', 'error');
        setUpdatingPassword(false);
        return;
      }

      setUpdatingPassword(false);
      setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPassErrors({});
      showToast('Security Password updated successfully!');
    } catch (err: any) {
      console.error('Password update error:', err);
      showToast(err?.message || 'Failed to update password.', 'error');
      setUpdatingPassword(false);
    }
  };

  const handleShippingChange = (val: string) => {
    setShippingChargesInput(val);
    if (val.trim() === '') {
      setShippingError('Shipping charges are required.');
      return;
    }
    const num = Number(val);
    if (isNaN(num)) {
      setShippingError('Shipping charges must be a valid number.');
      return;
    }
    if (num < 0 || num > 500) {
      setShippingError('Shipping charges must be between 0 and 500 PKR.');
      return;
    }
    setShippingError(null);
  };

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(shippingChargesInput);
    if (isNaN(num) || num < 0 || num > 500) {
      setShippingError('Shipping charges must be between 0 and 500 PKR.');
      return;
    }

    setSavingShipping(true);
    try {
      const res = await updateSellerShippingCharges(sellerId, num);
      if (!res.success) {
        showToast(res.error || 'Failed to update shipping charges.', 'error');
        setSavingShipping(false);
        return;
      }

      setOriginalShippingCharges(num);
      setSavingShipping(false);
      showToast('Shipping Charges updated successfully!');
    } catch (err: any) {
      console.error('Error saving shipping charges:', err);
      showToast(err?.message || 'Failed to update shipping charges.', 'error');
      setSavingShipping(false);
    }
  };

  return (
    <div className="space-y-6 max-w-8xl mx-auto pb-12 animate-fade-in text-stone-800">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 text-white text-xs font-semibold px-5 py-3.5 rounded-xl shadow-2xl flex items-center space-x-3 border animate-slide-up ${toastType === 'error'
              ? 'bg-red-900 border-red-800'
              : 'bg-stone-900 border-stone-800'
            }`}
        >
          <span
            className={`p-1 rounded-full ${toastType === 'error' ? 'bg-red-700 text-red-100' : 'bg-emerald-500/20 text-emerald-400'
              }`}
          >
            {toastType === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          </span>
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-stone-400 hover:text-white p-1 ml-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP PROFILE SUMMARY CARD */}
      <div className="bg-stone-900 text-white rounded-2xl p-5 sm:p-8 shadow-xl relative overflow-hidden border border-stone-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 relative z-10">
          <div className="relative group shrink-0">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-amber-400/40 shadow-xl bg-stone-800">
              <img
                src={
                  avatarPreview ||
                  formData.avatar_url ||
                  'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/pngtree-store-icon-image_1128274.jpg'
                }
                alt={formData.shop_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/pngtree-store-icon-image_1128274.jpg';
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-amber-400 text-stone-950 rounded-full shadow-lg hover:bg-amber-300 transition-transform transform hover:scale-110 cursor-pointer"
              title="Upload profile picture"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarSelect}
              className="hidden"
            />
          </div>

          <div className="space-y-2 text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-2xs font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded border border-amber-400/20">
                VERIFIED MARKETPLACE SELLER
              </span>

              {/* Status Display: Active Seller / Inactive Seller / Suspended Seller */}
              <span
                className={`text-2xs font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${statusBadge.style}`}
              >
                ✓ {statusBadge.text}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight font-script">
              {formData.shop_name || 'Seller Shop Name'}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-stone-300 flex items-center justify-center sm:justify-start space-x-2">
              <span>{formData.full_name}</span>
              <span className="text-stone-600">•</span>
              <span className="text-xs font-mono text-stone-400">ID: {sellerId.substring(0, 13)}</span>
            </p>

            <div className="pt-1 text-xs text-stone-400 flex flex-wrap justify-center sm:justify-start gap-4 font-medium">
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Member Since:{' '}
                  {new Date(formData.created_at || Date.now()).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </span>
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{formData.city || 'Pakistan'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3-TAB NAVIGATION BAR */}
      <div className="bg-white border border-stone-200 rounded-xl p-1.5 shadow-2xs flex flex-wrap sm:flex-nowrap gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex-1 min-w-[130px] py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer min-h-[40px] ${activeTab === 'profile'
              ? 'bg-stone-900 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
        >
          <User className="w-4 h-4 shrink-0" />
          <span>Profile Info</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex-1 min-w-[130px] py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer min-h-[40px] ${activeTab === 'security'
              ? 'bg-stone-900 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Security</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('store')}
          className={`flex-1 min-w-[130px] py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer min-h-[40px] ${activeTab === 'store'
              ? 'bg-stone-900 text-white shadow-sm'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
        >
          <Store className="w-4 h-4 shrink-0" />
          <span>Store Overview</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6 animate-pulse">
          <div className="h-6 bg-stone-200 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-12 bg-stone-100 rounded" />
            <div className="h-12 bg-stone-100 rounded" />
            <div className="h-12 bg-stone-100 rounded" />
            <div className="h-12 bg-stone-100 rounded" />
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: PROFILE INFORMATION */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xs space-y-5">
                <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-stone-900 flex items-center space-x-2">
                      <User className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Personal & Business Information</span>
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 text-xs sm:text-sm">
                  {/* Full Name */}
                  <div>
                    <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                      Full Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 transition-all min-h-[42px] ${errors.full_name
                          ? 'border-red-400 focus:border-red-600 focus:ring-red-600 bg-red-50/20'
                          : 'border-stone-300 focus:border-stone-900 focus:ring-stone-900 bg-white'
                        }`}
                    />
                    {errors.full_name && <p className="text-xs text-red-600 font-medium mt-1">{errors.full_name}</p>}
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="font-bold text-stone-700 block mb-1 uppercase tracking-wide flex items-center justify-between">
                      <span>Email Address (Read Only)</span>
                      <Lock className="w-3.5 h-3.5 text-stone-400" />
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        disabled
                        readOnly
                        value={formData.email}
                        className="w-full p-3 pl-9 border border-stone-200 rounded-lg bg-stone-100 text-stone-500 font-medium cursor-not-allowed select-none min-h-[42px]"
                      />
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-1">Email cannot be changed directly.</p>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                      Phone Number <span className="text-red-600">*</span>
                    </label>

                    <div className="relative">
                      <input
                        type="text"
                        required
                        readOnly
                        value={formData.phone}
                        className="w-full p-3 pl-9 border border-stone-300 rounded-lg focus:outline-none bg-stone-100 cursor-not-allowed min-h-[42px]"
                      />

                      <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                    </div>

                    {errors.phone && (
                      <p className="text-xs text-red-600 font-medium mt-1">
                        {errors.phone}
                      </p>
                    )}
                  </div>

                  {/* CNIC */}
                  <div>
                    <label className="font-bold text-stone-700 block mb-1 uppercase tracking-wide flex items-center justify-between">
                      <span>CNIC Number (Read Only)</span>
                      <Lock className="w-3.5 h-3.5 text-stone-400" />
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        readOnly
                        value={formData.cnic}
                        className="w-full p-3 pl-9 border border-stone-200 rounded-lg bg-stone-100 text-stone-500 font-mono font-medium cursor-not-allowed select-none min-h-[42px]"
                      />
                      <FileText className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-1">Government identity number linked to seller profile.</p>
                  </div>

                  {/* City */}
                  <div>
                    <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                      City <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className={`w-full p-3 pl-9 border rounded-lg focus:outline-none focus:ring-1 transition-all min-h-[42px] ${errors.city
                            ? 'border-red-400 focus:border-red-600 focus:ring-red-600 bg-red-50/20'
                            : 'border-stone-300 focus:border-stone-900 focus:ring-stone-900 bg-white'
                          }`}
                      />
                      <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                    </div>
                    {errors.city && <p className="text-xs text-red-600 font-medium mt-1">{errors.city}</p>}
                  </div>

                  {/* Shop Name */}
                  <div>
                    <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                      Shop / Store Name
                    </label>
                    <input
                      type="text"
                      value={formData.shop_name}
                      onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                      className="w-full p-3 border border-stone-300 focus:border-stone-900 focus:ring-stone-900 bg-white rounded-lg focus:outline-none focus:ring-1 transition-all min-h-[42px]"
                    />
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2">
                    <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                      Warehouse / Shop Address <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 transition-all leading-relaxed ${errors.address
                          ? 'border-red-400 focus:border-red-600 focus:ring-red-600 bg-red-50/20'
                          : 'border-stone-300 focus:border-stone-900 focus:ring-stone-900 bg-white'
                        }`}
                    />
                    {errors.address && <p className="text-xs text-red-600 font-medium mt-1">{errors.address}</p>}
                  </div>
                </div>
              </div>

              {/* TAB 1 ACTIONS ROW: Save Changes only, disabled when no changes */}
              <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingProfile || !isProfileChanged}
                  className={`px-6 py-2.5 bg-stone-900 text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center space-x-2 min-h-[42px] ${savingProfile || !isProfileChanged
                      ? 'opacity-40 bg-stone-300 text-stone-500 cursor-not-allowed shadow-none border-0'
                      : 'cursor-pointer hover:bg-black text-white'
                    }`}
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-amber-400" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SECURITY */}
          {activeTab === 'security' && (
            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xs space-y-6">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-stone-900 flex items-center space-x-2">
                    <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Change Account Password</span>
                  </h3>
                </div>
              </div>

              <form onSubmit={handleUpdatePasswordSubmit} className="space-y-5 text-xs sm:text-sm max-w-xl">
                <div>
                  <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                    Current Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPass.current ? 'text' : 'password'}
                      required
                      placeholder="Enter current password"
                      value={passData.currentPassword}
                      onChange={(e) => setPassData({ ...passData, currentPassword: e.target.value })}
                      className={`w-full p-3 pr-10 border rounded-lg focus:outline-none focus:ring-1 transition-all min-h-[42px] ${passErrors.currentPassword
                          ? 'border-red-400 focus:border-red-600 focus:ring-red-600 bg-red-50/20'
                          : 'border-stone-300 focus:border-stone-900 focus:ring-stone-900 bg-white'
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass({ ...showPass, current: !showPass.current })}
                      className="absolute right-3 top-3.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showPass.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passErrors.currentPassword && (
                    <p className="text-xs text-red-600 font-medium mt-1">{passErrors.currentPassword}</p>
                  )}
                </div>

                <div>
                  <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                    New Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPass.new ? 'text' : 'password'}
                      required
                      placeholder="Minimum 6 characters"
                      value={passData.newPassword}
                      onChange={(e) => setPassData({ ...passData, newPassword: e.target.value })}
                      className={`w-full p-3 pr-10 border rounded-lg focus:outline-none focus:ring-1 transition-all min-h-[42px] ${passErrors.newPassword
                          ? 'border-red-400 focus:border-red-600 focus:ring-red-600 bg-red-50/20'
                          : 'border-stone-300 focus:border-stone-900 focus:ring-stone-900 bg-white'
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass({ ...showPass, new: !showPass.new })}
                      className="absolute right-3 top-3.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showPass.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passErrors.newPassword && (
                    <p className="text-xs text-red-600 font-medium mt-1">{passErrors.newPassword}</p>
                  )}
                </div>

                <div>
                  <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                    Confirm New Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPass.confirm ? 'text' : 'password'}
                      required
                      placeholder="Re-enter new password"
                      value={passData.confirmPassword}
                      onChange={(e) => setPassData({ ...passData, confirmPassword: e.target.value })}
                      className={`w-full p-3 pr-10 border rounded-lg focus:outline-none focus:ring-1 transition-all min-h-[42px] ${passErrors.confirmPassword
                          ? 'border-red-400 focus:border-red-600 focus:ring-red-600 bg-red-50/20'
                          : 'border-stone-300 focus:border-stone-900 focus:ring-stone-900 bg-white'
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass({ ...showPass, confirm: !showPass.confirm })}
                      className="absolute right-3 top-3.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showPass.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passErrors.confirmPassword && (
                    <p className="text-xs text-red-600 font-medium mt-1">{passErrors.confirmPassword}</p>
                  )}
                </div>

                {/* TAB 2 ACTIONS ROW: Save Changes only, disabled when no changes */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={updatingPassword || !isSecurityChanged}
                    className={`w-full sm:w-auto px-6 py-3 bg-stone-900 text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center space-x-2 min-h-[42px] ${updatingPassword || !isSecurityChanged
                        ? 'opacity-40 bg-stone-300 text-stone-500 cursor-not-allowed shadow-none border-0'
                        : 'cursor-pointer hover:bg-black text-white'
                      }`}
                  >
                    {updatingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 text-amber-400" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: STORE OVERVIEW */}
          {activeTab === 'store' && (
            <div className="space-y-6">
              {/* EDITABLE SHIPPING CHARGES CARD */}
              <form onSubmit={handleSaveShipping} className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xs space-y-5">
                <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-stone-900 flex items-center space-x-2">
                      <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Store Shipping Configuration</span>
                    </h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Set flat-rate shipping charges applied to customer orders (0 to 500 PKR)
                    </p>
                  </div>
                </div>

                <div className="max-w-xl space-y-4">
                  <div>
                    <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs sm:text-sm flex items-center justify-between">
                      <span>Shipping Charges (PKR) <span className="text-red-600">*</span></span>
                      <span className="text-[11px] font-normal text-stone-400">Allowed range: 0 - 500 PKR</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={500}
                        step={1}
                        required
                        value={shippingChargesInput}
                        onChange={(e) => handleShippingChange(e.target.value)}
                        className={`w-full p-3 pl-9 border rounded-lg focus:outline-none focus:ring-1 transition-all text-xs sm:text-sm font-mono font-bold ${shippingError
                            ? 'border-red-400 focus:border-red-600 focus:ring-red-600 bg-red-50/20 text-red-900'
                            : 'border-stone-300 focus:border-stone-900 focus:ring-stone-900 bg-white text-stone-900'
                          }`}
                        placeholder="150"
                      />
                      <span className="absolute left-3 top-3.5 text-xs font-bold text-stone-400">Rs.</span>
                    </div>
                    {shippingError ? (
                      <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{shippingError}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-stone-500 mt-1">
                        Enter flat delivery fee in PKR. Leave 0 for free shipping.
                      </p>
                    )}
                  </div>

                  <div className="pt-1 flex items-center justify-start">
                    <button
                      type="submit"
                      disabled={savingShipping || !isStoreChanged || !!shippingError}
                      className={`px-6 py-2.5 bg-stone-900 text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center space-x-2 min-h-[42px] ${savingShipping || !isStoreChanged || !!shippingError
                          ? 'opacity-40 bg-stone-300 text-stone-500 cursor-not-allowed shadow-none border-0'
                          : 'cursor-pointer hover:bg-black text-white'
                        }`}
                    >
                      {savingShipping ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                          <span>Saving Shipping...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 text-amber-400" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* DYNAMIC STORE PERFORMANCE OVERVIEW */}
              <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xs space-y-6">
                <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-stone-900 flex items-center space-x-2">
                      <Store className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Store Performance Overview</span>
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                  {/* Metric 1: Total Products */}
                  <div className="bg-stone-50 border border-stone-200 p-4 sm:p-5 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-stone-500">
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total Products</span>
                      <Package className="w-4 h-4 text-stone-700 shrink-0" />
                    </div>
                    <div className="text-xl sm:text-2xl font-extrabold font-mono text-stone-900">
                      {stats?.totalProducts ?? 0}
                    </div>
                    <span className="text-xs text-stone-500 block">Catalog items</span>
                  </div>

                  {/* Metric 2: Active Products */}
                  <div className="bg-emerald-50/60 border border-emerald-200 p-4 sm:p-5 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-emerald-800">
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Active Products</span>
                      <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                    </div>
                    <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-950">
                      {stats?.activeProducts ?? 0}
                    </div>
                    <span className="text-xs text-emerald-700 block font-medium">Live on storefront</span>
                  </div>

                  {/* Metric 3: Sold Out Products */}
                  <div className="bg-amber-50/60 border border-amber-200 p-4 sm:p-5 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-amber-900">
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Sold Out Products</span>
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    </div>
                    <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-950">
                      {stats?.soldOutProducts ?? 0}
                    </div>
                    <span className="text-xs text-amber-800 block font-medium">Out of stock items</span>
                  </div>

                  {/* Metric 4: Total Orders */}
                  <div className="bg-stone-50 border border-stone-200 p-4 sm:p-5 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-stone-500">
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total Orders</span>
                      <ShoppingBag className="w-4 h-4 text-stone-700 shrink-0" />
                    </div>
                    <div className="text-xl sm:text-2xl font-extrabold font-mono text-stone-900">
                      {stats?.totalOrders ?? 0}
                    </div>
                    <span className="text-xs text-stone-500 block">Lifetime customer orders</span>
                  </div>

                  {/* Metric 5: Total Lifetime Revenue */}
                  <div className="bg-stone-900 text-white p-4 sm:p-5 rounded-xl space-y-2 col-span-1 sm:col-span-2">
                    <div className="flex justify-between items-center text-stone-300">
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total Lifetime Revenue</span>
                      <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                      {format$(stats?.totalRevenue ?? 0)}
                    </div>
                    <span className="text-xs text-stone-400 block font-medium">Shipped & Delivered order gross revenue</span>
                  </div>

                  {/* Metric 6: Average Rating */}
                  <div className="bg-stone-50 border border-stone-200 p-4 sm:p-5 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-amber-600">
                      <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider">Average Rating</span>
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                    </div>
                    <div className="text-xl sm:text-2xl font-extrabold font-mono text-stone-900 flex items-baseline space-x-1">
                      <span>{stats?.averageRating ? stats.averageRating.toFixed(1) : '5.0'}</span>
                      <span className="text-xs text-stone-400 font-normal">/ 5.0</span>
                    </div>
                    <span className="text-xs text-stone-500 block">Customer review score</span>
                  </div>

                  {/* Metric 7: Member Since */}
                  <div className="bg-stone-50 border border-stone-200 p-4 sm:p-5 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-stone-500">
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Member Since</span>
                      <Calendar className="w-4 h-4 text-stone-700 shrink-0" />
                    </div>
                    <div className="text-base sm:text-lg font-bold font-mono text-stone-900 truncate">
                      {stats?.memberSince || 'Jan 2024'}
                    </div>
                    <span className="text-xs text-stone-500 block font-medium">Registration date</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SettingsView;
