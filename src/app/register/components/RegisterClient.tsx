'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { registerUser } = useAuth();

  const phone = searchParams.get('phone') || '';
  const role = (searchParams.get('role') as 'customer' | 'craftsman') || 'customer';

  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('يرجى إدخال الاسم الكامل');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await registerUser(phone, fullName.trim(), role);
      router.replace('/home-screen');
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة مجدداً');
    } finally {
      setIsLoading(false);
    }
  };

  const roleLabel = role === 'craftsman' ? 'صنايعي' : 'زبون';
  const roleEmoji = role === 'craftsman' ? '🔧' : '👤';

  return (
    <div className="screen-container flex flex-col min-h-screen bg-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <Icon name="ChevronRightIcon" size={20} className="text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">إنشاء حساب جديد</h1>
      </div>

      <div className="flex-1 px-5 pt-2 pb-6 flex flex-col">
        {/* Welcome */}
        <div className="text-center mb-8 mt-4">
          <div className="w-20 h-20 rounded-2xl bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">{roleEmoji}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">أهلاً بك!</h2>
          <p className="text-sm text-gray-500">
            رقمك غير مسجل، أنشئ حسابك كـ{' '}
            <span className="font-semibold text-primary">{roleLabel}</span>
          </p>
        </div>

        {/* Phone display (read-only) */}
        <div className="mb-4">
          <label className="text-sm font-semibold text-gray-700 block mb-2">رقم الجوال</label>
          <div className="py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 font-tabular" dir="ltr">
            {phone}
          </div>
        </div>

        {/* Role display (read-only) */}
        <div className="mb-5">
          <label className="text-sm font-semibold text-gray-700 block mb-2">نوع الحساب</label>
          <div className="py-3.5 px-4 bg-green-50 border border-green-200 rounded-xl text-sm text-primary font-semibold flex items-center gap-2">
            <span>{roleEmoji}</span>
            <span>{roleLabel}</span>
          </div>
        </div>

        {/* Full name input */}
        <div className="mb-6">
          <label className="text-sm font-semibold text-gray-700 block mb-2">الاسم الكامل</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setError('');
            }}
            placeholder="أدخل اسمك الكامل"
            className="w-full py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary"
            autoFocus
          />
          {error && (
            <p className="text-red-500 text-xs mt-2">{error}</p>
          )}
        </div>

        {/* Register button */}
        <button
          onClick={handleRegister}
          disabled={isLoading || !fullName.trim()}
          className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all"
          style={{ background: '#1B5E20', opacity: (!fullName.trim() || isLoading) ? 0.6 : 1 }}
        >
          {isLoading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-5 flex items-center justify-center gap-1">
          <Icon name="LockClosedIcon" size={12} className="text-gray-400" />
          سيتم حفظ بياناتك بشكل آمن
        </p>
      </div>
    </div>
  );
}

export default function RegisterClient() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
