import { useState, useEffect, useCallback } from 'react';
import supabase from '@/src/api/client';
import useAuth from '@/src/hooks/useAuth';

export interface SellerStatusDetails {
  isRestricted: boolean;
  messages: string[];
  badgeText: string;
  formattedRestrictedUntil: string | null;
}

export interface SellerStatusData extends SellerStatusDetails {
  status: 'Active' | 'Inactive' | 'Suspended' | string | null;
  pendingOrdersInactive: boolean;
  commissionInactive: boolean;
  restrictedUntil: string | null;
  loading: boolean;
  error: string | null;
  refetchStatus: () => Promise<void>;
}

export function getSellerRestrictionDetails(
  status: string | null,
  pendingOrdersInactive: boolean = false,
  commissionInactive: boolean = false,
  restrictedUntil: string | null = null
): SellerStatusDetails {
  const normStatus = (status || 'Active').trim();
  const isPendingInactive = Boolean(pendingOrdersInactive);
  const isCommInactive = Boolean(commissionInactive);

  let formattedDate: string | null = null;
  if (restrictedUntil) {
    try {
      const parsed = new Date(restrictedUntil);
      if (!isNaN(parsed.getTime())) {
        formattedDate = parsed.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
    } catch {
      formattedDate = restrictedUntil;
    }
  }

  const messages: string[] = [];

  if (isPendingInactive) {
    messages.push(
      'Your seller account has been temporarily set to inactive because you have pending orders that require action. Please ship and complete your pending orders so that your seller access can be restored.'
    );
  }

  if (isCommInactive) {
    messages.push(
      'Your seller account has been temporarily set to inactive because you have not paid your outstanding commission amount. Please pay your remaining commission amount to restore full access to your seller account.'
    );
  }

  // Fallbacks if status is Inactive or Suspended without specific boolean flags
  if (messages.length === 0) {
    if (normStatus.toLowerCase() === 'suspended') {
      messages.push('Your seller account is currently suspended. You do not have permission to perform product management actions.');
    } else if (normStatus.toLowerCase() === 'inactive') {
      messages.push('Your seller account is currently inactive. You do not have permission to perform product management actions.');
    }
  }

  const isRestricted = messages.length > 0 || normStatus.toLowerCase() !== 'active';

  let badgeText = normStatus;
  if (isPendingInactive && isCommInactive) {
    badgeText = 'Pending Orders & Commission';
  } else if (isPendingInactive) {
    badgeText = 'Pending Orders';
  } else if (isCommInactive) {
    badgeText = 'Commission Dues';
  }

  return {
    isRestricted,
    messages,
    badgeText,
    formattedRestrictedUntil: formattedDate,
  };
}

export const useSellerStatus = (): SellerStatusData => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Suspended' | string | null>(null);
  const [pendingOrdersInactive, setPendingOrdersInactive] = useState<boolean>(false);
  const [commissionInactive, setCommissionInactive] = useState<boolean>(false);
  const [restrictedUntil, setRestrictedUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!user?.id) {
      setStatus(null);
      setPendingOrdersInactive(false);
      setCommissionInactive(false);
      setRestrictedUntil(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fast lightweight query selecting ONLY required fields
      let { data, error: dbError } = await supabase
        .from('sellers')
        .select('status, pending_orders_inactive, commission_inactive, restricted_until')
        .eq('id', user.id)
        .maybeSingle();

      // Graceful fallback if new columns don't exist in DB schema yet
      if (
        dbError &&
        (dbError.message?.includes('pending_orders_inactive') ||
          dbError.message?.includes('commission_inactive') ||
          dbError.message?.includes('restricted_until') ||
          dbError.code === 'PGRST204')
      ) {
        const fallback = await supabase
          .from('sellers')
          .select('status')
          .eq('id', user.id)
          .maybeSingle();

        data = fallback.data
          ? {
              status: fallback.data.status,
              pending_orders_inactive: false,
              commission_inactive: false,
              restricted_until: null,
            }
          : null;
        dbError = fallback.error;
      }

      if (dbError) {
        console.warn('Error fetching seller status:', dbError.message);
        setError(dbError.message);
        setStatus('Active');
        setPendingOrdersInactive(false);
        setCommissionInactive(false);
        setRestrictedUntil(null);
      } else if (data) {
        setStatus(data.status || 'Active');
        setPendingOrdersInactive(Boolean(data.pending_orders_inactive));
        setCommissionInactive(Boolean(data.commission_inactive));
        setRestrictedUntil(data.restricted_until || null);
      } else {
        setStatus('Active');
        setPendingOrdersInactive(false);
        setCommissionInactive(false);
        setRestrictedUntil(null);
      }
    } catch (err: any) {
      console.error('Unexpected error fetching seller status:', err);
      setError(err?.message || 'Failed to fetch seller status');
      setStatus('Active');
      setPendingOrdersInactive(false);
      setCommissionInactive(false);
      setRestrictedUntil(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const restrictionDetails = getSellerRestrictionDetails(
    status,
    pendingOrdersInactive,
    commissionInactive,
    restrictedUntil
  );

  return {
    status,
    pendingOrdersInactive,
    commissionInactive,
    restrictedUntil,
    loading,
    error,
    refetchStatus: fetchStatus,
    ...restrictionDetails,
  };
};

export default useSellerStatus;
