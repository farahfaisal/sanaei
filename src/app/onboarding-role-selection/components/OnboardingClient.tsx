'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';

type Role = 'customer' | 'craftsman' | null;

export default function OnboardingClient() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const router = useRouter();

  const handleContinue = () => {
    if (!selectedRole) return;
    router.push(`/phone-login-otp-verification?role=${selectedRole}`);
  };

  return (
    <div className="screen-container flex flex-col min-h-screen bg-white" dir="rtl">
      {/* Logo area */}
      <div className="flex flex-col items-center pt-16 pb-6 px-6">
        {/* Logo image */}
        <div className="w-40 h-40 mb-4 flex items-center justify-center">
          <img
            src="/assets/images/a_clean_vector_style_transparent_background_logo_g__1_-1791328639649.png"
            alt="شعار حِرَفي"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Welcome text */}
      <div className="text-center px-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">مرحباً بك في حِرَفي</h2>
        <p className="text-sm text-gray-500">كيف تريد استخدام التطبيق؟</p>
      </div>

      {/* Role Cards */}
      <div className="flex flex-col gap-4 px-5 mb-6">
        {/* Customer Card */}
        <button
          onClick={() => setSelectedRole('customer')}
          className="w-full text-right"
        >
          <div
            className={`relative rounded-2xl border-2 p-4 transition-all duration-200 ${
              selectedRole === 'customer' ?'border-primary bg-primary/10' :'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                selectedRole === 'customer' ? 'bg-primary' : 'bg-gray-100'
              }`}>
                <Icon
                  name="UserIcon"
                  size={24}
                  className={selectedRole === 'customer' ? 'text-white' : 'text-gray-500'}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-base font-bold text-gray-900">أنا زبون</h3>
                  {selectedRole === 'customer' && (
                    <span className="text-xs px-2 py-0.5 bg-primary text-white rounded-full font-medium">
                      ★ الأكثر استخداماً
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  أبحث عن صنايعي موثوق بالقرب مني
                </p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  selectedRole === 'customer' ?'border-primary bg-primary' :'border-gray-300'
                }`}
              >
                {selectedRole === 'customer' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
            </div>
          </div>
        </button>

        {/* Craftsman Card */}
        <button
          onClick={() => setSelectedRole('craftsman')}
          className="w-full text-right"
        >
          <div
            className={`relative rounded-2xl border-2 p-4 transition-all duration-200 ${
              selectedRole === 'craftsman' ?'border-primary bg-primary/10' :'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                selectedRole === 'craftsman' ? 'bg-primary' : 'bg-gray-100'
              }`}>
                <Icon
                  name="WrenchScrewdriverIcon"
                  size={24}
                  className={selectedRole === 'craftsman' ? 'text-white' : 'text-gray-500'}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-base font-bold text-gray-900">أنا صنايعي</h3>
                  {selectedRole === 'craftsman' && (
                    <span className="text-xs px-2 py-0.5 bg-yellow-500 text-white rounded-full font-medium">
                      ✓ انضم إلينا
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  أعرض خدماتي وأستقبل طلبات العملاء
                </p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  selectedRole === 'craftsman' ?'border-primary bg-primary' :'border-gray-300'
                }`}
              >
                {selectedRole === 'craftsman' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* CTA */}
      <div className="px-5 pb-4">
        <button
          onClick={handleContinue}
          className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all"
          style={{
            background: selectedRole ? '#2a724d' : '#9CA3AF',
            opacity: selectedRole ? 1 : 0.7,
          }}
          disabled={!selectedRole}
        >
          متابعة
        </button>
      </div>

      {/* Terms */}
      <p className="text-center text-xs text-gray-400 pb-8 px-6 leading-relaxed">
        بالمتابعة أنت توافق على{' '}
        <span className="text-primary font-semibold cursor-pointer">
          الشروط والأحكام
        </span>{' '}
        و{' '}
        <span className="text-primary font-semibold cursor-pointer">
          سياسة الخصوصية
        </span>
      </p>
    </div>
  );
}