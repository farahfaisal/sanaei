'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

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
  pending:     { label: 'قيد الانتظار', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  accepted:    { label: 'مقبول',        color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  in_progress: { label: 'جاري التنفيذ', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  completed:   { label: 'مكتمل',        color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  cancelled:   { label: 'ملغي',         color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

export default function CustomerProfileClient() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#6366F1', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const activeOrders = orders.filter(o => ['pending', 'accepted', 'in_progress'].includes(o.status));
  const completedOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status));
  const displayedOrders = activeTab === 'active' ? activeOrders : completedOrders;

  const fullName = profile?.full_name || 'الزبون';
  const phone = profile?.phone || '';
  const avatarUrl = profile?.avatar_url || null;

  // Customer accent color: indigo/blue
  const accent = '#6366F1';
  const accentLight = 'rgba(99,102,241,0.12)';

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">

      {/* Hero Header — gradient banner */}
      <div
        className="relative px-4 pt-10 pb-16"
        style={{
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        }}
      >
        {/* Top row: title + actions */}
        <div className="flex items-center justify-between mb-0">
          <h1 className="text-lg font-bold text-white">حسابي</h1>
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
              aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
            >
              <Icon
                name={theme === 'dark' ? 'SunIcon' : 'MoonIcon'}
                size={15}
                className="text-white"
              />
              <span>{theme === 'dark' ? 'نهاري' : 'ليلي'}</span>
            </button>
            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
            >
              <Icon name="ArrowRightOnRectangleIcon" size={15} className="text-white" />
              خروج
            </button>
          </div>
        </div>
      </div>

      {/* Profile card — overlaps hero */}
      <div className="px-4 -mt-10 mb-4">
        <div
          className="rounded-2xl p-4 flex items-center gap-4 shadow-lg"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
            style={{ background: accentLight, border: `2px solid ${accent}` }}
          >
            {avatarUrl ? (
              <AppImage src={avatarUrl} alt={`صورة ${fullName}`} width={64} height={64} className="w-full h-full object-cover" />
            ) : (
              <Icon name="UserCircleIcon" size={36} style={{ color: accent }} />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate" style={{ color: 'var(--foreground)' }}>{fullName}</h2>
            {phone && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{phone}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                style={{ background: accentLight, color: accent }}
              >
                👤 زبون
              </span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {orders.length} طلب
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'إجمالي', value: orders.length, icon: 'ClipboardDocumentListIcon' },
            { label: 'نشطة', value: activeOrders.length, icon: 'ClockIcon' },
            { label: 'مكتملة', value: completedOrders.length, icon: 'CheckCircleIcon' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center p-3 rounded-2xl"
              style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            >
              <Icon name={stat.icon as never} size={18} style={{ color: accent }} className="mb-1" />
              <span className="text-xl font-bold" style={{ color: accent }}>{stat.value}</span>
              <span className="text-xs mt-0.5 text-center" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick action */}
      <div className="px-4 mb-4">
        <button
          onClick={() => router.push('/home-screen')}
          className="w-full py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
        >
          <Icon name="MagnifyingGlassIcon" size={16} className="text-white" />
          تصفح الصنايعية
        </button>
      </div>

      {/* Orders Section */}
      <div className="px-4 pb-24">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="ClipboardDocumentListIcon" size={18} style={{ color: accent }} />
          <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>طلباتي</h3>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-2 mb-4 p-1 rounded-xl"
          style={{ background: 'var(--muted)' }}
        >
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
                  ? { background: accent, color: '#fff' }
                  : { background: 'transparent', color: 'var(--muted-foreground)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loadingOrders ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-semibold" style={{ color: 'var(--foreground)' }}>لا توجد طلبات</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {activeTab === 'active' ? 'ليس لديك طلبات نشطة حالياً' : 'لا توجد طلبات مكتملة بعد'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayedOrders.map((order) => {
              const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: '#6B7280', bg: 'rgba(107,114,128,0.12)' };
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
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: accentLight }}
                      >
                        <Icon name="WrenchScrewdriverIcon" size={15} style={{ color: accent }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>{craftsmanName}</p>
                        {specialty && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{specialty}</p>
                        )}
                      </div>
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
                      <span className="text-sm font-bold" style={{ color: accent }}>
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
