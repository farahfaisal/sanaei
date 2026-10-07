'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
}

interface ServiceRequest {
  id: string;
  status: string;
  description: string | null;
  address: string | null;
  amount: number | null;
  created_at: string;
  scheduled_at: string | null;
  craftsman: {
    specialty: string | null;
    user_profiles: { full_name: string; avatar_url?: string | null } | null;
  } | null;
  service: { name: string; emoji: string } | null;
  review: Review | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; icon: string }> = {
  pending:     { label: 'قيد الانتظار', color: '#D97706', bg: 'rgba(217,119,6,0.12)',   dot: '#F59E0B', icon: 'ClockIcon' },
  accepted:    { label: 'مقبول',        color: '#0284C7', bg: 'rgba(2,132,199,0.12)',   dot: '#38BDF8', icon: 'CheckCircleIcon' },
  in_progress: { label: 'جاري التنفيذ', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)', dot: '#A78BFA', icon: 'WrenchScrewdriverIcon' },
  completed:   { label: 'مكتمل',        color: '#059669', bg: 'rgba(5,150,105,0.12)',   dot: '#34D399', icon: 'CheckBadgeIcon' },
  cancelled:   { label: 'ملغي',         color: '#DC2626', bg: 'rgba(220,38,38,0.12)',   dot: '#F87171', icon: 'XCircleIcon' },
};

const STAR_LABELS = ['', 'سيء', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'];
const BRAND_GRADIENT = 'linear-gradient(145deg, #1d5236 0%, #2a724d 45%, #358f61 100%)';
const PRIMARY = '#2a724d';

type FilterTab = 'all' | 'active' | 'completed' | 'cancelled';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'الكل' },
  { key: 'active',    label: 'النشطة' },
  { key: 'completed', label: 'المكتملة' },
  { key: 'cancelled', label: 'الملغاة' },
];

export default function MyRequestsClient() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: authLoading } = useAuth();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/phone-login-otp-verification'); return; }
    loadRequests();
  }, [user, authLoading]);

  // Real-time subscription for order status updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`my-requests-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${user.id}` },
        (payload) => {
          if (payload.new) {
            setRequests(prev => prev.map(r =>
              r.id === (payload.new as any).id
                ? { ...r, status: (payload.new as any).status, amount: (payload.new as any).amount }
                : r
            ));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id, status, description, address, amount, created_at, scheduled_at,
          craftsman:craftsman_id(specialty, user_profiles(full_name, avatar_url)),
          service:service_id(name, emoji)
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!ordersData) { setLoading(false); return; }

      const orderIds = ordersData.map((o: any) => o.id);
      let reviewsMap: Record<string, Review> = {};

      if (orderIds.length > 0) {
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('id, order_id, rating, comment')
          .eq('customer_id', user.id)
          .in('order_id', orderIds);

        if (reviewsData) {
          reviewsData.forEach((r: any) => {
            reviewsMap[r.order_id] = { id: r.id, rating: r.rating, comment: r.comment };
          });
        }
      }

      const mapped: ServiceRequest[] = ordersData.map((o: any) => ({
        ...o,
        craftsman: Array.isArray(o.craftsman) ? o.craftsman[0] : o.craftsman,
        service: Array.isArray(o.service) ? o.service[0] : o.service,
        review: reviewsMap[o.id] ?? null,
      }));

      setRequests(mapped);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [user]);

  const filteredRequests = requests.filter(r => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return ['pending', 'accepted', 'in_progress'].includes(r.status);
    if (activeFilter === 'completed') return r.status === 'completed';
    if (activeFilter === 'cancelled') return r.status === 'cancelled';
    return true;
  });

  const totalSpent = requests
    .filter(r => r.status === 'completed' && r.amount != null)
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const completedCount = requests.filter(r => r.status === 'completed').length;
  const ratedCount = requests.filter(r => r.review != null).length;

  if (authLoading || loading) {
    return (
      <div className="screen-container flex items-center justify-center" style={{ background: 'var(--background)' }} dir="rtl">
        <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">

      {/* ── HEADER ── */}
      <div className="relative overflow-hidden" style={{ background: BRAND_GRADIENT, paddingTop: '2.5rem', paddingBottom: '3.5rem' }}>
        <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-6 right-6 w-24 h-24 rounded-full opacity-8" style={{ background: '#fff' }} />

        <div className="relative px-4 flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <Icon name="ChevronRightIcon" size={20} className="text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">طلباتي</h1>
            <p className="text-white/60 text-xs">جميع طلبات الخدمة المقدمة</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="relative px-4 grid grid-cols-3 gap-2">
          {[
            { label: 'إجمالي الطلبات', value: requests.length, icon: 'ClipboardDocumentListIcon', color: '#93C5FD' },
            { label: 'مكتملة', value: completedCount, icon: 'CheckBadgeIcon', color: '#6EE7B7' },
            { label: 'تقييماتي', value: ratedCount, icon: 'StarIcon', color: '#FCD34D' },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Icon name={stat.icon as never} size={18} style={{ color: stat.color }} className="mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{stat.value}</p>
              <p className="text-white/60 text-xs leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Total spent */}
        {totalSpent > 0 && (
          <div className="relative px-4 mt-3">
            <div className="rounded-2xl px-4 py-2.5 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <span className="text-white/70 text-sm">إجمالي ما أنفقته</span>
              <span className="text-white font-bold text-base">{totalSpent.toLocaleString('ar-SA')} ر.س</span>
            </div>
          </div>
        )}
      </div>

      {/* ── CONTENT ── */}
      <div className="relative -mt-5 mx-3 rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>

        {/* Filter tabs */}
        <div className="flex gap-1 p-2 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
          {FILTER_TABS.map(tab => {
            const count = tab.key === 'all' ? requests.length
              : tab.key === 'active' ? requests.filter(r => ['pending','accepted','in_progress'].includes(r.status)).length
              : tab.key === 'completed' ? completedCount
              : requests.filter(r => r.status === 'cancelled').length;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
                style={activeFilter === tab.key
                  ? { background: PRIMARY, color: '#fff' }
                  : { background: 'var(--muted)', color: 'var(--muted-foreground)' }
                }
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                    style={activeFilter === tab.key
                      ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                      : { background: 'var(--border)', color: 'var(--foreground)' }
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Requests list */}
        <div className="p-3 pb-28 flex flex-col gap-3" style={{ minHeight: '300px' }}>
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--muted)' }}>
                <Icon name="ClipboardDocumentListIcon" size={32} style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>لا توجد طلبات</p>
              <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                ستظهر هنا طلبات الخدمة التي قدمتها
              </p>
            </div>
          ) : (
            filteredRequests.map(req => {
              const statusInfo = STATUS_CONFIG[req.status] || { label: req.status, color: '#6B7280', bg: 'rgba(107,114,128,0.12)', dot: '#9CA3AF', icon: 'QuestionMarkCircleIcon' };
              const craftsmanProfile = req.craftsman?.user_profiles;
              const craftsmanName = craftsmanProfile?.full_name || 'صنايعي';
              const craftsmanSpecialty = req.craftsman?.specialty || '';
              const craftsmanAvatar = (craftsmanProfile as any)?.avatar_url || null;
              const serviceLabel = req.service ? `${req.service.emoji} ${req.service.name}` : null;
              const date = new Date(req.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' });

              return (
                <div
                  key={req.id}
                  className="rounded-2xl overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
                  style={{ background: 'var(--background)', border: '1.5px solid var(--border)' }}
                  onClick={() => router.push(`/order-live-status?orderId=${req.id}`)}
                >
                  {/* Card header */}
                  <div className="p-4 flex flex-col gap-3">
                    {/* Craftsman + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: 'var(--muted)' }}>
                          {craftsmanAvatar ? (
                            <AppImage src={craftsmanAvatar} alt={`صورة ${craftsmanName}`} className="w-full h-full object-cover" />
                          ) : (
                            <Icon name="UserCircleIcon" size={24} style={{ color: 'var(--muted-foreground)' }} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>{craftsmanName}</p>
                          {craftsmanSpecialty && (
                            <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{craftsmanSpecialty}</p>
                          )}
                        </div>
                      </div>
                      <span
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                        style={{ background: statusInfo.bg, color: statusInfo.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusInfo.dot }} />
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Service label */}
                    {serviceLabel && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(42,114,77,0.1)', color: PRIMARY }}>
                          {serviceLabel}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    {req.description && (
                      <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--foreground)' }}>
                        {req.description}
                      </p>
                    )}

                    {/* Date + cost row */}
                    <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <Icon name="CalendarDaysIcon" size={13} />
                        {date}
                      </span>
                      {req.amount != null ? (
                        <span className="text-sm font-bold" style={{ color: PRIMARY }}>
                          {req.amount.toLocaleString('ar-SA')} ر.س
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>السعر غير محدد</span>
                      )}
                    </div>
                  </div>

                  {/* Rating section — shown for completed orders */}
                  {req.status === 'completed' && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {req.review ? (
                        /* Already rated */
                        <div className="px-4 py-3 flex flex-col gap-1.5" style={{ background: 'rgba(42,114,77,0.04)' }}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold" style={{ color: PRIMARY }}>تقييمك للخدمة</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map(s => (
                                <Icon
                                  key={s}
                                  name="StarIcon"
                                  size={14}
                                  variant="solid"
                                  style={{ color: s <= req.review!.rating ? '#F59E0B' : 'var(--border)' }}
                                />
                              ))}
                              <span className="text-xs font-bold mr-1" style={{ color: '#F59E0B' }}>
                                {STAR_LABELS[req.review.rating]}
                              </span>
                            </div>
                          </div>
                          {req.review.comment && (
                            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
                              {req.review.comment}
                            </p>
                          )}
                        </div>
                      ) : (
                        /* Not yet rated */
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/service-rating?orderId=${req.id}`);
                          }}
                          className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold transition-all active:opacity-80"
                          style={{ background: 'rgba(42,114,77,0.08)', color: PRIMARY }}
                        >
                          <Icon name="StarIcon" size={15} variant="solid" style={{ color: '#F59E0B' }} />
                          قيّم الخدمة
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <BottomTabBar activeTab="orders" />
    </div>
  );
}
