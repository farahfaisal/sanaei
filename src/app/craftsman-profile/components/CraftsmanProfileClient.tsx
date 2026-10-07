'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateConversation } from '@/lib/chat';
import { LOGIN_PATH } from '@/lib/auth/roles';

interface CraftsmanData {
  id: string;
  user_id: string;
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
  cover_image_url: string | null;
  user_profiles: { full_name: string } | null;
}

interface ServiceItem {
  id: string;
  name: string;
  emoji: string;
  price_label: string | null;
  base_price: number | null;
}

interface PortfolioItem {
  id: string;
  image_url: string;
  label: string | null;
}

const ACHIEVEMENTS = [
  { id: 'ach-001', emoji: '🏆', label: 'أفضل حرفي' },
  { id: 'ach-002', emoji: '⭐', label: '100+ تقييم ممتاز' },
  { id: 'ach-003', emoji: '⚡', label: 'استجابة سريعة' },
  { id: 'ach-004', emoji: '🛡️', label: 'موثوق رسمياً' },
];

export default function CraftsmanProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const craftsmanId = searchParams?.get('id');
  const supabase = createClient();
  const { user, role, loading: authLoading } = useAuth();

  const [craftsman, setCraftsman] = useState<CraftsmanData | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [chatError, setChatError] = useState('');

  useEffect(() => {
    if (craftsmanId) {
      loadCraftsmanData(craftsmanId);
    } else if (!authLoading) {
      // No id: a signed-in craftsman sees their own profile, anyone else the top-rated one.
      loadDefaultCraftsman(role === 'craftsman' ? user?.id ?? null : null);
    }
  }, [craftsmanId, authLoading, role, user?.id]);

  const loadDefaultCraftsman = async (ownerUserId: string | null) => {
    setIsLoading(true);
    try {
      const query = supabase.from('craftsman_profiles').select('id');
      const { data } = ownerUserId
        ? await query.eq('user_id', ownerUserId).maybeSingle()
        : await query.order('rating', { ascending: false }).limit(1).maybeSingle();

      if (data) {
        await loadCraftsmanData(data.id);
        return;
      }
    } catch (e) {
      // ignore
    }
    setIsLoading(false);
  };

  const handleMessage = async () => {
    if (!craftsman) return;
    setChatError('');
    if (!user) {
      const next = `/craftsman-profile?id=${craftsman.id}`;
      router.push(`${LOGIN_PATH}?role=customer&next=${encodeURIComponent(next)}`);
      return;
    }
    if (role !== 'customer') {
      setChatError('المراسلة متاحة لحسابات الزبائن فقط');
      return;
    }
    setIsOpeningChat(true);
    try {
      // Conversations reference the craftsman's user id, not the craftsman profile id.
      const conversationId = await getOrCreateConversation(supabase, user.id, craftsman.user_id);
      router.push(`/messages/${conversationId}`);
    } catch (err) {
      console.error('Failed to open conversation:', err);
      setChatError('تعذّر فتح المحادثة، يرجى المحاولة مجدداً');
      setIsOpeningChat(false);
    }
  };

  const loadCraftsmanData = async (id: string) => {
    setIsLoading(true);
    try {
      const [profileRes, servicesRes, portfolioRes] = await Promise.all([
        supabase
          .from('craftsman_profiles')
          .select('*, user_profiles(full_name)')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('craftsman_services')
          .select('id, name, emoji, price_label, base_price')
          .eq('craftsman_id', id)
          .eq('is_active', true),
        supabase
          .from('portfolio_items')
          .select('id, image_url, label')
          .eq('craftsman_id', id)
          .order('created_at', { ascending: false })
          .limit(6),
      ]);

      if (profileRes.data) setCraftsman(profileRes.data as any);
      if (servicesRes.data) setServices(servicesRes.data);
      if (portfolioRes.data) setPortfolio(portfolioRes.data);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="screen-container bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!craftsman) {
    return (
      <div className="screen-container bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center px-6">
          <div className="text-4xl mb-3">😕</div>
          <p className="text-gray-500 text-sm">لم يتم العثور على الحرفي</p>
          <button onClick={() => router.back()} className="mt-4 text-primary text-sm font-semibold">
            العودة
          </button>
        </div>
      </div>
    );
  }

  const name = craftsman.user_profiles?.full_name || 'حرفي';

  return (
    <div className="screen-container bg-gray-50" dir="rtl">
      {/* Cover Image */}
      <div className="relative h-44 overflow-hidden">
        {craftsman.cover_image_url ? (
          <AppImage
            src={craftsman.cover_image_url}
            alt="صورة غلاف الحرفي"
            width={430}
            height={176}
            className="w-full h-full object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)' }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Back + actions */}
        <div className="absolute top-4 right-4 left-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
              <Icon name="EllipsisHorizontalIcon" size={18} className="text-white" />
            </button>
            <button className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
              <Icon name="ShareIcon" size={16} className="text-white" />
            </button>
          </div>
          <button
            onClick={() => router?.back()}
            className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
          >
            <Icon name="ChevronRightIcon" size={18} className="text-white" />
          </button>
        </div>

        {/* Avatar */}
        <div className="absolute -bottom-8 right-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-gray-100">
              {craftsman.avatar_url ? (
                <AppImage
                  src={craftsman.avatar_url}
                  alt={`صورة شخصية لـ${name}`}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-green-50">
                  <Icon name="UserCircleIcon" size={40} className="text-primary" />
                </div>
              )}
            </div>
            {craftsman.is_online && (
              <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white" />
            )}
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="bg-white px-4 pt-12 pb-4">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
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
          <div className="flex items-center gap-1">
            <Icon name="StarIcon" size={15} variant="solid" className="text-yellow-500" />
            <span className="text-base font-bold text-gray-900 font-tabular">{craftsman.rating}</span>
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-0.5">{name}</h1>
        <p className="text-sm text-gray-500 mb-1">{craftsman.specialty}</p>
        {craftsman.location && (
          <div className="flex items-center gap-1 mb-4">
            <Icon name="MapPinIcon" size={13} className="text-gray-400" />
            <span className="text-xs text-gray-400">{craftsman.location}</span>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { value: `${craftsman.completed_jobs}+`, label: 'مهمة منجزة' },
            { value: `${craftsman.experience_years}`, label: 'سنوات خبرة' },
            { value: `${craftsman.total_clients}+`, label: 'عميل' },
            { value: `${craftsman.rating}`, label: 'تقييم' },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center py-2.5 bg-green-50 rounded-xl">
              <span className="text-sm font-bold text-gray-900 font-tabular">{stat.value}</span>
              <span className="text-xs text-gray-500 text-center leading-tight mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700">
            <Icon name="PhoneIcon" size={15} className="text-primary" />
            اتصال
          </button>
          {craftsman.user_id !== user?.id && (
            <button
              type="button"
              onClick={handleMessage}
              disabled={isOpeningChat}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700 disabled:opacity-60"
            >
              <Icon name="ChatBubbleLeftEllipsisIcon" size={15} className="text-primary" />
              {isOpeningChat ? 'جاري الفتح…' : 'رسالة'}
            </button>
          )}
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700">
            <Icon name="HeartIcon" size={15} className="text-red-500" />
            حفظ
          </button>
        </div>
        {chatError && <p className="text-xs text-red-500 mt-2 text-center">{chatError}</p>}
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        {/* Bio */}
        {craftsman.bio && (
          <div className="bg-white rounded-2xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">عني</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{craftsman.bio}</p>
          </div>
        )}

        {/* Services */}
        {services.length > 0 && (
          <div className="bg-white rounded-2xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">خدماتي</h3>
            <div className="space-y-3">
              {services.map((svc) => (
                <div key={svc.id} className="flex items-center justify-between">
                  <Link href={`/payment-screen?service_id=${svc.id}&craftsman_id=${craftsman.id}`}>
                    <button className="px-4 py-1.5 rounded-xl text-sm font-bold text-white" style={{ background: '#1B5E20' }}>
                      طلب
                    </button>
                  </Link>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 text-right">{svc.name}</p>
                      <p className="text-xs text-gray-500 text-right">
                        {svc.price_label || (svc.base_price ? `ابتداء من ${svc.base_price} ريال` : '')}
                      </p>
                    </div>
                    <span className="text-xl">{svc.emoji}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio */}
        {portfolio.length > 0 && (
          <div className="bg-white rounded-2xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">أعمالي</h3>
            <div className="grid grid-cols-3 gap-2">
              {portfolio.map((item) => (
                <div key={item.id} className="relative rounded-xl overflow-hidden aspect-square">
                  <AppImage
                    src={item.image_url}
                    alt={item.label || 'صورة من أعمال الحرفي'}
                    width={120}
                    height={120}
                    className="w-full h-full object-cover"
                  />
                  {item.label && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/40 px-1.5 py-1">
                      <p className="text-white text-xs font-medium truncate">{item.label}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        <div className="bg-white rounded-2xl p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">إنجازاتي</h3>
          <div className="grid grid-cols-4 gap-2">
            {ACHIEVEMENTS.map((ach) => (
              <div key={ach.id} className="flex flex-col items-center gap-1 py-2.5 bg-gray-50 rounded-xl">
                <span className="text-xl">{ach.emoji}</span>
                <span className="text-xs text-gray-600 text-center leading-tight">{ach.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-100">
            <div className="flex items-start gap-2">
              <div className="flex gap-1 mt-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Icon key={i} name="StarIcon" size={12} variant="solid" className="text-yellow-500" />
                ))}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-800">أفضل الأستاذ الذين استأجرت معهم العمل، وصل من بعد العمل بالاحترافية.</p>
                <p className="text-xs text-gray-400 mt-1">{craftsman.rating} من {craftsman.total_reviews} تقييم</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomTabBar activeTab="profile" />
    </div>
  );
}
