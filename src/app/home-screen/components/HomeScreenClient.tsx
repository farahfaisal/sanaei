'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import dynamic from 'next/dynamic';
import RequestServiceModal from '@/app/craftsman-profile/components/RequestServiceModal';

const MapBlock = dynamic(() => import('./MapBlock'), { ssr: false });

interface ServiceCategory {
  id: string;
  name: string;
  emoji: string;
  slug: string;
}

interface CraftsmanCard {
  id: string;
  user_id: string;
  specialty: string;
  rating: number;
  completed_jobs: number;
  is_online: boolean;
  is_verified: boolean;
  avatar_url: string | null;
  location?: string | null;
  user_profiles: {
    full_name: string;
    location: string | null;
  } | null;
}

interface PromotionalOffer {
  id: string;
  title: string;
  description: string | null;
  discount_percent: number | null;
  image_url: string | null;
  badge_text: string | null;
  button_text: string;
  bg_color_from: string;
  bg_color_to: string;
}

function parseLocation(location: string | null): {lat: number;lng: number;} | null {
  if (!location) return null;
  const parts = location.split(',');
  if (parts.length === 2) {
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  return null;
}

function generateFallbackPosition(seed: string): {lat: number;lng: number;} {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const lat = 24.6 + Math.abs(hash % 1000) / 1000 * 0.4;
  const lng = 46.5 + Math.abs((hash >> 8) % 1000) / 1000 * 0.4;
  return { lat, lng };
}

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PRIMARY = '#1a6b3c';
const PRIMARY_LIGHT = '#2e8b57';
const PRIMARY_PALE = '#e8f5ee';
const ACCENT = '#f0a500';

const SORT_OPTIONS = [
  { value: 'rating', label: 'الأعلى تقييماً', icon: 'StarIcon' },
  { value: 'distance', label: 'الأقرب مسافةً', icon: 'MapPinIcon' },
  { value: 'availability', label: 'المتاحون الآن', icon: 'BoltIcon' },
];

const DISTANCE_OPTIONS = [5, 10, 20, 50, 100];

export default function HomeScreenClient() {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [craftsmen, setCraftsmen] = useState<CraftsmanCard[]>([]);
  const [offers, setOffers] = useState<PromotionalOffer[]>([]);
  const [activeOfferIndex, setActiveOfferIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const offerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [bookingCraftsman, setBookingCraftsman] = useState<CraftsmanCard | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [maxRating, setMaxRating] = useState<number>(5);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [distanceRadius, setDistanceRadius] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'rating' | 'distance' | 'availability'>('rating');
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);

  useEffect(() => {
    loadData();
    // Try to get user location for distance filtering
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          // Default to Riyadh center if denied
          setUserLocation({ lat: 24.7136, lng: 46.6753 });
        }
      );
    }
  }, []);

  useEffect(() => {
    if (offers.length > 1) {
      offerTimerRef.current = setInterval(() => {
        setActiveOfferIndex((prev) => (prev + 1) % offers.length);
      }, 4000);
    }
    return () => {
      if (offerTimerRef.current) clearInterval(offerTimerRef.current);
    };
  }, [offers.length]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [catRes, craftRes, offersRes] = await Promise.all([
      supabase.from('service_categories').select('id, name, emoji, slug').eq('is_active', true).order('name'),
      supabase.
      from('craftsman_profiles').
      select('id, user_id, specialty, rating, completed_jobs, is_online, is_verified, avatar_url, location, user_profiles(full_name, location)').
      order('rating', { ascending: false }).
      limit(20),
      supabase.
      from('promotional_offers').
      select('id, title, description, discount_percent, image_url, badge_text, button_text, bg_color_from, bg_color_to').
      eq('is_active', true).
      order('sort_order').
      limit(5)]
      );

      if (catRes.data) setCategories(catRes.data);

      if (craftRes.error) {
        const fallbackRes = await supabase.
        from('craftsman_profiles').
        select('id, user_id, specialty, rating, completed_jobs, is_online, is_verified, location, user_profiles(full_name, location)').
        order('rating', { ascending: false });
        if (fallbackRes.data) {
          setCraftsmen(fallbackRes.data.map((c: any) => ({ ...c, avatar_url: null })) as any);
        }
      } else if (craftRes.data) {
        setCraftsmen(craftRes.data as any);
      }

      if (offersRes.data && offersRes.data.length > 0) {
        setOffers(offersRes.data);
      } else {
        setOffers([{
          id: 'fallback',
          title: 'خصم 20% على خدمات التكييف',
          description: 'احصل على خصم حصري على جميع خدمات التكييف هذا الموسم',
          discount_percent: 20,
          image_url: "https://img.rocket.new/generatedImages/rocket_gen_img_10602a3a3-1774083107287.png",
          badge_text: '🌬️ عرض الصيف',
          button_text: 'اكتشف العرض',
          bg_color_from: PRIMARY,
          bg_color_to: PRIMARY_LIGHT
        }]);
      }
    } catch (e) {
      console.error('loadData error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const craftsmenWithDistance = useMemo(() => craftsmen.map((c) => {
    const locStr = c.location || c.user_profiles?.location || null;
    const parsed = parseLocation(locStr);
    const fallback = generateFallbackPosition(c.id);
    const pos = parsed ?? fallback;
    const distance = userLocation
      ? calcDistance(userLocation.lat, userLocation.lng, pos.lat, pos.lng)
      : null;
    return { ...c, _lat: pos.lat, _lng: pos.lng, _distance: distance };
  }), [craftsmen, userLocation]);

  const filteredCraftsmen = useMemo(() => {
    let list = craftsmenWithDistance.filter((c) => {
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (c.user_profiles?.full_name || '').toLowerCase();
        const spec = (c.specialty || '').toLowerCase();
        if (!name.includes(q) && !spec.includes(q)) return false;
      }
      // Category filter
      if (activeCategory) {
        if (!c.specialty?.includes(activeCategory)) return false;
      }
      // Specialty filter from filter panel
      if (selectedSpecialty) {
        const cat = categories.find((cat) => cat.id === selectedSpecialty);
        if (cat) {
          const spec = (c.specialty || '').toLowerCase();
          if (!spec.includes(cat.name.toLowerCase()) && !spec.includes(cat.slug.toLowerCase())) return false;
        }
      }
      // Min rating
      if (minRating > 0 && (c.rating || 0) < minRating) return false;
      // Max rating
      if (maxRating < 5 && (c.rating || 0) > maxRating) return false;
      // Distance radius
      if (distanceRadius !== null && c._distance !== null && c._distance > distanceRadius) return false;
      return true;
    });

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'distance') {
        if (a._distance !== null && b._distance !== null) return a._distance - b._distance;
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === 'availability') {
        if (a.is_online && !b.is_online) return -1;
        if (!a.is_online && b.is_online) return 1;
        return (b.rating || 0) - (a.rating || 0);
      }
      return 0;
    });

    return list;
  }, [craftsmenWithDistance, searchQuery, activeCategory, selectedSpecialty, minRating, maxRating, distanceRadius, sortBy, categories]);

  const mapCraftsmen = useMemo(() => craftsmen.map((c) => {
    const locStr = c.location || c.user_profiles?.location || null;
    const parsed = parseLocation(locStr);
    const fallback = generateFallbackPosition(c.id);
    return {
      id: c.id,
      full_name: c.user_profiles?.full_name || 'صنايعي',
      specialty: c.specialty || null,
      is_online: c.is_online,
      is_verified: c.is_verified,
      rating: c.rating || 0,
      lat: parsed?.lat ?? fallback.lat,
      lng: parsed?.lng ?? fallback.lng,
      status: c.is_online ? 'available' as const : 'offline' as const
    };
  }), [craftsmen]);

  const activeFiltersCount = [
    searchQuery !== '',
    selectedSpecialty !== null,
    minRating > 0,
    maxRating < 5,
    distanceRadius !== null,
    sortBy !== 'rating',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedSpecialty(null);
    setMinRating(0);
    setMaxRating(5);
    setDistanceRadius(null);
    setSortBy('rating');
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'مرحباً';
  const activeOffer = offers[activeOfferIndex] || offers[0];
  const onlineCraftsmen = craftsmen.filter((c) => c.is_online).length;

  return (
    <div className="screen-container" style={{ background: '#f4f6f8' }} dir="rtl">

      {/* ── HEADER ── */}
      <div
        style={{
          background: `linear-gradient(160deg, ${PRIMARY} 0%, ${PRIMARY_LIGHT} 100%)`,
          position: 'relative',
          overflow: 'hidden'
        }}
        className="px-5 pt-12 pb-6">
        
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 30, left: 80, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        {/* Top row */}
        <div className="flex items-center justify-between mb-5" style={{ position: 'relative' }}>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link href="/customer-profile">
            <div
              className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center cursor-pointer"
              style={{ border: '2px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)' }}>
              
              {profile?.avatar_url ?
              <AppImage src={profile.avatar_url} alt="صورة المستخدم" width={40} height={40} className="w-full h-full object-cover" /> :

              <Icon name="UserCircleIcon" size={22} className="text-white" />
              }
            </div>
            </Link>
          </div>

          <div className="text-right">
            <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>أهلاً وسهلاً 👋</p>
            <h1 className="text-lg font-bold text-white">{displayName}</h1>
          </div>
        </div>

        {/* Location pill */}
        <div className="flex items-center justify-end mb-5">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)' }}>
            
            <Icon name="MapPinIcon" size={13} style={{ color: 'rgba(255,255,255,0.8)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {profile?.location || 'الرياض، المملكة العربية السعودية'}
            </span>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
            <Icon name="MagnifyingGlassIcon" size={18} className="text-gray-400 flex-shrink-0" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن خدمة أو حِرَفي..."
            className="w-full rounded-2xl px-4 py-3.5 pr-11 text-sm text-gray-800 placeholder:text-gray-400 outline-none"
            style={{
              background: 'rgba(255,255,255,0.97)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.18)'
            }}
            dir="rtl"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 left-12 flex items-center"
            >
              <Icon name="XMarkIcon" size={16} className="text-gray-400" />
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="absolute inset-y-0 left-3 flex items-center justify-center w-8 h-8 my-auto rounded-xl transition-all"
            style={{
              background: showFilters || activeFiltersCount > 0
                ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`
                : 'rgba(0,0,0,0.06)',
            }}
          >
            <Icon
              name="AdjustmentsHorizontalIcon"
              size={16}
              style={{ color: showFilters || activeFiltersCount > 0 ? 'white' : '#6b7280' }}
            />
            {activeFiltersCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center"
                style={{ background: ACCENT, fontSize: '9px', fontWeight: 700 }}
              >
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 mt-4" style={{ position: 'relative' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {onlineCraftsmen} حِرَفي متاح الآن
            </span>
          </div>
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }} />
          <div className="flex items-center gap-1.5">
            <Icon name="BriefcaseIcon" size={12} style={{ color: 'rgba(255,255,255,0.7)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {craftsmen.length}+ محترف مسجل
            </span>
          </div>
          {(searchQuery || activeFiltersCount > 0) && (
            <>
              <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }} />
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {filteredCraftsmen.length} نتيجة
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── FILTER PANEL ── */}
      {showFilters && (
        <div
          className="mx-4 mt-3 rounded-2xl p-4 space-y-4"
          style={{
            background: 'white',
            boxShadow: '0 6px 24px rgba(0,0,0,0.1)',
            border: `1px solid ${PRIMARY}20`,
          }}
        >
          {/* Sort */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
              <Icon name="ArrowsUpDownIcon" size={13} style={{ color: PRIMARY }} />
              ترتيب النتائج
            </p>
            <div className="flex gap-2 flex-wrap">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value as any)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: sortBy === opt.value
                      ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`
                      : '#f3f4f6',
                    color: sortBy === opt.value ? 'white' : '#374151',
                    border: `1px solid ${sortBy === opt.value ? PRIMARY : 'transparent'}`,
                  }}
                >
                  <Icon name={opt.icon as never} size={12} style={{ color: sortBy === opt.value ? 'white' : PRIMARY }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Specialty */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
              <Icon name="WrenchScrewdriverIcon" size={13} style={{ color: PRIMARY }} />
              التخصص
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedSpecialty(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: selectedSpecialty === null
                    ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`
                    : '#f3f4f6',
                  color: selectedSpecialty === null ? 'white' : '#374151',
                }}
              >
                الكل
              </button>
            </div>
            <div className="relative w-20 h-20 flex-shrink-0 mr-3">
              <div className="w-full h-full rounded-xl overflow-hidden">
                <AppImage
                  src="https://img.rocket.new/generatedImages/rocket_gen_img_1122596dd-1785829864899.png"
                  alt="فني تكييف يعمل على وحدة تكييف"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -top-2 -right-2 w-9 h-9 bg-yellow-500 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white text-xs font-black">20%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nearby Craftsmen */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button className="text-primary text-sm font-semibold">عرض الكل</button>
            <h2 className="text-base font-bold text-gray-900">أفضل الحرفيين بالقرب منك</h2>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1,2,3].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredCraftsmen.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              لا يوجد حرفيون متاحون حالياً
            </div>
          </div>

          {/* Distance Radius */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
              <Icon name="MapPinIcon" size={13} style={{ color: PRIMARY }} />
              نطاق المسافة (كم)
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setDistanceRadius(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: distanceRadius === null
                    ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`
                    : '#f3f4f6',
                  color: distanceRadius === null ? 'white' : '#374151',
                }}
              >
                الكل
              </button>
              {DISTANCE_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDistanceRadius(distanceRadius === d ? null : d)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: distanceRadius === d
                      ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`
                      : '#f3f4f6',
                    color: distanceRadius === d ? 'white' : '#374151',
                  }}
                >
                  {d} كم
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={clearFilters}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: '#fff5f5', color: '#ef4444', border: '1.5px solid #fecaca' }}
            >
              مسح الفلاتر
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all"
              style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})` }}
            >
              تطبيق ({filteredCraftsmen.length} نتيجة)
            </button>
          </div>
        </div>
      )}

      {/* Sort quick-bar (visible when not showing full filter panel) */}
      {!showFilters && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value as any)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 transition-all"
                style={{
                  background: sortBy === opt.value
                    ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`
                    : 'white',
                  color: sortBy === opt.value ? 'white' : '#6b7280',
                  border: `1.5px solid ${sortBy === opt.value ? PRIMARY : '#e5e7eb'}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}
              >
                <Icon name={opt.icon as never} size={12} style={{ color: sortBy === opt.value ? 'white' : PRIMARY }} />
                {opt.label}
              </button>
            ))}
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: '#fff5f5', color: '#ef4444', border: '1.5px solid #fecaca' }}
              >
                مسح الكل
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div className="px-4 pt-5 pb-28 space-y-6">

        {/* ── QUICK ACTIONS ── */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'طلباتي', icon: 'ClipboardDocumentListIcon', href: '/my-requests', color: '#2a724d', bg: '#e8f5ee' },
            { label: 'المحادثات', icon: 'ChatBubbleLeftRightIcon', href: '/conversations', color: '#0284C7', bg: '#e0f2fe' },
            { label: 'حسابي', icon: 'UserCircleIcon', href: '/customer-profile', color: '#7C3AED', bg: '#f3e8ff' },
          ].map(action => (
            <button
              key={action.href}
              onClick={() => router.push(action.href)}
              className="flex flex-col items-center gap-2 py-3.5 rounded-2xl transition-all active:scale-95"
              style={{ background: action.bg, border: `1.5px solid ${action.color}20` }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: action.color }}>
                <Icon name={action.icon as never} size={18} className="text-white" />
              </div>
              <span className="text-xs font-bold" style={{ color: action.color }}>{action.label}</span>
            </button>
          ))}
        </div>

        {/* ── CATEGORIES ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button className="text-xs font-semibold" style={{ color: PRIMARY }}>عرض الكل</button>
            <h2 className="text-base font-bold text-gray-800">تصفح الخدمات</h2>
          </div>

          {isLoading ?
          <div className="grid grid-cols-4 gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) =>
            <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />
            )}
            </div> :

          <div className="grid grid-cols-4 gap-2.5">
              {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(isActive ? null : cat.id)}
                  className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl transition-all duration-200"
                  style={{
                    background: isActive ? PRIMARY : 'white',
                    boxShadow: isActive ?
                    `0 6px 18px ${PRIMARY}40` :
                    '0 2px 8px rgba(0,0,0,0.06)',
                    border: `1.5px solid ${isActive ? PRIMARY : '#e8ecef'}`,
                    transform: isActive ? 'scale(1.04)' : 'scale(1)'
                  }}>
                  
                    <span className="text-xl">{cat.emoji}</span>
                    <span
                    className="text-xs font-semibold text-center leading-tight"
                    style={{ color: isActive ? 'white' : '#374151' }}>
                    
                      {cat.name}
                    </span>
                  </button>);

            })}
            </div>
          }
        </div>

        {/* ── PROMOTIONAL OFFER ── */}
        {isLoading ?
        <div className="h-36 bg-gray-200 rounded-3xl animate-pulse" /> :
        activeOffer ?
        <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1.5">
                {offers.map((_, i) =>
              <button
                key={i}
                onClick={() => setActiveOfferIndex(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === activeOfferIndex ? 20 : 6,
                  height: 6,
                  background: i === activeOfferIndex ? PRIMARY : '#d1d5db'
                }} />

              )}
              </div>
              <h2 className="text-base font-bold text-gray-800">العروض الحصرية</h2>
            </div>

            <div
            key={activeOffer.id}
            className="rounded-3xl overflow-hidden relative"
            style={{
              background: `linear-gradient(135deg, ${activeOffer.bg_color_from} 0%, ${activeOffer.bg_color_to} 100%)`,
              boxShadow: `0 12px 36px ${activeOffer.bg_color_from}55`,
              minHeight: 130
            }}>
            
              {/* Decorative */}
              <div style={{ position: 'absolute', top: -50, left: -50, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -20, right: 60, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

              <div className="flex items-center p-4 gap-3" style={{ position: 'relative' }}>
                <div className="flex-1">
                  {activeOffer.badge_text &&
                <div
                  className="inline-flex items-center px-2.5 py-1 rounded-xl mb-2"
                  style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.25)' }}>
                  
                      <span className="text-white text-xs font-bold">{activeOffer.badge_text}</span>
                    </div>
                }
                  <p className="text-white font-bold text-sm leading-snug mb-1">{activeOffer.title}</p>
                  {activeOffer.description &&
                <p className="text-xs mb-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}>
                      {activeOffer.description}
                    </p>
                }
                  <button
                  className="text-white text-xs font-bold px-4 py-2 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.35)',
                    backdropFilter: 'blur(4px)'
                  }}>
                  
                    {activeOffer.button_text} ←
                  </button>
                </div>

                {activeOffer.image_url &&
              <div className="relative flex-shrink-0">
                    <div
                  className="w-24 h-24 rounded-2xl overflow-hidden"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
                  
                      <AppImage
                    src={activeOffer.image_url}
                    alt={activeOffer.title}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover" />
                  
                    </div>
                    {activeOffer.discount_percent &&
                <div
                  className="absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    boxShadow: '0 4px 12px rgba(217,119,6,0.5)',
                    border: '2px solid rgba(255,255,255,0.5)'
                  }}>
                  
                        <span className="text-white text-xs font-black">{activeOffer.discount_percent}%</span>
                      </div>
                }
                  </div>
              }
              </div>
            </div>
          </div> :
        null}

        {/* ── TOP CRAFTSMEN ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button className="text-xs font-semibold" style={{ color: PRIMARY }}>عرض الكل</button>
            <h2 className="text-base font-bold text-gray-800">
              {searchQuery || activeFiltersCount > 0 ? `نتائج البحث (${filteredCraftsmen.length})` : 'أفضل الحِرَفيين'}
            </h2>
          </div>

          {isLoading ?
          <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) =>
            <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />
            )}
            </div> :
          filteredCraftsmen.length === 0 ?
          <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: PRIMARY_PALE }}>
                <Icon name="MagnifyingGlassIcon" size={28} style={{ color: PRIMARY }} />
              </div>
              <p className="text-gray-500 text-sm font-medium">لا توجد نتائج مطابقة</p>
              <button
                onClick={clearFilters}
                className="text-xs font-bold px-4 py-2 rounded-xl"
                style={{ background: PRIMARY_PALE, color: PRIMARY }}
              >
                مسح الفلاتر
              </button>
            </div> :

          <div className="flex flex-col gap-3">
              {filteredCraftsmen.map((craftsman, index) =>
            <div
              key={craftsman.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'white',
                boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                border: '1px solid #eef0f2'
              }}>
              
                  {/* Top accent bar for #1 */}
                  {index === 0 && !searchQuery && activeFiltersCount === 0 &&
              <div style={{ height: 3, background: `linear-gradient(90deg, ${PRIMARY}, ${PRIMARY_LIGHT}, #4ade80)` }} />
              }

                  <div className="p-4">
                    {index === 0 && !searchQuery && activeFiltersCount === 0 &&
                <div className="flex items-center gap-1 mb-2.5">
                        <Icon name="TrophyIcon" size={12} style={{ color: ACCENT }} />
                        <span className="text-xs font-bold" style={{ color: ACCENT }}>الأعلى تقييماً هذا الأسبوع</span>
                      </div>
                }

                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100">
                          {craftsman.avatar_url ? (
                            <AppImage
                              src={craftsman.avatar_url}
                              alt={`صورة ${craftsman.user_profiles?.full_name || 'الحرفي'}`}
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Icon name="UserCircleIcon" size={32} className="text-gray-300" />
                            </div>
                      }
                        </div>
                        {craftsman.is_online &&
                    <div
                      className="absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full border-2 border-white"
                      style={{ background: '#22c55e', boxShadow: '0 0 6px #22c55e80' }} />

                    }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <h3 className="text-sm font-bold text-gray-900">
                            {craftsman.user_profiles?.full_name || 'حرفي'}
                          </h3>
                          {craftsman.is_verified &&
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: '#fef3c7', color: '#d97706' }}>
                        
                              <Icon name="CheckBadgeIcon" size={10} style={{ color: '#d97706' }} />
                              موثوق
                            </span>
                      }
                        </div>
                        <p className="text-xs text-gray-500 mb-1.5">{craftsman.specialty}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Icon name="StarIcon" size={12} variant="solid" style={{ color: ACCENT }} />
                            <span className="text-xs font-bold text-gray-800">{craftsman.rating}</span>
                          </div>
                          <div style={{ width: 1, height: 12, background: '#e5e7eb' }} />
                          <div className="flex items-center gap-1">
                            <Icon name="BriefcaseIcon" size={11} className="text-gray-400" />
                            <span className="text-xs text-gray-500">{craftsman.completed_jobs} مهمة</span>
                          </div>
                          {craftsman.is_online &&
                      <>
                              <div style={{ width: 1, height: 12, background: '#e5e7eb' }} />
                              <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>● متاح</span>
                            </>
                      }
                          {(craftsman as any)._distance !== null && sortBy === 'distance' && (
                            <>
                              <div style={{ width: 1, height: 12, background: '#e5e7eb' }} />
                              <span className="text-xs text-gray-500">
                                {((craftsman as any)._distance as number).toFixed(1)} كم
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                      onClick={(e) => {
                        e.preventDefault();
                        setBookingCraftsman(craftsman);
                      }}
                      className="px-3.5 py-2 rounded-xl text-white text-xs font-bold"
                      style={{
                        background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`,
                        boxShadow: `0 4px 12px ${PRIMARY}40`
                      }}>
                      
                          احجز الآن
                        </button>
                        <button
                          onClick={() => router.push(`/chat?craftsman_id=${craftsman.user_id}`)}
                          className="w-full px-3.5 py-2 rounded-xl text-xs font-semibold"
                          style={{
                            border: `1.5px solid ${PRIMARY}`,
                            color: PRIMARY,
                            background: PRIMARY_PALE
                          }}>
                            مراسلة
                          </button>
                      </div>
                    </div>
                  </div>
                </div>
            )}
            </div>
          }
        </div>

        {/* ── MAP SECTION ── */}
        <div>
          <MapBlock craftsmen={mapCraftsmen} />
        </div>

      </div>

      <BottomTabBar activeTab="home" />

      {bookingCraftsman &&
      <RequestServiceModal
        craftsmanProfileId={bookingCraftsman.id}
        craftsmanUserId={bookingCraftsman.user_id}
        craftsmanName={bookingCraftsman.user_profiles?.full_name || 'صنايعي'}
        services={[]}
        onClose={() => setBookingCraftsman(null)}
        onSuccess={(orderId) => {
          setBookingCraftsman(null);
          setBookingSuccess(orderId);
        }} />

      }
    </div>);

}