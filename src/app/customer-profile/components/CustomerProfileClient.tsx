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

interface SavedAddress {
  id: string;
  label: string;
  address_line: string;
  city: string | null;
  is_default: boolean;
}

interface PaymentMethod {
  id: string;
  method_type: string;
  label: string;
  last_four: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  is_default: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:     { label: 'قيد الانتظار', color: '#D97706', bg: 'rgba(217,119,6,0.12)',   dot: '#F59E0B' },
  accepted:    { label: 'مقبول',        color: '#0284C7', bg: 'rgba(2,132,199,0.12)',   dot: '#38BDF8' },
  in_progress: { label: 'جاري التنفيذ', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)', dot: '#A78BFA' },
  completed:   { label: 'مكتمل',        color: '#059669', bg: 'rgba(5,150,105,0.12)',   dot: '#34D399' },
  cancelled:   { label: 'ملغي',         color: '#DC2626', bg: 'rgba(220,38,38,0.12)',   dot: '#F87171' },
};

const BRAND = {
  primary:   '#2a724d',
  secondary: '#358f61',
  light:     'rgba(42,114,77,0.10)',
  gradient:  'linear-gradient(145deg, #1d5236 0%, #2a724d 45%, #358f61 100%)',
};

type ProfileTab = 'orders' | 'addresses' | 'payments' | 'settings';

const ADDRESS_LABELS = ['المنزل', 'العمل', 'المدرسة', 'أخرى'];
const PAYMENT_TYPES = [
  { key: 'card',      label: 'بطاقة بنكية',  icon: 'CreditCardIcon' },
  { key: 'cash',      label: 'نقداً',         icon: 'BanknotesIcon' },
  { key: 'apple_pay', label: 'Apple Pay',     icon: 'DevicePhoneMobileIcon' },
  { key: 'wallet',    label: 'المحفظة',       icon: 'WalletIcon' },
];

export default function CustomerProfileClient() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // ── Profile editing ─────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Section tabs ────────────────────────────────────────────────────────────
  const [profileTab, setProfileTab] = useState<ProfileTab>('orders');

  // ── Addresses ───────────────────────────────────────────────────────────────
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('المنزل');
  const [newAddressLine, setNewAddressLine] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  // ── Payment methods ─────────────────────────────────────────────────────────
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayType, setNewPayType] = useState('card');
  const [newPayLabel, setNewPayLabel] = useState('');
  const [newPayLastFour, setNewPayLastFour] = useState('');
  const [newPayExpMonth, setNewPayExpMonth] = useState('');
  const [newPayExpYear, setNewPayExpYear] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // ── Notifications toggle (local preference) ─────────────────────────────────
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifOffers, setNotifOffers] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/phone-login-otp-verification'); return; }
    loadOrders();
  }, [user, authLoading]);

  useEffect(() => {
    if (profile?.full_name) setEditName(profile.full_name);
    if (profile?.location)  setEditLocation(profile.location);
  }, [profile]);

  useEffect(() => {
    if (profileTab === 'addresses' && user) loadAddresses();
    if (profileTab === 'payments'  && user) loadPaymentMethods();
  }, [profileTab, user]);

  // Real-time subscription for order status updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`customer-profile-orders-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${user.id}` },
        (payload) => {
          if (payload.new) {
            setOrders(prev => prev.map(o =>
              o.id === (payload.new as any).id
                ? { ...o, status: (payload.new as any).status, amount: (payload.new as any).amount }
                : o
            ));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Data loaders ─────────────────────────────────────────────────────────────
  const loadOrders = async () => {
    if (!user) return;
    setLoadingOrders(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select(`id, status, description, address, amount, created_at,
          craftsman:craftsman_id(specialty, user_profiles(full_name))`)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) {
        setOrders(data.map((o: any) => ({
          ...o,
          craftsman: Array.isArray(o.craftsman) ? o.craftsman[0] : o.craftsman,
        })));
      }
    } catch { /* ignore */ } finally { setLoadingOrders(false); }
  };

  const loadAddresses = async () => {
    if (!user) return;
    setLoadingAddresses(true);
    try {
      const { data } = await supabase
        .from('saved_addresses')
        .select('id, label, address_line, city, is_default')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (data) setAddresses(data);
    } catch { /* ignore */ } finally { setLoadingAddresses(false); }
  };

  const loadPaymentMethods = async () => {
    if (!user) return;
    setLoadingPayments(true);
    try {
      const { data } = await supabase
        .from('payment_methods')
        .select('id, method_type, label, last_four, expiry_month, expiry_year, is_default')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (data) setPaymentMethods(data);
    } catch { /* ignore */ } finally { setLoadingPayments(false); }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!user || !editName.trim()) return;
    setSavingProfile(true);
    try {
      await supabase.from('user_profiles')
        .update({ full_name: editName.trim(), location: editLocation.trim() || null })
        .eq('id', user.id);
      setEditMode(false);
    } catch { /* ignore */ } finally { setSavingProfile(false); }
  };

  const handleAddAddress = async () => {
    if (!user || !newAddressLine.trim()) return;
    setSavingAddress(true);
    try {
      const isFirst = addresses.length === 0;
      await supabase.from('saved_addresses').insert({
        user_id: user.id,
        label: newAddressLabel,
        address_line: newAddressLine.trim(),
        city: newAddressCity.trim() || null,
        is_default: isFirst,
      });
      setNewAddressLine(''); setNewAddressCity(''); setNewAddressLabel('المنزل');
      setShowAddAddress(false);
      await loadAddresses();
    } catch { /* ignore */ } finally { setSavingAddress(false); }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await supabase.from('saved_addresses').delete().eq('id', id);
      setAddresses(prev => prev.filter(a => a.id !== id));
    } catch { /* ignore */ }
  };

  const handleSetDefaultAddress = async (id: string) => {
    if (!user) return;
    try {
      await supabase.from('saved_addresses').update({ is_default: false }).eq('user_id', user.id);
      await supabase.from('saved_addresses').update({ is_default: true }).eq('id', id);
      setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
    } catch { /* ignore */ }
  };

  const handleAddPayment = async () => {
    if (!user || !newPayLabel.trim()) return;
    setSavingPayment(true);
    try {
      const isFirst = paymentMethods.length === 0;
      await supabase.from('payment_methods').insert({
        user_id: user.id,
        method_type: newPayType,
        label: newPayLabel.trim(),
        last_four: newPayLastFour.trim() || null,
        expiry_month: newPayExpMonth ? parseInt(newPayExpMonth) : null,
        expiry_year:  newPayExpYear  ? parseInt(newPayExpYear)  : null,
        is_default: isFirst,
      });
      setNewPayLabel(''); setNewPayLastFour(''); setNewPayExpMonth(''); setNewPayExpYear('');
      setShowAddPayment(false);
      await loadPaymentMethods();
    } catch { /* ignore */ } finally { setSavingPayment(false); }
  };

  const handleDeletePayment = async (id: string) => {
    try {
      await supabase.from('payment_methods').delete().eq('id', id);
      setPaymentMethods(prev => prev.filter(p => p.id !== id));
    } catch { /* ignore */ }
  };

  const handleSetDefaultPayment = async (id: string) => {
    if (!user) return;
    try {
      await supabase.from('payment_methods').update({ is_default: false }).eq('user_id', user.id);
      await supabase.from('payment_methods').update({ is_default: true }).eq('id', id);
      setPaymentMethods(prev => prev.map(p => ({ ...p, is_default: p.id === id })));
    } catch { /* ignore */ }
  };

  const handleSignOut = async () => {
    try { await signOut(); router.replace('/phone-login-otp-verification'); } catch { /* ignore */ }
  };

  // ── Loading state ─────────────────────────────────────────────────────────────
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

  const payTypeInfo = (type: string) =>
    PAYMENT_TYPES.find(p => p.key === type) || { label: type, icon: 'CreditCardIcon' };

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">

      {/* ── HERO BANNER ── */}
      <div className="relative overflow-hidden" style={{ background: BRAND.gradient, paddingTop: '2.5rem', paddingBottom: '4.5rem' }}>
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-4 right-4 w-20 h-20 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-16 rounded-full opacity-10" style={{ background: '#fff', filter: 'blur(20px)' }} />

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

      {/* ── PROFILE CARD ── */}
      <div className="px-4 -mt-12 mb-4 relative z-10">
        <div className="rounded-2xl p-4 shadow-xl" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
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
              <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-sm shadow" style={{ background: BRAND.primary }}>
                👤
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {editMode ? (
                <div className="space-y-2 mb-1">
                  <div className="flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="الاسم الكامل"
                      className="flex-1 text-sm font-bold rounded-lg px-2 py-1 outline-none"
                      style={{ background: 'var(--muted)', color: 'var(--foreground)', border: `1.5px solid ${BRAND.primary}` }}
                      dir="rtl"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={editLocation}
                      onChange={e => setEditLocation(e.target.value)}
                      placeholder="الموقع / المدينة"
                      className="flex-1 text-xs rounded-lg px-2 py-1 outline-none"
                      style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
                      dir="rtl"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="text-xs px-3 py-1 rounded-lg font-semibold text-white"
                      style={{ background: BRAND.primary }}
                    >
                      {savingProfile ? '...' : 'حفظ'}
                    </button>
                    <button onClick={() => setEditMode(false)} className="text-xs px-2 py-1 rounded-lg" style={{ color: 'var(--muted-foreground)' }}>
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-base font-bold truncate" style={{ color: 'var(--foreground)' }}>{fullName}</h2>
                    <button onClick={() => setEditMode(true)} style={{ color: BRAND.primary }}>
                      <Icon name="PencilSquareIcon" size={14} />
                    </button>
                  </div>
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS BENTO GRID ── */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-1 p-4 rounded-2xl flex flex-col justify-between" style={{ background: BRAND.gradient, minHeight: '90px' }}>
            <Icon name="ClipboardDocumentListIcon" size={20} className="text-white opacity-80" />
            <div>
              <p className="text-2xl font-bold text-white">{orders.length}</p>
              <p className="text-xs text-white opacity-75">إجمالي الطلبات</p>
            </div>
          </div>
          <div className="col-span-1 p-4 rounded-2xl flex flex-col justify-between" style={{ background: 'var(--card)', border: '1.5px solid var(--border)', minHeight: '90px' }}>
            <Icon name="ClockIcon" size={20} style={{ color: '#F59E0B' }} />
            <div>
              <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{activeOrders.length}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>طلبات نشطة</p>
            </div>
          </div>
          <div className="col-span-1 p-4 rounded-2xl flex flex-col justify-between" style={{ background: 'var(--card)', border: '1.5px solid var(--border)', minHeight: '90px' }}>
            <Icon name="CheckCircleIcon" size={20} style={{ color: '#059669' }} />
            <div>
              <p className="text-2xl font-bold" style={{ color: '#059669' }}>{completedOrders.length}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>مكتملة</p>
            </div>
          </div>
          <div className="col-span-1 p-4 rounded-2xl flex flex-col justify-between" style={{ background: 'var(--card)', border: '1.5px solid var(--border)', minHeight: '90px' }}>
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
          تصفح الحِرَفيين وطلب خدمة
        </button>
      </div>

      {/* ── SECTION TABS ── */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto" style={{ background: 'var(--muted)' }}>
          {([
            { key: 'orders',   label: 'طلباتي',    icon: 'ClipboardDocumentListIcon' },
            { key: 'addresses',label: 'عناويني',   icon: 'MapPinIcon' },
            { key: 'payments', label: 'الدفع',      icon: 'CreditCardIcon' },
            { key: 'settings', label: 'الإعدادات', icon: 'Cog6ToothIcon' },
          ] as { key: ProfileTab; label: string; icon: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setProfileTab(tab.key)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center gap-0.5 min-w-0"
              style={
                profileTab === tab.key
                  ? { background: BRAND.primary, color: '#fff' }
                  : { background: 'transparent', color: 'var(--muted-foreground)' }
              }
            >
              <Icon name={tab.icon} size={14} />
              <span className="truncate w-full text-center">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="px-4 pb-28">

        {/* ── ORDERS TAB ── */}
        {profileTab === 'orders' && (
          <div>
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

            <div className="flex gap-1.5 mb-4 p-1 rounded-xl" style={{ background: 'var(--muted)' }}>
              {[
                { key: 'active',    label: 'النشطة',   count: activeOrders.length },
                { key: 'completed', label: 'المكتملة', count: completedOrders.length },
              ].map(tab => (
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

            {loadingOrders ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
              </div>
            ) : displayedOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: BRAND.light }}>
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
                    ابحث عن حِرَفي
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {displayedOrders.map(order => {
                  const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: '#6B7280', bg: 'rgba(107,114,128,0.12)', dot: '#9CA3AF' };
                  const craftsmanName = order.craftsman?.user_profiles?.full_name || 'حرفي';
                  const specialty     = order.craftsman?.specialty || '';
                  const date          = new Date(order.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' });

                  return (
                    <div key={order.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
                      <div className="h-1 w-full" style={{ background: statusInfo.dot }} />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2.5">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: BRAND.light }}>
                              <Icon name="WrenchScrewdriverIcon" size={18} style={{ color: BRAND.primary }} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm truncate" style={{ color: 'var(--foreground)' }}>{craftsmanName}</p>
                              {specialty && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>{specialty}</p>}
                            </div>
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 mr-2 flex items-center gap-1" style={{ color: statusInfo.color, background: statusInfo.bg }}>
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: statusInfo.dot }} />
                            {statusInfo.label}
                          </span>
                        </div>
                        {order.description && (
                          <p className="text-xs mb-2.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{order.description}</p>
                        )}
                        {order.address && (
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <Icon name="MapPinIcon" size={12} style={{ color: 'var(--muted-foreground)' }} />
                            <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{order.address}</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                          <div className="flex items-center gap-1">
                            <Icon name="CalendarDaysIcon" size={12} style={{ color: 'var(--muted-foreground)' }} />
                            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{date}</span>
                          </div>
                          {order.amount ? (
                            <span className="text-sm font-bold" style={{ color: BRAND.primary }}>₪{order.amount.toLocaleString()}</span>
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
        )}

        {/* ── ADDRESSES TAB ── */}
        {profileTab === 'addresses' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full" style={{ background: BRAND.primary }} />
                <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>العناوين المحفوظة</h3>
              </div>
              <button
                onClick={() => setShowAddAddress(v => !v)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-semibold text-white"
                style={{ background: BRAND.primary }}
              >
                <Icon name="PlusIcon" size={13} className="text-white" />
                إضافة
              </button>
            </div>

            {/* Add address form */}
            {showAddAddress && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--card)', border: `1.5px solid ${BRAND.primary}` }}>
                <p className="text-sm font-bold mb-3" style={{ color: 'var(--foreground)' }}>عنوان جديد</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--muted-foreground)' }}>التسمية</p>
                    <div className="flex gap-2 flex-wrap">
                      {ADDRESS_LABELS.map(lbl => (
                        <button
                          key={lbl}
                          onClick={() => setNewAddressLabel(lbl)}
                          className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
                          style={
                            newAddressLabel === lbl
                              ? { background: BRAND.primary, color: '#fff' }
                              : { background: 'var(--muted)', color: 'var(--muted-foreground)' }
                          }
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    value={newAddressLine}
                    onChange={e => setNewAddressLine(e.target.value)}
                    placeholder="العنوان التفصيلي *"
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
                    style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
                    dir="rtl"
                  />
                  <input
                    value={newAddressCity}
                    onChange={e => setNewAddressCity(e.target.value)}
                    placeholder="المدينة"
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
                    style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
                    dir="rtl"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddAddress}
                      disabled={savingAddress || !newAddressLine.trim()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: BRAND.primary }}
                    >
                      {savingAddress ? 'جاري الحفظ...' : 'حفظ العنوان'}
                    </button>
                    <button
                      onClick={() => setShowAddAddress(false)}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loadingAddresses ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
              </div>
            ) : addresses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: BRAND.light }}>
                  <Icon name="MapPinIcon" size={28} style={{ color: BRAND.primary }} />
                </div>
                <p className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>لا توجد عناوين محفوظة</p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>أضف عناوينك المفضلة لتسريع الطلبات</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {addresses.map(addr => (
                  <div key={addr.id} className="rounded-2xl p-4" style={{ background: 'var(--card)', border: addr.is_default ? `1.5px solid ${BRAND.primary}` : '1.5px solid var(--border)' }}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: addr.is_default ? BRAND.light : 'var(--muted)' }}>
                          <Icon name="MapPinIcon" size={18} style={{ color: addr.is_default ? BRAND.primary : 'var(--muted-foreground)' }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>{addr.label}</p>
                            {addr.is_default && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: BRAND.light, color: BRAND.primary }}>افتراضي</span>
                            )}
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{addr.address_line}</p>
                          {addr.city && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{addr.city}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mr-2">
                        {!addr.is_default && (
                          <button
                            onClick={() => handleSetDefaultAddress(addr.id)}
                            className="text-xs px-2 py-1 rounded-lg font-semibold"
                            style={{ background: BRAND.light, color: BRAND.primary }}
                          >
                            تعيين
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(220,38,38,0.10)' }}
                        >
                          <Icon name="TrashIcon" size={13} style={{ color: '#DC2626' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PAYMENTS TAB ── */}
        {profileTab === 'payments' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full" style={{ background: BRAND.primary }} />
                <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>طرق الدفع</h3>
              </div>
              <button
                onClick={() => setShowAddPayment(v => !v)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-semibold text-white"
                style={{ background: BRAND.primary }}
              >
                <Icon name="PlusIcon" size={13} className="text-white" />
                إضافة
              </button>
            </div>

            {/* Add payment form */}
            {showAddPayment && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--card)', border: `1.5px solid ${BRAND.primary}` }}>
                <p className="text-sm font-bold mb-3" style={{ color: 'var(--foreground)' }}>طريقة دفع جديدة</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--muted-foreground)' }}>نوع الدفع</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_TYPES.map(pt => (
                        <button
                          key={pt.key}
                          onClick={() => setNewPayType(pt.key)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
                          style={
                            newPayType === pt.key
                              ? { background: BRAND.primary, color: '#fff' }
                              : { background: 'var(--muted)', color: 'var(--muted-foreground)' }
                          }
                        >
                          <Icon name={pt.icon} size={14} />
                          {pt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    value={newPayLabel}
                    onChange={e => setNewPayLabel(e.target.value)}
                    placeholder="التسمية (مثال: بطاقتي الرئيسية) *"
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
                    style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
                    dir="rtl"
                  />
                  {newPayType === 'card' && (
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={newPayLastFour}
                        onChange={e => setNewPayLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="آخر 4 أرقام"
                        className="col-span-1 text-sm rounded-xl px-3 py-2.5 outline-none text-center"
                        style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
                        maxLength={4}
                      />
                      <input
                        value={newPayExpMonth}
                        onChange={e => setNewPayExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="الشهر"
                        className="col-span-1 text-sm rounded-xl px-3 py-2.5 outline-none text-center"
                        style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
                        maxLength={2}
                      />
                      <input
                        value={newPayExpYear}
                        onChange={e => setNewPayExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="السنة"
                        className="col-span-1 text-sm rounded-xl px-3 py-2.5 outline-none text-center"
                        style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
                        maxLength={4}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddPayment}
                      disabled={savingPayment || !newPayLabel.trim()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: BRAND.primary }}
                    >
                      {savingPayment ? 'جاري الحفظ...' : 'حفظ طريقة الدفع'}
                    </button>
                    <button
                      onClick={() => setShowAddPayment(false)}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loadingPayments ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
              </div>
            ) : paymentMethods.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: BRAND.light }}>
                  <Icon name="CreditCardIcon" size={28} style={{ color: BRAND.primary }} />
                </div>
                <p className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>لا توجد طرق دفع</p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>أضف طريقة دفع لتسريع عملية الدفع</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {paymentMethods.map(pm => {
                  const typeInfo = payTypeInfo(pm.method_type);
                  return (
                    <div key={pm.id} className="rounded-2xl p-4" style={{ background: 'var(--card)', border: pm.is_default ? `1.5px solid ${BRAND.primary}` : '1.5px solid var(--border)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: pm.is_default ? BRAND.light : 'var(--muted)' }}>
                            <Icon name={typeInfo.icon} size={20} style={{ color: pm.is_default ? BRAND.primary : 'var(--muted-foreground)' }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-bold text-sm truncate" style={{ color: 'var(--foreground)' }}>{pm.label}</p>
                              {pm.is_default && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: BRAND.light, color: BRAND.primary }}>افتراضي</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{typeInfo.label}</p>
                              {pm.last_four && (
                                <p className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>•••• {pm.last_four}</p>
                              )}
                              {pm.expiry_month && pm.expiry_year && (
                                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{pm.expiry_month}/{pm.expiry_year}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mr-2">
                          {!pm.is_default && (
                            <button
                              onClick={() => handleSetDefaultPayment(pm.id)}
                              className="text-xs px-2 py-1 rounded-lg font-semibold"
                              style={{ background: BRAND.light, color: BRAND.primary }}
                            >
                              تعيين
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePayment(pm.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(220,38,38,0.10)' }}
                          >
                            <Icon name="TrashIcon" size={13} style={{ color: '#DC2626' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {profileTab === 'settings' && (
          <div className="space-y-4">
            {/* Notifications section */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Icon name="BellIcon" size={16} style={{ color: BRAND.primary }} />
                  <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>الإشعارات</p>
                </div>
              </div>
              {[
                { key: 'orders',   label: 'تحديثات الطلبات',  sub: 'إشعارات حالة الطلب والتأكيد',  val: notifOrders,   set: setNotifOrders },
                { key: 'messages', label: 'الرسائل',           sub: 'رسائل الحِرَفيين والدعم',        val: notifMessages, set: setNotifMessages },
                { key: 'offers',   label: 'العروض والخصومات', sub: 'العروض الترويجية والتخفيضات',   val: notifOffers,   set: setNotifOffers },
              ].map((item, idx, arr) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between px-4 py-3.5"
                  style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{item.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{item.sub}</p>
                  </div>
                  <button
                    onClick={() => item.set(v => !v)}
                    className="relative w-12 h-6 rounded-full transition-all flex-shrink-0"
                    style={{ background: item.val ? BRAND.primary : 'var(--muted)' }}
                    aria-label={`تبديل ${item.label}`}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                      style={{ right: item.val ? '2px' : 'auto', left: item.val ? 'auto' : '2px' }}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Appearance section */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Icon name="PaintBrushIcon" size={16} style={{ color: BRAND.primary }} />
                  <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>المظهر</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>الوضع الليلي</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>تبديل بين الوضع النهاري والليلي</p>
                </div>
                <button
                  onClick={toggleTheme}
                  className="relative w-12 h-6 rounded-full transition-all flex-shrink-0"
                  style={{ background: theme === 'dark' ? BRAND.primary : 'var(--muted)' }}
                  aria-label="تبديل الوضع الليلي"
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                    style={{ right: theme === 'dark' ? '2px' : 'auto', left: theme === 'dark' ? 'auto' : '2px' }}
                  />
                </button>
              </div>
            </div>

            {/* Account section */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Icon name="UserCircleIcon" size={16} style={{ color: BRAND.primary }} />
                  <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>الحساب</p>
                </div>
              </div>
              {[
                { icon: 'PencilSquareIcon', label: 'تعديل المعلومات الشخصية', sub: 'الاسم والموقع', action: () => { setProfileTab('orders'); setEditMode(true); } },
                { icon: 'MapPinIcon',       label: 'إدارة العناوين',           sub: 'إضافة وتعديل العناوين المحفوظة', action: () => setProfileTab('addresses') },
                { icon: 'CreditCardIcon',   label: 'طرق الدفع',               sub: 'إدارة بطاقاتك وطرق الدفع', action: () => setProfileTab('payments') },
              ].map((item, idx, arr) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center justify-between px-4 py-3.5 transition-opacity active:opacity-70"
                  style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND.light }}>
                      <Icon name={item.icon} size={15} style={{ color: BRAND.primary }} />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{item.label}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{item.sub}</p>
                    </div>
                  </div>
                  <Icon name="ChevronLeftIcon" size={16} style={{ color: 'var(--muted-foreground)' }} />
                </button>
              ))}
            </div>

            {/* Danger zone */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-4 transition-opacity active:opacity-70"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.10)' }}>
                  <Icon name="ArrowRightOnRectangleIcon" size={15} style={{ color: '#DC2626' }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>تسجيل الخروج</p>
              </button>
            </div>
          </div>
        )}
      </div>

      <BottomTabBar activeTab="profile" />
    </div>
  );
}
