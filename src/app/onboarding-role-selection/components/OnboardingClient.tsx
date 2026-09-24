'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

type Role = 'customer' | 'craftsman' | null;

export default function OnboardingClient() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);

  return (
    <div className="screen-container flex flex-col min-h-screen" style={{ background: 'linear-gradient(160deg, #0F1A14 0%, #162219 60%, #0F1A14 100%)' }} dir="rtl">
      {/* Logo area */}
      <div className="flex flex-col items-center pt-16 pb-6 px-6">
        <div className="w-40 h-40 mb-4 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full blur-2xl opacity-20" style={{ background: '#C9A84C' }} />
          <img
            src="/assets/images/__________________24_-1790287739442.png"
            alt="شعار صنايعي"
            className="w-full h-full object-contain relative z-10"
          />
        </div>
      </div>

      {/* Welcome text */}
      <div className="text-center px-6 mb-6">
        <h2 className="text-xl font-bold mb-1" style={{ color: '#F0EAD6' }}>مرحباً بك في صنايعي</h2>
        <p className="text-sm" style={{ color: '#8A9E8E' }}>كيف تريد استخدام التطبيق؟</p>
      </div>

      {/* Role Cards */}
      <div className="flex flex-col gap-4 px-5 mb-6">
        {/* Customer Card */}
        <button
          onClick={() => setSelectedRole('customer')}
          className="w-full text-right"
        >
          <div
            className="relative rounded-2xl border-2 p-4 transition-all duration-200"
            style={{
              borderColor: selectedRole === 'customer' ? '#C9A84C' : '#243B2C',
              background: selectedRole === 'customer' ? 'rgba(201,168,76,0.08)' : '#162219',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: selectedRole === 'customer' ? '#1B6B5A' : '#1A2E24' }}
              >
                <Icon
                  name="UserIcon"
                  size={24}
                  className={selectedRole === 'customer' ? 'text-white' : 'text-gray-500'}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-base font-bold" style={{ color: '#F0EAD6' }}>أنا زبون</h3>
                  {selectedRole === 'customer' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#C9A84C', color: '#0F1A14' }}>
                      ★ الأكثر استخداماً
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: '#8A9E8E' }}>
                  أبحث عن صنايعي موثوق بالقرب مني
                </p>
              </div>
              <div
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  borderColor: selectedRole === 'customer' ? '#C9A84C' : '#3A5A40',
                  background: selectedRole === 'customer' ? '#C9A84C' : 'transparent',
                }}
              >
                {selectedRole === 'customer' && (
                  <div className="w-2 h-2 rounded-full" style={{ background: '#0F1A14' }} />
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
            className="relative rounded-2xl border-2 p-4 transition-all duration-200"
            style={{
              borderColor: selectedRole === 'craftsman' ? '#C9A84C' : '#243B2C',
              background: selectedRole === 'craftsman' ? 'rgba(201,168,76,0.08)' : '#162219',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: selectedRole === 'craftsman' ? '#1B6B5A' : '#1A2E24' }}
              >
                <Icon
                  name="WrenchScrewdriverIcon"
                  size={24}
                  className={selectedRole === 'craftsman' ? 'text-white' : 'text-gray-500'}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-base font-bold" style={{ color: '#F0EAD6' }}>أنا صنايعي</h3>
                  {selectedRole === 'craftsman' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#C9A84C', color: '#0F1A14' }}>
                      ✓ انضم إلينا
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: '#8A9E8E' }}>
                  أعرض خدماتي وأستقبل طلبات العملاء
                </p>
              </div>
              <div
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  borderColor: selectedRole === 'craftsman' ? '#C9A84C' : '#3A5A40',
                  background: selectedRole === 'craftsman' ? '#C9A84C' : 'transparent',
                }}
              >
                {selectedRole === 'craftsman' && (
                  <div className="w-2 h-2 rounded-full" style={{ background: '#0F1A14' }} />
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
            className="w-full py-4 rounded-2xl font-bold text-base transition-all"
            style={{
              background: selectedRole ? 'linear-gradient(135deg, #1B6B5A 0%, #23896F 100%)' : '#1A2E24',
              color: selectedRole ? '#FFFFFF' : '#5A7A60',
              opacity: selectedRole ? 1 : 0.7,
              boxShadow: selectedRole ? '0 4px 20px rgba(27,107,90,0.4)' : 'none',
            }}
            disabled={!selectedRole}
          >
            متابعة
          </button>
        </Link>
      </div>

      {/* Terms */}
      <p className="text-center text-xs pb-8 px-6 leading-relaxed" style={{ color: '#5A7A60' }}>
        بالمتابعة أنت توافق على{' '}
        <span className="font-semibold cursor-pointer" style={{ color: '#C9A84C' }}>
          الشروط والأحكام
        </span>{' '}
        و{' '}
        <span className="font-semibold cursor-pointer" style={{ color: '#C9A84C' }}>
          سياسة الخصوصية
        </span>
      </p>
    </div>
  );
}