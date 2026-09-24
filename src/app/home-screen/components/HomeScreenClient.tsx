'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  user_profiles: {
    full_name: string;
    location: string | null;
  } | null;
}

export default function HomeScreenClient() {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [craftsmen, setCraftsmen] = useState<CraftsmanCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          .select('id, user_id, specialty, rating, completed_jobs, is_online, is_verified, avatar_url, user_profiles(full_name, location)')
          .order('rating', { ascending: false })
          .limit(10),
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (craftRes.data) setCraftsmen(craftRes.data as any);
    } catch (e) {
      // ignore
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

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'مرحباً';

  return (
    <div className="screen-container" style={{ background: '#0F1A14' }} dir="rtl">
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #124A3E 0%, #1B6B5A 100%)' }} className="px-4 pt-12 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#C9A84C' }}>🌟 مرحباً بك</p>
            <h1 className="text-lg font-bold text-white">{displayName}</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <Icon name="MapPinIcon" size={12} style={{ color: '#A8D5C8' }} />
              <span className="text-xs" style={{ color: '#A8D5C8' }}>{profile?.location || 'الرياض، السعودية'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center">
              <img
                src="/assets/images/__________________24_-1790287739442.png"
                alt="شعار صنايعي"
                className="w-full h-full object-contain"
              />
            </div>
            <button className="relative w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Icon name="BellIcon" size={18} className="text-white" />
            </button>
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center" style={{ border: '2px solid rgba(201,168,76,0.4)', background: 'rgba(255,255,255,0.1)' }}>
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
        <div className="relative">
          <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none">
            <Icon name="MagnifyingGlassIcon" size={17} style={{ color: '#8A9E8E' }} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e?.target?.value)}
            placeholder="ما الخدمة التي تحتاجها؟"
            className="w-full rounded-xl py-3 pr-10 pl-4 text-sm outline-none"
            style={{ background: 'rgba(15,26,20,0.7)', color: '#F0EAD6', border: '1px solid rgba(201,168,76,0.2)' }}
            dir="rtl"
          />
        </div>
      </div>

      <div className="px-4 py-4 space-y-5 pb-24">
        {/* Service Categories */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button className="text-sm font-semibold" style={{ color: '#C9A84C' }}>عرض الكل</button>
            <h2 className="text-base font-bold" style={{ color: '#F0EAD6' }}>الخدمات</h2>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {[1,2,3,4,5,6,7,8].map((i) => (
                <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#1A2E24' }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all"
                  style={{
                    borderColor: activeCategory === cat.id ? '#C9A84C' : '#243B2C',
                    background: activeCategory === cat.id ? 'rgba(201,168,76,0.1)' : '#162219',
                  }}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-xs font-medium text-center leading-tight" style={{ color: activeCategory === cat.id ? '#C9A84C' : '#8A9E8E' }}>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Promo Banner */}
        <div
          className="rounded-2xl p-4 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #124A3E 0%, #1B6B5A 100%)', border: '1px solid rgba(201,168,76,0.2)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 mb-2" style={{ background: 'rgba(201,168,76,0.15)' }}>
                <span className="text-xs font-bold" style={{ color: '#C9A84C' }}>خصم 20% على خدمات التكييف</span>
              </div>
              <button className="mt-2 text-xs font-bold px-4 py-2 rounded-xl" style={{ background: '#C9A84C', color: '#0F1A14' }}>
                اكتشف العرض
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
              <div className="absolute -top-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-md" style={{ background: '#C9A84C' }}>
                <span className="text-xs font-black" style={{ color: '#0F1A14' }}>20%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nearby Craftsmen */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button className="text-sm font-semibold" style={{ color: '#C9A84C' }}>عرض الكل</button>
            <h2 className="text-base font-bold" style={{ color: '#F0EAD6' }}>أفضل الصنايعية بالقرب منك</h2>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1,2,3].map((i) => (
                <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: '#1A2E24' }} />
              ))}
            </div>
          ) : filteredCraftsmen.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: '#5A7A60' }}>
              لا يوجد صنايعية متاحون حالياً
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredCraftsmen.map((craftsman) => (
                <Link key={craftsman.id} href={`/craftsman-profile?id=${craftsman.id}`}>
                  <div className="rounded-2xl p-4" style={{ background: '#162219', border: '1.5px solid #243B2C' }}>
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 rounded-xl overflow-hidden" style={{ background: '#1A2E24' }}>
                          {craftsman.avatar_url ? (
                            <AppImage
                              src={craftsman.avatar_url}
                              alt={`صورة ${craftsman.user_profiles?.full_name || 'الصنايعي'}`}
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Icon name="UserCircleIcon" size={32} style={{ color: '#3A5A40' }} />
                            </div>
                          )}
                        </div>
                        {craftsman.is_online && (
                          <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2" style={{ borderColor: '#162219' }} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="text-sm font-bold" style={{ color: '#F0EAD6' }}>
                            {craftsman.user_profiles?.full_name || 'صنايعي'}
                          </h3>
                          {craftsman.is_verified && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'linear-gradient(135deg, #A8872E, #C9A84C)', color: '#0F1A14' }}>
                              <Icon name="CheckBadgeIcon" size={10} style={{ color: '#0F1A14' }} />
                              موثوق
                            </span>
                          )}
                          {craftsman.is_online && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(27,107,90,0.2)', color: '#23896F', border: '1px solid #1B6B5A' }}>
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#23896F' }} />
                              متاح الآن
                            </span>
                          )}
                        </div>
                        <p className="text-xs mb-1.5" style={{ color: '#8A9E8E' }}>{craftsman.specialty}</p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Icon name="BriefcaseIcon" size={12} style={{ color: '#5A7A60' }} />
                            <span className="text-xs font-tabular" style={{ color: '#5A7A60' }}>{craftsman.completed_jobs} مهمة مكتملة</span>
                          </div>
                        </div>
                      </div>

                      {/* Rating + Button */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold font-tabular" style={{ color: '#F0EAD6' }}>{craftsman.rating}</span>
                          <Icon name="StarIcon" size={13} variant="solid" style={{ color: '#C9A84C' }} />
                        </div>
                        <button className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: '1px solid #1B6B5A', color: '#23896F', background: 'rgba(27,107,90,0.1)' }}>
                          عرض الملف
                        </button>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomTabBar activeTab="home" />
    </div>
  );
}
