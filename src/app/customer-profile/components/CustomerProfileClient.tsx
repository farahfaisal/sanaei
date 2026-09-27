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
    user_profiles: { full_name: string } | null;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'قيد الانتظار', color: '#F59E0B', bg: '#FEF3C7' },
  accepted:    { label: 'مقبول',        color: '#3B82F6', bg: '#DBEAFE' },
  in_progress: { label: 'جاري التنفيذ', color: '#8B5CF6', bg: '#EDE9FE' },
  completed:   { label: 'مكتمل',        color: '#22C55E', bg: '#DCFCE7' },
  cancelled:   { label: 'ملغي',         color: '#EF4444', bg: '#FEE2E2' },
};

export default function CustomerProfileClient() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: authLoading, signOut } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/phone-login-otp-verification');
      return;
    }
    loadOrders();
  }, [user, authLoading]);

  const loadOrders = async () => {
    if (!user) return;
    setLoadingOrders(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select(`
          id, status, description, address, amount, created_at,
          craftsman:craftsman_id(specialty, user_profiles(full_name))
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (data) {
        setOrders(data.map((o: any) => ({
          ...o,
          craftsman: Array.isArray(o.craftsman) ? o.craftsman[0] : o.craftsman,
        })));
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/phone-login-otp-verification');
    } catch (e) {
      // ignore
    }
  };

  if (authLoading) {
    return (
      <div className="screen-container flex items-center justify-center" style={{ background: 'var(--background)' }} dir="rtl">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeOrders = orders.filter(o => ['pending', 'accepted', 'in_progress'].includes(o.status));
  const completedOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status));
  const displayedOrders = activeTab === 'active' ? activeOrders : completedOrders;

  const fullName = profile?.full_name || 'الزبون';
  const phone = profile?.phone || '';
  const avatarUrl = profile?.avatar_url || null;

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">
      {/* Header */}
      <div className="px-4 pt-6 pb-4" style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>حسابي</h1>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
            style={{ background: '#FEE2E2', color: '#EF4444' }}
          >
            <Icon name="ArrowRightOnRectangleIcon" size={16} className="text-red-500" />
            تسجيل الخروج
          </button>
        </div>

        {/* Profile Card */}
        <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'var(--secondary)', border: '1.5px solid var(--border)' }}>
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ background: 'var(--muted)' }}>
            {avatarUrl ? (
              <AppImage src={avatarUrl} alt={`صورة ${fullName}`} width={64} height={64} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon name="UserCircleIcon" size={36} className="text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--foreground)' }}>{fullName}</h2>
            {phone && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{phone}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
                زبون
              </span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {orders.length} طلب
              </span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'إجمالي الطلبات', value: orders.length },
            { label: 'الطلبات النشطة', value: activeOrders.length },
            { label: 'المكتملة', value: completedOrders.length },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center p-3 rounded-xl" style={{ background: 'var(--muted)' }}>
              <span className="text-xl font-bold" style={{ color: 'var(--primary)' }}>{stat.value}</span>
              <span className="text-xs mt-0.5 text-center" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Orders Section */}
      <div className="px-4 pt-4 pb-24">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="ClipboardDocumentListIcon" size={20} className="text-primary" />
          <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>طلباتي</h3>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{ background: 'var(--muted)' }}>
          {[
            { key: 'active', label: `النشطة (${activeOrders.length})` },
            { key: 'completed', label: `المكتملة (${completedOrders.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'active' | 'completed')}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={
                activeTab === tab.key
                  ? { background: 'var(--primary)', color: '#fff' }
                  : { background: 'transparent', color: 'var(--muted-foreground)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loadingOrders ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-semibold" style={{ color: 'var(--foreground)' }}>لا توجد طلبات</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {activeTab === 'active' ? 'ليس لديك طلبات نشطة حالياً' : 'لا توجد طلبات مكتملة بعد'}
            </p>
            <button
              onClick={() => router.push('/home-screen')}
              className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'var(--primary)' }}
            >
              تصفح الصنايعية
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayedOrders.map((order) => {
              const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: '#6B7280', bg: '#F3F4F6' };
              const craftsmanName = order.craftsman?.user_profiles?.full_name || 'صنايعي';
              const specialty = order.craftsman?.specialty || '';
              const date = new Date(order.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl"
                  style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>{craftsmanName}</p>
                      {specialty && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{specialty}</p>
                      )}
                    </div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 mr-2"
                      style={{ color: statusInfo.color, background: statusInfo.bg }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  {order.description && (
                    <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>{order.description}</p>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{date}</span>
                    {order.amount && (
                      <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                        ₪{order.amount.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomTabBar activeTab="profile" />
    </div>
  );
}
