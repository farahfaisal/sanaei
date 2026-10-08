'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { rtChannelName } from '@/lib/supabase/realtime';
import { Spinner } from '@/components/ui/Loader';

interface IncomingOrder {
  id: string;
  status: string;
  description: string | null;
  address: string | null;
  amount: number | null;
  created_at: string;
  scheduled_at: string | null;
  service_id: string | null;
  customer: {
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
    location: string | null;
  } | null;
  service: {
    name: string;
    emoji: string;
    category: {
      name: string;
    } | null;
  } | null;
}

interface MarketJob {
  id: string;
  created_at: string;
  service_type: string | null;
  category_name: string | null;
  category_emoji: string | null;
  description: string | null;
  city: string | null;
  urgency: string | null;
  amount: number | null;
  scheduled_at: string | null;
  image_count: number | null;
  customer_first_name: string | null;
  is_match: boolean;
}

type Tab = 'direct' | 'market';

const URGENCY_LABEL: Record<string, string> = {
  urgent: 'عاجل',
  normal: 'عادي',
  scheduled: 'موعد محدد',
};

const BRAND_GRADIENT = 'linear-gradient(145deg, #2a724d 0%, #2d8a5a 50%, #2a724d 100%)';

export default function IncomingRequestsClient() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [craftsmanProfileId, setCraftsmanProfileId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('direct');
  const [marketJobs, setMarketJobs] = useState<MarketJob[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Open the market tab when coming from an "open job" notification.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'market') setTab('market');
  }, []);

  const loadMarketJobs = useCallback(async () => {
    setMarketLoading(true);
    try {
      const { data, error } = await supabase.rpc('list_open_jobs');
      if (error) throw error;
      setMarketJobs((data as MarketJob[]) || []);
    } catch (err: any) {
      setActionError(err?.message || 'تعذّر تحميل طلبات السوق');
    } finally {
      setMarketLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user || profile?.role !== 'craftsman') return;
    loadMarketJobs();
  }, [user, authLoading, profile, loadMarketJobs]);

  // A new open job arrives as a notification → refresh the market list.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(rtChannelName(`market-jobs-${user.id}`))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: any) => { if (payload?.new?.type === 'open_job') loadMarketJobs(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadMarketJobs]);

  const handleClaim = async (orderId: string) => {
    setActionError(null);
    setActionLoading(orderId + '_claim');
    try {
      const { data: conversationId, error } = await supabase.rpc('claim_open_job', { p_order_id: orderId });
      if (error) throw error;
      setMarketJobs(prev => prev.filter(j => j.id !== orderId));
      if (conversationId) {
        router.push(`/chat?conversation_id=${conversationId}`);
      } else {
        router.push(`/order-details?id=${orderId}`);
      }
    } catch (err: any) {
      setActionError(err?.message || 'تعذّر استلام الطلب');
      loadMarketJobs();
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/phone-login-otp-verification'); return; }
    if (profile?.role !== 'craftsman') { router.replace('/home-screen'); return; }
    loadIncomingRequests();
  }, [user, authLoading, profile]);

  // Real-time subscription for new orders
  useEffect(() => {
    if (!craftsmanProfileId) return;

    const channel = supabase
      .channel(rtChannelName(`incoming-orders-${craftsmanProfileId}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `craftsman_id=eq.${craftsmanProfileId}`,
        },
        () => { loadIncomingRequests(); }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `craftsman_id=eq.${craftsmanProfileId}`,
        },
        () => { loadIncomingRequests(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [craftsmanProfileId]);

  const loadIncomingRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: craftsmanProfile } = await supabase
        .from('craftsman_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!craftsmanProfile) { setLoading(false); return; }
      setCraftsmanProfileId(craftsmanProfile.id);

      const { data } = await supabase
        .from('orders')
        .select(`
          id, status, description, address, amount, created_at, scheduled_at, service_id,
          customer:customer_id(full_name, avatar_url, phone, location),
          service:service_id(name, emoji, category:category_id(name))
        `)
        .eq('craftsman_id', craftsmanProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setOrders(
          data.map((o: any) => ({
            ...o,
            customer: Array.isArray(o.customer) ? o.customer[0] : o.customer,
            service: Array.isArray(o.service) ? o.service[0] : o.service,
          }))
        );
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [user]);

  const handleAccept = async (orderId: string) => {
    setActionError(null);
    setActionLoading(orderId + '_accept');
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'accepted' })
        .eq('id', orderId);
      if (error) throw error;
      setOrders(prev => prev.filter(o => o.id !== orderId));
      router.push(`/order-details?id=${orderId}`);
    } catch (err: any) {
      setActionError(err?.message || 'تعذّر قبول الطلب');
    } finally { setActionLoading(null); }
  };

  const handleDecline = async (orderId: string) => {
    setActionError(null);
    setActionLoading(orderId + '_decline');
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      if (error) throw error;
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err: any) {
      setActionError(err?.message || 'تعذّر رفض الطلب');
    } finally { setActionLoading(null); }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    const days = Math.floor(hrs / 24);
    return `منذ ${days} يوم`;
  };

  if (authLoading || loading) {
    return (
      <div className="screen-container flex items-center justify-center" style={{ background: 'var(--background)' }} dir="rtl">
        <Spinner size={48} />
      </div>
    );
  }

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">

      {/* ── HEADER ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: BRAND_GRADIENT, paddingTop: '2.5rem', paddingBottom: '3.5rem' }}
      >
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-4 right-4 w-20 h-20 rounded-full opacity-10" style={{ background: '#fff' }} />

        <div className="relative px-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm mb-0.5">الطلبات الواردة</p>
            <h1 className="text-white text-xl font-bold">طلبات الخدمة الجديدة</h1>
          </div>
          <div
            className="flex items-center justify-center w-12 h-12 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)' }}
          >
            <Icon name="BellAlertIcon" size={24} className="text-white" />
          </div>
        </div>

        {/* Stats pill */}
        <div className="relative px-4 mt-4">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
            <span className="text-white text-sm font-semibold">
              {tab === 'direct'
                ? `${orders.length} طلب جديد ينتظر ردك`
                : `${marketJobs.length} طلب مفتوح في السوق`}
            </span>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div
        className="relative -mt-5 mx-3 rounded-2xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Tabs */}
        <div className="flex p-1.5 gap-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            { key: 'direct', label: 'طلبات لي', count: orders.length },
            { key: 'market', label: 'طلبات السوق', count: marketJobs.length },
          ] as { key: Tab; label: string; count: number }[]).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setActionError(null); if (t.key === 'market') loadMarketJobs(); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all"
              style={tab === t.key
                ? { background: '#2a724d', color: '#fff' }
                : { background: 'transparent', color: 'var(--muted-foreground)' }}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className="min-w-[20px] h-5 px-1.5 rounded-full text-xs flex items-center justify-center"
                  style={tab === t.key
                    ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                    : { background: 'var(--muted)', color: 'var(--foreground)' }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {actionError && (
          <div
            className="mx-3 mt-3 px-3 py-2.5 rounded-xl text-sm flex items-start gap-2"
            style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626' }}
          >
            <Icon name="ExclamationTriangleIcon" size={16} className="flex-shrink-0 mt-0.5" />
            <span className="flex-1">{actionError}</span>
            <button onClick={() => setActionError(null)} aria-label="إغلاق">
              <Icon name="XMarkIcon" size={14} />
            </button>
          </div>
        )}

        {tab === 'market' ? (
          <MarketList
            jobs={marketJobs}
            loading={marketLoading}
            actionLoading={actionLoading}
            onRefresh={loadMarketJobs}
            onClaim={handleClaim}
            formatTimeAgo={formatTimeAgo}
          />
        ) : (
        <>
        {/* Section header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
            <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
              قيد الانتظار
            </span>
          </div>
          <button
            onClick={loadIncomingRequests}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            <Icon name="ArrowPathIcon" size={12} />
            تحديث
          </button>
        </div>

        {/* Orders list */}
        <div className="p-3 pb-28 flex flex-col gap-3" style={{ minHeight: '300px' }}>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'var(--muted)' }}
              >
                <Icon name="InboxIcon" size={36} style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <div className="text-center">
                <p className="font-bold text-base mb-1" style={{ color: 'var(--foreground)' }}>
                  لا توجد طلبات واردة
                </p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  ستظهر هنا طلبات الخدمة الجديدة من العملاء
                </p>
              </div>
            </div>
          ) : (
            orders.map(order => {
              const customerName = order.customer?.full_name || 'عميل';
              const serviceLabel = order.service?.name || order.service?.category?.name || 'خدمة عامة';
              const serviceEmoji = order.service?.emoji || '🔧';
              const categoryName = order.service?.category?.name || '';
              const isAccepting = actionLoading === order.id + '_accept';
              const isDeclining = actionLoading === order.id + '_decline';
              const isAnyLoading = isAccepting || isDeclining;

              return (
                <div
                  key={order.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'var(--background)',
                    border: '1.5px solid var(--border)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* New badge strip */}
                  <div
                    className="flex items-center justify-between px-4 py-1.5"
                    style={{ background: 'rgba(42,114,77,0.08)', borderBottom: '1px solid rgba(42,114,77,0.12)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#2a724d' }} />
                      <span className="text-xs font-bold" style={{ color: '#2a724d' }}>طلب جديد</span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {formatTimeAgo(order.created_at)}
                    </span>
                  </div>

                  <div className="p-4 flex flex-col gap-3">
                    {/* Customer row */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: 'var(--muted)' }}>
                        {order.customer?.avatar_url ? (
                          <AppImage src={order.customer.avatar_url} alt={customerName} className="w-full h-full object-cover" />
                        ) : (
                          <Icon name="UserCircleIcon" size={28} style={{ color: '#9CA3AF' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base truncate" style={{ color: 'var(--foreground)' }}>
                          {customerName}
                        </p>
                        {order.customer?.phone && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                            {order.customer.phone}
                          </p>
                        )}
                      </div>
                      {order.amount != null && (
                        <div
                          className="flex flex-col items-end flex-shrink-0 px-3 py-1.5 rounded-xl"
                          style={{ background: 'rgba(42,114,77,0.1)', border: '1px solid rgba(42,114,77,0.2)' }}
                        >
                          <span className="text-xs font-semibold" style={{ color: '#2a724d' }}>المبلغ</span>
                          <span className="text-base font-bold" style={{ color: '#2a724d' }}>
                            {order.amount.toLocaleString('ar-SA')} ر.س
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Service type */}
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                        style={{ background: 'var(--muted)' }}
                      >
                        <span className="text-base">{serviceEmoji}</span>
                        <div>
                          <p className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{serviceLabel}</p>
                          {categoryName && categoryName !== serviceLabel && (
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{categoryName}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {order.description && (
                      <div
                        className="px-3 py-2.5 rounded-xl"
                        style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
                      >
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
                          وصف الطلب
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                          {order.description}
                        </p>
                      </div>
                    )}

                    {/* Location & schedule */}
                    <div className="flex flex-col gap-1.5">
                      {order.address && (
                        <div className="flex items-start gap-2">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: 'rgba(239,68,68,0.1)' }}
                          >
                            <Icon name="MapPinIcon" size={13} style={{ color: '#ef4444' }} />
                          </div>
                          <p className="text-sm leading-snug" style={{ color: 'var(--foreground)' }}>
                            {order.address}
                          </p>
                        </div>
                      )}
                      {order.scheduled_at && (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(8,145,178,0.1)' }}
                          >
                            <Icon name="CalendarDaysIcon" size={13} style={{ color: '#0891b2' }} />
                          </div>
                          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                            {new Date(order.scheduled_at).toLocaleDateString('ar-SA', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2.5 pt-1">
                      {/* Decline */}
                      <button
                        onClick={() => handleDecline(order.id)}
                        disabled={isAnyLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                        style={{
                          background: 'rgba(220,38,38,0.08)',
                          border: '1.5px solid rgba(220,38,38,0.25)',
                          color: '#dc2626',
                        }}
                      >
                        {isDeclining ? (
                          <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#dc2626', borderTopColor: 'transparent' }} />
                        ) : (
                          <>
                            <Icon name="XMarkIcon" size={16} />
                            رفض
                          </>
                        )}
                      </button>

                      {/* Accept */}
                      <button
                        onClick={() => handleAccept(order.id)}
                        disabled={isAnyLoading}
                        className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                        style={{ background: '#2a724d', color: '#fff', boxShadow: '0 4px 14px rgba(42,114,77,0.35)' }}
                      >
                        {isAccepting ? (
                          <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                        ) : (
                          <>
                            <Icon name="CheckIcon" size={16} />
                            قبول الطلب
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </>
        )}
      </div>

      <BottomTabBar activeTab="orders" />
    </div>
  );
}

interface MarketListProps {
  jobs: MarketJob[];
  loading: boolean;
  actionLoading: string | null;
  onRefresh: () => void;
  onClaim: (orderId: string) => void;
  formatTimeAgo: (dateStr: string) => string;
}

function MarketList({ jobs, loading, actionLoading, onRefresh, onClaim, formatTimeAgo }: MarketListProps) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#0891b2' }} />
          <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
            أول من يستلم الطلب يحصل عليه
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          <Icon name="ArrowPathIcon" size={12} />
          تحديث
        </button>
      </div>

      <div className="p-3 pb-28 flex flex-col gap-3" style={{ minHeight: '300px' }}>
        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={40} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'var(--muted)' }}>
              <Icon name="MegaphoneIcon" size={36} style={{ color: 'var(--muted-foreground)' }} />
            </div>
            <div className="text-center">
              <p className="font-bold text-base mb-1" style={{ color: 'var(--foreground)' }}>
                لا توجد طلبات مفتوحة الآن
              </p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                سيصلك إشعار فور نشر عميل طلباً يناسب تخصصك
              </p>
            </div>
          </div>
        ) : (
          jobs.map(job => {
            const isClaiming = actionLoading === job.id + '_claim';
            const title = job.service_type || job.category_name || 'خدمة عامة';
            const urgency = job.urgency ? (URGENCY_LABEL[job.urgency] || job.urgency) : null;
            const isUrgent = job.urgency === 'urgent';
            return (
              <div
                key={job.id}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'var(--background)',
                  border: job.is_match ? '1.5px solid rgba(42,114,77,0.45)' : '1.5px solid var(--border)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-1.5"
                  style={{ background: 'rgba(8,145,178,0.07)', borderBottom: '1px solid rgba(8,145,178,0.12)' }}
                >
                  <div className="flex items-center gap-1.5">
                    {job.is_match ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#2a724d', color: '#fff' }}>
                        مناسب لتخصصك
                      </span>
                    ) : (
                      <span className="text-xs font-bold" style={{ color: '#0891b2' }}>طلب مفتوح</span>
                    )}
                    {urgency && (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={isUrgent
                          ? { background: 'rgba(220,38,38,0.12)', color: '#dc2626' }
                          : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                      >
                        {urgency}
                      </span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {formatTimeAgo(job.created_at)}
                  </span>
                </div>

                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'var(--muted)' }}>
                      {job.category_emoji || '🔧'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base truncate" style={{ color: 'var(--foreground)' }}>{title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {job.customer_first_name ? `العميل: ${job.customer_first_name}` : 'عميل'}
                        {job.category_name && job.category_name !== title ? ` · ${job.category_name}` : ''}
                      </p>
                    </div>
                    {job.amount != null && Number(job.amount) > 0 && (
                      <div
                        className="flex flex-col items-end flex-shrink-0 px-3 py-1.5 rounded-xl"
                        style={{ background: 'rgba(42,114,77,0.1)', border: '1px solid rgba(42,114,77,0.2)' }}
                      >
                        <span className="text-xs font-semibold" style={{ color: '#2a724d' }}>الميزانية</span>
                        <span className="text-base font-bold" style={{ color: '#2a724d' }}>
                          {Number(job.amount).toLocaleString('ar-SA')} ر.س
                        </span>
                      </div>
                    )}
                  </div>

                  {job.description && (
                    <p
                      className="text-sm leading-relaxed px-3 py-2.5 rounded-xl"
                      style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
                    >
                      {job.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm" style={{ color: 'var(--foreground)' }}>
                    {job.city && (
                      <span className="flex items-center gap-1.5">
                        <Icon name="MapPinIcon" size={14} style={{ color: '#ef4444' }} />
                        {job.city}
                      </span>
                    )}
                    {job.scheduled_at && (
                      <span className="flex items-center gap-1.5">
                        <Icon name="CalendarDaysIcon" size={14} style={{ color: '#0891b2' }} />
                        {new Date(job.scheduled_at).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {!!job.image_count && job.image_count > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Icon name="PhotoIcon" size={14} style={{ color: 'var(--muted-foreground)' }} />
                        {job.image_count} صور
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onClaim(job.id)}
                    disabled={!!actionLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: '#2a724d', color: '#fff', boxShadow: '0 4px 14px rgba(42,114,77,0.35)' }}
                  >
                    {isClaiming ? (
                      <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    ) : (
                      <>
                        <Icon name="HandRaisedIcon" size={16} />
                        استلام الطلب وإرسال عرض سعر
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
