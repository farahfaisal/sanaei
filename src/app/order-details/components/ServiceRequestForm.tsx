'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { getOrCreateConversation } from '@/lib/supabase/chat';
import { useAuth } from '@/contexts/AuthContext';
import { sendPushToUser } from '@/lib/pushNotifications';
import BookingSuccessScreen from './BookingSuccessScreen';

const BRAND = {
  primary:  '#2a724d',
  accent:   '#1d5236',
  light:    'rgba(42,114,77,0.10)',
  gradient: 'linear-gradient(145deg, #2a724d 0%, #1d5236 55%, #358f61 100%)',
};

interface ServiceOption {
  id: string;
  name: string;
  emoji: string;
  price_label: string | null;
  base_price: number | null;
}

interface CraftsmanInfo {
  id: string;
  userId: string;
  name: string;
  specialty: string | null;
  rating: number;
  avatarUrl: string | null;
}

interface ServiceRequestFormProps {
  craftsmanProfileId: string;
  craftsmanUserId?: string;
  serviceId?: string;
}

export default function ServiceRequestForm({
  craftsmanProfileId,
  craftsmanUserId: initialCraftsmanUserId,
  serviceId: initialServiceId,
}: ServiceRequestFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [craftsman, setCraftsman] = useState<CraftsmanInfo | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isLoadingCraftsman, setIsLoadingCraftsman] = useState(true);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(initialServiceId || '');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Booking success state
  const [bookingSuccess, setBookingSuccess] = useState<{
    orderId: string;
    paymentParams: string;
  } | null>(null);

  // Image upload
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadCraftsmanData();
  }, [craftsmanProfileId]);

  const loadCraftsmanData = async () => {
    setIsLoadingCraftsman(true);
    try {
      const { data } = await supabase
        .from('craftsman_profiles')
        .select(`
          id, specialty, rating, avatar_url, user_id,
          user_profiles(full_name)
        `)
        .eq('id', craftsmanProfileId)
        .maybeSingle();

      if (data) {
        const up = Array.isArray(data.user_profiles) ? data.user_profiles[0] : data.user_profiles;
        setCraftsman({
          id: data.id,
          userId: data.user_id,
          name: (up as any)?.full_name || 'الحرفي',
          specialty: data.specialty,
          rating: data.rating || 0,
          avatarUrl: data.avatar_url,
        });
      }

      // Load services for this craftsman
      const { data: svcData } = await supabase
        .from('craftsman_services')
        .select('service:service_id(id, name, emoji, base_price, price_label)')
        .eq('craftsman_id', craftsmanProfileId)
        .limit(10);

      if (svcData) {
        const svcs: ServiceOption[] = svcData
          .map((row: any) => {
            const s = Array.isArray(row.service) ? row.service[0] : row.service;
            return s ? { id: s.id, name: s.name, emoji: s.emoji, price_label: s.price_label, base_price: s.base_price } : null;
          })
          .filter(Boolean) as ServiceOption[];
        setServices(svcs);
        if (initialServiceId && !selectedServiceId) setSelectedServiceId(initialServiceId);
      }
    } catch {
      // silent
    } finally {
      setIsLoadingCraftsman(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newFiles = [...selectedImages, ...files].slice(0, 4);
    setSelectedImages(newFiles);
    const previews = newFiles.map((f) => URL.createObjectURL(f));
    setImagePreviews(previews);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (orderId: string): Promise<string[]> => {
    if (selectedImages.length === 0) return [];
    const urls: string[] = [];
    for (const file of selectedImages) {
      const ext = file.name.split('.').pop();
      const path = `service-requests/${orderId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('service-media')
        .upload(path, file, { upsert: true });
      if (!uploadError) {
        const { data } = supabase.storage.from('service-media').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const selectedService = services.find((s) => s.id === selectedServiceId) || null;
  const displayServiceName = selectedService?.name || '';
  const craftsmanUserId = craftsman?.userId || initialCraftsmanUserId || '';

  const handleSubmit = async () => {
    if (!user) {
      setError('يجب تسجيل الدخول أولاً');
      return;
    }
    if (!notes.trim()) {
      setError('يرجى وصف الخدمة المطلوبة');
      return;
    }
    if (!location.trim()) {
      setError('يرجى إدخال موقع الخدمة');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const scheduledAt = scheduledDate
        ? new Date(`${scheduledDate}T${scheduledTime || '09:00'}:00`).toISOString()
        : null;

      const finalServiceId = selectedServiceId || initialServiceId || undefined;

      const insertPayload: Record<string, any> = {
        customer_id: user.id,
        craftsman_id: craftsmanProfileId,
        status: 'pending',
        description: notes.trim(),
        address: location.trim(),
        scheduled_at: scheduledAt,
        payment_status: 'pending',
        escrow_status: 'none',
      };
      if (finalServiceId) insertPayload.service_id = finalServiceId;

      const { data: order, error: insertError } = await supabase
        .from('orders')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload images if any
      if (selectedImages.length > 0) {
        setUploadingImages(true);
        const imageUrls = await uploadImages(order.id);
        if (imageUrls.length > 0) {
          await supabase.from('orders').update({ service_images: imageUrls }).eq('id', order.id);
        }
        setUploadingImages(false);
      }

      // Create conversation linked to this order
      if (craftsmanUserId) {
        // One thread per customer–craftsman pair (like WhatsApp): reuse it and switch it to this order.
        let conversation: { id: string } | null = null;
        try {
          const conversationId = await getOrCreateConversation(supabase, {
            customerId: user.id,
            craftsmanUserId,
            orderId: order.id,
          });
          conversation = { id: conversationId };
        } catch (convError) {
          console.error('Failed to open conversation for order:', convError);
        }

        if (conversation) {
          await supabase.from('messages').insert({
            conversation_id: conversation.id,
            sender_id: user.id,
            content: `مرحباً، أحتاج خدمة${displayServiceName ? ' ' + displayServiceName : ''}.\n📍 الموقع: ${location.trim()}\n${notes.trim()}`,
            message_type: 'text',
          });
        }

        // Notification for craftsman
        await supabase.from('notifications').insert({
          user_id: craftsmanUserId,
          title: 'طلب خدمة جديد 🔔',
          body: `لديك طلب خدمة جديد${displayServiceName ? ` - ${displayServiceName}` : ''} بانتظار موافقتك`,
          type: 'new_order',
          order_id: order.id,
        });

        sendPushToUser(
          craftsmanUserId,
          'طلب خدمة جديد 🔔',
          `لديك طلب خدمة جديد${displayServiceName ? ` - ${displayServiceName}` : ''} بانتظار موافقتك`,
          { url: '/order-details', orderId: order.id }
        );
      }

      // Build payment params
      const paymentParams = new URLSearchParams({ order_id: order.id });
      if (finalServiceId) paymentParams.set('service_id', finalServiceId);
      else paymentParams.set('craftsman_id', craftsmanProfileId);

      // Show booking success screen instead of navigating directly
      setBookingSuccess({ orderId: order.id, paymentParams: paymentParams.toString() });
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ، يرجى المحاولة مجدداً');
      setUploadingImages(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Show booking success screen after submission ──
  if (bookingSuccess) {
    const svc = services.find((s) => s.id === selectedServiceId) || services[0] || null;
    const estimatedCost = svc?.price_label
      ? svc.price_label
      : svc?.base_price
      ? `${svc.base_price} ₪`
      : null;

    return (
      <BookingSuccessScreen
        orderId={bookingSuccess.orderId}
        craftsman={{
          name: craftsman?.name || 'الحرفي',
          specialty: craftsman?.specialty || null,
          rating: craftsman?.rating || 0,
          avatarUrl: craftsman?.avatarUrl || null,
        }}
        serviceName={svc?.name || null}
        serviceEmoji={svc?.emoji || null}
        scheduledDate={scheduledDate}
        scheduledTime={scheduledTime}
        estimatedCost={estimatedCost}
        location={location}
        onGoToPayment={() => router.push(`/payment-screen?${bookingSuccess.paymentParams}`)}
        onViewOrder={() => router.push(`/order-details?order_id=${bookingSuccess.orderId}`)}
      />
    );
  }

  const isFormReady = notes.trim().length > 0 && location.trim().length > 0;

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">

      {/* ── HEADER ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: BRAND.gradient, paddingTop: '2.75rem', paddingBottom: '4.5rem' }}
      >
        <div className="absolute -top-6 -left-6 w-36 h-36 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-6 right-6 w-16 h-16 rounded-full opacity-10" style={{ background: '#fff' }} />

        <div className="relative flex items-center gap-3 px-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)' }}
          >
            <Icon name="ChevronRightIcon" size={20} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white opacity-75">خطوة 1 من 2</p>
            <h1 className="text-lg font-bold text-white leading-tight">طلب خدمة</h1>
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.18)' }}
          >
            <Icon name="WrenchScrewdriverIcon" size={18} className="text-white" />
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="px-4 -mt-8 pb-10 space-y-4 relative z-10">

        {/* ── CRAFTSMAN CONFIRMATION CARD ── */}
        <div
          className="rounded-2xl overflow-hidden shadow-xl"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>الحرفي المختار</p>
            <div className="mr-auto">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: BRAND.light, color: BRAND.primary }}
              >
                ✓ تم التأكيد
              </span>
            </div>
          </div>

          <div className="p-4">
            {isLoadingCraftsman ? (
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl animate-pulse" style={{ background: 'var(--muted)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded-lg animate-pulse w-32" style={{ background: 'var(--muted)' }} />
                  <div className="h-3 rounded-lg animate-pulse w-20" style={{ background: 'var(--muted)' }} />
                </div>
              </div>
            ) : craftsman ? (
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
                  style={{ background: BRAND.light, border: `2px solid ${BRAND.primary}` }}
                >
                  {craftsman.avatarUrl ? (
                    <AppImage
                      src={craftsman.avatarUrl}
                      alt={`صورة ${craftsman.name}`}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon name="UserCircleIcon" size={30} style={{ color: BRAND.primary }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base truncate" style={{ color: 'var(--foreground)' }}>{craftsman.name}</p>
                  {craftsman.specialty && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>{craftsman.specialty}</p>
                  )}
                  {craftsman.rating > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Icon name="StarIcon" size={12} variant="solid" className="text-yellow-500" />
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{craftsman.rating.toFixed(1)}</span>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>تقييم</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>تعذّر تحميل بيانات الحرفي</p>
            )}
          </div>
        </div>

        {/* ── SERVICE SELECTION ── */}
        {services.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
              <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                اختر الخدمة
                {!initialServiceId && <span className="text-red-500 mr-1">*</span>}
              </p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSelectedServiceId(s.id); setError(null); }}
                  className="flex items-center gap-2 p-3 rounded-xl border text-right transition-all"
                  style={{
                    borderColor: selectedServiceId === s.id ? BRAND.primary : 'var(--border)',
                    background: selectedServiceId === s.id ? BRAND.light : 'var(--muted)',
                  }}
                >
                  <span className="text-xl flex-shrink-0">{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>{s.name}</p>
                    {(s.price_label || s.base_price) && (
                      <p className="text-xs" style={{ color: BRAND.primary }}>
                        {s.price_label || `${s.base_price} ₪`}
                      </p>
                    )}
                  </div>
                  {selectedServiceId === s.id && (
                    <Icon name="CheckCircleIcon" size={16} style={{ color: BRAND.primary }} className="flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── DATE & TIME ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>التاريخ والوقت</p>
            <span className="text-xs mr-auto" style={{ color: 'var(--muted-foreground)' }}>اختياري</span>
          </div>
          <div className="p-4 space-y-3">
            {/* Date */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                تاريخ الخدمة
              </label>
              <div className="relative">
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Icon name="CalendarDaysIcon" size={16} style={{ color: BRAND.primary }} />
                </div>
                <input
                  type="date"
                  min={today}
                  value={scheduledDate}
                  onChange={(e) => { setScheduledDate(e.target.value); setError(null); }}
                  className="w-full rounded-xl pr-9 pl-4 py-3 text-sm focus:outline-none"
                  style={{
                    border: '1.5px solid var(--border)',
                    background: 'var(--muted)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            {/* Time — only show when date is selected */}
            {scheduledDate && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  الوقت المفضل
                </label>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Icon name="ClockIcon" size={16} style={{ color: BRAND.primary }} />
                  </div>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full rounded-xl pr-9 pl-4 py-3 text-sm focus:outline-none"
                    style={{
                      border: '1.5px solid var(--border)',
                      background: 'var(--muted)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Quick time slots */}
            {scheduledDate && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>أوقات مقترحة</p>
                <div className="flex gap-2 flex-wrap">
                  {['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setScheduledTime(t)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: scheduledTime === t ? BRAND.primary : 'var(--muted)',
                        color: scheduledTime === t ? '#fff' : 'var(--muted-foreground)',
                        border: `1px solid ${scheduledTime === t ? BRAND.primary : 'var(--border)'}`,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── LOCATION ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
              موقع الخدمة <span className="text-red-500">*</span>
            </p>
          </div>
          <div className="p-4">
            <div className="relative">
              <div className="absolute right-3 top-3.5 pointer-events-none">
                <Icon name="MapPinIcon" size={16} style={{ color: BRAND.primary }} />
              </div>
              <input
                type="text"
                placeholder="أدخل العنوان أو الحي..."
                value={location}
                onChange={(e) => { setLocation(e.target.value); setError(null); }}
                className="w-full rounded-xl pr-9 pl-4 py-3 text-sm focus:outline-none"
                style={{
                  border: `1.5px solid ${location ? BRAND.primary : 'var(--border)'}`,
                  background: 'var(--muted)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── NOTES / DESCRIPTION ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
              وصف المشكلة / ملاحظات <span className="text-red-500">*</span>
            </p>
          </div>
          <div className="p-4">
            <textarea
              rows={4}
              placeholder="اشرح بالتفصيل ما تحتاجه... (مثال: تسرب مياه في الحمام، كهرباء مقطوعة في غرفة النوم)"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setError(null); }}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none leading-relaxed"
              style={{
                border: `1.5px solid ${notes ? BRAND.primary : 'var(--border)'}`,
                background: 'var(--muted)',
                color: 'var(--foreground)',
              }}
            />
            <p className="text-xs mt-1.5 text-left" style={{ color: 'var(--muted-foreground)' }}>
              {notes.length} / 500
            </p>
          </div>
        </div>

        {/* ── IMAGE UPLOAD ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>صور المشكلة</p>
            <span className="text-xs mr-auto" style={{ color: 'var(--muted-foreground)' }}>اختياري — حتى 4 صور</span>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {imagePreviews.map((preview, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden" style={{ border: '1.5px solid var(--border)' }}>
                  <AppImage src={preview} alt={`صورة المشكلة ${i + 1}`} width={80} height={80} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 left-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <Icon name="XMarkIcon" size={10} className="text-white" />
                  </button>
                </div>
              ))}
              {selectedImages.length < 4 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors"
                  style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}
                >
                  <Icon name="PhotoIcon" size={20} style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>إضافة</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl"
            style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}
          >
            <Icon name="ExclamationCircleIcon" size={16} style={{ color: '#DC2626' }} />
            <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
          </div>
        )}

        {/* ── PAYMENT NOTICE ── */}
        {isFormReady && (
          <div
            className="flex items-start gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}
          >
            <Icon name="CreditCardIcon" size={16} style={{ color: '#D97706' }} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400E' }}>ستنتقل إلى صفحة الدفع بعد إرسال الطلب</p>
              <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>يمكنك اختيار طريقة الدفع المناسبة في الخطوة التالية</p>
            </div>
          </div>
        )}

        {/* ── SUBMIT BUTTON ── */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || uploadingImages || !isFormReady}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all"
          style={{
            background: isFormReady ? BRAND.gradient : 'var(--muted)',
            color: isFormReady ? '#fff' : 'var(--muted-foreground)',
            opacity: isSubmitting || uploadingImages ? 0.8 : 1,
          }}
        >
          {isSubmitting || uploadingImages ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {uploadingImages ? 'جاري رفع الصور...' : 'جاري إرسال الطلب...'}
            </>
          ) : (
            <>
              <Icon name="CreditCardIcon" size={16} className="text-white" />
              تأكيد الطلب والمتابعة للدفع
            </>
          )}
        </button>

        <button
          onClick={() => router.back()}
          className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
          style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
        >
          <Icon name="ChevronRightIcon" size={16} />
          العودة
        </button>
      </div>
    </div>
  );
}
