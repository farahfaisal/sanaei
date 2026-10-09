'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Spinner } from '@/components/ui/Loader';

interface PaymentMethod {
  id: string;
  method_type: string;
  label: string;
  last_four: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  is_default: boolean;
}

const BRAND = {
  primary: '#2a724d',
  secondary: '#358f61',
  light: 'rgba(42,114,77,0.10)',
  gradient: 'linear-gradient(145deg, #1d5236 0%, #2a724d 45%, #358f61 100%)',
};

const PAYMENT_TYPES = [
  { key: 'card', label: 'بطاقة بنكية', icon: 'CreditCardIcon' },
  { key: 'cash', label: 'نقداً', icon: 'BanknotesIcon' },
  { key: 'apple_pay', label: 'Apple Pay', icon: 'DevicePhoneMobileIcon' },
  { key: 'wallet', label: 'المحفظة', icon: 'WalletIcon' },
];

type Section = 'personal' | 'photo' | 'payments' | 'preferences';

export default function ProfileManagementClient() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<Section>('personal');

  // ── Personal info ────────────────────────────────────────────────────────────
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);

  // ── Photo ────────────────────────────────────────────────────────────────────
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);

  // ── Payment methods ──────────────────────────────────────────────────────────
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayType, setNewPayType] = useState('card');
  const [newPayLabel, setNewPayLabel] = useState('');
  const [newPayLastFour, setNewPayLastFour] = useState('');
  const [newPayExpMonth, setNewPayExpMonth] = useState('');
  const [newPayExpYear, setNewPayExpYear] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // ── Preferences ──────────────────────────────────────────────────────────────
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifOffers, setNotifOffers] = useState(true);
  const [darkMode, setDarkMode] = useState(theme === 'dark');
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/phone-login-otp-verification'); return; }
  }, [user, authLoading]);

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || '');
      setEditPhone(profile.phone || '');
      setEditLocation(profile.location || '');
      setAvatarPreview(profile.avatar_url || null);
    }
  }, [profile]);

  useEffect(() => {
    if (activeSection === 'payments' && user) loadPaymentMethods();
  }, [activeSection, user]);

  // ── Data loaders ─────────────────────────────────────────────────────────────
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
  const handleSavePersonal = async () => {
    if (!user || !editName.trim()) return;
    setSavingPersonal(true);
    try {
      await supabase.from('user_profiles')
        .update({
          full_name: editName.trim(),
          phone: editPhone.trim() || null,
          location: editLocation.trim() || null,
        })
        .eq('id', user.id);
      setPersonalSaved(true);
      setTimeout(() => setPersonalSaved(false), 2500);
    } catch { /* ignore */ } finally { setSavingPersonal(false); }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    handlePhotoUpload(file);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!user) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        if (urlData?.publicUrl) {
          await supabase.from('user_profiles')
            .update({ avatar_url: urlData.publicUrl })
            .eq('id', user.id);
          setAvatarPreview(urlData.publicUrl);
          setPhotoSaved(true);
          setTimeout(() => setPhotoSaved(false), 2500);
        }
      }
    } catch { /* ignore */ } finally { setUploadingPhoto(false); }
  };

  const handleRemovePhoto = async () => {
    if (!user) return;
    try {
      await supabase.from('user_profiles').update({ avatar_url: null }).eq('id', user.id);
      setAvatarPreview(null);
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
        expiry_year: newPayExpYear ? parseInt(newPayExpYear) : null,
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

  const handleToggleDarkMode = () => {
    setDarkMode(!darkMode);
    toggleTheme();
  };

  const handleSignOut = async () => {
    try { await signOut(); router.replace('/phone-login-otp-verification'); } catch { /* ignore */ }
  };

  const payTypeInfo = (type: string) =>
    PAYMENT_TYPES.find(p => p.key === type) || { label: type, icon: 'CreditCardIcon' };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <Spinner size={48} />
      </div>
    );
  }

  const SECTIONS: { id: Section; label: string; icon: string }[] = [
    { id: 'personal', label: 'البيانات الشخصية', icon: 'UserCircleIcon' },
    { id: 'photo', label: 'الصورة الشخصية', icon: 'CameraIcon' },
    { id: 'payments', label: 'طرق الدفع', icon: 'CreditCardIcon' },
    { id: 'preferences', label: 'التفضيلات', icon: 'AdjustmentsHorizontalIcon' },
  ];

  const displayName = profile?.full_name || 'المستخدم';
  const displayPhone = profile?.phone || '';

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--background)', direction: 'rtl' }}>
      {/* ── HEADER ── */}
      <div className="relative overflow-hidden" style={{ background: BRAND.gradient, paddingTop: '52px', paddingBottom: '72px' }}>
        <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-6 right-6 w-24 h-24 rounded-full opacity-8" style={{ background: '#fff' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-20 rounded-full opacity-10" style={{ background: '#fff', filter: 'blur(24px)' }} />

        <div className="relative px-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.18)' }}
            >
              <Icon name="ChevronRightIcon" size={18} className="text-white" />
            </button>
            <div>
              <p className="text-xs text-white opacity-75">إدارة الحساب</p>
              <h1 className="text-lg font-bold text-white">الملف الشخصي</h1>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
          >
            <Icon name="ArrowRightOnRectangleIcon" size={14} className="text-white" />
            خروج
          </button>
        </div>
      </div>

      {/* ── AVATAR HERO CARD ── */}
      <div className="px-5 -mt-14 relative z-10 mb-5">
        <div className="rounded-2xl p-5 shadow-xl flex items-center gap-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
          <div className="relative flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ background: BRAND.light, border: `2.5px solid ${BRAND.primary}` }}
            >
              {avatarPreview ? (
                <AppImage src={avatarPreview} alt={`صورة ${displayName}`} width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <Icon name="UserCircleIcon" size={44} style={{ color: BRAND.primary }} />
              )}
            </div>
            <button
              onClick={() => { setActiveSection('photo'); fileInputRef.current?.click(); }}
              className="absolute -bottom-1.5 -left-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
              style={{ background: BRAND.primary }}
            >
              <Icon name="CameraIcon" size={14} className="text-white" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate" style={{ color: 'var(--foreground)' }}>{displayName}</h2>
            {displayPhone && (
              <div className="flex items-center gap-1.5 mt-1">
                <Icon name="PhoneIcon" size={12} style={{ color: 'var(--muted-foreground)' }} />
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{displayPhone}</p>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full" style={{ background: '#34D399' }} />
              <p className="text-xs font-medium" style={{ color: '#059669' }}>حساب نشط</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION TABS ── */}
      <div className="px-5 mb-5">
        <div className="grid grid-cols-2 gap-2">
          {SECTIONS.map(sec => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{
                  background: isActive ? BRAND.gradient : 'var(--card)',
                  color: isActive ? '#fff' : 'var(--foreground)',
                  border: isActive ? 'none' : '1.5px solid var(--border)',
                  boxShadow: isActive ? '0 4px 16px rgba(42,114,77,0.35)' : 'none',
                }}
              >
                <Icon name={sec.icon as never} size={18} className={isActive ? 'text-white' : ''} style={!isActive ? { color: BRAND.primary } : {}} />
                <span className="text-xs">{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SECTION CONTENT ── */}
      <div className="px-5">

        {/* ── PERSONAL INFO ── */}
        {activeSection === 'personal' && (
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND.light }}>
                <Icon name="UserCircleIcon" size={18} style={{ color: BRAND.primary }} />
              </div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>البيانات الشخصية</h3>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>الاسم الكامل</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--muted)', border: '1.5px solid var(--border)' }}>
                <Icon name="UserIcon" size={16} style={{ color: BRAND.primary }} />
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                  className="flex-1 text-sm bg-transparent outline-none"
                  style={{ color: 'var(--foreground)' }}
                  dir="rtl"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>رقم الهاتف</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--muted)', border: '1.5px solid var(--border)' }}>
                <Icon name="PhoneIcon" size={16} style={{ color: BRAND.primary }} />
                <input
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="أدخل رقم هاتفك"
                  className="flex-1 text-sm bg-transparent outline-none"
                  style={{ color: 'var(--foreground)' }}
                  dir="ltr"
                  type="tel"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>الموقع / المدينة</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--muted)', border: '1.5px solid var(--border)' }}>
                <Icon name="MapPinIcon" size={16} style={{ color: BRAND.primary }} />
                <input
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value)}
                  placeholder="المدينة أو المنطقة"
                  className="flex-1 text-sm bg-transparent outline-none"
                  style={{ color: 'var(--foreground)' }}
                  dir="rtl"
                />
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={handleSavePersonal}
              disabled={savingPersonal || !editName.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity active:opacity-80 disabled:opacity-50"
              style={{ background: BRAND.gradient }}
            >
              {savingPersonal ? (
                <Spinner size={18} />
              ) : personalSaved ? (
                <>
                  <Icon name="CheckCircleIcon" size={18} className="text-white" />
                  تم الحفظ بنجاح
                </>
              ) : (
                <>
                  <Icon name="CheckIcon" size={18} className="text-white" />
                  حفظ البيانات
                </>
              )}
            </button>
          </div>
        )}

        {/* ── PHOTO ── */}
        {activeSection === 'photo' && (
          <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND.light }}>
                <Icon name="CameraIcon" size={18} style={{ color: BRAND.primary }} />
              </div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>الصورة الشخصية</h3>
            </div>

            {/* Avatar preview */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div
                  className="w-28 h-28 rounded-3xl overflow-hidden flex items-center justify-center"
                  style={{ background: BRAND.light, border: `3px solid ${BRAND.primary}` }}
                >
                  {uploadingPhoto ? (
                    <Spinner size={36} />
                  ) : avatarPreview ? (
                    <AppImage src={avatarPreview} alt={`صورة ${displayName}`} width={112} height={112} className="w-full h-full object-cover" />
                  ) : (
                    <Icon name="UserCircleIcon" size={56} style={{ color: BRAND.primary }} />
                  )}
                </div>
                {photoSaved && (
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md" style={{ background: '#059669' }}>
                    <Icon name="CheckIcon" size={16} className="text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                يُنصح باستخدام صورة واضحة بحجم لا يقل عن 200×200 بكسل
              </p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity active:opacity-80 disabled:opacity-50"
                style={{ background: BRAND.gradient }}
              >
                <Icon name="ArrowUpTrayIcon" size={18} className="text-white" />
                {uploadingPhoto ? 'جاري الرفع...' : 'رفع صورة جديدة'}
              </button>

              {avatarPreview && (
                <button
                  onClick={handleRemovePhoto}
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity active:opacity-80"
                  style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1.5px solid rgba(220,38,38,0.2)' }}
                >
                  <Icon name="TrashIcon" size={18} />
                  حذف الصورة الحالية
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── PAYMENT METHODS ── */}
        {activeSection === 'payments' && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND.light }}>
                    <Icon name="CreditCardIcon" size={18} style={{ color: BRAND.primary }} />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>طرق الدفع</h3>
                </div>
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                  style={{ background: BRAND.primary }}
                >
                  <Icon name="PlusIcon" size={14} className="text-white" />
                  إضافة
                </button>
              </div>

              {loadingPayments ? (
                <div className="flex justify-center py-6"><Spinner size={32} /></div>
              ) : paymentMethods.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: BRAND.light }}>
                    <Icon name="CreditCardIcon" size={28} style={{ color: BRAND.primary }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>لا توجد طرق دفع مضافة</p>
                  <button
                    onClick={() => setShowAddPayment(true)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl text-white"
                    style={{ background: BRAND.gradient }}
                  >
                    إضافة طريقة دفع
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map(pm => {
                    const info = payTypeInfo(pm.method_type);
                    return (
                      <div
                        key={pm.id}
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{
                          background: pm.is_default ? BRAND.light : 'var(--muted)',
                          border: pm.is_default ? `1.5px solid ${BRAND.primary}` : '1.5px solid var(--border)',
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: pm.is_default ? BRAND.primary : 'var(--card)' }}>
                          <Icon name={info.icon as never} size={20} className={pm.is_default ? 'text-white' : ''} style={!pm.is_default ? { color: BRAND.primary } : {}} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{pm.label}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{info.label}</p>
                            {pm.last_four && <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>•••• {pm.last_four}</p>}
                            {pm.is_default && (
                              <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold" style={{ background: BRAND.primary, color: '#fff' }}>افتراضي</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!pm.is_default && (
                            <button
                              onClick={() => handleSetDefaultPayment(pm.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: BRAND.light }}
                              title="تعيين كافتراضي"
                            >
                              <Icon name="StarIcon" size={15} style={{ color: BRAND.primary }} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePayment(pm.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(220,38,38,0.08)' }}
                            title="حذف"
                          >
                            <Icon name="TrashIcon" size={15} style={{ color: '#DC2626' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add payment form */}
            {showAddPayment && (
              <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: `1.5px solid ${BRAND.primary}` }}>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>إضافة طريقة دفع</h4>
                  <button onClick={() => setShowAddPayment(false)}>
                    <Icon name="XMarkIcon" size={18} style={{ color: 'var(--muted-foreground)' }} />
                  </button>
                </div>

                {/* Type selector */}
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_TYPES.map(pt => (
                    <button
                      key={pt.key}
                      onClick={() => setNewPayType(pt.key)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: newPayType === pt.key ? BRAND.gradient : 'var(--muted)',
                        color: newPayType === pt.key ? '#fff' : 'var(--foreground)',
                        border: newPayType === pt.key ? 'none' : '1.5px solid var(--border)',
                      }}
                    >
                      <Icon name={pt.icon as never} size={16} className={newPayType === pt.key ? 'text-white' : ''} style={newPayType !== pt.key ? { color: BRAND.primary } : {}} />
                      {pt.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>التسمية (مثال: بطاقتي الرئيسية)</label>
                  <input
                    value={newPayLabel}
                    onChange={e => setNewPayLabel(e.target.value)}
                    placeholder="اسم طريقة الدفع"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
                    dir="rtl"
                  />
                </div>

                {newPayType === 'card' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-3">
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>آخر 4 أرقام</label>
                      <input
                        value={newPayLastFour}
                        onChange={e => setNewPayLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="1234"
                        maxLength={4}
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
                        dir="ltr"
                      />
                    </div>
                    <div className="col-span-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>شهر الانتهاء</label>
                        <input
                          value={newPayExpMonth}
                          onChange={e => setNewPayExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          placeholder="MM"
                          maxLength={2}
                          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                          style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>سنة الانتهاء</label>
                        <input
                          value={newPayExpYear}
                          onChange={e => setNewPayExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="YYYY"
                          maxLength={4}
                          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                          style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleAddPayment}
                  disabled={savingPayment || !newPayLabel.trim()}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: BRAND.gradient }}
                >
                  {savingPayment ? <Spinner size={18} /> : <><Icon name="PlusIcon" size={18} className="text-white" />إضافة طريقة الدفع</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PREFERENCES ── */}
        {activeSection === 'preferences' && (
          <div className="space-y-4">
            {/* Notifications */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND.light }}>
                  <Icon name="BellIcon" size={18} style={{ color: BRAND.primary }} />
                </div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>الإشعارات</h3>
              </div>

              {[
                { label: 'إشعارات الطلبات', sub: 'تحديثات حالة طلباتك', value: notifOrders, setter: setNotifOrders },
                { label: 'إشعارات الرسائل', sub: 'رسائل الحِرَفيين والدعم', value: notifMessages, setter: setNotifMessages },
                { label: 'العروض والتخفيضات', sub: 'عروض حصرية وتخفيضات', value: notifOffers, setter: setNotifOffers },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{item.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{item.sub}</p>
                  </div>
                  <button
                    onClick={() => item.setter(!item.value)}
                    className="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
                    style={{ background: item.value ? BRAND.primary : 'var(--muted)' }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300"
                      style={{ right: item.value ? '2px' : 'calc(100% - 22px)' }}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Appearance */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND.light }}>
                  <Icon name="PaintBrushIcon" size={18} style={{ color: BRAND.primary }} />
                </div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>المظهر</h3>
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>الوضع الليلي</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>تغيير مظهر التطبيق</p>
                </div>
                <button
                  onClick={handleToggleDarkMode}
                  className="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
                  style={{ background: darkMode ? BRAND.primary : 'var(--muted)' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300"
                    style={{ right: darkMode ? '2px' : 'calc(100% - 22px)' }}
                  />
                </button>
              </div>

              {/* Language */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>اللغة</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>لغة واجهة التطبيق</p>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--muted)' }}>
                  {(['ar', 'en'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background: language === lang ? BRAND.primary : 'transparent',
                        color: language === lang ? '#fff' : 'var(--muted-foreground)',
                      }}
                    >
                      {lang === 'ar' ? 'عربي' : 'EN'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Privacy & Security */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND.light }}>
                  <Icon name="ShieldCheckIcon" size={18} style={{ color: BRAND.primary }} />
                </div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>الخصوصية والأمان</h3>
              </div>

              {[
                { label: 'سياسة الخصوصية', icon: 'DocumentTextIcon', href: '/privacy-policy' },
                { label: 'شروط الاستخدام', icon: 'ClipboardDocumentListIcon', href: '/privacy-policy' },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => router.push(item.href)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl transition-all active:opacity-70"
                  style={{ background: 'var(--muted)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon name={item.icon as never} size={16} style={{ color: BRAND.primary }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{item.label}</span>
                  </div>
                  <Icon name="ChevronLeftIcon" size={14} style={{ color: 'var(--muted-foreground)' }} />
                </button>
              ))}
            </div>

            {/* Danger zone */}
            <div className="rounded-2xl p-5" style={{ background: 'rgba(220,38,38,0.05)', border: '1.5px solid rgba(220,38,38,0.15)' }}>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                style={{ color: '#DC2626' }}
              >
                <Icon name="ArrowRightOnRectangleIcon" size={18} />
                تسجيل الخروج
              </button>
            </div>
          </div>
        )}
      </div>

      <BottomTabBar activeTab="profile" />
    </div>
  );
}
