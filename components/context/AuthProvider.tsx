'use client';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import supabase from '@/src/api/client';

export interface ResellerProfile {
  id: string;
  email: string;
  full_name: string;
  shop_name: string;
  cnic: string;
  phone: string;
  city: string;
  address: string;
  bank_name?: string | null;
  account_title?: string | null;
  iban?: string | null;
  avatar_url?: string | null;
  store_image_url?: string | null;
  status: string;
  created_at?: string;
  shipping_charges?: number;
  cod?: boolean;
  advance_pay_full?: boolean;
  advance_pay_dc?: boolean;
}

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_no: string;
  created_at?: string;
  updated_at?: string;
}

export type UserRole = 'seller' | 'customer' | null;

export interface ProfileResult {
  role: UserRole;
  resellerProfile: ResellerProfile | null;
  userProfile: UserProfile | null;
  sellerStatus: string | null;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  resellerProfile: ResellerProfile | null;
  userProfile: UserProfile | null;
  role: UserRole;
  sellerStatus: string | null;
  loading: boolean;
  logout: () => Promise<void>;
  refetchProfile: (targetUser?: User | null) => Promise<ProfileResult>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  resellerProfile: null,
  userProfile: null,
  role: null,
  sellerStatus: null,
  loading: true,
  logout: async () => {},
  refetchProfile: async () => ({
    role: null,
    resellerProfile: null,
    userProfile: null,
    sellerStatus: null,
  }),
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [resellerProfile, setResellerProfile] = useState<ResellerProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [sellerStatus, setSellerStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchResellerProfile = async (userId: string): Promise<ResellerProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching reseller profile:', error.message);
        return null;
      }
      return data || null;
    } catch (err) {
      console.warn('Unexpected error fetching reseller profile:', err);
      return null;
    }
  };

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching user profile:', error.message);
        return null;
      }
      return data || null;
    } catch (err) {
      console.warn('Unexpected error fetching user profile:', err);
      return null;
    }
  };

  const loadUserProfilesAndRole = async (userId: string, authUser?: User | null): Promise<ProfileResult> => {
    let sellerRes = await fetchResellerProfile(userId);
    let customerRes = await fetchUserProfile(userId);

    // Auto-create customer profile if no seller profile exists and no customer profile exists yet
    if (!sellerRes && !customerRes && authUser) {
      try {
        const meta = authUser.user_metadata || {};
        const fullName = (meta.full_name || meta.name || '').trim();
        const nameParts = fullName ? fullName.split(/\s+/) : [];

        const firstName = meta.first_name || meta.given_name || (nameParts.length > 0 ? nameParts[0] : '') || (authUser.email ? authUser.email.split('@')[0] : 'User');
        const lastName = meta.last_name || meta.family_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
        const email = authUser.email || meta.email || '';
        const phoneNo = authUser.phone || meta.phone_no || meta.phone || null;

        const { data: createdProfile, error: insertErr } = await supabase
          .from('users')
          .insert([
            {
              id: userId,
              first_name: firstName,
              last_name: lastName,
              email: email,
              phone_no: phoneNo,
            },
          ])
          .select('*')
          .maybeSingle();

        if (!insertErr && createdProfile) {
          customerRes = createdProfile;
        } else {
          customerRes = await fetchUserProfile(userId);
        }
      } catch (err) {
        console.warn('Auto-create customer profile error:', err);
        customerRes = await fetchUserProfile(userId);
      }
    }

    setResellerProfile(sellerRes);
    setUserProfile(customerRes);

    let resolvedRole: UserRole = null;
    let resolvedStatus: string | null = null;

    if (sellerRes) {
      resolvedRole = 'seller';
      resolvedStatus = sellerRes.status || 'Active';
    } else {
      resolvedRole = 'customer';
      resolvedStatus = null;
    }

    setRole(resolvedRole);
    setSellerStatus(resolvedStatus);

    return {
      role: resolvedRole,
      resellerProfile: sellerRes,
      userProfile: customerRes,
      sellerStatus: resolvedStatus,
    };
  };

  const refetchProfile = async (targetUser?: User | null): Promise<ProfileResult> => {
    const activeUser = targetUser || user;
    if (activeUser?.id) {
      return await loadUserProfilesAndRole(activeUser.id, activeUser);
    }
    return {
      role: null,
      resellerProfile: null,
      userProfile: null,
      sellerStatus: null,
    };
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setUser(null);
      setSession(null);
      setResellerProfile(null);
      setUserProfile(null);
      setRole(null);
      setSellerStatus(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;

        const currentSession = data?.session || null;
        const currentUser = currentSession?.user || null;

        setSession(currentSession);
        setUser(currentUser);

        if (currentUser?.id) {
          await loadUserProfilesAndRole(currentUser.id, currentUser);
        } else {
          setResellerProfile(null);
          setUserProfile(null);
          setRole(null);
          setSellerStatus(null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;

      const newUser = newSession?.user || null;
      setSession(newSession);
      setUser(newUser);

      if (newUser?.id) {
        await loadUserProfilesAndRole(newUser.id, newUser);
      } else {
        setResellerProfile(null);
        setUserProfile(null);
        setRole(null);
        setSellerStatus(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        resellerProfile,
        userProfile,
        role,
        sellerStatus,
        loading,
        logout,
        refetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };

