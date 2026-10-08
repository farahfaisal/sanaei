'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import BottomTabBar from '@/components/BottomTabBar';
import RatingModal from './RatingModal';
import { rtChannelName } from '@/lib/supabase/realtime';
import { Spinner } from '@/components/ui/Loader';

const BRAND = {
  primary: '#2a724d',
  accent: '#1d5236',
  light: 'rgba(42,114,77,0.12)',
  gradient: 'linear-gradient(145deg, #2a724d 0%, #1d5236 55%, #358f61 100%)',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; step: number }> = {
  pending:     { label: 'قيد الانتظار',  color: '#D97706', bg: 'rgba(217,119,6,0.12)',   icon: 'ClockIcon',               step: 0 },
  accepted:    { label: 'تم القبول',      color: '#0284C7', bg: 'rgba(2,132,199,0.12)',   icon: 'CheckCircleIcon',         step: 1 },
  in_progress: { label: 'جاري التنفيذ',  color: '#7C3AED', bg: 'rgba(124,58,237,0.12)', icon: 'WrenchScrewdriverIcon',   step: 2 },
  completed:   { label: 'مكتمل',          color: '#059669', bg: 'rgba(5,150,105,0.12)',   icon: 'CheckBadgeIcon',          step: 3 },
  cancelled:   { label: 'ملغي',           color: '#DC2626', bg: 'rgba(220,38,38,0.12)',   icon: 'XCircleIcon',             step: -1 },
};

const TIMELINE_STEPS = [
  { status: 'pending',     label: 'تم استلام الطلب',       sublabel: 'طلبك في انتظار الحِرَفي',        icon: 'ClipboardDocumentListIcon' },
  { status: 'accepted',    label: 'قبل الحِرَفي الطلب',    sublabel: 'الحِرَفي في طريقه إليك',          icon: 'CheckCircleIcon' },
  { status: 'in_progress', label: 'جاري تنفيذ الخدمة',     sublabel: 'الحِرَفي يعمل الآن',              icon: 'WrenchScrewdriverIcon' },
  { status: 'completed',   label: 'اكتملت الخدمة',         sublabel: 'تم إنجاز الطلب بنجاح',            icon: 'CheckBadgeIcon' },
];

const STATUS_ORDER = ['pending', 'accepted', 'in_progress', 'completed'];

const ETA_BY_STATUS: Record<string, string> = {
  pending:     'في انتظار القبول',
  accepted:    '15 - 30 دقيقة',
  in_progress: 'جاري التنفيذ الآن',
  completed:   'تم الإنجاز',
  cancelled:   'تم الإلغاء',
};

interface OrderData {
  id: string;
  status: string;
  description: string | null;
  address: string | null;
  amount: number | null;
  payment_method: string | null;
  payment_status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  scheduled_at: string | null;
  craftsman: {
    id: string;
    specialty: string | null;
    rating: number;
    is_online: boolean;
    user_profiles: { full_name: string; phone?: string | null; avatar_url?: string | null } | null;
  } | null;
  service: {
    name: string;
    emoji: string;
  } | null;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function OrderLiveStatusClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const orderId = searchParams.get('id');

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pulse, setPulse] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!orderId || !user) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, status, description, address, amount,
          payment_method, payment_status, notes,
          created_at, updated_at, scheduled_at,
          service:service_id(name, emoji),
          craftsman:craftsman_id(
            id, specialty, rating, is_online,
            user_profiles:user_id(full_name, phone, avatar_url)
          )
        `)
        .eq('id', orderId)
        .eq('customer_id', user.id)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      const mapped: OrderData = {
        ...(data as any),
        craftsman: data.craftsman
          ? {
              ...(data.craftsman as any),
              user_profiles: Array.isArray((data.craftsman as any).user_profiles)
                ? (data.craftsman as any).user_profiles[0] ?? null
                : (data.craftsman as any).user_profiles,
            }
          : null,
        service: Array.isArray(data.service) ? data.service[0] ?? null : data.service,
      };

      setOrder(mapped);
      setLastUpdated(new Date());
      setPulse(true);
      setTimeout(() => setPulse(false), 800);

      // Check if already reviewed when order is completed
      if ((data as any).status === 'completed') {
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('order_id', orderId)
          .eq('customer_id', user.id)
          .maybeSingle();
        setAlreadyReviewed(!!existingReview);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  // Initial load
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/phone-login-otp-verification'); return; }
    if (!orderId) { router.replace('/home-screen'); return; }
    fetchOrder();
  }, [user, authLoading, orderId]);

  // Real-time subscription
  useEffect(() => {
    if (!orderId || !user) return;

    const channel = supabase
      .channel(rtChannelName(`order-live-${orderId}`))
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => { fetchOrder(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId, user, fetchOrder]);

  if (loading) {
    return (
      <div className="screen-container flex flex-col items-center justify-center gap-4" style={{ background: 'var(--background)' }} dir="rtl">
        <Spinner size={48} />
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>جاري تحميل حالة الطلب...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="screen-container flex flex-col items-center justify-center gap-4 px-6" style={{ background: 'var(--background)' }} dir="rtl">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: BRAND.light }}>
          <Icon name="ExclamationCircleIcon" size={36} style={{ color: BRAND.primary }} />
        </div>
        <h2 className="text-lg font-bold text-center" style={{ color: 'var(--foreground)' }}>الطلب غير موجود</h2>
        <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>لم يتم العثور على هذا الطلب أو ليس لديك صلاحية عرضه</p>
        <button
          onClick={() => router.replace('/home-screen')}
          className="mt-2 px-6 py-3 rounded-xl font-bold text-white text-sm"
          style={{ background: BRAND.primary }}
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG['pending'];
  const currentStep = STATUS_ORDER.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';
  const isCompleted = order.status === 'completed';
  const craftsmanName = order.craftsman?.user_profiles?.full_name ?? 'الحرفي';
  const craftsmanPhone = order.craftsman?.user_profiles?.phone ?? null;
  const craftsmanAvatar = order.craftsman?.user_profiles?.avatar_url ?? null;

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">
      {/* ── Header ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: BRAND.gradient, paddingTop: '2.75rem', paddingBottom: '5rem' }}
      >
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-4 right-4 w-20 h-20 rounded-full opacity-8" style={{ background: '#fff' }} />
        <div className="relative px-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <Icon name="ArrowRightIcon" size={18} className="text-white" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-white opacity-70 mb-0.5">حالة الطلب المباشرة</p>
            <h1 className="text-lg font-bold text-white leading-tight">
              {order.service ? `${order.service.emoji} ${order.service.name}` : 'طلب خدمة'}
            </h1>
            <p className="text-xs text-white opacity-60 mt-0.5">#{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <span
              className={`w-2 h-2 rounded-full ${pulse ? 'scale-125' : 'scale-100'} transition-transform`}
              style={{ background: isCancelled ? '#EF4444' : isCompleted ? '#34D399' : '#F59E0B', boxShadow: `0 0 6px ${isCancelled ? '#EF4444' : isCompleted ? '#34D399' : '#F59E0B'}` }}
            />
            <span className="text-xs font-semibold text-white">{isCancelled ? 'ملغي' : isCompleted ? 'مكتمل' : 'مباشر'}</span>
          </div>
        </div>
      </div>

      {/* ── Status Card (floating) ── */}
      <div className="px-4 -mt-10 relative z-10 mb-4">
        <div
          className="rounded-2xl p-4 shadow-2xl"
          style={{ background: 'var(--card)', border: `1.5px solid ${statusCfg.color}40` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: statusCfg.bg }}>
                <Icon name={statusCfg.icon as never} size={20} style={{ color: statusCfg.color }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>الحالة الحالية</p>
                <p className="text-base font-bold" style={{ color: statusCfg.color }}>{statusCfg.label}</p>
              </div>
            </div>
            {/* ETA */}
            <div className="text-left">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>الوقت المتوقع</p>
              <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{ETA_BY_STATUS[order.status] ?? '—'}</p>
            </div>
          </div>

          {/* Last updated */}
          {lastUpdated && (
            <div className="flex items-center gap-1.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
              <Icon name="ArrowPathIcon" size={12} style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                آخر تحديث: {formatTime(lastUpdated.toISOString())}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-28 space-y-4">
        {/* ── Progress Timeline ── */}
        {!isCancelled && (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <p className="text-sm font-bold mb-4" style={{ color: 'var(--foreground)' }}>مراحل الطلب</p>
            <div className="space-y-0">
              {TIMELINE_STEPS.map((step, idx) => {
                const stepIndex = STATUS_ORDER.indexOf(step.status);
                const isDone = currentStep >= stepIndex;
                const isActive = currentStep === stepIndex;
                const isLast = idx === TIMELINE_STEPS.length - 1;

                return (
                  <div key={step.status} className="flex gap-3">
                    {/* Left: icon + connector */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500"
                        style={{
                          background: isDone ? BRAND.primary : 'var(--muted)',
                          border: isActive ? `2px solid ${BRAND.primary}` : 'none',
                          boxShadow: isActive ? `0 0 12px ${BRAND.light}` : 'none',
                        }}
                      >
                        {isDone && !isActive ? (
                          <Icon name="CheckIcon" size={16} className="text-white" />
                        ) : (
                          <Icon
                            name={step.icon as never}
                            size={16}
                            style={{ color: isActive ? '#fff' : 'var(--muted-foreground)' }}
                          />
                        )}
                      </div>
                      {!isLast && (
                        <div
                          className="w-0.5 flex-1 my-1 transition-all duration-500"
                          style={{
                            background: isDone && currentStep > stepIndex ? BRAND.primary : 'var(--border)',
                            minHeight: '24px',
                          }}
                        />
                      )}
                    </div>
                    {/* Right: text */}
                    <div className={`pb-4 flex-1 ${isLast ? 'pb-0' : ''}`}>
                      <p
                        className="text-sm font-bold leading-tight"
                        style={{ color: isDone ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                      >
                        {step.label}
                        {isActive && (
                          <span
                            className="mr-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: BRAND.light, color: BRAND.primary }}
                          >
                            الآن
                          </span>
                        )}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {step.sublabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Cancelled Banner ── */}
        {isCancelled && (
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.3)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(220,38,38,0.12)' }}>
              <Icon name="XCircleIcon" size={22} style={{ color: '#DC2626' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#DC2626' }}>تم إلغاء الطلب</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>يمكنك إنشاء طلب جديد من الصفحة الرئيسية</p>
            </div>
          </div>
        )}

        {/* ── Craftsman Card ── */}
        {order.craftsman && (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <p className="text-sm font-bold mb-3" style={{ color: 'var(--foreground)' }}>الحِرَفي</p>
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl overflow-hidden" style={{ border: `2px solid ${BRAND.primary}30` }}>
                  {craftsmanAvatar ? (
                    <AppImage
                      src={craftsmanAvatar}
                      alt={`صورة ${craftsmanName}`}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: BRAND.light }}>
                      <Icon name="UserCircleIcon" size={28} style={{ color: BRAND.primary }} />
                    </div>
                  )}
                </div>
                {order.craftsman.is_online && (
                  <span
                    className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full border-2"
                    style={{ background: '#22c55e', borderColor: 'var(--card)' }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-tight truncate" style={{ color: 'var(--foreground)' }}>{craftsmanName}</p>
                {order.craftsman.specialty && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>{order.craftsman.specialty}</p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <Icon name="StarIcon" size={12} variant="solid" style={{ color: '#F59E0B' }} />
                  <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>{order.craftsman.rating?.toFixed(1) ?? '—'}</span>
                </div>
              </div>
              {/* Call button */}
              {craftsmanPhone && (
                <a
                  href={`tel:${craftsmanPhone}`}
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: BRAND.light }}
                >
                  <Icon name="PhoneIcon" size={20} style={{ color: BRAND.primary }} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Order Details ── */}
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>تفاصيل الطلب</p>

          {order.description && (
            <div className="flex gap-2.5">
              <Icon name="DocumentTextIcon" size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{order.description}</p>
            </div>
          )}

          {order.address && (
            <div className="flex gap-2.5">
              <Icon name="MapPinIcon" size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>{order.address}</p>
            </div>
          )}

          {order.scheduled_at && (
            <div className="flex gap-2.5">
              <Icon name="CalendarDaysIcon" size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                {formatDate(order.scheduled_at)} — {formatTime(order.scheduled_at)}
              </p>
            </div>
          )}

          {order.amount != null && (
            <div className="flex gap-2.5">
              <Icon name="BanknotesIcon" size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {order.amount.toLocaleString('ar-SA')} ر.س
              </p>
            </div>
          )}

          <div className="flex gap-2.5">
            <Icon name="ClockIcon" size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              أُنشئ في {formatDate(order.created_at)}
            </p>
          </div>
        </div>

        {/* ── Completed CTA ── */}
        {isCompleted && (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(5,150,105,0.08)', border: '1.5px solid rgba(5,150,105,0.3)' }}
          >
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(5,150,105,0.15)' }}>
                <Icon name="CheckBadgeIcon" size={24} style={{ color: '#059669' }} />
              </div>
              <p className="font-bold text-sm mb-1" style={{ color: '#059669' }}>تم إنجاز الخدمة بنجاح 🎉</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>شكراً لاستخدامك حِرَفي</p>
            </div>

            {/* Rating CTA */}
            {reviewSubmitted || alreadyReviewed ? (
              <div
                className="flex items-center justify-center gap-2 py-3 rounded-xl"
                style={{ background: 'rgba(5,150,105,0.12)' }}
              >
                <Icon name="StarIcon" size={18} variant="solid" style={{ color: '#F59E0B' }} />
                <p className="text-sm font-semibold" style={{ color: '#059669' }}>
                  {reviewSubmitted ? 'شكراً! تم إرسال تقييمك' : 'لقد قيّمت هذا الطلب مسبقاً'}
                </p>
              </div>
            ) : (
              <button
                onClick={() => setShowRatingModal(true)}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-opacity active:opacity-80"
                style={{ background: BRAND.primary, color: '#fff' }}
              >
                <Icon name="StarIcon" size={18} variant="solid" className="text-yellow-300" />
                قيّم الحِرَفي
              </button>
            )}
          </div>
        )}
      </div>

      <BottomTabBar activeTab="orders" />

      {/* Rating Modal */}
      {showRatingModal && order?.craftsman && (
        <RatingModal
          orderId={order.id}
          craftsmanId={order.craftsman.id}
          craftsmanName={order.craftsman.user_profiles?.full_name ?? 'الحرفي'}
          craftsmanAvatar={order.craftsman.user_profiles?.avatar_url ?? null}
          onClose={() => setShowRatingModal(false)}
          onSuccess={() => {
            setShowRatingModal(false);
            setReviewSubmitted(true);
          }}
        />
      )}
    </div>
  );
}
