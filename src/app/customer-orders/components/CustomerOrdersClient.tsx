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
  craftsman: {
    specialty: string | null;
    user_profiles: { full_name: string; avatar_url?: string | null } | null;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:     { label: 'قيد الانتظار', color: '#D97706', bg: 'rgba(217,119,6,0.12)',   dot: '#F59E0B' },
  accepted:    { label: 'مقبول',        color: '#0284C7', bg: 'rgba(2,132,199,0.12)',   dot: '#38BDF8' },
  in_progress: { label: 'جاري التنفيذ', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)', dot: '#A78BFA' },
  completed:   { label: 'مكتمل',        color: '#059669', bg: 'rgba(5,150,105,0.12)',   dot: '#34D399' },
  cancelled:   { label: 'ملغي',         color: '#DC2626', bg: 'rgba(220,38,38,0.12)',   dot: '#F87171' },
};

type OrderTab = 'ongoing' | 'past';

const BRAND_GRADIENT = 'linear-gradient(145deg, #1d5236 0%, #2a724d 45%, #358f61 100%)';

export default function CustomerOrdersClient() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderTab>('ongoing');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/phone-login-otp-verification'); return; }
    loadOrders();
  }, [user, authLoading]);

  // Real-time subscription for order status updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`customer-orders-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setOrders(prev => prev.map(o => o.id === (payload.new as any).id ? { ...o, status: (payload.new as any).status, amount: (payload.new as any).amount } : o));
          } else if (payload.eventType === 'INSERT') {
            loadOrders();
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select(`
          id, status, description, address, amount, created_at,
          craftsman:craftsman_id(specialty, user_profiles(full_name, avatar_url))
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        setOrders(data.map((o: any) => ({
          ...o,
          craftsman: Array.isArray(o.craftsman) ? o.craftsman[0] : o.craftsman,
        })));
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const ongoingOrders = orders.filter(o => ['pending', 'accepted', 'in_progress'].includes(o.status));
  const pastOrders    = orders.filter(o => ['completed', 'cancelled'].includes(o.status));
  const displayedOrders = activeTab === 'ongoing' ? ongoingOrders : pastOrders;

  const customerName = profile?.full_name || 'العميل';

  if (authLoading || loading) {
    return (
      <div className="screen-container flex items-center justify-center" style={{ background: 'var(--background)' }} dir="rtl">
        <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: '#2a724d', borderTopColor: 'transparent' }} />
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
            <h1 className="text-white text-xl font-bold">{customerName}</h1>
          </div>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30 bg-white/20 flex items-center justify-center">
            {profile?.avatar_url ? (
              <AppImage src={profile.avatar_url} alt={customerName} className="w-full h-full object-cover" />
            ) : (
              <Icon name="UserCircleIcon" size={28} className="text-white" />
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="relative px-4 mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'جارية', count: ongoingOrders.length, color: '#F59E0B' },
            { label: 'مكتملة', count: orders.filter(o => o.status === 'completed').length, color: '#34D399' },
            { label: 'ملغاة', count: orders.filter(o => o.status === 'cancelled').length, color: '#F87171' },
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
            { key: 'ongoing', label: 'الجارية', count: ongoingOrders.length },
            { key: 'past',    label: 'السابقة', count: pastOrders.length },
          ] as { key: OrderTab; label: string; count: number }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={activeTab === tab.key
                ? { background: '#2a724d', color: '#fff' }
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
        <div className="p-3 pb-28 flex flex-col gap-3" style={{ minHeight: '300px' }}>
          {displayedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--muted)' }}>
                <Icon name="ClipboardDocumentListIcon" size={32} style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                {activeTab === 'ongoing' ? 'لا توجد طلبات جارية' : 'لا توجد طلبات سابقة'}
              </p>
              <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                {activeTab === 'ongoing' ?'ستظهر هنا طلباتك النشطة والجارية' :'ستظهر هنا طلباتك المكتملة والملغاة'}
              </p>
            </div>
          ) : (
            displayedOrders.map(order => {
              const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: '#6B7280', bg: 'rgba(107,114,128,0.12)', dot: '#9CA3AF' };
              const craftsmanProfile = order.craftsman?.user_profiles;
              const craftsmanName = craftsmanProfile?.full_name || 'صنايعي';
              const craftsmanSpecialty = order.craftsman?.specialty || '';
              const craftsmanAvatar = (craftsmanProfile as any)?.avatar_url || null;
              const date = new Date(order.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' });

              return (
                <div
                  key={order.id}
                  className="rounded-2xl p-4 flex flex-col gap-3 cursor-pointer active:scale-[0.99] transition-transform"
                  style={{ background: 'var(--background)', border: '1.5px solid var(--border)' }}
                  onClick={() => router.push(`/order-live-status?orderId=${order.id}`)}
                >
                  {/* Header row: craftsman info + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-200 flex items-center justify-center">
                        {craftsmanAvatar ? (
                          <AppImage src={craftsmanAvatar} alt={craftsmanName} className="w-full h-full object-cover" />
                        ) : (
                          <Icon name="UserCircleIcon" size={24} style={{ color: '#9CA3AF' }} />
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

                  {/* Description */}
                  {order.description && (
                    <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--foreground)' }}>
                      {order.description}
                    </p>
                  )}

                  {/* Footer row: date + amount */}
                  <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      <Icon name="CalendarDaysIcon" size={13} />
                      {date}
                    </span>
                    {order.amount != null && (
                      <span className="text-sm font-bold" style={{ color: '#2a724d' }}>
                        {order.amount.toLocaleString('ar-SA')} ر.س
                      </span>
                    )}
                    {order.amount == null && (
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>السعر غير محدد</span>
                    )}
                  </div>

                  {/* Rate button for completed orders */}
                  {order.status === 'completed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/service-rating?orderId=${order.id}`);
                      }}
                      className="w-full mt-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                      style={{ background: 'rgba(42,114,77,0.12)', color: '#2a724d', border: '1.5px solid rgba(42,114,77,0.25)' }}
                    >
                      <Icon name="StarIcon" size={15} variant="solid" style={{ color: '#F59E0B' }} />
                      قيّم الخدمة
                    </button>
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
