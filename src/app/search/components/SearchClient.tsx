'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import RequestServiceModal from '@/app/craftsman-profile/components/RequestServiceModal';

const LOGO_GREEN = '#2a724d';
const LOGO_GREEN_DARK = '#1d5236';

interface CraftsmanResult {
  id: string;
  user_id: string;
  specialty: string | null;
  rating: number;
  completed_jobs: number;
  is_online: boolean;
  is_verified: boolean;
  avatar_url: string | null;
  location: string | null;
  experience_years: number;
  user_profiles: {
    full_name: string;
    location: string | null;
  } | null;
  services?: { base_price: number | null }[];
}

interface ServiceCategory {
  id: string;
  name: string;
  emoji: string;
  slug: string;
}

const REGIONS = [
  'الكل',
  'الرياض',
  'جدة',
  'مكة المكرمة',
  'المدينة المنورة',
  'الدمام',
  'الخبر',
  'الطائف',
  'تبوك',
  'أبها',
  'القصيم',
];

const SORT_OPTIONS = [
  { value: 'rating', label: 'الأعلى تقييماً' },
  { value: 'jobs', label: 'الأكثر خبرة' },
  { value: 'online', label: 'المتاحون الآن' },
];

export default function SearchClient() {
  const supabase = createClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [craftsmen, setCraftsmen] = useState<CraftsmanResult[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedRegion, setSelectedRegion] = useState('الكل');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<number>(0);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [showFilters, setShowFilters] = useState(false);

  const [bookingCraftsman, setBookingCraftsman] = useState<CraftsmanResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [catRes, craftRes] = await Promise.all([
        supabase.from('service_categories').select('*').eq('is_active', true).order('name'),
        supabase
          .from('craftsman_profiles')
          .select(
            'id, user_id, specialty, rating, completed_jobs, is_online, is_verified, avatar_url, location, experience_years, user_profiles(full_name, location)'
          )
          .order('rating', { ascending: false }),
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (craftRes.data) setCraftsmen(craftRes.data as any);
    } catch (e) {
      console.error('loadData error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCraftsmen = craftsmen
    .filter((c) => {
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (c.user_profiles?.full_name || '').toLowerCase();
        const spec = (c.specialty || '').toLowerCase();
        if (!name.includes(q) && !spec.includes(q)) return false;
      }

      // Region filter
      if (selectedRegion !== 'الكل') {
        const loc = (c.location || c.user_profiles?.location || '').toLowerCase();
        if (!loc.includes(selectedRegion.toLowerCase())) return false;
      }

      // Category / specialty filter
      if (selectedCategory) {
        const cat = categories.find((c2) => c2.id === selectedCategory);
        if (cat) {
          const spec = (c.specialty || '').toLowerCase();
          if (!spec.includes(cat.name.toLowerCase()) && !spec.includes(cat.slug.toLowerCase())) return false;
        }
      }

      // Rating filter
      if (minRating > 0 && (c.rating || 0) < minRating) return false;

      // Online only
      if (onlineOnly && !c.is_online) return false;

      // Verified only
      if (verifiedOnly && !c.is_verified) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'jobs') return (b.completed_jobs || 0) - (a.completed_jobs || 0);
      if (sortBy === 'online') {
        if (a.is_online && !b.is_online) return -1;
        if (!a.is_online && b.is_online) return 1;
        return (b.rating || 0) - (a.rating || 0);
      }
      return 0;
    });

  const activeFiltersCount = [
    selectedRegion !== 'الكل',
    selectedCategory !== null,
    minRating > 0,
    minPrice !== '',
    maxPrice !== '',
    onlineOnly,
    verifiedOnly,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedRegion('الكل');
    setSelectedCategory(null);
    setMinRating(0);
    setMinPrice('');
    setMaxPrice('');
    setOnlineOnly(false);
    setVerifiedOnly(false);
    setSortBy('rating');
  };

  return (
    <div className="screen-container" style={{ background: 'linear-gradient(180deg, #f0f7f3 0%, #f5f5f5 100%)' }} dir="rtl">
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(150deg, ${LOGO_GREEN_DARK} 0%, ${LOGO_GREEN} 55%, #3aaa6e 100%)`,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: `0 8px 32px ${LOGO_GREEN_DARK}60, 0 2px 8px rgba(0,0,0,0.15)`,
        }}
        className="px-4 pt-12 pb-6"
      >
        <div style={{ position: 'absolute', top: -50, left: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

        <div className="flex items-center gap-3 mb-4" style={{ position: 'relative' }}>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">البحث عن صنايعي</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {isLoading ? '...' : `${filteredCraftsmen.length} صنايعي متاح`}
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none">
            <Icon name="MagnifyingGlassIcon" size={17} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم أو التخصص..."
            className="w-full rounded-2xl py-3.5 pr-10 pl-4 text-sm text-gray-800 placeholder:text-gray-400 outline-none"
            style={{
              background: 'rgba(255,255,255,0.98)',
              boxShadow: '0 6px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
            }}
            dir="rtl"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 left-3 flex items-center"
            >
              <Icon name="XMarkIcon" size={16} className="text-gray-400" />
            </button>
          )}
        </div>

        <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 20, background: '#f0f7f3', borderRadius: '50% 50% 0 0 / 100% 100% 0 0', transform: 'scaleX(1.1)' }} />
      </div>

      {/* Filter Bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {/* Filter toggle button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 transition-all"
            style={{
              background: showFilters || activeFiltersCount > 0
                ? `linear-gradient(135deg, ${LOGO_GREEN_DARK}, ${LOGO_GREEN})`
                : 'white',
              color: showFilters || activeFiltersCount > 0 ? 'white' : '#374151',
              border: `1.5px solid ${showFilters || activeFiltersCount > 0 ? LOGO_GREEN : '#e5e7eb'}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
            }}
          >
            <Icon name="AdjustmentsHorizontalIcon" size={14} />
            فلاتر
            {activeFiltersCount > 0 && (
              <span
                className="w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.3)', fontSize: '10px' }}
              >
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Sort options */}
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: sortBy === opt.value
                  ? `linear-gradient(135deg, ${LOGO_GREEN_DARK}18, ${LOGO_GREEN}28)`
                  : 'white',
                color: sortBy === opt.value ? LOGO_GREEN : '#6b7280',
                border: `1.5px solid ${sortBy === opt.value ? LOGO_GREEN + '50' : '#e5e7eb'}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              {opt.label}
            </button>
          ))}

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold text-red-500 transition-all"
              style={{ background: '#fff5f5', border: '1.5px solid #fecaca' }}
            >
              مسح الكل
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filters Panel */}
      {showFilters && (
        <div
          className="mx-4 mb-3 rounded-2xl p-4 space-y-4"
          style={{
            background: 'white',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.05)',
          }}
        >
          {/* Region */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
              <Icon name="MapPinIcon" size={13} style={{ color: LOGO_GREEN }} />
              المنطقة
            </p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((region) => (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: selectedRegion === region
                      ? `linear-gradient(135deg, ${LOGO_GREEN_DARK}, ${LOGO_GREEN})`
                      : '#f3f4f6',
                    color: selectedRegion === region ? 'white' : '#374151',
                    border: `1px solid ${selectedRegion === region ? LOGO_GREEN : 'transparent'}`,
                  }}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
              <Icon name="WrenchScrewdriverIcon" size={13} style={{ color: LOGO_GREEN }} />
              التخصص
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: selectedCategory === null
                    ? `linear-gradient(135deg, ${LOGO_GREEN_DARK}, ${LOGO_GREEN})`
                    : '#f3f4f6',
                  color: selectedCategory === null ? 'white' : '#374151',
                }}
              >
                الكل
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: selectedCategory === cat.id
                      ? `linear-gradient(135deg, ${LOGO_GREEN_DARK}, ${LOGO_GREEN})`
                      : '#f3f4f6',
                    color: selectedCategory === cat.id ? 'white' : '#374151',
                  }}
                >
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
              <Icon name="StarIcon" size={13} style={{ color: LOGO_GREEN }} />
              الحد الأدنى للتقييم
            </p>
            <div className="flex gap-2">
              {[0, 3, 3.5, 4, 4.5].map((r) => (
                <button
                  key={r}
                  onClick={() => setMinRating(r)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: minRating === r
                      ? `linear-gradient(135deg, ${LOGO_GREEN_DARK}, ${LOGO_GREEN})`
                      : '#f3f4f6',
                    color: minRating === r ? 'white' : '#374151',
                  }}
                >
                  {r === 0 ? 'الكل' : (
                    <>
                      <Icon name="StarIcon" size={10} variant="solid" style={{ color: minRating === r ? 'white' : '#f59e0b' }} />
                      {r}+
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
              <Icon name="BanknotesIcon" size={13} style={{ color: LOGO_GREEN }} />
              نطاق السعر (ريال)
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="الأدنى"
                className="flex-1 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none text-center"
                style={{ border: `1.5px solid ${minPrice ? LOGO_GREEN + '60' : '#e5e7eb'}`, background: '#fafafa' }}
                dir="ltr"
              />
              <span className="text-gray-400 text-xs font-bold">—</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="الأعلى"
                className="flex-1 rounded-xl px-3 py-2 text-sm text-gray-800 outline-none text-center"
                style={{ border: `1.5px solid ${maxPrice ? LOGO_GREEN + '60' : '#e5e7eb'}`, background: '#fafafa' }}
                dir="ltr"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-3">
            <button
              onClick={() => setOnlineOnly(!onlineOnly)}
              className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: onlineOnly ? `${LOGO_GREEN}15` : '#f3f4f6',
                border: `1.5px solid ${onlineOnly ? LOGO_GREEN + '50' : 'transparent'}`,
                color: onlineOnly ? LOGO_GREEN : '#6b7280',
              }}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: onlineOnly ? LOGO_GREEN : '#d1d5db', boxShadow: onlineOnly ? `0 0 6px ${LOGO_GREEN}` : 'none' }}
              />
              متاح الآن فقط
            </button>
            <button
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: verifiedOnly ? '#FEF3C715' : '#f3f4f6',
                border: `1.5px solid ${verifiedOnly ? '#D97706' : 'transparent'}`,
                color: verifiedOnly ? '#D97706' : '#6b7280',
              }}
            >
              <Icon name="CheckBadgeIcon" size={13} style={{ color: verifiedOnly ? '#D97706' : '#d1d5db' }} />
              موثوق فقط
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="px-4 pb-24 space-y-3">
        {/* Results count */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-400">
            {isLoading ? 'جارٍ التحميل...' : `${filteredCraftsmen.length} نتيجة`}
          </span>
          <span className="text-xs font-semibold" style={{ color: LOGO_GREEN }}>
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
          </span>
        </div>

        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} />
            ))}
          </>
        ) : filteredCraftsmen.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: `${LOGO_GREEN}15` }}
            >
              <Icon name="MagnifyingGlassIcon" size={28} style={{ color: LOGO_GREEN }} />
            </div>
            <p className="text-gray-700 font-bold text-base mb-1">لا توجد نتائج</p>
            <p className="text-gray-400 text-sm">جرّب تغيير الفلاتر أو كلمة البحث</p>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${LOGO_GREEN_DARK}, ${LOGO_GREEN})` }}
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        ) : (
          filteredCraftsmen.map((craftsman, index) => (
            <div
              key={craftsman.id}
              className="bg-white rounded-2xl p-4"
              style={{
                border: '1px solid rgba(0,0,0,0.05)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              {/* Top badge */}
              {index === 0 && (
                <div
                  className="flex items-center gap-1 mb-2 px-2 py-0.5 rounded-lg self-start inline-flex"
                  style={{
                    background: `linear-gradient(135deg, ${LOGO_GREEN_DARK}15, ${LOGO_GREEN}20)`,
                    border: `1px solid ${LOGO_GREEN}30`,
                  }}
                >
                  <Icon name="StarIcon" size={10} variant="solid" style={{ color: LOGO_GREEN }} />
                  <span className="text-xs font-bold" style={{ color: LOGO_GREEN }}>الأعلى تقييماً</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100"
                    style={{
                      boxShadow: craftsman.is_online
                        ? `0 4px 14px ${LOGO_GREEN}35`
                        : '0 3px 10px rgba(0,0,0,0.1)',
                      border: craftsman.is_online ? `2px solid ${LOGO_GREEN}40` : '2px solid transparent',
                    }}
                  >
                    {craftsman.avatar_url ? (
                      <AppImage
                        src={craftsman.avatar_url}
                        alt={`صورة ${craftsman.user_profiles?.full_name || 'الصنايعي'}`}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <Icon name="UserCircleIcon" size={32} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  {craftsman.is_online && (
                    <div
                      className="absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full border-2 border-white"
                      style={{ background: LOGO_GREEN, boxShadow: `0 0 6px ${LOGO_GREEN}80` }}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900">
                      {craftsman.user_profiles?.full_name || 'صنايعي'}
                    </h3>
                    {craftsman.is_verified && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B)', boxShadow: '0 2px 6px rgba(217,119,6,0.35)' }}
                      >
                        <Icon name="CheckBadgeIcon" size={10} className="text-white" />
                        موثوق
                      </span>
                    )}
                    {craftsman.is_online && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ color: LOGO_GREEN, background: `${LOGO_GREEN}15`, border: `1px solid ${LOGO_GREEN}30` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: LOGO_GREEN }} />
                        متاح
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{craftsman.specialty}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Icon name="BriefcaseIcon" size={11} className="text-gray-400" />
                      <span className="text-xs text-gray-500">{craftsman.completed_jobs} مهمة</span>
                    </div>
                    {craftsman.experience_years > 0 && (
                      <div className="flex items-center gap-1">
                        <Icon name="ClockIcon" size={11} className="text-gray-400" />
                        <span className="text-xs text-gray-500">{craftsman.experience_years} سنة خبرة</span>
                      </div>
                    )}
                  </div>
                  {(craftsman.location || craftsman.user_profiles?.location) && (
                    <div className="flex items-center gap-1 mt-1">
                      <Icon name="MapPinIcon" size={11} className="text-gray-400" />
                      <span className="text-xs text-gray-400 truncate">
                        {craftsman.user_profiles?.location || craftsman.location}
                      </span>
                    </div>
                  )}
                </div>

                {/* Rating + Actions */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                      boxShadow: '0 2px 6px rgba(245,158,11,0.2)',
                      border: '1px solid rgba(245,158,11,0.2)',
                    }}
                  >
                    <span className="text-sm font-bold text-gray-900">{craftsman.rating?.toFixed(1) || '0.0'}</span>
                    <Icon name="StarIcon" size={13} variant="solid" className="text-yellow-500" />
                  </div>
                  <Link href={`/craftsman-profile?id=${craftsman.id}`}>
                    <button
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                      style={{ border: `1.5px solid ${LOGO_GREEN}`, color: LOGO_GREEN, background: `${LOGO_GREEN}08` }}
                    >
                      عرض الملف
                    </button>
                  </Link>
                  <button
                    onClick={() => setBookingCraftsman(craftsman)}
                    className="px-3 py-1.5 rounded-xl text-white text-xs font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${LOGO_GREEN_DARK}, ${LOGO_GREEN})`,
                      boxShadow: `0 4px 14px ${LOGO_GREEN}45`,
                    }}
                  >
                    احجز الآن
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomTabBar activeTab="search" />

      {bookingCraftsman && (
        <RequestServiceModal
          craftsmanProfileId={bookingCraftsman.id}
          craftsmanUserId={bookingCraftsman.user_id}
          craftsmanName={bookingCraftsman.user_profiles?.full_name || 'صنايعي'}
          services={[]}
          onClose={() => setBookingCraftsman(null)}
          onSuccess={() => setBookingCraftsman(null)}
        />
      )}
    </div>
  );
}
