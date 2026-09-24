'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';

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
  { id: 'ach-001', emoji: '🏆', label: 'أفضل صنايعي' },
  { id: 'ach-002', emoji: '⭐', label: '100+ تقييم ممتاز' },
  { id: 'ach-003', emoji: '⚡', label: 'استجابة سريعة' },
  { id: 'ach-004', emoji: '🛡️', label: 'موثوق رسمياً' },
];

export default function CraftsmanProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const craftsmanId = searchParams?.get('id');
  const supabase = createClient();

  const [craftsman, setCraftsman] = useState<CraftsmanData | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (craftsmanId) {
      loadCraftsmanData(craftsmanId);
    } else {
      loadDefaultCraftsman();
    }
  }, [craftsmanId]);

  const loadDefaultCraftsman = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('craftsman_profiles')
        .select('*, user_profiles(full_name)')
        .order('rating', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        await loadCraftsmanData(data.id);
        return;
      }
    } catch (e) {
      // ignore
    }
    setIsLoading(false);
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
      <div className="screen-container flex items-center justify-center" style={{ background: '#0F1A14' }} dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#8A9E8E' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!craftsman) {
    return (
      <div className="screen-container flex items-center justify-center" style={{ background: '#0F1A14' }} dir="rtl">
        <div className="text-center px-6">
          <div className="text-4xl mb-3">😕</div>
          <p className="text-sm" style={{ color: '#8A9E8E' }}>لم يتم العثور على الصنايعي</p>
          <button onClick={() => router.back()} className="mt-4 text-sm font-semibold" style={{ color: '#C9A84C' }}>
            العودة
          </button>
        </div>
      </div>
    );
  }

  const name = craftsman.user_profiles?.full_name || 'صنايعي';

  return (
    <div className="screen-container" style={{ background: '#0F1A14' }} dir="rtl">
      {/* Cover Image */}
      <div className="relative h-44 overflow-hidden">
        {craftsman.cover_image_url ? (
          <AppImage
            src={craftsman.cover_image_url}
            alt="صورة غلاف الصنايعي"
            width={430}
            height={176}
            className="w-full h-full object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #124A3E 0%, #1B6B5A 100%)' }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Back + actions */}
        <div className="absolute top-4 right-4 left-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
              <Icon name="EllipsisHorizontalIcon" size={18} className="text-white" />
            </button>
            <button className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
              <Icon name="ShareIcon" size={16} className="text-white" />
            </button>
          </div>
          <button
            onClick={() => router?.back()}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
          >
            <Icon name="ChevronRightIcon" size={18} className="text-white" />
          </button>
        </div>

        {/* Avatar */}
        <div className="absolute -bottom-8 right-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md" style={{ border: '3px solid #C9A84C', background: '#1A2E24' }}>
              {craftsman.avatar_url ? (
                <AppImage
                  src={craftsman.avatar_url}
                  alt={`صورة شخصية لـ${name}`}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon name="UserCircleIcon" size={40} style={{ color: '#1B6B5A' }} />
                </div>
              )}
            </div>
            {craftsman.is_online && (
              <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-green-500 rounded-full border-2" style={{ borderColor: '#0F1A14' }} />
            )}
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="px-4 pt-12 pb-4" style={{ background: '#162219' }}>
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
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
          <div className="flex items-center gap-1">
            <Icon name="StarIcon" size={15} variant="solid" style={{ color: '#C9A84C' }} />
            <span className="text-base font-bold font-tabular" style={{ color: '#F0EAD6' }}>{craftsman.rating}</span>
          </div>
        </div>

        <h1 className="text-xl font-bold mb-0.5" style={{ color: '#F0EAD6' }}>{name}</h1>
        <p className="text-sm mb-1" style={{ color: '#8A9E8E' }}>{craftsman.specialty}</p>
        {craftsman.location && (
          <div className="flex items-center gap-1 mb-4">
            <Icon name="MapPinIcon" size={13} style={{ color: '#5A7A60' }} />
            <span className="text-xs" style={{ color: '#5A7A60' }}>{craftsman.location}</span>
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
            <div key={stat.label} className="flex flex-col items-center py-2.5 rounded-xl" style={{ background: '#1A2E24' }}>
              <span className="text-sm font-bold font-tabular" style={{ color: '#C9A84C' }}>{stat.value}</span>
              <span className="text-xs text-center leading-tight mt-0.5" style={{ color: '#8A9E8E' }}>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#1A2E24', color: '#F0EAD6' }}>
            <Icon name="PhoneIcon" size={15} style={{ color: '#1B6B5A' }} />
            اتصال
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#1A2E24', color: '#F0EAD6' }}>
            <Icon name="ChatBubbleLeftEllipsisIcon" size={15} style={{ color: '#1B6B5A' }} />
            رسالة
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#1A2E24', color: '#F0EAD6' }}>
            <Icon name="HeartIcon" size={15} className="text-red-400" />
            حفظ
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        {/* Bio */}
        {craftsman.bio && (
          <div className="rounded-2xl p-4" style={{ background: '#162219', border: '1.5px solid #243B2C' }}>
            <h3 className="text-sm font-bold mb-2" style={{ color: '#F0EAD6' }}>عني</h3>
            <p className="text-sm leading-relaxed" style={{ color: '#8A9E8E' }}>{craftsman.bio}</p>
          </div>
        )}

        {/* Services */}
        {services.length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: '#162219', border: '1.5px solid #243B2C' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: '#F0EAD6' }}>خدماتي</h3>
            <div className="space-y-3">
              {services.map((svc) => (
                <div key={svc.id} className="flex items-center justify-between">
                  <Link href={`/payment-screen?service_id=${svc.id}&craftsman_id=${craftsman.id}`}>
                    <button className="px-4 py-1.5 rounded-xl text-sm font-bold" style={{ background: 'linear-gradient(135deg, #1B6B5A, #23896F)', color: '#FFFFFF' }}>
                      طلب
                    </button>
                  </Link>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-sm font-semibold text-right" style={{ color: '#F0EAD6' }}>{svc.name}</p>
                      <p className="text-xs text-right" style={{ color: '#8A9E8E' }}>
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
          <div className="rounded-2xl p-4" style={{ background: '#162219', border: '1.5px solid #243B2C' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: '#F0EAD6' }}>أعمالي</h3>
            <div className="grid grid-cols-3 gap-2">
              {portfolio.map((item) => (
                <div key={item.id} className="relative rounded-xl overflow-hidden aspect-square">
                  <AppImage
                    src={item.image_url}
                    alt={item.label || 'صورة من أعمال الصنايعي'}
                    width={120}
                    height={120}
                    className="w-full h-full object-cover"
                  />
                  {item.label && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1.5 py-1">
                      <p className="text-white text-xs font-medium truncate">{item.label}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        <div className="rounded-2xl p-4" style={{ background: '#162219', border: '1.5px solid #243B2C' }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#F0EAD6' }}>إنجازاتي</h3>
          <div className="grid grid-cols-4 gap-2">
            {ACHIEVEMENTS.map((ach) => (
              <div key={ach.id} className="flex flex-col items-center gap-1 py-2.5 rounded-xl" style={{ background: '#1A2E24' }}>
                <span className="text-xl">{ach.emoji}</span>
                <span className="text-xs text-center leading-tight" style={{ color: '#8A9E8E' }}>{ach.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <div className="flex items-start gap-2">
              <div className="flex gap-1 mt-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Icon key={i} name="StarIcon" size={12} variant="solid" style={{ color: '#C9A84C' }} />
                ))}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold" style={{ color: '#F0EAD6' }}>أفضل الأستاذ الذين استأجرت معهم العمل، وصل من بعد العمل بالاحترافية.</p>
                <p className="text-xs mt-1" style={{ color: '#5A7A60' }}>{craftsman.rating} من {craftsman.total_reviews} تقييم</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomTabBar activeTab="profile" />
    </div>
  );
}
