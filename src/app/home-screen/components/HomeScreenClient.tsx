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
    <div className="screen-container bg-gray-50" dir="rtl">
      {/* Header - dark green */}
      <div style={{ background: '#1B5E20' }} className="px-4 pt-12 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-green-300 mb-0.5">🌟 مرحباً بك</p>
            <h1 className="text-lg font-bold text-white">{displayName}</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <Icon name="MapPinIcon" size={12} className="text-green-300" />
              <span className="text-xs text-green-200">{profile?.location || 'الرياض، السعودية'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-9 h-9 bg-white/15 rounded-full flex items-center justify-center">
              <Icon name="BellIcon" size={18} className="text-white" />
            </button>
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/30 bg-white/20 flex items-center justify-center">
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
            <Icon name="MagnifyingGlassIcon" size={17} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e?.target?.value)}
            placeholder="ما الخدمة التي تحتاجها؟"
            className="w-full bg-white rounded-xl py-3 pr-10 pl-4 text-sm text-gray-800 placeholder:text-gray-400 outline-none"
            dir="rtl"
          />
        </div>
      </div>

      <div className="px-4 py-4 space-y-5 pb-24">
        {/* Service Categories */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button className="text-primary text-sm font-semibold">عرض الكل</button>
            <h2 className="text-base font-bold text-gray-900">الخدمات</h2>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {[1,2,3,4,5,6,7,8].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
                    activeCategory === cat.id
                      ? 'border-primary bg-green-50' :'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-xs font-medium text-gray-700 text-center leading-tight">
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
          style={{ background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="inline-flex items-center gap-1 bg-white/15 rounded-lg px-2.5 py-1 mb-2">
                <span className="text-white text-xs font-bold">خصم 20% على خدمات التكييف</span>
              </div>
              <button className="mt-2 bg-yellow-500 text-white text-xs font-bold px-4 py-2 rounded-xl">
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
          ) : (
            <div className="flex flex-col gap-3">
              {filteredCraftsmen.map((craftsman) => (
                <Link key={craftsman.id} href={`/craftsman-profile?id=${craftsman.id}`}>
                  <div className="bg-white rounded-2xl border border-gray-200 p-4">
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
                          )}
                        </div>
                        {craftsman.is_online && (
                          <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="text-sm font-bold text-gray-900">
                            {craftsman.user_profiles?.full_name || 'حرفي'}
                          </h3>
                          {craftsman.is_verified && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B)' }}>
                              <Icon name="CheckBadgeIcon" size={10} className="text-white" />
                              موثوق
                            </span>
                          )}
                          {craftsman.is_online && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-primary bg-green-50 border border-green-200">
                              <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                              متاح الآن
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-1.5">{craftsman.specialty}</p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Icon name="BriefcaseIcon" size={12} className="text-gray-400" />
                            <span className="text-xs text-gray-500 font-tabular">{craftsman.completed_jobs} مهمة مكتملة</span>
                          </div>
                        </div>
                      </div>

                      {/* Rating + Button */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-gray-900 font-tabular">{craftsman.rating}</span>
                          <Icon name="StarIcon" size={13} variant="solid" className="text-yellow-500" />
                        </div>
                        <button className="px-3 py-1.5 rounded-lg border border-primary text-primary text-xs font-semibold">
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
