'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import BottomTabBar from '@/components/BottomTabBar';

// ── Brand palette (matches app's primary green) ──────────────────────────────
const BRAND = {
  primary:  '#1B5E20',
  accent:   '#2E7D32',
  light:    'rgba(27,94,32,0.10)',
  gradient: 'linear-gradient(145deg, #1B5E20 0%, #2E7D32 55%, #388E3C 100%)',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; icon: string }> = {
  pending:     { label: 'قيد الانتظار',  color: '#D97706', bg: 'rgba(217,119,6,0.12)',   dot: '#F59E0B', icon: 'ClockIcon' },
  accepted:    { label: 'مقبول',          color: '#0284C7', bg: 'rgba(2,132,199,0.12)',   dot: '#38BDF8', icon: 'CheckCircleIcon' },
  in_progress: { label: 'جاري التنفيذ',  color: '#7C3AED', bg: 'rgba(124,58,237,0.12)', dot: '#A78BFA', icon: 'WrenchScrewdriverIcon' },
  completed:   { label: 'مكتمل',          color: '#059669', bg: 'rgba(5,150,105,0.12)',   dot: '#34D399', icon: 'CheckBadgeIcon' },
  cancelled:   { label: 'ملغي',           color: '#DC2626', bg: 'rgba(220,38,38,0.12)',   dot: '#F87171', icon: 'XCircleIcon' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card:      'بطاقة إلكترونية',
  cash:      'كاش',
  apple_pay: 'Apple Pay',
  wallet:    'المحفظة',
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:  { label: 'في الانتظار', color: '#D97706' },
  paid:     { label: 'مدفوع',       color: '#059669' },
  refunded: { label: 'مُسترد',      color: '#0284C7' },
  failed:   { label: 'فشل',         color: '#DC2626' },
};

// Timeline steps in order
const TIMELINE_STEPS = [
  { status: 'pending',     label: 'تم استلام الطلب',    icon: 'ClipboardDocumentListIcon' },
  { status: 'accepted',    label: 'قبل الصنايعي الطلب', icon: 'CheckCircleIcon' },
  { status: 'in_progress', label: 'جاري تنفيذ الخدمة',  icon: 'WrenchScrewdriverIcon' },
  { status: 'completed',   label: 'اكتملت الخدمة',      icon: 'CheckBadgeIcon' },
];

const STATUS_ORDER = ['pending', 'accepted', 'in_progress', 'completed'];

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
    avatar_url: string | null;
    phone?: string | null;
    user_profiles: { full_name: string; phone?: string | null } | null;
  } | null;
  service: {
    id: string;
    name: string;
    emoji: string;
    base_price: number | null;
    price_label: string | null;
    description: string | null;
  } | null;
  customer?: {
    user_profiles: { full_name: string; phone?: string | null } | null;
  } | null;
}

// ── Craftsman Orders List View ────────────────────────────────────────────────
function CraftsmanOrdersList() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const supabase = createClient();

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    if (user) loadCraftsmanOrders();
  }, [user]);

  const loadCraftsmanOrders = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select(`
          id, status, description, address, amount,
          payment_method, payment_status, notes,
          created_at, updated_at, scheduled_at,
          service:service_id(id, name, emoji, base_price, price_label, description),
          customer:customer_id(user_profiles(full_name, phone))
        `)
        .eq('craftsman_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setOrders((data as unknown as OrderData[]) || []);
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const activeOrders = orders.filter(o => ['pending', 'accepted', 'in_progress'].includes(o.status));
  const completedOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status));
  const displayedOrders = activeTab === 'active' ? activeOrders : completedOrders;

  const craftsmanName = profile?.full_name || 'الصنايعي';

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: BRAND.gradient, paddingTop: '2.75rem', paddingBottom: '4.5rem' }}
      >
        <div className="absolute -top-6 -left-6 w-36 h-36 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-6 right-6 w-16 h-16 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="relative px-4">
          <p className="text-xs font-medium text-white opacity-75 mb-0.5">مرحباً،</p>
          <h1 className="text-xl font-bold text-white leading-tight">{craftsmanName}</h1>
          <p className="text-xs text-white opacity-60 mt-1">إدارة طلباتك</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="px-4 -mt-8 relative z-10 mb-4">
        <div
          className="rounded-2xl p-4 shadow-xl grid grid-cols-3 gap-3"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          {[
            { label: 'إجمالي', value: orders.length, color: BRAND.primary },
            { label: 'نشطة', value: activeOrders.length, color: '#D97706' },
            { label: 'مكتملة', value: completedOrders.length, color: '#059669' },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--muted)' }}>
          {[
            { key: 'active', label: `الطلبات النشطة (${activeOrders.length})` },
            { key: 'completed', label: `المكتملة (${completedOrders.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'active' | 'completed')}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background: activeTab === tab.key ? BRAND.primary : 'transparent',
                color: activeTab === tab.key ? '#fff' : 'var(--muted-foreground)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      <div className="px-4 pb-24 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>جاري تحميل الطلبات...</p>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: BRAND.light }}>
              <Icon name="ClipboardDocumentListIcon" size={28} style={{ color: BRAND.primary }} />
            </div>
            <p className="font-bold text-base" style={{ color: 'var(--foreground)' }}>
              {activeTab === 'active' ? 'لا توجد طلبات نشطة' : 'لا توجد طلبات مكتملة'}
            </p>
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              {activeTab === 'active' ? 'ستظهر هنا الطلبات الجديدة عند وصولها' : 'ستظهر هنا الطلبات المكتملة'}
            </p>
          </div>
        ) : (
          displayedOrders.map((order) => {
            const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const service = Array.isArray(order.service) ? order.service[0] : order.service;
            const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
            const customerName = (customer as any)?.user_profiles?.full_name || 'زبون';
            const serviceName = service?.name || 'خدمة صيانة';
            const serviceEmoji = service?.emoji || '🔧';
            const createdDate = new Date(order.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });

            return (
              <button
                key={order.id}
                onClick={() => router.push(`/order-details?order_id=${order.id}`)}
                className="w-full text-right rounded-2xl p-4 transition-all active:scale-[0.98]"
                style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                    style={{ background: BRAND.light }}
                  >
                    {serviceEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--foreground)' }}>{serviceName}</p>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
                        style={{ background: statusInfo.bg, color: statusInfo.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusInfo.dot }} />
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      الزبون: {customerName}
                    </p>
                    {order.address && (
                      <p className="text-xs truncate mb-1" style={{ color: 'var(--muted-foreground)' }}>
                        📍 {order.address}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{createdDate}</p>
                      {order.amount && order.amount > 0 && (
                        <p className="text-sm font-black" style={{ color: BRAND.primary }}>
                          {order.amount.toLocaleString()} ر.س
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}

// ── Single Order Detail View ──────────────────────────────────────────────────
function SingleOrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrder(orderId);
  }, [orderId]);

  const loadOrder = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('orders')
        .select(`
          id, status, description, address, amount,
          payment_method, payment_status, notes,
          created_at, updated_at, scheduled_at,
          craftsman:craftsman_id(
            id, specialty, rating, avatar_url,
            user_profiles(full_name, phone)
          ),
          service:service_id(
            id, name, emoji, base_price, price_label, description
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (qErr) throw qErr;
      if (!data) {
        setError('لم يتم العثور على الطلب');
        return;
      }

      const normalized: OrderData = {
        ...data,
        craftsman: Array.isArray(data.craftsman) ? data.craftsman[0] : data.craftsman,
        service:   Array.isArray(data.service)   ? data.service[0]   : data.service,
      } as OrderData;

      setOrder(normalized);
    } catch {
      setError('حدث خطأ أثناء تحميل تفاصيل الطلب');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const statusInfo  = order ? (STATUS_CONFIG[order.status] || STATUS_CONFIG.pending) : STATUS_CONFIG.pending;
  const currentStep = order ? STATUS_ORDER.indexOf(order.status) : 0;

  const craftsmanName  = order?.craftsman?.user_profiles?.full_name || 'الصنايعي';
  const craftsmanPhone = order?.craftsman?.user_profiles?.phone || null;
  const craftsmanRating = order?.craftsman?.rating || 0;
  const craftsmanAvatar = order?.craftsman?.avatar_url || null;
  const specialty       = order?.craftsman?.specialty || '';

  const serviceName  = order?.service?.name  || 'خدمة صيانة';
  const serviceEmoji = order?.service?.emoji || '🔧';
  const serviceDesc  = order?.service?.description || order?.description || '';

  const amount        = order?.amount || 0;
  const payMethod     = PAYMENT_METHOD_LABELS[order?.payment_method || ''] || order?.payment_method || '—';
  const payStatusInfo = PAYMENT_STATUS_LABELS[order?.payment_status || ''] || { label: '—', color: '#6B7280' };

  const createdDate = order?.created_at
    ? new Date(order.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const createdTime = order?.created_at
    ? new Date(order.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    : '';

  const shortId = `#${orderId.slice(0, 8).toUpperCase()}`;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="screen-container flex items-center justify-center" style={{ background: 'var(--background)' }} dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>جاري تحميل تفاصيل الطلب...</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div className="screen-container flex flex-col items-center justify-center px-6" style={{ background: 'var(--background)' }} dir="rtl">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: BRAND.light }}>
          <Icon name="ExclamationTriangleIcon" size={28} style={{ color: BRAND.primary }} />
        </div>
        <p className="font-bold text-base mb-1" style={{ color: 'var(--foreground)' }}>{error || 'خطأ غير متوقع'}</p>
        <p className="text-sm text-center mb-6" style={{ color: 'var(--muted-foreground)' }}>تعذّر تحميل تفاصيل الطلب</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 rounded-2xl font-bold text-white text-sm"
          style={{ background: BRAND.gradient }}
        >
          العودة
        </button>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">

      {/* ── HEADER ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: BRAND.gradient, paddingTop: '2.75rem', paddingBottom: '5rem' }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-6 -left-6 w-36 h-36 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-6 right-6 w-16 h-16 rounded-full opacity-10" style={{ background: '#fff' }} />

        <div className="relative flex items-center gap-3 px-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)' }}
          >
            <Icon name="ChevronRightIcon" size={20} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white opacity-75">تفاصيل الطلب</p>
            <h1 className="text-lg font-bold text-white leading-tight truncate">{shortId}</h1>
          </div>
          {/* Status badge */}
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: statusInfo.dot }} />
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="px-4 -mt-10 pb-10 space-y-4 relative z-10">

        {/* ── STATUS CARD (overlaps header) ── */}
        <div
          className="rounded-2xl p-4 shadow-xl"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: statusInfo.bg }}
            >
              <Icon name={statusInfo.icon as never} size={24} style={{ color: statusInfo.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>حالة الطلب</p>
              <p className="font-bold text-base" style={{ color: statusInfo.color }}>{statusInfo.label}</p>
            </div>
            <div className="text-left flex-shrink-0">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{createdDate}</p>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{createdTime}</p>
            </div>
          </div>

          {/* ── TIMELINE ── */}
          {order.status !== 'cancelled' && (
            <div className="relative">
              {/* Connecting line */}
              <div
                className="absolute top-4 right-4 w-0.5"
                style={{
                  height: `${(TIMELINE_STEPS.length - 1) * 52}px`,
                  background: 'var(--border)',
                }}
              />
              {/* Filled progress line */}
              <div
                className="absolute top-4 right-4 w-0.5 transition-all duration-700"
                style={{
                  height: `${Math.min(currentStep, TIMELINE_STEPS.length - 1) * 52}px`,
                  background: BRAND.primary,
                }}
              />

              <div className="space-y-0">
                {TIMELINE_STEPS.map((step, idx) => {
                  const isDone    = idx <= currentStep;
                  const isCurrent = idx === currentStep;
                  return (
                    <div key={step.status} className="flex items-start gap-4 relative" style={{ minHeight: '52px' }}>
                      {/* Step circle */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 transition-all duration-300"
                        style={{
                          background: isDone ? BRAND.primary : 'var(--muted)',
                          border: isCurrent ? `2px solid ${BRAND.accent}` : 'none',
                          boxShadow: isCurrent ? `0 0 0 4px ${BRAND.light}` : 'none',
                        }}
                      >
                        <Icon
                          name={step.icon as never}
                          size={14}
                          style={{ color: isDone ? '#fff' : 'var(--muted-foreground)' }}
                        />
                      </div>
                      {/* Step label */}
                      <div className="flex-1 pt-1.5">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: isDone ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                        >
                          {step.label}
                        </p>
                        {isCurrent && (
                          <p className="text-xs mt-0.5" style={{ color: BRAND.primary }}>الحالة الحالية</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cancelled state */}
          {order.status === 'cancelled' && (
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(220,38,38,0.08)' }}
            >
              <Icon name="XCircleIcon" size={20} style={{ color: '#DC2626' }} />
              <p className="text-sm font-medium" style={{ color: '#DC2626' }}>تم إلغاء هذا الطلب</p>
            </div>
          )}
        </div>

        {/* ── CRAFTSMAN CONTACT CARD ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          {/* Section header strip */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>معلومات الصنايعي</p>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              {/* Avatar */}
              <div
                className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
                style={{ background: BRAND.light, border: `2px solid ${BRAND.primary}` }}
              >
                {craftsmanAvatar ? (
                  <AppImage
                    src={craftsmanAvatar}
                    alt={`صورة ${craftsmanName}`}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Icon name="UserCircleIcon" size={30} style={{ color: BRAND.primary }} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-base truncate" style={{ color: 'var(--foreground)' }}>{craftsmanName}</p>
                {specialty && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>{specialty}</p>
                )}
                {craftsmanRating > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Icon name="StarIcon" size={12} variant="solid" className="text-yellow-500" />
                    <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{craftsmanRating.toFixed(1)}</span>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>تقييم</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact actions */}
            <div className="grid grid-cols-2 gap-2">
              {craftsmanPhone ? (
                <a
                  href={`tel:${craftsmanPhone}`}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: BRAND.gradient }}
                >
                  <Icon name="PhoneIcon" size={16} className="text-white" />
                  اتصال
                </a>
              ) : (
                <button
                  disabled
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold opacity-40"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  <Icon name="PhoneIcon" size={16} />
                  اتصال
                </button>
              )}
              <button
                onClick={() => router.push('/chat')}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                style={{ background: BRAND.light, color: BRAND.primary }}
              >
                <Icon name="ChatBubbleLeftRightIcon" size={16} style={{ color: BRAND.primary }} />
                مراسلة
              </button>
            </div>
          </div>
        </div>

        {/* ── SERVICE DETAILS CARD ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>تفاصيل الخدمة</p>
          </div>

          <div className="p-4 space-y-3">
            {/* Service name */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                style={{ background: BRAND.light }}
              >
                {serviceEmoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>{serviceName}</p>
                {serviceDesc && (
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{serviceDesc}</p>
                )}
              </div>
            </div>

            {/* Address */}
            {order.address && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-xl"
                style={{ background: 'var(--muted)' }}
              >
                <Icon name="MapPinIcon" size={16} style={{ color: BRAND.primary }} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{order.address}</p>
              </div>
            )}

            {/* Scheduled date */}
            {order.scheduled_at && (
              <div
                className="flex items-center gap-2.5 p-3 rounded-xl"
                style={{ background: 'var(--muted)' }}
              >
                <Icon name="CalendarDaysIcon" size={16} style={{ color: BRAND.primary }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>الموعد المحدد</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {new Date(order.scheduled_at).toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-xl"
                style={{ background: 'var(--muted)' }}
              >
                <Icon name="ChatBubbleBottomCenterTextIcon" size={16} style={{ color: BRAND.primary }} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)' }}>ملاحظات</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{order.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── PAYMENT PROOF CARD ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>إثبات الدفع</p>
          </div>

          <div className="p-4 space-y-3">
            {/* Receipt visual */}
            <div
              className="rounded-2xl p-4 relative overflow-hidden"
              style={{ background: BRAND.gradient }}
            >
              {/* Decorative circles */}
              <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full opacity-10" style={{ background: '#fff' }} />
              <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-10" style={{ background: '#fff' }} />

              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <Icon name="ReceiptRefundIcon" size={16} className="text-white" />
                    </div>
                    <span className="text-xs font-semibold text-white opacity-80">إيصال الدفع</span>
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                  >
                    {payStatusInfo.label}
                  </span>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-white opacity-60 mb-0.5">المبلغ الإجمالي</p>
                  <p className="text-3xl font-black text-white">
                    {amount > 0 ? `${amount.toLocaleString()} ر.س` : 'لم يُحدد'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                  <div>
                    <p className="text-xs text-white opacity-60">طريقة الدفع</p>
                    <p className="text-sm font-bold text-white">{payMethod}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-white opacity-60">رقم الطلب</p>
                    <p className="text-sm font-bold text-white font-tabular">{shortId}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment breakdown rows */}
            <div className="space-y-2">
              {[
                { label: 'تكلفة الخدمة',  value: amount > 0 ? `${amount.toLocaleString()} ر.س` : '—' },
                { label: 'رسوم الخدمة',   value: '0.00 ر.س' },
                { label: 'الإجمالي',       value: amount > 0 ? `${amount.toLocaleString()} ر.س` : '—', bold: true },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <span
                    className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'}`}
                    style={{ color: row.bold ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                  >
                    {row.label}
                  </span>
                  <span
                    className={`text-sm ${row.bold ? 'font-black' : 'font-semibold'}`}
                    style={{ color: row.bold ? BRAND.primary : 'var(--foreground)' }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Payment status badge */}
            <div
              className="flex items-center gap-2 p-3 rounded-xl"
              style={{ background: order.payment_status === 'paid' ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)' }}
            >
              <Icon
                name={order.payment_status === 'paid' ? 'ShieldCheckIcon' : 'ClockIcon'}
                size={16}
                style={{ color: payStatusInfo.color }}
              />
              <p className="text-sm font-semibold" style={{ color: payStatusInfo.color }}>
                {order.payment_status === 'paid' ? 'تم تأكيد الدفع بنجاح'
                  : order.payment_status === 'pending' ? 'الدفع سيتم عند إتمام الخدمة'
                  : payStatusInfo.label}
              </p>
            </div>
          </div>
        </div>

        {/* ── ACTIONS ── */}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => router.push('/customer-profile')}
            className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2"
            style={{ background: BRAND.gradient }}
          >
            <Icon name="ClipboardDocumentListIcon" size={16} className="text-white" />
            عرض جميع طلباتي
          </button>
          <button
            onClick={() => router.push('/home-screen')}
            className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
          >
            <Icon name="HomeIcon" size={16} />
            العودة للرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main export — routes between list and detail ──────────────────────────────
export default function OrderDetailsClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get('order_id');

  if (orderId) {
    return <SingleOrderDetail orderId={orderId} />;
  }

  return <CraftsmanOrdersList />;
}
