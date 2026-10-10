import supabase from './client';
import { ResellerProfile } from '@/components/context/AuthProvider';

export interface StoreOverviewStats {
  totalProducts?: number;
  activeProducts?: number;
  soldOutProducts?: number;
  totalOrders?: number;
  totalRevenue?: number;
  averageRating?: number;
  memberSince?: string;
  shippingCharges: number;
}

export interface SellerShippingPaymentConfig {
  shipping_charges: number;
  cod: boolean;
  advance_pay_full: boolean;
  advance_pay_dc: boolean;
  bank_name?: string;
  account_title?: string;
  iban?: string;
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Jan 2024';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Fetches seller profile and shipping/payment settings from sellers table.
 * Selects only specific required columns (no select('*')).
 */
export async function fetchSellerFullProfile(sellerId: string): Promise<{
  profile: ResellerProfile;
  stats?: StoreOverviewStats;
}> {
  const isUuid = isValidUUID(sellerId);

  // Fallback defaults for demo/mock IDs
  const defaultProfile: ResellerProfile = {
    id: sellerId,
    email: 'reseller@zebaish.pk',
    full_name: 'Ayesha Khan',
    shop_name: 'Ayesha Luxury Surplus',
    cnic: '35202-1234567-8',
    phone: '+92 300 1234567',
    city: 'Lahore',
    address: 'Shop #12, Liberty Market, Gulberg III, Lahore',
    bank_name: 'Meezan Bank',
    account_title: 'Ayesha Luxury Surplus Ltd',
    iban: 'PK80MEZN0038020113013132',
    status: 'Active',
    created_at: '2024-01-15T10:00:00Z',
    avatar_url: 'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png',
    store_image_url: 'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png',
    shipping_charges: 150,
    cod: true,
    advance_pay_full: false,
    advance_pay_dc: false,
  };

  if (!isUuid) {
    return { profile: defaultProfile };
  }

  try {
    // 1. Fetch Profile from `sellers` table selecting specific columns only (no select('*'))
    const { data: rawSeller, error: sellerErr } = await supabase
      .from('sellers')
      .select('id, email, full_name, shop_name, cnic, phone, city, address, bank_name, account_title, iban, status, created_at, avatar_url, store_image_url, logo_url, shipping_charges, cod, advance_pay_full, advance_pay_dc')
      .eq('id', sellerId)
      .maybeSingle();

    if (sellerErr) {
      console.warn('Error fetching seller profile:', sellerErr.message);
    }

    if (rawSeller) {
      const rawShippingCharges = Number(rawSeller.shipping_charges);
      const validShipping = isNaN(rawShippingCharges) ? 150 : Math.max(0, Math.min(500, rawShippingCharges));

      const profile: ResellerProfile = {
        id: rawSeller.id || sellerId,
        email: rawSeller.email || '',
        full_name: rawSeller.full_name || '',
        shop_name: rawSeller.shop_name || '',
        cnic: rawSeller.cnic || '',
        phone: rawSeller.phone || '',
        city: rawSeller.city || '',
        address: rawSeller.address || '',
        bank_name: rawSeller.bank_name ?? '',
        account_title: rawSeller.account_title ?? '',
        iban: rawSeller.iban ?? '',
        status: rawSeller.status || 'Active',
        created_at: rawSeller.created_at || '',
        avatar_url: rawSeller.avatar_url || rawSeller.store_image_url || rawSeller.logo_url || defaultProfile.avatar_url,
        store_image_url: rawSeller.store_image_url || rawSeller.avatar_url || rawSeller.logo_url || defaultProfile.store_image_url,
        shipping_charges: validShipping,
        cod: rawSeller.cod !== undefined && rawSeller.cod !== null ? Boolean(rawSeller.cod) : true,
        advance_pay_full: rawSeller.advance_pay_full !== undefined && rawSeller.advance_pay_full !== null ? Boolean(rawSeller.advance_pay_full) : false,
        advance_pay_dc: rawSeller.advance_pay_dc !== undefined && rawSeller.advance_pay_dc !== null ? Boolean(rawSeller.advance_pay_dc) : false,
      };

      return { profile };
    }

    return { profile: defaultProfile };
  } catch (err) {
    console.error('Error fetching seller full profile:', err);
    return { profile: defaultProfile };
  }
}

/**
 * Updates seller profile in sellers table (updates ONLY editable fields)
 */
export async function updateSellerProfile(
  sellerId: string,
  editableData: {
    full_name?: string;
    city?: string;
    address?: string;
    avatar_url?: string;
    store_image_url?: string;
    // Backwards compatibility if passed, but shop_name is excluded from payload
    shop_name?: string;
    phone?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!sellerId) return { success: false, error: 'Invalid seller ID' };

  if (!isValidUUID(sellerId)) {
    return { success: true };
  }

  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (editableData.full_name !== undefined) {
      updatePayload.full_name = editableData.full_name.trim();
    }
    if (editableData.city !== undefined) {
      updatePayload.city = editableData.city.trim();
    }
    if (editableData.address !== undefined) {
      updatePayload.address = editableData.address.trim();
    }

    const imgUrl = editableData.store_image_url || editableData.avatar_url;
    if (imgUrl) {
      updatePayload.store_image_url = imgUrl;
    }

    const { error } = await supabase
      .from('sellers')
      .update(updatePayload)
      .eq('id', sellerId);

    if (error) {
      console.error('Error updating seller profile:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Unexpected error updating seller profile:', err);
    return { success: false, error: err?.message || 'Failed to save changes.' };
  }
}

/**
 * Uploads seller avatar picture to Supabase storage bucket
 */
export async function uploadSellerAvatar(sellerId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'png';
  const filePath = `avatars/${sellerId}_${Date.now()}.${fileExt}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('seller-avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.warn('Storage upload error, using object URL fallback:', uploadError);
      return URL.createObjectURL(file);
    }

    const { data } = supabase.storage.from('seller-avatars').getPublicUrl(filePath);
    return data?.publicUrl || URL.createObjectURL(file);
  } catch (err) {
    console.warn('Avatar upload fallback:', err);
    return URL.createObjectURL(file);
  }
}

/**
 * Updates seller password via Supabase Auth
 */
export async function updateSellerPassword(
  currentPass: string,
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Re-verify current password by attempting sign in
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.email) {
      return { success: false, error: 'Authenticated user email not found.' };
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPass,
    });

    if (signInErr) {
      return { success: false, error: 'Current password Verification failed. Please check your current password.' };
    }

    // 2. Update to new password
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPass,
    });

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error updating password:', err);
    return { success: false, error: err?.message || 'Failed to update password.' };
  }
}

/**
 * Updates seller shipping charges, payment options, and bank details in sellers table.
 * Enforces server-side validation for:
 * 1. Shipping charges range (0 <= shipping_charges <= 500)
 * 2. Mutual exclusivity of advance payment options (advance_pay_full and advance_pay_dc cannot both be true)
 * 3. At least one payment option must be enabled
 * 4. Conditional requirement: Bank details (bank_name, account_title, iban) are REQUIRED when advance_pay_full or advance_pay_dc is true
 */
export async function updateSellerShippingAndPaymentConfig(
  sellerId: string,
  config: SellerShippingPaymentConfig
): Promise<{ success: boolean; error?: string }> {
  if (!sellerId) return { success: false, error: 'Invalid seller ID' };

  if (config.shipping_charges < 0 || config.shipping_charges > 500) {
    return { success: false, error: 'Shipping charges must be between 0 and 500 PKR.' };
  }

  if (config.advance_pay_full && config.advance_pay_dc) {
    return { success: false, error: 'Both Advance Payment Full and Advance Payment Only DC cannot be selected simultaneously.' };
  }

  if (!config.cod && !config.advance_pay_full && !config.advance_pay_dc) {
    return { success: false, error: 'At least one payment option (COD, Advance Payment Full, or Advance Payment Only DC) must be selected.' };
  }

  // Server-side conditional validation for Bank Details when Advance Payment option is active
  if (config.advance_pay_full || config.advance_pay_dc) {
    if (!config.bank_name?.trim()) {
      return { success: false, error: 'Bank Name is required when Advance Payment options are enabled.' };
    }
    if (!config.account_title?.trim()) {
      return { success: false, error: 'Account Title is required when Advance Payment options are enabled.' };
    }
    if (!config.iban?.trim()) {
      return { success: false, error: 'IBAN Number is required when Advance Payment options are enabled.' };
    }
  }

  if (!isValidUUID(sellerId)) {
    return { success: true };
  }

  try {
    const updatePayload: Record<string, any> = {
      shipping_charges: config.shipping_charges,
      cod: config.cod,
      advance_pay_full: config.advance_pay_full,
      advance_pay_dc: config.advance_pay_dc,
      updated_at: new Date().toISOString(),
    };

    if (config.bank_name !== undefined) updatePayload.bank_name = config.bank_name.trim();
    if (config.account_title !== undefined) updatePayload.account_title = config.account_title.trim();
    if (config.iban !== undefined) updatePayload.iban = config.iban.trim();

    const { error } = await supabase
      .from('sellers')
      .update(updatePayload)
      .eq('id', sellerId);

    if (error) {
      console.error('Error updating seller shipping and payment config:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Unexpected error updating seller shipping and payment config:', err);
    return { success: false, error: err?.message || 'Failed to save shipping & payment configuration.' };
  }
}

/**
 * Backwards compatible alias for updateSellerShippingAndPaymentConfig
 */
export async function updateSellerShippingCharges(
  sellerId: string,
  shippingCharges: number
): Promise<{ success: boolean; error?: string }> {
  return updateSellerShippingAndPaymentConfig(sellerId, {
    shipping_charges: shippingCharges,
    cod: true,
    advance_pay_full: false,
    advance_pay_dc: false,
  });
}
