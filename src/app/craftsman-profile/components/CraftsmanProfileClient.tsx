'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  latitude?: number | null;
  longitude?: number | null;
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

interface ActiveOrder {
  id: string;
  status: string;
  description: string | null;
  address: string | null;
  amount: number | null;
  created_at: string;
  customer: {
    id: string;
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
    location: string | null;
  } | null;
}

interface NearbyCraftsman {
  id: string;
  specialty: string | null;
  is_online: boolean;
  rating: number;
  latitude?: number | null;
  longitude?: number | null;
  user_profiles: { full_name: string } | null;
}

const ACHIEVEMENTS = [
  { id: 'ach-001', emoji: '🏆', label: 'أفضل صنايعي' },
  { id: 'ach-002', emoji: '⭐', label: '100+ تقييم ممتاز' },
  { id: 'ach-003', emoji: '⚡', label: 'استجابة سريعة' },
  { id: 'ach-004', emoji: '🛡️', label: 'موثوق رسمياً' },
];

// Nearby craftsmen map component (client-only)
function NearbyCraftsmenMap({ craftsmen, centerLat, centerLng }: {
  craftsmen: NearbyCraftsman[];
  centerLat: number;
  centerLng: number;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;
    if (mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      // Fix default icon
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!).setView([centerLat, centerLng], 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Center marker (current craftsman)
      const selfIcon = L.divIcon({
        html: `<div style="background:#1B5E20;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([centerLat, centerLng], { icon: selfIcon })
        .addTo(map)
        .bindPopup('<b>موقعك الحالي</b>');

      // Nearby craftsmen markers
      craftsmen.forEach((c) => {
        const lat = c.latitude ?? centerLat + (Math.random() - 0.5) * 0.05;
        const lng = c.longitude ?? centerLng + (Math.random() - 0.5) * 0.05;
        const color = c.is_online ? '#22c55e' : '#6b7280';
        const icon = L.divIcon({
          html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
          className: '',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        const name = c.user_profiles?.full_name || 'صنايعي';
        const status = c.is_online ? 'متصل' : 'غير متصل';
        L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${name}</b><br/>${c.specialty || ''}<br/><span style="color:${color}">${status}</span>`);
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [craftsmen, centerLat, centerLng]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div ref={mapRef} style={{ height: '220px', width: '100%', borderRadius: '12px', zIndex: 0 }} />
    </>
  );
}

export default function CraftsmanProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const craftsmanId = searchParams?.get('id');
  const supabase = createClient();
  const { user } = useAuth();

  const [craftsman, setCraftsman] = useState<CraftsmanData | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [nearbyCraftsmen, setNearbyCraftsmen] = useState<NearbyCraftsman[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);

  useEffect(() => {
    if (craftsmanId) {
      loadCraftsmanData(craftsmanId);
    } else {
      loadDefaultCraftsman();
    }
  }, [craftsmanId, user]);

  const loadDefaultCraftsman = async () => {
    setIsLoading(true);
    try {
      // If user is a craftsman, load their own profile
      if (user) {
        const { data: ownProfile } = await supabase
          .from('craftsman_profiles')
          .select('*, user_profiles(full_name)')
          .eq('user_id', user.id)
          .maybeSingle();
        if (ownProfile) {
          await loadCraftsmanData(ownProfile.id);
          return;
        }
      }
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

      if (profileRes.data) {
        const p = profileRes.data as any;
        setCraftsman(p);
        setIsOnline(p.is_online);

        // Check if this is the logged-in craftsman's own profile
        const own = user && p.user_id === user.id;
        setIsOwnProfile(!!own);

        if (own) {
          loadActiveOrders(id);
        }
        loadNearbyCraftsmen(id);
      }
      if (servicesRes.data) setServices(servicesRes.data);
      if (portfolioRes.data) setPortfolio(portfolioRes.data);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const loadActiveOrders = async (craftsmanProfileId: string) => {
    try {
      const { data } = await supabase
        .from('orders')
        .select(`
          id, status, description, address, amount, created_at,
          customer:customer_id(id, full_name, phone, avatar_url, location)
        `)
        .eq('craftsman_id', craftsmanProfileId)
        .in('status', ['accepted', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setActiveOrders(data.map((o: any) => ({
          ...o,
          customer: Array.isArray(o.customer) ? o.customer[0] : o.customer,
        })));
      }
    } catch (e) {
      // ignore
    }
  };

  const loadNearbyCraftsmen = async (excludeId: string) => {
    try {
      const { data } = await supabase
        .from('craftsman_profiles')
        .select('id, specialty, is_online, rating, latitude, longitude, user_profiles(full_name)')
        .neq('id', excludeId)
        .limit(10);
      if (data) setNearbyCraftsmen(data as any);
    } catch (e) {
      // ignore
    }
  };

  const toggleOnlineStatus = async () => {
    if (!craftsman || togglingOnline) return;
    setTogglingOnline(true);
    const newStatus = !isOnline;
    try {
      await supabase
        .from('craftsman_profiles')
        .update({ is_online: newStatus, updated_at: new Date().toISOString() })
        .eq('id', craftsman.id);
      setIsOnline(newStatus);
    } catch (e) {
      // ignore
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleShowMap = () => {
    setShowMap(true);
    setTimeout(() => setMapMounted(true), 100);
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
          <p className="text-gray-500 text-sm">لم يتم العثور على الصنايعي</p>
          <button onClick={() => router.back()} className="mt-4 text-primary text-sm font-semibold">
            العودة
          </button>
        </div>
      </div>
    );
  }

  const name = craftsman.user_profiles?.full_name || 'صنايعي';
  const centerLat = craftsman.latitude ?? 24.7136;
  const centerLng = craftsman.longitude ?? 46.6753;

  return (
    <div className="screen-container bg-gray-50" dir="rtl">
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
            {isOnline && (
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
            {isOnline && (
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

        {/* ── Online/Offline Toggle (own profile only) ── */}
        {isOwnProfile && (
          <div className="mb-4 p-3 rounded-2xl border-2 flex items-center justify-between"
            style={{ borderColor: isOnline ? '#22c55e' : '#d1d5db', background: isOnline ? '#f0fdf4' : '#f9fafb' }}>
            <div>
              <p className="text-sm font-bold" style={{ color: isOnline ? '#15803d' : '#374151' }}>
                {isOnline ? '🟢 أنت متصل الآن' : '⚫ أنت غير متصل'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: isOnline ? '#16a34a' : '#6b7280' }}>
                {isOnline ? 'العملاء يمكنهم رؤيتك وطلب خدماتك' : 'لن تظهر للعملاء في البحث'}
              </p>
            </div>
            <button
              onClick={toggleOnlineStatus}
              disabled={togglingOnline}
              className="relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none"
              style={{ background: isOnline ? '#22c55e' : '#d1d5db' }}
              aria-label="تبديل حالة الاتصال"
            >
              {togglingOnline ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <span
                  className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300"
                  style={{ right: isOnline ? '2px' : 'auto', left: isOnline ? 'auto' : '2px' }}
                />
              )}
            </button>
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
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700">
            <Icon name="ChatBubbleLeftEllipsisIcon" size={15} className="text-primary" />
            رسالة
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700">
            <Icon name="HeartIcon" size={15} className="text-red-500" />
            حفظ
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">

        {/* ── Active Orders (own profile only) ── */}
        {isOwnProfile && activeOrders.length > 0 && (
          <div className="bg-white rounded-2xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              الطلبات النشطة ({activeOrders.length})
            </h3>
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-green-100 bg-green-50 p-3">
                  {/* Status badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      order.status === 'in_progress' ?'bg-blue-100 text-blue-700' :'bg-yellow-100 text-yellow-700'
                    }`}>
                      {order.status === 'in_progress' ? '🔧 جاري التنفيذ' : '✅ مقبول'}
                    </span>
                    {order.amount && (
                      <span className="text-xs font-bold text-primary">{order.amount} ريال</span>
                    )}
                  </div>

                  {/* Customer info */}
                  {order.customer && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                        {order.customer.avatar_url ? (
                          <AppImage
                            src={order.customer.avatar_url}
                            alt={`صورة ${order.customer.full_name}`}
                            width={36}
                            height={36}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Icon name="UserCircleIcon" size={22} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{order.customer.full_name}</p>
                        {order.customer.phone && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Icon name="PhoneIcon" size={11} className="text-gray-400" />
                            {order.customer.phone}
                          </p>
                        )}
                      </div>
                      {order.customer.phone && (
                        <a
                          href={`tel:${order.customer.phone}`}
                          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
                        >
                          <Icon name="PhoneIcon" size={14} className="text-white" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Customer location */}
                  {(order.address || order.customer?.location) && (
                    <div className="flex items-start gap-1.5 bg-white rounded-lg p-2">
                      <Icon name="MapPinIcon" size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-gray-700">موقع العميل</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {order.address || order.customer?.location || 'غير محدد'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {order.description && (
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">{order.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Nearby Craftsmen Map ── */}
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={showMap ? undefined : handleShowMap}
              className="text-primary text-xs font-semibold flex items-center gap-1"
            >
              {showMap ? (
                <span className="text-gray-400">مفتوح</span>
              ) : (
                <>
                  <Icon name="MapIcon" size={13} className="text-primary" />
                  عرض الخريطة
                </>
              )}
            </button>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Icon name="MapPinIcon" size={14} className="text-primary" />
              الصنايعية القريبون منك
            </h3>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-gray-500">متصل</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-xs text-gray-500">غير متصل</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-800" />
              <span className="text-xs text-gray-500">موقعك</span>
            </div>
          </div>

          {showMap && mapMounted ? (
            <NearbyCraftsmenMap
              craftsmen={nearbyCraftsmen}
              centerLat={centerLat}
              centerLng={centerLng}
            />
          ) : showMap ? (
            <div className="h-[220px] bg-gray-100 rounded-xl flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <button
              onClick={handleShowMap}
              className="w-full h-[120px] bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary hover:text-primary transition-colors"
            >
              <Icon name="MapIcon" size={28} className="text-gray-300" />
              <span className="text-xs font-medium">اضغط لعرض خريطة الصنايعية القريبين</span>
            </button>
          )}

          {/* Craftsmen list below map */}
          {nearbyCraftsmen.length > 0 && (
            <div className="mt-3 space-y-2">
              {nearbyCraftsmen.slice(0, 4).map((c) => (
                <Link key={c.id} href={`/craftsman-profile?id=${c.id}`}>
                  <div className="flex items-center gap-2 py-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-sm text-gray-800 font-medium flex-1 truncate">
                      {c.user_profiles?.full_name || 'صنايعي'}
                    </span>
                    <span className="text-xs text-gray-400">{c.specialty || ''}</span>
                    <div className="flex items-center gap-0.5">
                      <Icon name="StarIcon" size={11} variant="solid" className="text-yellow-500" />
                      <span className="text-xs text-gray-600">{c.rating}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

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
                    alt={item.label || 'صورة من أعمال الصنايعي'}
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
