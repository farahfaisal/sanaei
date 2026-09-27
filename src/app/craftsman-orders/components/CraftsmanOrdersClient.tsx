'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Order {
  id: string;
  status: string;
  description: string | null;
  address: string | null;
  amount: number | null;
  created_at: string;
  scheduled_at: string | null;
  customer: {
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:     { label: 'قيد الانتظار', color: '#D97706', bg: 'rgba(217,119,6,0.12)',   dot: '#F59E0B' },
  accepted:    { label: 'مقبول',        color: '#0284C7', bg: 'rgba(2,132,199,0.12)',   dot: '#38BDF8' },
  in_progress: { label: 'جاري التنفيذ', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)', dot: '#A78BFA' },
  completed:   { label: 'مكتمل',        color: '#059669', bg: 'rgba(5,150,105,0.12)',   dot: '#34D399' },
  cancelled:   { label: 'ملغي',         color: '#DC2626', bg: 'rgba(220,38,38,0.12)',   dot: '#F87171' },
  scheduled:   { label: 'مجدول',        color: '#0891B2', bg: 'rgba(8,145,178,0.12)',   dot: '#38BDF8' },
};

type OrderTab = 'active' | 'scheduled' | 'previous';

const BRAND_GRADIENT = 'linear-gradient(145deg, #1a5857 0%, #1e6b6a 50%, #1a5857 100%)';

export default function CraftsmanOrdersClient() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderTab>('active');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/phone-login-otp-verification'); return; }
    if (profile?.role !== 'craftsman') { router.replace('/home-screen'); return; }
    loadOrders();
  }, [user, authLoading, profile]);

  const loadOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get craftsman profile id first
      const { data: craftsmanProfile } = await supabase
        .from('craftsman_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!craftsmanProfile) { setLoading(false); return; }

      const { data } = await supabase
        .from('orders')
        .select(`
          id, status, description, address, amount, created_at, scheduled_at,
          customer:customer_id(full_name, avatar_url, phone)
        `)
        .eq('craftsman_id', craftsmanProfile.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        setOrders(data.map((o: any) => ({
          ...o,
          customer: Array.isArray(o.customer) ? o.customer[0] : o.customer,
        })));
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const activeOrders    = orders.filter(o => ['pending', 'accepted', 'in_progress'].includes(o.status));
  const scheduledOrders = orders.filter(o => o.status === 'scheduled' || (o.scheduled_at && ['pending', 'accepted'].includes(o.status)));
  const previousOrders  = orders.filter(o => ['completed', 'cancelled'].includes(o.status));

  const displayedOrders =
    activeTab === 'active'    ? activeOrders :
    activeTab === 'scheduled' ? scheduledOrders :
    previousOrders;

  const craftsmanName = profile?.full_name || 'الصنايعي';

  if (authLoading || loading) {
    return (
      <div className="screen-container flex items-center justify-center" style={{ background: 'var(--background)' }} dir="rtl">
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a5857', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">

      {/* ── HEADER ── */}
      <div className="relative overflow-hidden" style={{ background: BRAND_GRADIENT, paddingTop: '2.5rem', paddingBottom: '3.5rem' }}>
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-4 right-4 w-20 h-20 rounded-full opacity-10" style={{ background: '#fff' }} />

        <div className="relative px-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm mb-0.5">مرحباً،</p>
            <h1 className="text-white text-xl font-bold">{craftsmanName}</h1>
          </div>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30 bg-white/20 flex items-center justify-center">
            {profile?.avatar_url ? (
              <AppImage src={profile.avatar_url} alt={craftsmanName} className="w-full h-full object-cover" />
            ) : (
              <Icon name="UserCircleIcon" size={28} className="text-white" />
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="relative px-4 mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'نشطة', count: activeOrders.length, color: '#F59E0B' },
            { label: 'مجدولة', count: scheduledOrders.length, color: '#38BDF8' },
            { label: 'مكتملة', count: previousOrders.filter(o => o.status === 'completed').length, color: '#34D399' },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.count}</p>
              <p className="text-white/70 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTENT CARD ── */}
      <div className="relative -mt-5 mx-3 rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>

        {/* Tab bar */}
        <div className="flex gap-1 p-2" style={{ borderBottom: '1px solid var(--border)' }}>
          {([
            { key: 'active',    label: 'النشطة',   count: activeOrders.length },
            { key: 'scheduled', label: 'المجدولة', count: scheduledOrders.length },
            { key: 'previous',  label: 'السابقة',  count: previousOrders.length },
          ] as { key: OrderTab; label: string; count: number }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all"
              style={activeTab === tab.key
                ? { background: '#1a5857', color: '#fff' }
                : { background: 'var(--muted)', color: 'var(--muted-foreground)' }
              }
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={activeTab === tab.key
                    ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                    : { background: 'var(--border)', color: 'var(--foreground)' }
                  }
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Orders list */}
        <div className="p-3 pb-24 flex flex-col gap-3" style={{ minHeight: '300px' }}>
          {displayedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--muted)' }}>
                <Icon name="ClipboardDocumentListIcon" size={32} style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                {activeTab === 'active' ? 'لا توجد طلبات نشطة' :
                 activeTab === 'scheduled'? 'لا توجد طلبات مجدولة' : 'لا توجد طلبات سابقة'}
              </p>
              <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                {activeTab === 'active' ? 'ستظهر هنا الطلبات الجديدة والجارية' :
                 activeTab === 'scheduled'? 'ستظهر هنا الطلبات المحددة بموعد مسبق' : 'ستظهر هنا الطلبات المكتملة والملغاة'}
              </p>
            </div>
          ) : (
            displayedOrders.map(order => {
              const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: '#6B7280', bg: 'rgba(107,114,128,0.12)', dot: '#9CA3AF' };
              const customerName = order.customer?.full_name || 'عميل';
              const date = new Date(order.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' });
              const scheduledDate = order.scheduled_at
                ? new Date(order.scheduled_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : null;

              return (
                <div
                  key={order.id}
                  className="rounded-2xl p-4 flex flex-col gap-3"
                  style={{ background: 'var(--background)', border: '1.5px solid var(--border)' }}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-200 flex items-center justify-center">
                        {order.customer?.avatar_url ? (
                          <AppImage src={order.customer.avatar_url} alt={customerName} className="w-full h-full object-cover" />
                        ) : (
                          <Icon name="UserCircleIcon" size={24} style={{ color: '#9CA3AF' }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>{customerName}</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{date}</p>
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

                  {/* Description */}
                  {order.description && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                      {order.description}
                    </p>
                  )}

                  {/* Details row */}
                  <div className="flex flex-wrap gap-2">
                    {order.address && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <Icon name="MapPinIcon" size={12} />
                        {order.address}
                      </span>
                    )}
                    {scheduledDate && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#0891B2' }}>
                        <Icon name="CalendarDaysIcon" size={12} />
                        {scheduledDate}
                      </span>
                    )}
                  </div>

                  {/* Footer row */}
                  <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
                      #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    {order.amount != null && (
                      <span className="font-bold text-sm" style={{ color: '#1a5857' }}>
                        {order.amount.toLocaleString('ar-SA')} ر.س
                      </span>
                    )}
                  </div>

                  {/* Action buttons for active orders */}
                  {['pending', 'accepted', 'in_progress'].includes(order.status) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/order-details?id=${order.id}`)}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
                        style={{ background: '#1a5857', color: '#fff' }}
                      >
                        عرض التفاصيل
                      </button>
                      {order.customer?.phone && (
                        <a
                          href={`tel:${order.customer.phone}`}
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
                        >
                          <Icon name="PhoneIcon" size={16} />
                        </a>
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
