'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { roleMismatchMessage, type SelfServiceRole, type UserRole } from '@/lib/auth/roles';
import type { UserProfile } from '@/types/database';

/** Thrown when a user signs in under an account type that isn't theirs. */
export class RoleMismatchError extends Error {
  readonly actualRole: UserRole;

  constructor(actualRole: UserRole) {
    super(roleMismatchMessage(actualRole));
    this.name = 'RoleMismatchError';
    this.actualRole = actualRole;
  }
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  /** Step 1: send an SMS code. `role` is only applied if this phone is new. */
  sendOtp: (phone: string, role: SelfServiceRole) => Promise<void>;
  /**
   * Step 2: verify the code. Rejects with RoleMismatchError (and signs out)
   * if the account belongs to a different role than `expectedRole`.
   */
  verifyOtp: (phone: string, token: string, expectedRole: SelfServiceRole) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(
    async (userId: string): Promise<UserProfile | null> => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.error('Failed to load user profile:', error.message);
        return null;
      }
      return (data as UserProfile | null) ?? null;
    },
    [supabase]
  );

  useEffect(() => {
    let active = true;

    const applySession = async (next: Session | null) => {
      if (!active) return;
      setSession(next);
      if (next?.user) {
        const loaded = await fetchProfile(next.user.id);
        if (active) setProfile(loaded);
      } else {
        setProfile(null);
      }
      if (active) setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      void applySession(next);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const sendOtp = useCallback<AuthContextValue['sendOtp']>(
    async (phone, role) => {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        // Metadata is only stored when the account is first created; the
        // database trigger reads it to set the role. Existing accounts keep theirs.
        options: { data: { role, phone } },
      });
      if (error) throw error;
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    if (error) throw error;
  }, [supabase]);

  const verifyOtp = useCallback<AuthContextValue['verifyOtp']>(
    async (phone, token, expectedRole) => {
      const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
      if (error) throw error;
      const authUser = data.user;
      if (!authUser) throw new Error('تعذّر تسجيل الدخول، يرجى المحاولة مجدداً');

      let current = await fetchProfile(authUser.id);

      // Fallback for brand-new accounts if the signup trigger didn't create a profile.
      if (!current) {
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({ id: authUser.id, phone, role: expectedRole });
        if (insertError) console.error('Failed to create user profile:', insertError.message);
        current = await fetchProfile(authUser.id);
      }

      if (!current) {
        await signOut();
        throw new Error('تعذّر تحميل بيانات الحساب، يرجى المحاولة مجدداً');
      }

      if (!current.is_active) {
        await signOut();
        throw new Error('هذا الحساب موقوف. يرجى التواصل مع الدعم.');
      }

      // An account is permanently tied to one role: never switch it on login.
      if (current.role !== expectedRole && current.role !== 'admin') {
        await signOut();
        throw new RoleMismatchError(current.role);
      }

      setProfile(current);
      return current;
    },
    [supabase, fetchProfile, signOut]
  );

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return null;
    const loaded = await fetchProfile(session.user.id);
    setProfile(loaded);
    return loaded;
  }, [session, fetchProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      role: profile?.role ?? null,
      loading,
      sendOtp,
      verifyOtp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, sendOtp, verifyOtp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
