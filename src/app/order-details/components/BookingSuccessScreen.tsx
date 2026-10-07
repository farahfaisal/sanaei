'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';

const BRAND = {
  primary:  '#2a724d',
  accent:   '#1d5236',
  light:    'rgba(42,114,77,0.10)',
  gradient: 'linear-gradient(145deg, #2a724d 0%, #1d5236 55%, #358f61 100%)',
};

interface BookingSuccessScreenProps {
  orderId: string;
  craftsman: {
    name: string;
    specialty: string | null;
    rating: number;
    avatarUrl: string | null;
  };
  serviceName: string | null;
  serviceEmoji: string | null;
  scheduledDate: string;
  scheduledTime: string;
  estimatedCost: string | null;
  location: string;
  onGoToPayment: () => void;
  onViewOrder: () => void;
}

export default function BookingSuccessScreen({
  orderId,
  craftsman,
  serviceName,
  serviceEmoji,
  scheduledDate,
  scheduledTime,
  estimatedCost,
  location,
  onGoToPayment,
  onViewOrder,
}: BookingSuccessScreenProps) {
  const router = useRouter();
  const checkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Trigger entrance animation
    const el = checkRef.current;
    if (el) {
      el.style.transform = 'scale(0)';
      el.style.opacity = '0';
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease';
        el.style.transform = 'scale(1)';
        el.style.opacity = '1';
      });
    }
  }, []);

  const shortOrderId = orderId.slice(0, 8).toUpperCase();

  const formatDate = (date: string, time: string) => {
    if (!date) return 'سيتم التحديد لاحقاً';
    const d = new Date(`${date}T${time || '09:00'}:00`);
    return d.toLocaleDateString('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) + (time ? ` — ${time}` : '');
  };

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">

      {/* ── TOP GRADIENT HEADER ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: BRAND.gradient, paddingTop: '3rem', paddingBottom: '5rem' }}
      >
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-4 right-4 w-20 h-20 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-5" style={{ background: '#fff' }} />

        {/* Success check icon */}
        <div className="relative flex flex-col items-center gap-3 px-4">
          <div
            ref={checkRef}
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
            style={{ background: 'rgba(255,255,255,0.22)', border: '3px solid rgba(255,255,255,0.5)' }}
          >
            <Icon name="CheckIcon" size={40} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-white leading-tight">تم إرسال طلبك بنجاح! 🎉</h1>
            <p className="text-sm text-white opacity-75 mt-1">سيتواصل معك الحرفي قريباً</p>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="px-4 -mt-10 pb-28 space-y-4 relative z-10">

        {/* ── ORDER ID CARD ── */}
        <div
          className="rounded-2xl p-4 shadow-xl"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: BRAND.light }}
              >
                <Icon name="HashtagIcon" size={18} style={{ color: BRAND.primary }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>رقم الطلب</p>
                <p className="text-base font-black tracking-widest" style={{ color: BRAND.primary }}>
                  #{shortOrderId}
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(217,119,6,0.12)' }}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-bold" style={{ color: '#D97706' }}>قيد الانتظار</span>
            </div>
          </div>
        </div>

        {/* ── CRAFTSMAN DETAILS ── */}
        <div
          className="rounded-2xl overflow-hidden shadow-lg"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>الحرفي المختار</p>
          </div>
          <div className="p-4 flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ background: BRAND.light, border: `2px solid ${BRAND.primary}` }}
            >
              {craftsman.avatarUrl ? (
                <AppImage
                  src={craftsman.avatarUrl}
                  alt={`صورة ${craftsman.name}`}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Icon name="UserCircleIcon" size={30} style={{ color: BRAND.primary }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base truncate" style={{ color: 'var(--foreground)' }}>{craftsman.name}</p>
              {craftsman.specialty && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{craftsman.specialty}</p>
              )}
              {craftsman.rating > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <Icon name="StarIcon" size={12} variant="solid" className="text-yellow-500" />
                  <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                    {craftsman.rating.toFixed(1)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>تقييم</span>
                </div>
              )}
            </div>
            {serviceName && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0"
                style={{ background: BRAND.light }}
              >
                <span className="text-base">{serviceEmoji || '🔧'}</span>
                <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>{serviceName}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── BOOKING DETAILS GRID ── */}
        <div
          className="rounded-2xl overflow-hidden shadow-lg"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>تفاصيل الحجز</p>
          </div>
          <div className="p-4 space-y-3">

            {/* Scheduled date/time */}
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(2,132,199,0.10)' }}
              >
                <Icon name="CalendarDaysIcon" size={18} style={{ color: '#0284C7' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>الموعد المجدول</p>
                <p className="text-sm font-bold mt-0.5 leading-snug" style={{ color: 'var(--foreground)' }}>
                  {formatDate(scheduledDate, scheduledTime)}
                </p>
              </div>
            </div>

            <div className="h-px" style={{ background: 'var(--border)' }} />

            {/* Location */}
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(124,58,237,0.10)' }}
              >
                <Icon name="MapPinIcon" size={18} style={{ color: '#7C3AED' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>موقع الخدمة</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--foreground)' }}>{location}</p>
              </div>
            </div>

            {/* Estimated cost */}
            {estimatedCost && (
              <>
                <div className="h-px" style={{ background: 'var(--border)' }} />
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(5,150,105,0.10)' }}
                  >
                    <Icon name="BanknotesIcon" size={18} style={{ color: '#059669' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>التكلفة التقديرية</p>
                    <p className="text-sm font-black mt-0.5" style={{ color: '#059669' }}>{estimatedCost}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      السعر النهائي يُحدد بعد معاينة الحرفي
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── WHAT'S NEXT ── */}
        <div
          className="rounded-2xl p-4"
          style={{ background: BRAND.light, border: `1.5px solid ${BRAND.primary}22` }}
        >
          <p className="text-sm font-bold mb-3" style={{ color: BRAND.primary }}>ماذا يحدث الآن؟</p>
          <div className="space-y-2.5">
            {[
              { icon: 'BellAlertIcon', text: 'سيتلقى الحرفي إشعاراً بطلبك فوراً' },
              { icon: 'ChatBubbleLeftRightIcon', text: 'يمكنك التواصل معه عبر المحادثة' },
              { icon: 'CreditCardIcon', text: 'أتمم الدفع لتأكيد الحجز' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: BRAND.primary }}
                >
                  <Icon name={step.icon} size={14} className="text-white" />
                </div>
                <p className="text-xs font-medium" style={{ color: BRAND.accent }}>{step.text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── FIXED BOTTOM ACTIONS ── */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 space-y-2.5 z-50"
        style={{ background: 'var(--background)', borderTop: '1px solid var(--border)' }}
      >
        <button
          onClick={onGoToPayment}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: BRAND.gradient }}
        >
          <Icon name="CreditCardIcon" size={18} className="text-white" />
          المتابعة للدفع
        </button>
        <button
          onClick={onViewOrder}
          className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
        >
          <Icon name="ClipboardDocumentListIcon" size={16} />
          عرض تفاصيل الطلب
        </button>
      </div>
    </div>
  );
}
