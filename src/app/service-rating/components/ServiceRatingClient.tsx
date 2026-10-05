'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const BRAND = {
  primary: '#2a724d',
  accent: '#1d5236',
  light: 'rgba(42,114,77,0.12)',
  gradient: 'linear-gradient(145deg, #1d5236 0%, #2a724d 45%, #358f61 100%)',
};

const STAR_LABELS = ['', 'سيء', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'];
const STAR_COLORS = ['', '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E'];

const QUICK_TAGS = [
  { id: 'punctual', label: 'التزم بالمواعيد', icon: 'ClockIcon' },
  { id: 'professional', label: 'محترف', icon: 'StarIcon' },
  { id: 'clean', label: 'نظيف ومرتب', icon: 'SparklesIcon' },
  { id: 'friendly', label: 'ودود', icon: 'FaceSmileIcon' },
  { id: 'skilled', label: 'ماهر في عمله', icon: 'WrenchScrewdriverIcon' },
  { id: 'fair_price', label: 'سعر مناسب', icon: 'BanknotesIcon' },
];

interface OrderInfo {
  id: string;
  description: string | null;
  amount: number | null;
  created_at: string;
  craftsman: {
    id: string;
    specialty: string | null;
    user_profiles: { full_name: string; avatar_url?: string | null } | null;
  } | null;
  service: { name: string; emoji: string } | null;
}

type SubmitState = 'idle' | 'saving' | 'success' | 'already_reviewed' | 'error';

export default function ServiceRatingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const orderId = searchParams.get('orderId') || searchParams.get('id');

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeRating = hovered || rating;

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/phone-login-otp-verification'); return; }
    if (!orderId) { router.replace('/customer-orders'); return; }
    loadOrder();
  }, [user, authLoading, orderId]);

  const loadOrder = async () => {
    if (!user || !orderId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, description, amount, created_at,
          service:service_id(name, emoji),
          craftsman:craftsman_id(
            id, specialty,
            user_profiles:user_id(full_name, avatar_url)
          )
        `)
        .eq('id', orderId)
        .eq('customer_id', user.id)
        .eq('status', 'completed')
        .single();

      if (error || !data) {
        router.replace('/customer-orders');
        return;
      }

      // Check if already reviewed
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', orderId)
        .eq('customer_id', user.id)
        .maybeSingle();

      if (existing) {
        setSubmitState('already_reviewed');
      }

      const mapped: OrderInfo = {
        ...(data as any),
        craftsman: (data as any).craftsman
          ? {
              ...(data as any).craftsman,
              user_profiles: Array.isArray((data as any).craftsman.user_profiles)
                ? (data as any).craftsman.user_profiles[0] ?? null
                : (data as any).craftsman.user_profiles,
            }
          : null,
        service: Array.isArray((data as any).service) ? (data as any).service[0] ?? null : (data as any).service,
      };

      setOrder(mapped);
    } catch {
      router.replace('/customer-orders');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) { setErrorMsg('يرجى اختيار تقييم بالنجوم أولاً'); return; }
    if (!user || !order) return;

    setSubmitState('saving');
    setErrorMsg(null);

    try {
      const tagLabels = selectedTags.map(id => QUICK_TAGS.find(t => t.id === id)?.label).filter(Boolean);
      const fullComment = [
        tagLabels.length > 0 ? tagLabels.join(' • ') : null,
        comment.trim() || null,
      ].filter(Boolean).join('\n') || null;

      const { error } = await supabase.from('reviews').insert({
        order_id: order.id,
        customer_id: user.id,
        craftsman_id: order.craftsman?.id,
        rating,
        comment: fullComment,
      });

      if (error) {
        if (error.code === '23505') {
          setSubmitState('already_reviewed');
        } else {
          setErrorMsg('حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى');
          setSubmitState('idle');
        }
        return;
      }

      setSubmitState('success');
    } catch {
      setErrorMsg('حدث خطأ غير متوقع');
      setSubmitState('idle');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="screen-container flex items-center justify-center" style={{ background: 'var(--background)' }} dir="rtl">
        <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!order) return null;

  const craftsmanName = order.craftsman?.user_profiles?.full_name ?? 'الصنايعي';
  const craftsmanAvatar = (order.craftsman?.user_profiles as any)?.avatar_url ?? null;
  const craftsmanSpecialty = order.craftsman?.specialty ?? '';
  const serviceLabel = order.service ? `${order.service.emoji} ${order.service.name}` : 'خدمة';
  const orderDate = new Date(order.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Success Screen ──
  if (submitState === 'success') {
    return (
      <div className="screen-container flex flex-col items-center justify-center px-6 gap-6" style={{ background: 'var(--background)' }} dir="rtl">
        {/* Confetti-like decorative circles */}
        <div className="absolute top-16 right-8 w-16 h-16 rounded-full opacity-10" style={{ background: BRAND.primary }} />
        <div className="absolute top-32 left-6 w-10 h-10 rounded-full opacity-10" style={{ background: '#F59E0B' }} />
        <div className="absolute bottom-40 right-10 w-12 h-12 rounded-full opacity-10" style={{ background: BRAND.primary }} />

        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl"
          style={{ background: BRAND.gradient }}
        >
          <Icon name="CheckBadgeIcon" size={48} className="text-white" />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>شكراً على تقييمك! 🎉</h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            رأيك يساعدنا في تحسين جودة الخدمة وتطوير تجربة العملاء
          </p>
        </div>

        {/* Rating summary */}
        <div
          className="w-full rounded-2xl p-4 flex items-center gap-4"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: `2px solid ${BRAND.primary}30` }}>
            {craftsmanAvatar ? (
              <AppImage src={craftsmanAvatar} alt={`صورة ${craftsmanName}`} width={48} height={48} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: BRAND.light }}>
                <Icon name="UserCircleIcon" size={24} style={{ color: BRAND.primary }} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: 'var(--foreground)' }}>{craftsmanName}</p>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map(s => (
                <Icon key={s} name="StarIcon" size={14} variant="solid" style={{ color: s <= rating ? '#F59E0B' : 'var(--border)' }} />
              ))}
              <span className="text-xs font-semibold mr-1" style={{ color: '#F59E0B' }}>{STAR_LABELS[rating]}</span>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => router.push('/customer-orders')}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-base"
            style={{ background: BRAND.gradient }}
          >
            عرض طلباتي
          </button>
          <button
            onClick={() => router.push('/home-screen')}
            className="w-full py-3.5 rounded-2xl font-bold text-base"
            style={{ background: 'var(--card)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
          >
            الصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  // ── Already Reviewed Screen ──
  if (submitState === 'already_reviewed') {
    return (
      <div className="screen-container flex flex-col items-center justify-center px-6 gap-6" style={{ background: 'var(--background)' }} dir="rtl">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.12)' }}
        >
          <Icon name="StarIcon" size={40} variant="solid" style={{ color: '#F59E0B' }} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>تم التقييم مسبقاً</h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>لقد قمت بتقييم هذا الطلب من قبل، شكراً لك!</p>
        </div>
        <button
          onClick={() => router.push('/customer-orders')}
          className="w-full py-3.5 rounded-2xl font-bold text-white text-base"
          style={{ background: BRAND.gradient }}
        >
          عرض طلباتي
        </button>
      </div>
    );
  }

  // ── Main Rating Form ──
  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">

      {/* ── Header ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: BRAND.gradient, paddingTop: '2.75rem', paddingBottom: '4.5rem' }}
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
          <div>
            <p className="text-xs text-white/70 mb-0.5">تقييم الخدمة</p>
            <h1 className="text-lg font-bold text-white">شاركنا تجربتك</h1>
          </div>
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="px-4 -mt-8 pb-10 space-y-4 relative z-10">

        {/* ── Craftsman & Order Card ── */}
        <div
          className="rounded-2xl p-4 shadow-xl"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: `2px solid ${BRAND.primary}30` }}>
              {craftsmanAvatar ? (
                <AppImage src={craftsmanAvatar} alt={`صورة ${craftsmanName}`} width={64} height={64} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: BRAND.light }}>
                  <Icon name="UserCircleIcon" size={32} style={{ color: BRAND.primary }} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base truncate" style={{ color: 'var(--foreground)' }}>{craftsmanName}</p>
              {craftsmanSpecialty && (
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>{craftsmanSpecialty}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: BRAND.light, color: BRAND.primary }}
                >
                  {serviceLabel}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{orderDate}</span>
              </div>
            </div>
            {/* Completed badge */}
            <div
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(5,150,105,0.12)' }}
            >
              <Icon name="CheckBadgeIcon" size={22} style={{ color: '#059669' }} />
            </div>
          </div>

          {order.amount != null && (
            <div
              className="mt-3 pt-3 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>قيمة الخدمة</span>
              <span className="text-sm font-bold" style={{ color: BRAND.primary }}>
                {order.amount.toLocaleString('ar-SA')} ر.س
              </span>
            </div>
          )}
        </div>

        {/* ── Star Rating ── */}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <p className="text-sm font-bold mb-4 text-center" style={{ color: 'var(--foreground)' }}>
            كيف تقيّم الخدمة؟
          </p>

          <div className="flex justify-center gap-3 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="transition-all duration-150 active:scale-90"
                style={{
                  transform: activeRating >= star ? 'scale(1.2)' : 'scale(1)',
                  filter: activeRating >= star ? 'drop-shadow(0 2px 6px rgba(245,158,11,0.5))' : 'none',
                }}
              >
                <Icon
                  name="StarIcon"
                  size={44}
                  variant={activeRating >= star ? 'solid' : 'outline'}
                  style={{ color: activeRating >= star ? STAR_COLORS[activeRating] : 'var(--border)' }}
                />
              </button>
            ))}
          </div>

          {activeRating > 0 ? (
            <div className="text-center">
              <p
                className="text-base font-bold transition-all duration-200"
                style={{ color: STAR_COLORS[activeRating] }}
              >
                {STAR_LABELS[activeRating]}
              </p>
              <div className="flex justify-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <div
                    key={s}
                    className="h-1 rounded-full transition-all duration-300"
                    style={{
                      width: s <= activeRating ? '20px' : '8px',
                      background: s <= activeRating ? STAR_COLORS[activeRating] : 'var(--border)',
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
              اضغط على النجوم لتقييم الخدمة
            </p>
          )}
        </div>

        {/* ── Quick Tags ── */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <p className="text-sm font-bold mb-3" style={{ color: 'var(--foreground)' }}>
            ما الذي أعجبك؟ <span className="font-normal text-xs" style={{ color: 'var(--muted-foreground)' }}>(اختياري)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TAGS.map(tag => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 active:scale-95"
                  style={{
                    background: isSelected ? BRAND.primary : 'var(--muted)',
                    color: isSelected ? '#fff' : 'var(--muted-foreground)',
                    border: `1.5px solid ${isSelected ? BRAND.primary : 'var(--border)'}`,
                    boxShadow: isSelected ? `0 2px 8px ${BRAND.light}` : 'none',
                  }}
                >
                  <Icon
                    name={tag.icon as never}
                    size={13}
                    style={{ color: isSelected ? '#fff' : 'var(--muted-foreground)' }}
                  />
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Comment ── */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            تعليق إضافي <span className="font-normal text-xs" style={{ color: 'var(--muted-foreground)' }}>(اختياري)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="شاركنا تفاصيل تجربتك مع هذا الصنايعي..."
            rows={4}
            maxLength={500}
            className="w-full rounded-xl p-3 text-sm resize-none outline-none transition-all"
            style={{
              background: 'var(--background)',
              border: `1.5px solid ${comment.length > 0 ? BRAND.primary : 'var(--border)'}`,
              color: 'var(--foreground)',
              lineHeight: '1.6',
            }}
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {comment.length > 0 ? `${comment.length}/500 حرف` : 'حتى 500 حرف'}
            </p>
            {comment.length > 0 && (
              <button
                onClick={() => setComment('')}
                className="text-xs"
                style={{ color: 'var(--muted-foreground)' }}
              >
                مسح
              </button>
            )}
          </div>
        </div>

        {/* ── Error ── */}
        {errorMsg && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl text-sm"
            style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}
          >
            <Icon name="ExclamationCircleIcon" size={16} />
            {errorMsg}
          </div>
        )}

        {/* ── Submit Button ── */}
        <button
          onClick={handleSubmit}
          disabled={submitState === 'saving' || rating === 0}
          className="w-full py-4 rounded-2xl font-bold text-base transition-all duration-200 active:scale-[0.98]"
          style={{
            background: rating === 0 ? 'var(--muted)' : BRAND.gradient,
            color: rating === 0 ? 'var(--muted-foreground)' : '#fff',
            opacity: submitState === 'saving' ? 0.75 : 1,
            boxShadow: rating > 0 ? `0 4px 20px ${BRAND.light}` : 'none',
          }}
        >
          {submitState === 'saving' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              جاري إرسال التقييم...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Icon name="PaperAirplaneIcon" size={18} className="text-white" />
              إرسال التقييم
            </span>
          )}
        </button>

        {/* Skip link */}
        <button
          onClick={() => router.push('/customer-orders')}
          className="w-full py-2 text-sm text-center"
          style={{ color: 'var(--muted-foreground)' }}
        >
          تخطي الآن
        </button>
      </div>
    </div>
  );
}
