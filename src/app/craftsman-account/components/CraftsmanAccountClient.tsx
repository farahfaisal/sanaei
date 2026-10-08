'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { rtChannelName } from '@/lib/supabase/realtime';
import { Spinner } from '@/components/ui/Loader';

interface CraftsmanProfile {
  id: string;
  bio: string | null;
  specialty: string | null;
  experience_years: number;
  location: string | null;
  is_online: boolean;
  is_verified: boolean;
  rating: number;
  total_reviews: number;
  completed_jobs: number;
  total_clients: number;
  avatar_url: string | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer: { full_name: string; avatar_url: string | null } | null;
}

const BRAND = {
  primary: '#2a724d',
  secondary: '#358f61',
  light: 'rgba(42,114,77,0.10)',
  gradient: 'linear-gradient(145deg, #1d5236 0%, #2a724d 45%, #358f61 100%)',
};

type AccountTab = 'profile' | 'reviews' | 'settings';

export default function CraftsmanAccountClient() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [craftsmanProfile, setCraftsmanProfile] = useState<CraftsmanProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>('profile');

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editExperience, setEditExperience] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Online toggle
  const [togglingOnline, setTogglingOnline] = useState(false);

  // Notification prefs
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifOffers, setNotifOffers] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/phone-login-otp-verification'); return; }
    if (profile?.role !== 'craftsman') { router.replace('/home-screen'); return; }
    loadCraftsmanProfile();
  }, [user, authLoading, profile]);

  useEffect(() => {
    if (profile?.full_name) setEditName(profile.full_name);
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'reviews' && craftsmanProfile) {
      loadReviews(craftsmanProfile.id);
    }
  }, [activeTab, craftsmanProfile]);

  // Real-time subscription for craftsman profile updates
  useEffect(() => {
    if (!craftsmanProfile?.id) return;
    const channel = supabase
      .channel(rtChannelName(`craftsman-profile-realtime-${craftsmanProfile.id}`))
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'craftsman_profiles', filter: `id=eq.${craftsmanProfile.id}` },
        (payload) => {
          if (payload.new) {
            setCraftsmanProfile(prev => prev ? { ...prev, ...(payload.new as Partial<CraftsmanProfile>) } : prev);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [craftsmanProfile?.id]);

  const loadCraftsmanProfile = async () => {
    if (!user) return;
    setLoadingProfile(true);
    try {
      const { data } = await supabase
        .from('craftsman_profiles')
        .select('id, bio, specialty, experience_years, location, is_online, is_verified, rating, total_reviews, completed_jobs, total_clients, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setCraftsmanProfile(data);
        setEditBio(data.bio || '');
        setEditSpecialty(data.specialty || '');
        setEditLocation(data.location || '');
        setEditExperience(String(data.experience_years || 0));
      }
    } catch { /* ignore */ } finally { setLoadingProfile(false); }
  };

  const loadReviews = async (craftsmanId: string) => {
    setLoadingReviews(true);
    try {
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, customer:customer_id(full_name, avatar_url)')
        .eq('craftsman_id', craftsmanId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setReviews(data.map((r: any) => ({
          ...r,
          customer: Array.isArray(r.customer) ? r.customer[0] : r.customer,
        })));
      }
    } catch { /* ignore */ } finally { setLoadingReviews(false); }
  };

  const handleSaveProfile = async () => {
    if (!user || !craftsmanProfile) return;
    setSavingProfile(true);
    try {
      await supabase.from('user_profiles')
        .update({ full_name: editName.trim(), location: editLocation.trim() || null })
        .eq('id', user.id);

      await supabase.from('craftsman_profiles')
        .update({
          bio: editBio.trim() || null,
          specialty: editSpecialty.trim() || null,
          location: editLocation.trim() || null,
          experience_years: parseInt(editExperience) || 0,
        })
        .eq('id', craftsmanProfile.id);

      await loadCraftsmanProfile();
      setEditMode(false);
    } catch { /* ignore */ } finally { setSavingProfile(false); }
  };

  const handleToggleOnline = async () => {
    if (!craftsmanProfile) return;
    setTogglingOnline(true);
    try {
      const newStatus = !craftsmanProfile.is_online;
      await supabase.from('craftsman_profiles')
        .update({ is_online: newStatus })
        .eq('id', craftsmanProfile.id);
      setCraftsmanProfile(prev => prev ? { ...prev, is_online: newStatus } : prev);
    } catch { /* ignore */ } finally { setTogglingOnline(false); }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/phone-login-otp-verification');
    } catch { /* ignore */ }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < rating ? '#F59E0B' : '#D1D5DB', fontSize: '14px' }}>★</span>
    ));
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8faf9' }}>
        <div className="flex flex-col items-center gap-3">
          <Spinner size={48} />
          <span className="text-sm font-medium" style={{ color: BRAND.primary }}>جاري التحميل...</span>
        </div>
      </div>
    );
  }

  const avatarUrl = craftsmanProfile?.avatar_url || profile?.avatar_url;
  const displayName = profile?.full_name || 'الحرفي';

  const TABS: { id: AccountTab; label: string; icon: string }[] = [
    { id: 'profile', label: 'الملف الشخصي', icon: 'UserCircleIcon' },
    { id: 'reviews', label: 'التقييمات', icon: 'StarIcon' },
    { id: 'settings', label: 'الإعدادات', icon: 'Cog6ToothIcon' },
  ];

  return (
    <div className="min-h-screen pb-28" style={{ background: '#f8faf9', direction: 'rtl' }}>
      {/* Header */}
      <div className="relative" style={{ background: BRAND.gradient, paddingTop: '56px', paddingBottom: '80px' }}>
        <div className="px-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-white text-xl font-bold">حسابي</h1>
            {craftsmanProfile && (
              <button
                onClick={handleToggleOnline}
                disabled={togglingOnline}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: craftsmanProfile.is_online ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.15)',
                  border: `1.5px solid ${craftsmanProfile.is_online ? '#34D399' : 'rgba(255,255,255,0.4)'}`,
                  color: craftsmanProfile.is_online ? '#34D399' : 'rgba(255,255,255,0.8)',
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: craftsmanProfile.is_online ? '#34D399' : 'rgba(255,255,255,0.5)' }} />
                {craftsmanProfile.is_online ? 'متاح الآن' : 'غير متاح'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Avatar card */}
      <div className="px-5 -mt-16 relative z-10">
        <div className="rounded-3xl p-5 shadow-lg" style={{ background: '#fff', border: '1px solid rgba(42,114,77,0.10)' }}>
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden" style={{ border: `3px solid ${BRAND.primary}` }}>
                {avatarUrl ? (
                  <AppImage src={avatarUrl} alt={`صورة ${displayName}`} width={80} height={80} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: BRAND.gradient }}>
                    <Icon name="UserCircleIcon" size={40} className="text-white" />
                  </div>
                )}
              </div>
              {craftsmanProfile?.is_verified && (
                <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: BRAND.primary }}>
                  <Icon name="CheckBadgeIcon" size={14} className="text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 truncate">{displayName}</h2>
                {craftsmanProfile?.is_verified && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(42,114,77,0.12)', color: BRAND.primary }}>موثّق</span>
                )}
              </div>
              {craftsmanProfile?.specialty && (
                <p className="text-sm mt-0.5" style={{ color: BRAND.primary }}>{craftsmanProfile.specialty}</p>
              )}
              {profile?.phone && (
                <p className="text-xs text-gray-500 mt-0.5">{profile.phone}</p>
              )}
              {craftsmanProfile?.location && (
                <div className="flex items-center gap-1 mt-1">
                  <Icon name="MapPinIcon" size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{craftsmanProfile.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          {craftsmanProfile && (
            <div className="grid grid-cols-4 gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(42,114,77,0.08)' }}>
              {[
                { label: 'التقييم', value: Number(craftsmanProfile.rating).toFixed(1), icon: 'StarIcon', color: '#F59E0B' },
                { label: 'التقييمات', value: String(craftsmanProfile.total_reviews), icon: 'ChatBubbleLeftIcon', color: BRAND.primary },
                { label: 'الطلبات', value: String(craftsmanProfile.completed_jobs), icon: 'CheckCircleIcon', color: '#0284C7' },
                { label: 'العملاء', value: String(craftsmanProfile.total_clients), icon: 'UsersIcon', color: '#7C3AED' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}18` }}>
                    <Icon name={stat.icon as never} size={16} style={{ color: stat.color }} />
                  </div>
                  <span className="text-sm font-bold text-gray-900">{stat.value}</span>
                  <span className="text-xs text-gray-400">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mt-4">
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: 'rgba(42,114,77,0.08)' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: activeTab === tab.id ? '#fff' : 'transparent',
                color: activeTab === tab.id ? BRAND.primary : '#9CA3AF',
                boxShadow: activeTab === tab.id ? '0 2px 8px rgba(42,114,77,0.15)' : 'none',
              }}
            >
              <Icon name={tab.icon as never} size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-5 mt-4">

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {!editMode ? (
              <>
                {/* Bio */}
                <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid rgba(42,114,77,0.08)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800 text-sm">نبذة عني</h3>
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl"
                      style={{ background: BRAND.light, color: BRAND.primary }}
                    >
                      <Icon name="PencilSquareIcon" size={13} />
                      تعديل
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {craftsmanProfile?.bio || 'لم تتم إضافة نبذة بعد'}
                  </p>
                </div>

                {/* Info */}
                <div className="rounded-2xl p-4 space-y-3" style={{ background: '#fff', border: '1px solid rgba(42,114,77,0.08)' }}>
                  <h3 className="font-semibold text-gray-800 text-sm mb-3">معلومات المهنة</h3>
                  {[
                    { icon: 'WrenchScrewdriverIcon', label: 'التخصص', value: craftsmanProfile?.specialty || '—' },
                    { icon: 'MapPinIcon', label: 'المنطقة', value: craftsmanProfile?.location || '—' },
                    { icon: 'CalendarDaysIcon', label: 'سنوات الخبرة', value: craftsmanProfile?.experience_years ? `${craftsmanProfile.experience_years} سنة` : '—' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: BRAND.light }}>
                        <Icon name={item.icon as never} size={15} style={{ color: BRAND.primary }} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{item.label}</p>
                        <p className="text-sm font-medium text-gray-800">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick links */}
                <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(42,114,77,0.08)' }}>
                  {[
                    { icon: 'ClipboardDocumentListIcon', label: 'طلباتي', href: '/craftsman-orders', color: '#0284C7' },
                    { icon: 'WalletIcon', label: 'المحفظة والأرباح', href: '/wallet-earnings-dashboard', color: '#059669' },
                    { icon: 'ChatBubbleLeftRightIcon', label: 'المحادثات', href: '/conversations', color: '#7C3AED' },
                  ].map((item, idx, arr) => (
                    <button
                      key={item.label}
                      onClick={() => router.push(item.href)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50"
                      style={{ borderBottom: idx < arr.length - 1 ? '1px solid rgba(42,114,77,0.06)' : 'none' }}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}18` }}>
                        <Icon name={item.icon as never} size={16} style={{ color: item.color }} />
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-800 text-right">{item.label}</span>
                      <Icon name="ChevronLeftIcon" size={16} className="text-gray-300" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* Edit form */
              <div className="rounded-2xl p-4 space-y-4" style={{ background: '#fff', border: '1px solid rgba(42,114,77,0.08)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">تعديل الملف الشخصي</h3>
                  <button onClick={() => setEditMode(false)} className="text-gray-400">
                    <Icon name="XMarkIcon" size={20} />
                  </button>
                </div>

                {[
                  { label: 'الاسم الكامل', value: editName, setter: setEditName, placeholder: 'أدخل اسمك الكامل' },
                  { label: 'التخصص', value: editSpecialty, setter: setEditSpecialty, placeholder: 'مثال: سباكة، كهرباء، نجارة' },
                  { label: 'المنطقة', value: editLocation, setter: setEditLocation, placeholder: 'مثال: الرياض، جدة' },
                  { label: 'سنوات الخبرة', value: editExperience, setter: setEditExperience, placeholder: '0', type: 'number' },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">{field.label}</label>
                    <input
                      type={(field as any).type || 'text'}
                      value={field.value}
                      onChange={(e) => field.setter(e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-gray-800 outline-none transition-all"
                      style={{
                        background: '#f8faf9',
                        border: '1.5px solid rgba(42,114,77,0.15)',
                      }}
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">نبذة عني</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="اكتب نبذة مختصرة عن نفسك وخبراتك..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-gray-800 outline-none resize-none transition-all"
                    style={{
                      background: '#f8faf9',
                      border: '1.5px solid rgba(42,114,77,0.15)',
                    }}
                  />
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="w-full py-3 rounded-2xl text-white font-semibold text-sm transition-all"
                  style={{ background: BRAND.gradient, opacity: savingProfile ? 0.7 : 1 }}
                >
                  {savingProfile ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-3">
            {/* Rating summary */}
            {craftsmanProfile && (
              <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid rgba(42,114,77,0.08)' }}>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <span className="text-4xl font-bold" style={{ color: BRAND.primary }}>{Number(craftsmanProfile.rating).toFixed(1)}</span>
                    <div className="flex mt-1">{renderStars(Math.round(craftsmanProfile.rating))}</div>
                    <span className="text-xs text-gray-400 mt-1">{craftsmanProfile.total_reviews} تقييم</span>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((star) => (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-3">{star}</span>
                        <span style={{ color: '#F59E0B', fontSize: '10px' }}>★</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                          <div className="h-full rounded-full" style={{ background: '#F59E0B', width: `${craftsmanProfile.total_reviews > 0 ? (reviews.filter(r => r.rating === star).length / craftsmanProfile.total_reviews) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loadingReviews ? (
              <div className="flex justify-center py-8">
                <Spinner size={32} />
              </div>
            ) : reviews.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: BRAND.light }}>
                  <Icon name="StarIcon" size={32} style={{ color: BRAND.primary }} />
                </div>
                <p className="text-sm font-medium text-gray-500">لا توجد تقييمات بعد</p>
                <p className="text-xs text-gray-400 text-center">ستظهر تقييمات العملاء هنا بعد إتمام الطلبات</p>
              </div>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid rgba(42,114,77,0.08)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0" style={{ background: BRAND.light }}>
                      {review.customer?.avatar_url ? (
                        <AppImage src={review.customer.avatar_url} alt={`صورة ${review.customer.full_name}`} width={40} height={40} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="UserCircleIcon" size={22} style={{ color: BRAND.primary }} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">{review.customer?.full_name || 'عميل'}</span>
                        <span className="text-xs text-gray-400">{formatDate(review.created_at)}</span>
                      </div>
                      <div className="flex mt-0.5">{renderStars(review.rating)}</div>
                      {review.comment && (
                        <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{review.comment}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {/* Notifications */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(42,114,77,0.08)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(42,114,77,0.06)' }}>
                <h3 className="font-semibold text-gray-800 text-sm">الإشعارات</h3>
              </div>
              {[
                { label: 'إشعارات الطلبات الجديدة', value: notifOrders, setter: setNotifOrders },
                { label: 'إشعارات الرسائل', value: notifMessages, setter: setNotifMessages },
                { label: 'إشعارات العروض', value: notifOffers, setter: setNotifOffers },
              ].map((item, idx, arr) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-4 py-3.5"
                  style={{ borderBottom: idx < arr.length - 1 ? '1px solid rgba(42,114,77,0.06)' : 'none' }}
                >
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <button
                    onClick={() => item.setter(!item.value)}
                    className="relative w-11 h-6 rounded-full transition-all duration-200"
                    style={{ background: item.value ? BRAND.primary : '#D1D5DB' }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200"
                      style={{ right: item.value ? '2px' : 'auto', left: item.value ? 'auto' : '2px' }}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Appearance */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(42,114,77,0.08)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(42,114,77,0.06)' }}>
                <h3 className="font-semibold text-gray-800 text-sm">المظهر</h3>
              </div>
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND.light }}>
                    <Icon name={theme === 'dark' ? 'MoonIcon' : 'SunIcon'} size={16} style={{ color: BRAND.primary }} />
                  </div>
                  <span className="text-sm text-gray-700">الوضع الليلي</span>
                </div>
                <button
                  onClick={toggleTheme}
                  className="relative w-11 h-6 rounded-full transition-all duration-200"
                  style={{ background: theme === 'dark' ? BRAND.primary : '#D1D5DB' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200"
                    style={{ right: theme === 'dark' ? '2px' : 'auto', left: theme === 'dark' ? 'auto' : '2px' }}
                  />
                </button>
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1.5px solid rgba(220,38,38,0.15)' }}
            >
              <Icon name="ArrowRightOnRectangleIcon" size={18} />
              تسجيل الخروج
            </button>
          </div>
        )}
      </div>

      <BottomTabBar activeTab="profile" />
    </div>
  );
}
