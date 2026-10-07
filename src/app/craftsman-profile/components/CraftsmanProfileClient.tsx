'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import RequestServiceModal from './RequestServiceModal';
import { useTheme } from '@/contexts/ThemeContext';

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
  cover_image_url: string | null;
  latitude?: number | null;
  longitude?: number | null;
  user_profiles: { full_name: string; avatar_url: string | null } | null;
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
  price: number | null;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer: {
    full_name: string;
    avatar_url: string | null;
  } | null;
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
  { id: 'ach-001', emoji: '🏆', label: 'أفضل حرفي' },
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
        html: `<div style="background:#2a724d;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
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
        const color = c.is_online ? '#2a724d' : '#6b7280';
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
  const { user, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestServiceId, setRequestServiceId] = useState<string | undefined>(undefined);
  const [requestServiceName, setRequestServiceName] = useState<string | undefined>(undefined);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'reviews'>('portfolio');

  // ── Edit Profile State ──
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    bio: '',
    specialty: '',
    location: '',
    experience_years: 0,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  // ── Add Portfolio State ──
  const [showAddPortfolioModal, setShowAddPortfolioModal] = useState(false);
  const [portfolioForm, setPortfolioForm] = useState({ label: '', description: '', price: '' });
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);
  const [portfolioPreview, setPortfolioPreview] = useState<string | null>(null);
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const portfolioFileRef = useRef<HTMLInputElement>(null);

  // ── Avatar Upload State ──
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/phone-login-otp-verification');
      return;
    }
    if (craftsmanId) {
      loadCraftsmanData(craftsmanId);
    } else {
      loadDefaultCraftsman();
    }
  }, [craftsmanId, user, authLoading]);

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
      // Load profile first — independently so secondary query failures don't block it
      const profileRes = await supabase
        .from('craftsman_profiles')
        .select('*, user_profiles(full_name, avatar_url)')
        .eq('id', id)
        .maybeSingle();

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

      // Load secondary data independently — failures here won't affect profile display
      try {
        const servicesRes = await supabase
          .from('craftsman_services')
          .select('id, name, emoji, price_label, base_price')
          .eq('craftsman_id', id)
          .eq('is_active', true);
        if (servicesRes.data) setServices(servicesRes.data);
      } catch (e) { /* ignore */ }

      try {
        const portfolioRes = await supabase
          .from('portfolio_items')
          .select('id, image_url, label, price')
          .eq('craftsman_id', id)
          .order('created_at', { ascending: false })
          .limit(6);
        if (portfolioRes.data) setPortfolio(portfolioRes.data);
      } catch (e) { /* ignore */ }

      try {
        const reviewsRes = await supabase
          .from('reviews')
          .select('id, rating, comment, created_at, customer_id, customer_name:customer_id(full_name, avatar_url)')
          .eq('craftsman_id', id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (reviewsRes.data) {
          setReviews(reviewsRes.data.map((r: any) => {
            const customerData = Array.isArray(r.customer_name) ? r.customer_name[0] : r.customer_name;
            return {
              id: r.id,
              rating: r.rating,
              comment: r.comment,
              created_at: r.created_at,
              customer: customerData || null,
            };
          }));
        }
      } catch (e) { /* ignore */ }

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

  const openEditModal = () => {
    if (!craftsman) return;
    setEditForm({
      full_name: craftsman.user_profiles?.full_name || '',
      bio: craftsman.bio || '',
      specialty: craftsman.specialty || '',
      location: craftsman.location || '',
      experience_years: craftsman.experience_years || 0,
    });
    setEditError(null);
    setEditSuccess(false);
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!craftsman || !user) return;
    setEditSaving(true);
    setEditError(null);
    try {
      // Update user_profiles (full_name)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ full_name: editForm.full_name.trim(), updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (profileError) throw profileError;

      // Update craftsman_profiles
      const { error: craftsmanError } = await supabase
        .from('craftsman_profiles')
        .update({
          bio: editForm.bio.trim() || null,
          specialty: editForm.specialty.trim() || null,
          location: editForm.location.trim() || null,
          experience_years: Number(editForm.experience_years) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', craftsman.id);
      if (craftsmanError) throw craftsmanError;

      // Update local state
      setCraftsman((prev) =>
        prev
          ? {
              ...prev,
              bio: editForm.bio.trim() || null,
              specialty: editForm.specialty.trim() || null,
              location: editForm.location.trim() || null,
              experience_years: Number(editForm.experience_years) || 0,
              user_profiles: prev.user_profiles
                ? { ...prev.user_profiles, full_name: editForm.full_name.trim() }
                : { full_name: editForm.full_name.trim(), avatar_url: null },
            }
          : prev
      );
      setEditSuccess(true);
      setTimeout(() => setShowEditModal(false), 1000);
    } catch (e: any) {
      setEditError('حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى');
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddPortfolioItem = async () => {
    if (!craftsman || !portfolioFile) return;
    setPortfolioSaving(true);
    setPortfolioError(null);
    try {
      // Upload image to portfolio bucket
      // Path must start with user.id to satisfy RLS: auth.uid()::text = (storage.foldername(name))[1]
      const ext = portfolioFile.name.split('.').pop() || 'jpg';
      const filePath = `${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(filePath, portfolioFile, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('portfolio').getPublicUrl(filePath);
      const imageUrl = urlData.publicUrl;

      // Insert into portfolio_items
      const { data: newItem, error: insertError } = await supabase
        .from('portfolio_items')
        .insert({
          craftsman_id: craftsman.id,
          image_url: imageUrl,
          label: portfolioForm.label.trim() || null,
          description: portfolioForm.description.trim() || null,
          price: portfolioForm.price ? parseFloat(portfolioForm.price) : null,
        })
        .select('id, image_url, label, price')
        .single();
      if (insertError) throw insertError;

      // Update local state
      setPortfolio((prev) => [newItem, ...prev]);
      setShowAddPortfolioModal(false);
      setPortfolioForm({ label: '', description: '', price: '' });
      setPortfolioFile(null);
      setPortfolioPreview(null);
      setActiveTab('portfolio');
    } catch (e: any) {
      setPortfolioError('حدث خطأ أثناء الرفع، يرجى المحاولة مرة أخرى');
    } finally {
      setPortfolioSaving(false);
    }
  };

  const handlePortfolioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPortfolioFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPortfolioPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const openAddPortfolioModal = () => {
    setPortfolioForm({ label: '', description: '', price: '' });
    setPortfolioFile(null);
    setPortfolioPreview(null);
    setPortfolioError(null);
    setShowAddPortfolioModal(true);
  };

  const handleShowMap = () => {
    setShowMap(true);
    setTimeout(() => setMapMounted(true), 100);
  };

  const handleRequestService = (serviceId?: string, serviceName?: string) => {
    if (!craftsman) return;
    const params = new URLSearchParams({ craftsman_id: craftsman.id, craftsman_user_id: craftsman.user_id });
    if (serviceId) params.set('service_id', serviceId);
    router.push(`/order-details?${params.toString()}`);
  };

  const handleOrderSuccess = (orderId: string) => {
    setShowRequestModal(false);
    setOrderSuccess(orderId);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/phone-login-otp-verification');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !craftsman || !user) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (updateError) throw updateError;

      setCraftsman((prev) =>
        prev
          ? {
              ...prev,
              user_profiles: prev.user_profiles
                ? { ...prev.user_profiles, avatar_url: avatarUrl }
                : { full_name: '', avatar_url: avatarUrl },
            }
          : prev
      );
    } catch (e) {
      // ignore silently
    } finally {
      setAvatarUploading(false);
      if (avatarFileRef.current) avatarFileRef.current.value = '';
    }
  };

  if (authLoading || (!user && isLoading)) {
    return (
      <div className="screen-container bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">جاري التحميل...</p>
        </div>
      </div>
    );
  }

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
      <div className="relative h-44">
        {craftsman.cover_image_url ? (
          <AppImage
            src={craftsman.cover_image_url}
            alt="صورة غلاف الحرفي"
            width={430}
            height={176}
            className="w-full h-full object-cover overflow-hidden"
            priority
          />
        ) : (
          <div className="w-full h-full overflow-hidden" style={{ background: 'linear-gradient(135deg, #2a724d 0%, #1d5236 100%)' }} />
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
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(4px)', color: '#fff' }}
              aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
            >
              <Icon name={theme === 'dark' ? 'SunIcon' : 'MoonIcon'} size={14} className="text-white" />
              <span>{theme === 'dark' ? 'نهاري' : 'ليلي'}</span>
            </button>
            {/* Sign out button (own profile only) */}
            {isOwnProfile && (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(220,38,38,0.75)', backdropFilter: 'blur(4px)', color: '#fff' }}
                aria-label="تسجيل الخروج"
              >
                <Icon name="ArrowRightOnRectangleIcon" size={14} className="text-white" />
                <span>خروج</span>
              </button>
            )}
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
            {/* Hidden file input for avatar upload */}
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <div
              className={`w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-gray-100 ${isOwnProfile ? 'cursor-pointer' : ''}`}
              onClick={() => isOwnProfile && !avatarUploading && avatarFileRef.current?.click()}
            >
              {craftsman.user_profiles?.avatar_url ? (
                <AppImage
                  src={craftsman.user_profiles.avatar_url}
                  alt={`صورة شخصية لـ${name}`}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10">
                  <Icon name="UserCircleIcon" size={40} className="text-primary" />
                </div>
              )}
              {/* Upload overlay */}
              {isOwnProfile && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                  {avatarUploading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="CameraIcon" size={22} className="text-white" />
                  )}
                </div>
              )}
            </div>
            {/* Camera badge */}
            {isOwnProfile && (
              <button
                onClick={() => !avatarUploading && avatarFileRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow"
                style={{ background: '#2a724d' }}
                aria-label="تغيير الصورة الشخصية"
              >
                {avatarUploading ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="CameraIcon" size={12} className="text-white" />
                )}
              </button>
            )}
            {!isOwnProfile && isOnline && (
              <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-primary rounded-full border-2 border-white" />
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20">
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
            style={{ borderColor: isOnline ? '#2a724d' : '#d1d5db', background: isOnline ? '#f0faf9' : '#f9fafb' }}>
            <div>
              <p className="text-sm font-bold" style={{ color: isOnline ? '#2a724d' : '#374151' }}>
                {isOnline ? '🟢 أنت متصل الآن' : '⚫ أنت غير متصل'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: isOnline ? '#358f61' : '#6b7280' }}>
                {isOnline ? 'العملاء يمكنهم رؤيتك وطلب خدماتك' : 'لن تظهر للعملاء في البحث'}
              </p>
            </div>
            <button
              onClick={toggleOnlineStatus}
              disabled={togglingOnline}
              className="relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none"
              style={{ background: isOnline ? '#2a724d' : '#d1d5db' }}
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
            <div key={stat.label} className="flex flex-col items-center py-2.5 bg-primary/10 rounded-xl">
              <span className="text-sm font-bold text-gray-900 font-tabular">{stat.value}</span>
              <span className="text-xs text-gray-500 text-center leading-tight mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {!isOwnProfile && (
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700">
              <Icon name="PhoneIcon" size={15} className="text-primary" />
              اتصال
            </button>
          )}
          {!isOwnProfile && (
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700">
              <Icon name="ChatBubbleLeftEllipsisIcon" size={15} className="text-primary" />
              رسالة
            </button>
          )}
          {!isOwnProfile && (
            <button
              onClick={() => handleRequestService()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#2a724d' }}
            >
              <Icon name="WrenchScrewdriverIcon" size={15} className="text-white" />
              طلب خدمة
            </button>
          )}
          {isOwnProfile && (
            <button
              onClick={openEditModal}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#2a724d' }}
            >
              <Icon name="PencilSquareIcon" size={15} className="text-white" />
              تعديل الملف
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">

        {/* ── Active Orders (own profile only) ── */}
        {isOwnProfile && activeOrders.length > 0 && (
          <div className="bg-white rounded-2xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              الطلبات النشطة ({activeOrders.length})
            </h3>
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                  {/* Status badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      order.status === 'in_progress' ?'bg-blue-100 text-blue-700' :'bg-yellow-100 text-yellow-700'
                    }`}>
                      {order.status === 'in_progress' ? '🔧 جاري التنفيذ' : '✅ مقبول'}
                    </span>
                    {order.amount && (
                      <span className="text-xs font-bold text-primary">{order.amount} ₪</span>
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
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-xs text-gray-500">متصل</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-primary-dark" />
              <span className="text-xs text-gray-500">غير متصل</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-primary" />
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
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.is_online ? 'bg-primary' : 'bg-gray-400'}`} />
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
                  {isOwnProfile ? (
                    <Link href={`/payment-screen?service_id=${svc.id}&craftsman_id=${craftsman.id}`}>
                      <button className="px-4 py-1.5 rounded-xl text-sm font-bold text-white" style={{ background: '#2a724d' }}>
                        طلب
                      </button>
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleRequestService(svc.id, svc.name)}
                      className="px-4 py-1.5 rounded-xl text-sm font-bold text-white"
                      style={{ background: '#2a724d' }}
                    >
                      طلب
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 text-right">{svc.name}</p>
                      <p className="text-xs text-gray-500 text-right">
{svc.price_label || (svc.base_price ? `ابتداء من ${svc.base_price} ₪` : '')}
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
                </>
              )}

              {/* Reviews Tab */}
              {activeTab === 'reviews' && (
                <>
                  {reviews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <span className="text-3xl mb-2">⭐</span>
                      <p className="text-sm">لا توجد تقييمات بعد</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Rating Summary */}
                      <div className="flex items-center gap-4 p-3 bg-primary/10 rounded-xl border border-primary/20 mb-4">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-primary font-tabular">{craftsman?.rating ?? 0}</p>
                          <div className="flex gap-0.5 justify-center mt-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Icon
                                key={i}
                                name="StarIcon"
                                size={12}
                                variant="solid"
                                className={i <= Math.round(Number(craftsman?.rating ?? 0)) ? 'text-yellow-500' : 'text-gray-200'}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{craftsman?.total_reviews} تقييم</p>
                        </div>
                        <div className="flex-1 space-y-1">
                          {[5, 4, 3, 2, 1].map((star) => {
                            const count = reviews.filter((r) => r.rating === star).length;
                            const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                            return (
                              <div key={star} className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-3 font-tabular">{star}</span>
                                <Icon name="StarIcon" size={10} variant="solid" className="text-yellow-400 flex-shrink-0" />
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-yellow-400 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-4 font-tabular">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Individual Reviews */}
                      {reviews.map((review) => (
                        <div key={review.id} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                              {review.customer?.avatar_url ? (
                                <AppImage
                                  src={review.customer.avatar_url}
                                  alt={`صورة ${review.customer.full_name}`}
                                  width={36}
                                  height={36}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Icon name="UserCircleIcon" size={22} className="text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-bold text-gray-900 truncate">
                                  {review.customer?.full_name || 'عميل'}
                                </p>
                                <span className="text-xs text-gray-400 flex-shrink-0 mr-2">
                                  {new Date(review.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <div className="flex gap-0.5 mb-1.5">
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <Icon
                                    key={i}
                                    name="StarIcon"
                                    size={12}
                                    variant="solid"
                                    className={i <= review.rating ? 'text-yellow-500' : 'text-gray-200'}
                                  />
                                ))}
                              </div>
                              {review.comment && (
                                <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
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
        </div>
      </div>

      <BottomTabBar activeTab="profile" />

      {showRequestModal && craftsman && (
        <RequestServiceModal
          craftsmanProfileId={craftsman.id}
          craftsmanUserId={craftsman.user_id}
          craftsmanName={craftsman.user_profiles?.full_name || 'الصنايعي'}
          serviceId={requestServiceId}
          serviceName={requestServiceName}
          services={services}
          onClose={() => setShowRequestModal(false)}
          onSuccess={handleOrderSuccess}
        />
      )}

      {/* ── Edit Profile Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !editSaving && setShowEditModal(false)}
          />
          {/* Sheet */}
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <button
                onClick={() => !editSaving && setShowEditModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                disabled={editSaving}
              >
                <Icon name="XMarkIcon" size={18} className="text-gray-600" />
              </button>
              <h2 className="text-base font-bold text-gray-900">تعديل الملف الشخصي</h2>
              <div className="w-8" />
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">الاسم الكامل</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="أدخل اسمك الكامل"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-primary focus:bg-white transition-colors text-right"
                  disabled={editSaving}
                />
              </div>

              {/* Specialty */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">التخصص</label>
                <input
                  type="text"
                  value={editForm.specialty}
                  onChange={(e) => setEditForm((f) => ({ ...f, specialty: e.target.value }))}
                  placeholder="مثال: سباكة، كهرباء، نجارة..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-primary focus:bg-white transition-colors text-right"
                  disabled={editSaving}
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">الموقع</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="مثال: الرياض، حي النزهة"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-primary focus:bg-white transition-colors text-right"
                  disabled={editSaving}
                />
              </div>

              {/* Experience Years */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">سنوات الخبرة</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={editForm.experience_years}
                  onChange={(e) => setEditForm((f) => ({ ...f, experience_years: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-primary focus:bg-white transition-colors text-right"
                  disabled={editSaving}
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">نبذة عني</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="اكتب نبذة مختصرة عن نفسك وخبراتك..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-primary focus:bg-white transition-colors text-right resize-none"
                  disabled={editSaving}
                />
              </div>

              {/* Error */}
              {editError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                  <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{editError}</p>
                </div>
              )}

              {/* Success */}
              {editSuccess && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-xl border border-primary/20">
                  <Icon name="CheckCircleIcon" size={16} className="text-primary flex-shrink-0" />
                  <p className="text-sm text-primary">تم حفظ التغييرات بنجاح ✓</p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="px-5 pb-6 pt-3 border-t border-gray-100">
              <button
                onClick={handleSaveProfile}
                disabled={editSaving || !editForm.full_name.trim()}
                className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
                style={{ background: '#2a724d' }}
              >
                {editSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Icon name="CheckIcon" size={18} className="text-white" />
                    حفظ التغييرات
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Portfolio Modal ── */}
      {showAddPortfolioModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !portfolioSaving && setShowAddPortfolioModal(false)}
          />
          {/* Sheet */}
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <button
                onClick={() => !portfolioSaving && setShowAddPortfolioModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                disabled={portfolioSaving}
              >
                <Icon name="XMarkIcon" size={18} className="text-gray-600" />
              </button>
              <h2 className="text-base font-bold text-gray-900">إضافة عمل سابق</h2>
              <div className="w-8" />
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">صورة العمل *</label>
                <input
                  ref={portfolioFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePortfolioFileChange}
                  disabled={portfolioSaving}
                />
                {portfolioPreview ? (
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={portfolioPreview}
                      alt="معاينة الصورة"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => { setPortfolioFile(null); setPortfolioPreview(null); }}
                      className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
                      disabled={portfolioSaving}
                    >
                      <Icon name="XMarkIcon" size={14} className="text-white" />
                    </button>
                    <button
                      onClick={() => portfolioFileRef.current?.click()}
                      className="absolute bottom-2 left-2 px-3 py-1 rounded-lg bg-black/50 text-white text-xs font-semibold"
                      disabled={portfolioSaving}
                    >
                      تغيير
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => portfolioFileRef.current?.click()}
                    className="w-full h-36 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary hover:text-primary transition-colors"
                    disabled={portfolioSaving}
                  >
                    <Icon name="PhotoIcon" size={32} className="text-gray-300" />
                    <span className="text-sm font-medium">اضغط لاختيار صورة</span>
                    <span className="text-xs text-gray-400">JPG, PNG, WEBP</span>
                  </button>
                )}
              </div>

              {/* Label */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">عنوان العمل</label>
                <input
                  type="text"
                  value={portfolioForm.label}
                  onChange={(e) => setPortfolioForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="مثال: تركيب سباكة حمام"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-primary focus:bg-white transition-colors text-right"
                  disabled={portfolioSaving}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">وصف العمل</label>
                <textarea
                  value={portfolioForm.description}
                  onChange={(e) => setPortfolioForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="اكتب وصفاً مختصراً للعمل..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-primary focus:bg-white transition-colors text-right resize-none"
                  disabled={portfolioSaving}
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">سعر العمل (₪) — اختياري</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={portfolioForm.price}
                  onChange={(e) => setPortfolioForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="مثال: 250"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-primary focus:bg-white transition-colors text-right"
                  disabled={portfolioSaving}
                />
              </div>

              {/* Error */}
              {portfolioError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                  <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{portfolioError}</p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="px-5 pb-6 pt-3 border-t border-gray-100">
              <button
                onClick={handleAddPortfolioItem}
                disabled={portfolioSaving || !portfolioFile}
                className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
                style={{ background: '#2a724d' }}
              >
                {portfolioSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري الرفع...
                  </>
                ) : (
                  <>
                    <Icon name="PlusIcon" size={18} className="text-white" />
                    إضافة العمل
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
