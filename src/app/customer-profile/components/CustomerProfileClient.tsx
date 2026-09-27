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

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:     { label: 'قيد الانتظار', color: '#D97706', bg: 'rgba(217,119,6,0.12)',   dot: '#F59E0B' },
  accepted:    { label: 'مقبول',        color: '#0284C7', bg: 'rgba(2,132,199,0.12)',   dot: '#38BDF8' },
  in_progress: { label: 'جاري التنفيذ', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)', dot: '#A78BFA' },
  completed:   { label: 'مكتمل',        color: '#059669', bg: 'rgba(5,150,105,0.12)',   dot: '#34D399' },
  cancelled:   { label: 'ملغي',         color: '#DC2626', bg: 'rgba(220,38,38,0.12)',   dot: '#F87171' },
};

// Teal/Cyan brand palette — distinct from craftsman's green
const BRAND = {
  primary:   '#0891B2',   // cyan-600
  secondary: '#06B6D4',   // cyan-500
  light:     'rgba(8,145,178,0.10)',
  gradient:  'linear-gradient(145deg, #0E7490 0%, #0891B2 45%, #0284C7 100%)',
};

export default function CustomerProfileClient() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/phone-login-otp-verification');
      return;
    }
    loadOrders();
  }, [user, authLoading]);

  useEffect(() => {
    if (profile?.full_name) setEditName(profile.full_name);
  }, [profile]);

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
        .limit(50);

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

  const handleSaveName = async () => {
    if (!user || !editName.trim()) return;
    setSavingName(true);
    try {
      await supabase
        .from('user_profiles')
        .update({ full_name: editName.trim() })
        .eq('id', user.id);
      setEditMode(false);
    } catch (e) {
      // ignore
    } finally {
      setSavingName(false);
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
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const activeOrders    = orders.filter(o => ['pending', 'accepted', 'in_progress'].includes(o.status));
  const completedOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status));
  const displayedOrders = activeTab === 'active' ? activeOrders : completedOrders;

  const fullName  = profile?.full_name || 'الزبون';
  const phone     = profile?.phone || '';
  const location  = profile?.location || '';
  const avatarUrl = profile?.avatar_url || null;
  const joinDate  = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })
    : '';

  const totalSpent = orders
    .filter(o => o.status === 'completed' && o.amount)
    .reduce((sum, o) => sum + (o.amount || 0), 0);

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">

      {/* ── HERO BANNER ── */}
      <div className="relative overflow-hidden" style={{ background: BRAND.gradient, paddingTop: '2.5rem', paddingBottom: '4.5rem' }}>
        {/* Decorative circles */}
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-4 right-4 w-20 h-20 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-16 rounded-full opacity-10" style={{ background: '#fff', filter: 'blur(20px)' }} />

        {/* Top bar */}
        <div className="relative flex items-center justify-between px-4">
          <div>
            <p className="text-xs font-medium opacity-75 text-white">ملفي الشخصي</p>
            <h1 className="text-lg font-bold text-white leading-tight">حسابي</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
              aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
            >
              <Icon name={theme === 'dark' ? 'SunIcon' : 'MoonIcon'} size={14} className="text-white" />
              <span>{theme === 'dark' ? 'نهاري' : 'ليلي'}</span>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
            >
              <Icon name="ArrowRightOnRectangleIcon" size={14} className="text-white" />
              خروج
            </button>
          </div>
        </div>
      </div>

      {/* ── PROFILE CARD (overlaps hero) ── */}
      <div className="px-4 -mt-12 mb-4 relative z-10">
        <div
          className="rounded-2xl p-4 shadow-xl"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center"
                style={{ background: BRAND.light, border: `2.5px solid ${BRAND.primary}` }}
              >
                {avatarUrl ? (
                  <AppImage src={avatarUrl} alt={`صورة ${fullName}`} width={80} height={80} className="w-full h-full object-cover" />
                ) : (
                  <Icon name="UserCircleIcon" size={42} style={{ color: BRAND.primary }} />
                )}
              </div>
              {/* Customer badge */}
              <div
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-sm shadow"
                style={{ background: BRAND.primary }}
              >
                👤
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {editMode ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 text-sm font-bold rounded-lg px-2 py-1 outline-none"
                    style={{ background: 'var(--muted)', color: 'var(--foreground)', border: `1.5px solid ${BRAND.primary}` }}
                    dir="rtl"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold text-white"
                    style={{ background: BRAND.primary }}
                  >
                    {savingName ? '...' : 'حفظ'}
                  </button>
                  <button onClick={() => setEditMode(false)} className="text-xs px-2 py-1 rounded-lg" style={{ color: 'var(--muted-foreground)' }}>
                    إلغاء
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-base font-bold truncate" style={{ color: 'var(--foreground)' }}>{fullName}</h2>
                  <button onClick={() => setEditMode(true)} style={{ color: BRAND.primary }}>
                    <Icon name="PencilSquareIcon" size={14} />
                  </button>
                </div>
              )}

              {phone && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Icon name="PhoneIcon" size={12} style={{ color: 'var(--muted-foreground)' }} />
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{phone}</p>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Icon name="MapPinIcon" size={12} style={{ color: 'var(--muted-foreground)' }} />
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{location}</p>
                </div>
              )}
              {joinDate && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Icon name="CalendarDaysIcon" size={12} style={{ color: 'var(--muted-foreground)' }} />
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>عضو منذ {joinDate}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS BENTO GRID ── */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Total orders — wide */}
          <div
            className="col-span-1 p-4 rounded-2xl flex flex-col justify-between"
            style={{ background: BRAND.gradient, minHeight: '90px' }}
          >
            <Icon name="ClipboardDocumentListIcon" size={20} className="text-white opacity-80" />
            <div>
              <p className="text-2xl font-bold text-white">{orders.length}</p>
              <p className="text-xs text-white opacity-75">إجمالي الطلبات</p>
            </div>
          </div>

          {/* Active orders */}
          <div
            className="col-span-1 p-4 rounded-2xl flex flex-col justify-between"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)', minHeight: '90px' }}
          >
            <Icon name="ClockIcon" size={20} style={{ color: '#F59E0B' }} />
            <div>
              <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{activeOrders.length}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>طلبات نشطة</p>
            </div>
          </div>

          {/* Completed */}
          <div
            className="col-span-1 p-4 rounded-2xl flex flex-col justify-between"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)', minHeight: '90px' }}
          >
            <Icon name="CheckCircleIcon" size={20} style={{ color: '#059669' }} />
            <div>
              <p className="text-2xl font-bold" style={{ color: '#059669' }}>{completedOrders.length}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>مكتملة</p>
            </div>
          </div>

          {/* Total spent */}
          <div
            className="col-span-1 p-4 rounded-2xl flex flex-col justify-between"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)', minHeight: '90px' }}
          >
            <Icon name="BanknotesIcon" size={20} style={{ color: BRAND.primary }} />
            <div>
              <p className="text-xl font-bold" style={{ color: BRAND.primary }}>₪{totalSpent > 0 ? totalSpent.toLocaleString() : '0'}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>إجمالي المدفوع</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTION ── */}
      <div className="px-4 mb-5">
        <button
          onClick={() => router.push('/home-screen')}
          className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity active:opacity-80"
          style={{ background: BRAND.gradient }}
        >
          <Icon name="MagnifyingGlassIcon" size={16} className="text-white" />
          تصفح الصنايعية وطلب خدمة
        </button>
      </div>

      {/* ── ORDERS SECTION ── */}
      <div className="px-4 pb-28">
        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{ background: BRAND.primary }} />
            <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>طلباتي</h3>
          </div>
          <button
            onClick={loadOrders}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
            style={{ color: BRAND.primary, background: BRAND.light }}
          >
            <Icon name="ArrowPathIcon" size={13} style={{ color: BRAND.primary }} />
            تحديث
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1.5 mb-4 p-1 rounded-xl"
          style={{ background: 'var(--muted)' }}
        >
          {[
            { key: 'active',    label: 'النشطة',    count: activeOrders.length },
            { key: 'completed', label: 'المكتملة',  count: completedOrders.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'active' | 'completed')}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
              style={
                activeTab === tab.key
                  ? { background: BRAND.primary, color: '#fff' }
                  : { background: 'transparent', color: 'var(--muted-foreground)' }
              }
            >
              {tab.label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                style={
                  activeTab === tab.key
                    ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                    : { background: 'var(--border)', color: 'var(--muted-foreground)' }
                }
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Orders list */}
        {loadingOrders ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: BRAND.light }}
            >
              <Icon name="ClipboardDocumentListIcon" size={28} style={{ color: BRAND.primary }} />
            </div>
            <p className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>لا توجد طلبات</p>
            <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
              {activeTab === 'active' ? 'ليس لديك طلبات نشطة حالياً' : 'لا توجد طلبات مكتملة بعد'}
            </p>
            {activeTab === 'active' && (
              <button
                onClick={() => router.push('/home-screen')}
                className="mt-4 text-sm font-semibold px-5 py-2 rounded-xl text-white"
                style={{ background: BRAND.primary }}
              >
                ابحث عن صنايعي
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayedOrders.map((order) => {
              const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: '#6B7280', bg: 'rgba(107,114,128,0.12)', dot: '#9CA3AF' };
              const craftsmanName = order.craftsman?.user_profiles?.full_name || 'صنايعي';
              const specialty     = order.craftsman?.specialty || '';
              const date          = new Date(order.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' });

              return (
                <div
                  key={order.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
                >
                  {/* Card top accent strip */}
                  <div className="h-1 w-full" style={{ background: statusInfo.dot }} />

                  <div className="p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: BRAND.light }}
                        >
                          <Icon name="WrenchScrewdriverIcon" size={18} style={{ color: BRAND.primary }} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: 'var(--foreground)' }}>{craftsmanName}</p>
                          {specialty && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>{specialty}</p>
                          )}
                        </div>
                      </div>
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 mr-2 flex items-center gap-1"
                        style={{ color: statusInfo.color, background: statusInfo.bg }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: statusInfo.dot }} />
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Description */}
                    {order.description && (
                      <p className="text-xs mb-2.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                        {order.description}
                      </p>
                    )}

                    {/* Address */}
                    {order.address && (
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Icon name="MapPinIcon" size={12} style={{ color: 'var(--muted-foreground)' }} />
                        <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{order.address}</p>
                      </div>
                    )}

                    {/* Footer row */}
                    <div className="flex items-center justify-between pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-1">
                        <Icon name="CalendarDaysIcon" size={12} style={{ color: 'var(--muted-foreground)' }} />
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{date}</span>
                      </div>
                      {order.amount ? (
                        <span className="text-sm font-bold" style={{ color: BRAND.primary }}>
                          ₪{order.amount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>لم يُحدد السعر</span>
                      )}
                    </div>
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
