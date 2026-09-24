'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

type Role = 'customer' | 'craftsman' | null;

export default function OnboardingClient() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);

  return (
    <div className="screen-container flex flex-col min-h-screen bg-white" dir="rtl">
      {/* Logo area */}
      <div className="flex flex-col items-center pt-16 pb-6 px-6">
        {/* Logo icon */}
        <div className="w-24 h-24 mb-4 flex items-center justify-center">
          <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Wrench */}
            <path d="M20 76 L52 44" stroke="#1B5E20" strokeWidth="5" strokeLinecap="round"/>
            <circle cx="18" cy="78" r="8" fill="#1B5E20"/>
            <path d="M52 44 C52 44 60 30 70 28 C72 36 68 44 60 48 L52 44Z" fill="#1B5E20"/>
            {/* Handshake */}
            <path d="M48 52 C54 46 64 44 72 48 L80 56 C76 62 68 64 62 60 L56 56 L48 52Z" fill="#F9A825"/>
            <path d="M44 56 C38 62 36 70 40 76 L48 68 L52 60 L44 56Z" fill="#F9A825"/>
          </svg>
        </div>
        {/* App name */}
        <h1 className="text-4xl font-black text-primary mb-1">صنايعي</h1>
        <p className="text-sm font-medium" style={{ color: '#F9A825' }}>نبني ثقة، ونصنع فرق</p>
      </div>

      {/* Welcome text */}
      <div className="text-center px-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">مرحباً بك في صنايعي</h2>
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
              selectedRole === 'customer' ?'border-primary bg-green-50' :'border-gray-200 bg-white'
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
              selectedRole === 'craftsman' ?'border-primary bg-green-50' :'border-gray-200 bg-white'
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
        <Link href="/phone-login-otp-verification">
          <button
            className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all"
            style={{
              background: selectedRole ? '#1B5E20' : '#9CA3AF',
              opacity: selectedRole ? 1 : 0.7,
            }}
            disabled={!selectedRole}
          >
            متابعة
          </button>
        </Link>
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