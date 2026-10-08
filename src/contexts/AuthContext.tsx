'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isNativeApp, registerNativePush, unregisterNativePush } from '@/lib/nativeApp';
import { rtChannelName } from '@/lib/supabase/realtime';

const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // One listener drives everything. INITIAL_SESSION fires right away with the
  // stored session, so there is no separate getSession() call (which used to
  // fetch the profile twice on every app start).
  //
  // Supabase holds an internal lock while this callback runs; calling the
  // client from inside it (e.g. to read the profile) can stall every request
  // in the app. So the work is deferred with setTimeout.
  useEffect(() => {
    let lastUserId: string | null = null;
    let deviceSetupFor: string | null = null;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      // Keep the same object on token refreshes so screens don't reload their data.
      setUser((prev: any) =>
        prev && nextUser && prev.id === nextUser.id && event !== 'USER_UPDATED' ? prev : nextUser
      );

      if (!nextUser) {
        lastUserId = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      // A token refresh for the same user needs no new profile fetch.
      const userChanged = nextUser.id !== lastUserId;
      lastUserId = nextUser.id;
      if (userChanged || event === 'USER_UPDATED') {
        setTimeout(() => { fetchProfile(nextUser.id); }, 0);
      }

      // Push / FCM registration once per signed-in user, after the UI is up.
      if (deviceSetupFor !== nextUser.id) {
        deviceSetupFor = nextUser.id;
        setTimeout(() => setupDevice(nextUser.id), 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setupDevice = (userId: string) => {
    if (typeof window === 'undefined') return;
    // Inside the Android / iOS app: native push (shown by the phone even when
    // the app is closed). Web Push doesn't work inside an app's WebView.
    if (isNativeApp()) {
      registerNativePush().catch(() => {});
      return;
    }
    if ('Notification' in window) {
      import('@/lib/pushNotifications').then(({ requestNotificationPermission, subscribeToPush }) => {
        requestNotificationPermission().then((permission) => {
          if (permission === 'granted') subscribeToPush(userId);
        });
      }).catch(() => {});
    }
    import('@/lib/fcm').then(({ isWebView, registerFCM }) => {
      if (isWebView()) registerFCM(userId);
    }).catch(() => {});
  };

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, phone, role, location, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      setProfile(data);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time profile sync
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(rtChannelName(`profile-realtime-${user.id}`))
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          if (payload.new) {
            setProfile((prev: any) => ({ ...prev, ...payload.new }));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Phone-based Sign In — Step 1: skip real SMS, just proceed
  const sendOtp = async (phone: string) => {
    // BYPASS: Never call Supabase phone provider — no SMS sent.
    // Any OTP code entered by the user will be accepted in verifyOtp.
    return { success: true };
  };

  // Phone OTP Sign In - Step 2: accept any OTP code (bypass verification)
  const verifyOtp = async (phone: string, token: string, role: string = 'customer') => {
    // Accept any OTP — use email/password auth under the hood
    const normalizedPhone = phone.replace(/\D/g, '');
    const email = `${normalizedPhone}@sanaei.app`;
    const password = '123456';

    // Try signing in first (existing user)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError && signInData?.user) {
      // Existing user — check profile
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', signInData.user.id)
        .maybeSingle();

      if (existing?.is_active === false) {
        await supabase.auth.signOut();
        setProfile(null);
        throw new Error('هذا الحساب موقوف. يرجى التواصل مع الدعم.');
      }

      if (existing && existing.role !== role && existing.role !== 'admin') {
        await supabase.auth.signOut();
        setProfile(null);
        const label = existing.role === 'craftsman' ? 'حِرَفي' : 'زبون';
        throw new Error(`هذا الرقم مسجَّل كحساب «${label}». اختر «${label}» لتسجيل الدخول، أو استخدم رقمًا آخر لإنشاء حساب جديد.`);
      }

      return signInData;
    }

    // New user — register automatically
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    });

    if (signUpError) throw signUpError;
    if (!signUpData?.user) throw new Error('فشل إنشاء الحساب');

    // Sign in after registration
    const { data: finalSignIn, error: finalError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (finalError) throw finalError;
    if (!finalSignIn?.user) throw new Error('فشل تسجيل الدخول');

    // Create profile
    await supabase.from('user_profiles').upsert({
      id: finalSignIn.user.id,
      phone,
      role: role as any,
    }, { onConflict: 'id' });

    return finalSignIn;
  };

  // Register a new user: creates auth account with phone-derived email + password 123456, then saves profile
  const registerUser = async (phone: string, fullName: string, role: 'customer' | 'craftsman', location?: string) => {
    const normalizedPhone = phone.replace(/\D/g, '');
    const email = `${normalizedPhone}@sanaei.app`;
    const password = '123456';

    // Create auth user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });

    if (error) throw error;
    if (!data?.user) throw new Error('فشل إنشاء الحساب');

    // Sign in immediately after registration (signUp may not auto-sign-in without email confirmation)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;
    if (!signInData?.user) throw new Error('فشل تسجيل الدخول بعد إنشاء الحساب');

    // Save profile to user_profiles table AFTER sign-in so auth.uid() is set for RLS
    // Use signInData.user.id (active session) and upsert to handle trigger-created rows
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: signInData.user.id,
        phone,
        full_name: fullName,
        role: role as any,
        ...(location ? { location } : {}),
      }, { onConflict: 'id' });

    if (profileError) throw profileError;

    return signInData;
  };

  // Sign Out
  const signOut = async () => {
    // Stop this phone receiving the account's notifications after sign-out.
    if (isNativeApp()) await unregisterNativePush();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  // Get User Profile from Database
  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  // Legacy email methods (kept for compatibility)
  const signUp = async (email: string, password: string, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  const isEmailVerified = () => user?.email_confirmed_at !== null;

  const value = {
    user,
    session,
    profile,
    loading,
    sendOtp,
    verifyOtp,
    registerUser,
    signOut,
    signUp,
    signIn,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
