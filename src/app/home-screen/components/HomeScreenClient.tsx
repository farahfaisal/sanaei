'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import dynamic from 'next/dynamic';
import RequestServiceModal from '@/app/craftsman-profile/components/RequestServiceModal';

const NearbyMapSection = dynamic(() => import('./NearbyMapSection'), { ssr: false });

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

function parseLocation(location: string | null): { lat: number; lng: number } | null {
  if (!location) return null;
  const parts = location.split(',');
  if (parts.length === 2) {
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  return null;
}

function generateFallbackPosition(seed: string): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const lat = 24.6 + (Math.abs(hash % 1000) / 1000) * 0.4;
  const lng = 46.5 + (Math.abs((hash >> 8) % 1000) / 1000) * 0.4;
  return { lat, lng };
}

const LOGO_GREEN = '#2a724d';
const LOGO_GREEN_DARK = '#1d5236';

export default function HomeScreenClient() {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [craftsmen, setCraftsmen] = useState<CraftsmanCard[]>([]);
  const [offers, setOffers] = useState<PromotionalOffer[]>([]);
  const [activeOfferIndex, setActiveOfferIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const offerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [bookingCraftsman, setBookingCraftsman] = useState<CraftsmanCard | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [catRes, craftRes, offersRes] = await Promise.all([
        supabase.from('service_categories').select('*').eq('is_active', true).order('name'),
        supabase
          .from('craftsman_profiles')
          .select('id, user_id, specialty, rating, completed_jobs, is_online, is_verified, avatar_url, location, user_profiles(full_name, location)')
          .order('rating', { ascending: false }),
        supabase
          .from('promotional_offers')
          .select('id, title, description, discount_percent, image_url, badge_text, button_text, bg_color_from, bg_color_to')
          .eq('is_active', true)
          .order('sort_order')
          .limit(5),
      ]);

      if (catRes.data) setCategories(catRes.data);

      if (craftRes.error) {
        const fallbackRes = await supabase
          .from('craftsman_profiles')
          .select('id, user_id, specialty, rating, completed_jobs, is_online, is_verified, location, user_profiles(full_name, location)')
          .order('rating', { ascending: false });
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
          description: 'احصل على خصم حصري على جميع خدمات التكييف',
          discount_percent: 20,
          image_url: "https://img.rocket.new/generatedImages/rocket_gen_img_18872744a-1779353675436.png",
          badge_text: '🌬️ عرض الصيف',
          button_text: 'اكتشف العرض',
          bg_color_from: LOGO_GREEN_DARK,
          bg_color_to: LOGO_GREEN,
        }]);
      }
    } catch (e) {
      console.error('loadData error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCraftsmen = craftsmen.filter(
    (c) =>
      !searchQuery ||
      c?.user_profiles?.full_name?.includes(searchQuery) ||
      c?.specialty?.includes(searchQuery)
  );

  const mapCraftsmen = craftsmen.map((c) => {
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
      status: c.is_online ? ('available' as const) : ('offline' as const),
    };
  });

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'مرحباً';
  const activeOffer = offers[activeOfferIndex] || offers[0];

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
        className="px-4 pt-12 pb-8"
      >
        {/* Decorative circles — layered for depth */}
        <div style={{ position: 'absolute', top: -50, left: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -20, left: 20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 10, right: 60, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        {/* Subtle diagonal shimmer line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="flex items-center justify-between mb-5" style={{ position: 'relative' }}>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
              👋 أهلاً وسهلاً
            </p>
            <h1 className="text-xl font-bold text-white tracking-tight">{displayName}</h1>
            <div
              className="flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.12)', display: 'inline-flex', backdropFilter: 'blur(4px)' }}
            >
              <Icon name="MapPinIcon" size={11} style={{ color: 'rgba(255,255,255,0.75)' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {profile?.location || 'الرياض، السعودية'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <img
                src="/assets/images/__________________24_-1790287739442.png"
                alt="شعار صنايعي"
                className="w-full h-full object-contain"
              />
            </div>
            <NotificationBell />
            <div
              className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                border: '2px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.15)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(6px)',
              }}
            >
              {profile?.avatar_url ? (
                <AppImage
                  src={profile.avatar_url}
                  alt="صورة المستخدم"
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Icon name="UserCircleIcon" size={22} className="text-white" />
              )}
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative" style={{ position: 'relative' }}>
          <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none">
            <Icon name="MagnifyingGlassIcon" size={17} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e?.target?.value)}
            placeholder="ما الخدمة التي تحتاجها؟"
            className="w-full rounded-2xl py-3.5 pr-10 pl-4 text-sm text-gray-800 placeholder:text-gray-400 outline-none"
            style={{
              background: 'rgba(255,255,255,0.98)',
              boxShadow: '0 6px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
            }}
            dir="rtl"
          />
        </div>

        {/* Bottom wave divider */}
        <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 20, background: 'linear-gradient(180deg, #f0f7f3 0%, #f0f7f3 100%)', borderRadius: '50% 50% 0 0 / 100% 100% 0 0', transform: 'scaleX(1.1)' }} />
      </div>

      <div className="px-4 py-5 space-y-6 pb-24" style={{ marginTop: 4 }}>

        {/* Service Categories */}
        <div
          className="rounded-3xl p-4"
          style={{
            background: 'white',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <button className="text-sm font-semibold" style={{ color: LOGO_GREEN }}>
              عرض الكل
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">الخدمات</h2>
              <div
                className="w-1 h-5 rounded-full"
                style={{ background: `linear-gradient(to bottom, ${LOGO_GREEN}, ${LOGO_GREEN_DARK})`, boxShadow: `0 2px 6px ${LOGO_GREEN}50` }}
              />
            </div>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-18 bg-gray-100 rounded-2xl animate-pulse" style={{ height: 72 }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl transition-all"
                  style={{
                    background:
                      activeCategory === cat.id
                        ? `linear-gradient(135deg, ${LOGO_GREEN_DARK}20, ${LOGO_GREEN}28)`
                        : '#FAFAFA',
                    border: `1.5px solid ${activeCategory === cat.id ? LOGO_GREEN + '60' : '#EBEBEB'}`,
                    boxShadow:
                      activeCategory === cat.id
                        ? `0 4px 16px ${LOGO_GREEN}30, 0 1px 4px rgba(0,0,0,0.06)`
                        : '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span
                    className="text-xs font-medium text-center leading-tight"
                    style={{ color: activeCategory === cat.id ? LOGO_GREEN : '#374151' }}
                  >
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Promotional Offers Banner */}
        {isLoading ? (
          <div className="h-32 bg-gray-100 rounded-3xl animate-pulse" />
        ) : activeOffer ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1.5 items-center">
                {offers.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveOfferIndex(i)}
                    className="rounded-full transition-all"
                    style={{
                      width: i === activeOfferIndex ? 22 : 6,
                      height: 6,
                      background: i === activeOfferIndex ? LOGO_GREEN : '#D1D5DB',
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">العروض والخصومات</h2>
                <div
                  className="w-1 h-5 rounded-full"
                  style={{ background: `linear-gradient(to bottom, ${LOGO_GREEN}, ${LOGO_GREEN_DARK})`, boxShadow: `0 2px 6px ${LOGO_GREEN}50` }}
                />
              </div>
            </div>
            <div
              key={activeOffer.id}
              className="rounded-3xl p-4 overflow-hidden relative"
              style={{
                background: `linear-gradient(135deg, ${activeOffer.bg_color_from} 0%, ${activeOffer.bg_color_to} 100%)`,
                boxShadow: `0 10px 36px ${activeOffer.bg_color_from}60, 0 3px 10px rgba(0,0,0,0.12)`,
              }}
            >
              {/* Layered decorative blobs */}
              <div style={{ position: 'absolute', top: -40, left: -40, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.09)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 10, left: 40, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -20, right: 80, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
              {/* Shimmer overlay */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.06) 50%, transparent 80%)', pointerEvents: 'none' }} />

              <div className="flex items-center justify-between" style={{ position: 'relative' }}>
                <div className="flex-1">
                  {activeOffer.badge_text && (
                    <div
                      className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 mb-2"
                      style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.25)' }}
                    >
                      <span className="text-white text-xs font-bold">{activeOffer.badge_text}</span>
                    </div>
                  )}
                  <p className="text-white font-bold text-sm leading-snug mb-1.5">{activeOffer.title}</p>
                  {activeOffer.description && (
                    <p className="text-xs mb-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>
                      {activeOffer.description}
                    </p>
                  )}
                  <button
                    className="mt-1 text-white text-xs font-bold px-4 py-2 rounded-xl"
                    style={{
                      background: 'rgba(255,255,255,0.22)',
                      border: '1px solid rgba(255,255,255,0.4)',
                      backdropFilter: 'blur(4px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  >
                    {activeOffer.button_text}
                  </button>
                </div>
                <div className="relative w-20 h-20 flex-shrink-0 mr-3">
                  {activeOffer.image_url && (
                    <div
                      className="w-full h-full rounded-2xl overflow-hidden"
                      style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }}
                    >
                      <AppImage
                        src={activeOffer.image_url}
                        alt={activeOffer.title}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {activeOffer.discount_percent && (
                    <div
                      className="absolute -top-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                        boxShadow: '0 4px 12px rgba(217,119,6,0.55)',
                        border: '2px solid rgba(255,255,255,0.4)',
                      }}
                    >
                      <span className="text-white text-xs font-black">{activeOffer.discount_percent}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Nearby Craftsmen Map */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <NearbyMapSection craftsmen={mapCraftsmen} />
        </div>

        {/* Craftsmen List */}
        <div>
          <div
            className="flex items-center justify-between mb-4 px-1"
          >
            <button className="text-sm font-semibold" style={{ color: LOGO_GREEN }}>
              عرض الكل
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">جميع الصنايعية</h2>
              <div
                className="w-1 h-5 rounded-full"
                style={{ background: `linear-gradient(to bottom, ${LOGO_GREEN}, ${LOGO_GREEN_DARK})`, boxShadow: `0 2px 6px ${LOGO_GREEN}50` }}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredCraftsmen.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              لا يوجد صنايعية مسجلون حالياً
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredCraftsmen.map((craftsman, index) => (
                <div
                  key={craftsman.id}
                  className="bg-white rounded-2xl p-4"
                  style={{
                    border: '1px solid rgba(0,0,0,0.05)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
                    background: index === 0
                      ? `linear-gradient(135deg, white 70%, ${LOGO_GREEN}08 100%)`
                      : 'white',
                  }}
                >
                  {/* Top craftsman badge */}
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
                            ? `0 4px 14px ${LOGO_GREEN}35, 0 1px 4px rgba(0,0,0,0.08)`
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
                            style={{
                              background: 'linear-gradient(135deg, #D97706, #F59E0B)',
                              boxShadow: '0 2px 6px rgba(217,119,6,0.35)',
                            }}
                          >
                            <Icon name="CheckBadgeIcon" size={10} className="text-white" />
                            موثوق
                          </span>
                        )}
                        {craftsman.is_online && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{
                              color: LOGO_GREEN,
                              background: `${LOGO_GREEN}15`,
                              border: `1px solid ${LOGO_GREEN}30`,
                            }}
                          >
                            <div
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: LOGO_GREEN, boxShadow: `0 0 4px ${LOGO_GREEN}` }}
                            />
                            متاح الآن
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-1.5">{craftsman.specialty}</p>
                      <div className="flex items-center gap-1">
                        <Icon name="BriefcaseIcon" size={12} className="text-gray-400" />
                        <span className="text-xs text-gray-500 font-tabular">
                          {craftsman.completed_jobs} مهمة مكتملة
                        </span>
                      </div>
                    </div>

                    {/* Rating + Buttons */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl"
                        style={{
                          background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                          boxShadow: '0 2px 6px rgba(245,158,11,0.2)',
                          border: '1px solid rgba(245,158,11,0.2)',
                        }}
                      >
                        <span className="text-sm font-bold text-gray-900 font-tabular">
                          {craftsman.rating}
                        </span>
                        <Icon name="StarIcon" size={13} variant="solid" className="text-yellow-500" />
                      </div>
                      <Link href={`/craftsman-profile?id=${craftsman.id}`}>
                        <button
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                          style={{
                            border: `1.5px solid ${LOGO_GREEN}`,
                            color: LOGO_GREEN,
                            background: `${LOGO_GREEN}08`,
                          }}
                        >
                          عرض الملف
                        </button>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setBookingCraftsman(craftsman);
                        }}
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
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomTabBar activeTab="home" />

      {bookingCraftsman && (
        <RequestServiceModal
          craftsmanProfileId={bookingCraftsman.id}
          craftsmanUserId={bookingCraftsman.user_id}
          craftsmanName={bookingCraftsman.user_profiles?.full_name || 'صنايعي'}
          services={[]}
          onClose={() => setBookingCraftsman(null)}
          onSuccess={(orderId) => {
            setBookingCraftsman(null);
            setBookingSuccess(orderId);
          }}
        />
      )}
    </div>
  );
}