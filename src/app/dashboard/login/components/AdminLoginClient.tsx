'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole, safeAdminRedirect } from '@/lib/auth/admin';

function friendlyError(message: string | undefined): string {
  const m = (message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  if (m.includes('email not confirmed')) return 'لم يتم تأكيد هذا البريد بعد';
  if (m.includes('too many') || m.includes('rate limit')) return 'محاولات كثيرة، انتظر قليلاً ثم حاول مجدداً';
  return 'تعذّر تسجيل الدخول، حاول مجدداً';
}

export default function AdminLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeAdminRedirect(searchParams?.get('next'));
  const reason = searchParams?.get('reason');
  const supabase = createClient();
  const { user, profile, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(reason === 'not_admin' ? 'هذا الحساب ليس حساب مدير' : '');

  const signedInAsAdmin = !loading && !!user && profile?.id === user.id && isAdminRole(profile?.role);
  // The server sent us here even though this browser holds an admin session:
  // the session cookie isn't reaching the server, so redirecting again would loop.
  const sentByServer = searchParams?.has('next') ?? false;

  // Already signed in as admin: go straight to the dashboard.
  useEffect(() => {
    if (signedInAsAdmin && !sentByServer) router.replace(next);
  }, [signedInAsAdmin, sentByServer, router, next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError || !data.user) {
        setError(friendlyError(signInError?.message));
        return;
      }

      const { data: adminProfile } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!isAdminRole(adminProfile?.role) || adminProfile?.is_active === false) {
        // Never leave a non-admin signed in from the admin login page.
        await supabase.auth.signOut();
        setError('هذا الحساب ليس حساب مدير');
        return;
      }

      // Full reload so the server-side guard sees the new session cookie.
      window.location.replace(next);
    } catch {
      setError('تعذّر تسجيل الدخول، تحقق من الاتصال وحاول مجدداً');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-lg shadow-emerald-950/50">
            <img src="/icons/icon-192.png" alt="شعار حِرَفي" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-white">لوحة تحكم حِرَفي</h1>
          <p className="text-sm text-gray-400 mt-1">دخول المشرفين فقط</p>
        </div>

        {signedInAsAdmin && sentByServer && (
          <div role="alert" className="mb-4 text-sm text-amber-200 bg-amber-950/40 border border-amber-800/50 rounded-xl px-4 py-3">
            أنت مسجّل كمدير، لكن المتصفح لا يرسل جلسة الدخول إلى الخادم (قد تكون ملفات تعريف الارتباط محظورة).
            سجّل الدخول مجدداً أدناه، أو افتح اللوحة في نافذة متصفح عادية.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4" noValidate>
          <div>
            <label htmlFor="admin-email" className="block text-sm font-semibold text-gray-300 mb-2">
              البريد الإلكتروني
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              inputMode="email"
              dir="ltr"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white text-left placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-semibold text-gray-300 mb-2">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                className="w-full px-4 py-3 pl-12 rounded-xl bg-gray-800 border border-gray-700 text-white text-left focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={20} />
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Icon name="LockClosedIcon" size={18} />
                دخول
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-6">
          نسيت كلمة المرور؟ يمكن تعيين كلمة جديدة من لوحة Supabase ← Authentication ← Users.
        </p>
      </div>
    </div>
  );
}
