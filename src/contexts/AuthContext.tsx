'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        // Request notification permission and subscribe to Web Push
        if (typeof window !== 'undefined' && 'Notification' in window) {
          import('@/lib/pushNotifications').then(({ requestNotificationPermission, subscribeToPush }) => {
            requestNotificationPermission().then((permission) => {
              if (permission === 'granted') {
                subscribeToPush(session.user.id);
              }
            });
          });
        }
        // Request geolocation permission
        if (typeof window !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            () => { /* permission granted, position available */ },
            () => { /* permission denied or error, ignore silently */ },
            { timeout: 10000, maximumAge: 60000 }
          );
        }
        // Register FCM token for WebView (JS-Native bridge)
        import('@/lib/fcm').then(({ isWebView, registerFCM }) => {
          if (isWebView()) {
            registerFCM(session.user.id);
          }
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  // Phone-based Sign In — Step 1: send real OTP via SMS
  const sendOtp = async (phone: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
    });
    if (error) throw error;
    return data;
  };

  // Phone OTP Sign In - Step 2: verify real OTP token
  const verifyOtp = async (phone: string, token: string, role: string = 'customer') => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) {
      if (
        error.message?.toLowerCase().includes('token has expired') ||
        error.message?.toLowerCase().includes('otp expired')
      ) {
        throw new Error('انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد');
      }
      if (
        error.message?.toLowerCase().includes('invalid') ||
        error.message?.toLowerCase().includes('incorrect')
      ) {
        throw new Error('رمز التحقق غير صحيح');
      }
      throw error;
    }

    // Update profile role if provided
    if (data?.user) {
      await supabase
        .from('user_profiles')
        .upsert({
          id: data.user.id,
          phone,
          role: role as any,
        }, { onConflict: 'id' });
    }

    return data;
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

    // Save profile to user_profiles table AFTER sign-in so auth.uid() is set for RLS
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: data.user.id,
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
