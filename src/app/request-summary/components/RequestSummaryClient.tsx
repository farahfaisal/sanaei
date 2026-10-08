'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { getOrCreateConversation } from '@/lib/supabase/chat';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/Loader';

const BRAND = {
  primary: '#2a724d',
  accent: '#1d5236',
  light: 'rgba(42,114,77,0.10)',
  gradient: 'linear-gradient(145deg, #2a724d 0%, #1d5236 55%, #358f61 100%)',
};

interface CraftsmanInfo {
  id: string;
  userId: string;
  name: string;
  specialty: string | null;
  rating: number;
  totalReviews: number;
  completedJobs: number;
  avatarUrl: string | null;
  isVerified: boolean;
  isOnline: boolean;
}

interface ServiceInfo {
  id: string;
  name: string;
  emoji: string;
  priceLabel: string | null;
  basePrice: number | null;
}

interface RequestData {
  craftsmanProfileId: string;
  craftsmanUserId: string;
  serviceId: string | null;
  serviceName: string | null;
  requestType: 'listed' | 'custom';
  customServiceTitle: string;
  description: string;
  location: string;
  scheduledDate: string;
  scheduledTime: string;
  imageCount: number;
}

export default function RequestSummaryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const supabase = createClient();

  const [craftsman, setCraftsman] = useState<CraftsmanInfo | null>(null);
  const [service, setService] = useState<ServiceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestData, setRequestData] = useState<RequestData | null>(null);

  useEffect(() => {
    // Parse request data from URL params
    const craftsmanProfileId = searchParams?.get('craftsman_id') || '';
    const craftsmanUserId = searchParams?.get('craftsman_user_id') || '';
    const serviceId = searchParams?.get('service_id') || null;
    const serviceName = searchParams?.get('service_name') || null;
    const requestType = (searchParams?.get('request_type') as 'listed' | 'custom') || 'listed';
    const customServiceTitle = searchParams?.get('custom_title') || '';
    const description = decodeURIComponent(searchParams?.get('description') || '');
    const location = decodeURIComponent(searchParams?.get('location') || '');
    const scheduledDate = searchParams?.get('date') || '';
    const scheduledTime = searchParams?.get('time') || '';
    const imageCount = parseInt(searchParams?.get('image_count') || '0', 10);

    setRequestData({
      craftsmanProfileId,
      craftsmanUserId,
      serviceId,
      serviceName,
      requestType,
      customServiceTitle,
      description,
      location,
      scheduledDate,
      scheduledTime,
      imageCount,
    });

    if (craftsmanProfileId) {
      loadCraftsmanData(craftsmanProfileId, serviceId);
    }
  }, []);

  const loadCraftsmanData = async (craftsmanProfileId: string, serviceId: string | null) => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('craftsman_profiles')
        .select(`
          id, specialty, rating, total_reviews, completed_jobs, avatar_url, user_id, is_verified, is_online,
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
          totalReviews: data.total_reviews || 0,
          completedJobs: data.completed_jobs || 0,
          avatarUrl: data.avatar_url,
          isVerified: data.is_verified || false,
          isOnline: data.is_online || false,
        });
      }

      if (serviceId) {
        const { data: svcData } = await supabase
          .from('service_categories')
          .select('id, name, emoji, base_price, price_label')
          .eq('id', serviceId)
          .maybeSingle();

        if (svcData) {
          setService({
            id: svcData.id,
            name: svcData.name,
            emoji: svcData.emoji,
            priceLabel: svcData.price_label,
            basePrice: svcData.base_price,
          });
        }
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!user || !requestData) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const { craftsmanProfileId, craftsmanUserId, serviceId, requestType, customServiceTitle, description, location, scheduledDate, scheduledTime } = requestData;

      const scheduledAt = scheduledDate
        ? new Date(`${scheduledDate}T${scheduledTime || '09:00'}:00`).toISOString()
        : null;

      const finalDescription = requestType === 'custom' && customServiceTitle.trim()
        ? `[خدمة مخصصة: ${customServiceTitle.trim()}]\n${description.trim()}`
        : description.trim();

      const insertPayload: Record<string, any> = {
        customer_id: user.id,
        craftsman_id: craftsmanProfileId,
        status: 'pending',
        description: finalDescription,
        address: location.trim(),
        scheduled_at: scheduledAt,
        payment_status: 'pending',
        escrow_status: 'none',
      };
      if (serviceId) insertPayload.service_id = serviceId;

      const { data: order, error: insertError } = await supabase
        .from('orders')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) throw insertError;

      const displayServiceName = requestType === 'custom' ? (customServiceTitle.trim() ||'خدمة مخصصة')
        : (service?.name || requestData.serviceName || '');

      const firstMessage = requestType === 'custom'
        ? `مرحباً، أحتاج خدمة مخصصة${customServiceTitle.trim() ? ': ' + customServiceTitle.trim() : ''}.\n📍 الموقع: ${location.trim()}\n${description.trim()}\n\n💡 يرجى إرسال عرض السعر المناسب.`
        : `مرحباً، أحتاج خدمة${displayServiceName ? ' ' + displayServiceName : ''}.\n📍 الموقع: ${location.trim()}\n${description.trim()}`;

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
          content: firstMessage,
          message_type: 'text',
        });

        if (requestType === 'custom') {
          await supabase.from('messages').insert({
            conversation_id: conversation.id,
            sender_id: craftsmanUserId,
            content: `📋 طلب خدمة مخصصة جديد — يرجى مراجعة الطلب وإرسال عرض السعر المناسب باستخدام زر 💰 عرض سعر.`,
            message_type: 'text',
          });
        }
      }

      // The craftsman's notification + push is sent by the database when the order is created.

      if (conversation) {
        router.push(`/chat?conversation_id=${conversation.id}`);
      } else {
        router.push(`/chat?order_id=${order.id}`);
      }
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ، يرجى المحاولة مجدداً');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string, timeStr: string) => {
    if (!dateStr) return null;
    const date = new Date(`${dateStr}T${timeStr || '09:00'}:00`);
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${days[date.getDay()]}، ${date.getDate()} ${months[date.getMonth()]}${timeStr ? ' — ' + timeStr : ''}`;
  };

  if (isLoading) {
    return (
      <div className="screen-container flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  const displayServiceName = requestData?.requestType === 'custom' ? (requestData.customServiceTitle ||'خدمة مخصصة')
    : (service?.name || requestData?.serviceName || 'خدمة');

  const displayEmoji = requestData?.requestType === 'custom' ? '🔧' : (service?.emoji || '🛠️');
  const displayPrice = service?.priceLabel || (service?.basePrice ? `${service.basePrice} ₪` : null);

  return (
    <div className="screen-container" style={{ background: 'var(--background)' }} dir="rtl">

      {/* ── HEADER ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: BRAND.gradient, paddingTop: '2.75rem', paddingBottom: '5rem' }}
      >
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute top-4 right-4 w-20 h-20 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute bottom-0 left-0 right-0 h-8 rounded-t-3xl" style={{ background: 'var(--background)' }} />

        <div className="relative flex items-center gap-3 px-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)' }}
          >
            <Icon name="ChevronRightIcon" size={20} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white opacity-75">الخطوة الأخيرة</p>
            <h1 className="text-lg font-bold text-white leading-tight">مراجعة الطلب</h1>
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.18)' }}
          >
            <Icon name="ClipboardDocumentCheckIcon" size={18} className="text-white" />
          </div>
        </div>

        {/* Step indicator */}
        <div className="relative flex items-center justify-center gap-2 mt-4 px-4">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(255,255,255,0.3)', color: '#fff' }}>
              <Icon name="CheckIcon" size={12} className="text-white" />
            </div>
            <span className="text-xs text-white opacity-70">تفاصيل الطلب</span>
          </div>
          <div className="flex-1 h-px mx-1" style={{ background: 'rgba(255,255,255,0.3)' }} />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white" style={{ color: BRAND.primary }}>
              2
            </div>
            <span className="text-xs text-white font-semibold">تأكيد الطلب</span>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="px-4 -mt-2 pb-32 space-y-4 relative z-10">

        {/* ── CRAFTSMAN CARD ── */}
        <div
          className="rounded-2xl overflow-hidden shadow-lg"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>الحِرَفي المختار</p>
          </div>
          <div className="p-4">
            {craftsman ? (
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0 relative"
                  style={{ background: BRAND.light, border: `2px solid ${BRAND.primary}` }}
                >
                  {craftsman.avatarUrl ? (
                    <AppImage
                      src={craftsman.avatarUrl}
                      alt={`صورة ${craftsman.name}`}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon name="UserCircleIcon" size={34} style={{ color: BRAND.primary }} />
                  )}
                  {craftsman.isOnline && (
                    <div className="absolute bottom-1 left-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-base" style={{ color: 'var(--foreground)' }}>{craftsman.name}</p>
                    {craftsman.isVerified && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: BRAND.light, color: BRAND.primary }}>✓ موثوق</span>
                    )}
                  </div>
                  {craftsman.specialty && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{craftsman.specialty}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {craftsman.rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Icon name="StarIcon" size={12} variant="solid" className="text-yellow-500" />
                        <span className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{craftsman.rating.toFixed(1)}</span>
                        {craftsman.totalReviews > 0 && (
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>({craftsman.totalReviews})</span>
                        )}
                      </div>
                    )}
                    {craftsman.completedJobs > 0 && (
                      <div className="flex items-center gap-1">
                        <Icon name="BriefcaseIcon" size={11} style={{ color: 'var(--muted-foreground)' }} />
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{craftsman.completedJobs} مهمة</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>تعذّر تحميل بيانات الحِرَفي</p>
            )}
          </div>
        </div>

        {/* ── SERVICE DETAILS ── */}
        <div
          className="rounded-2xl overflow-hidden shadow-lg"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>تفاصيل الخدمة</p>
          </div>
          <div className="p-4 space-y-3">
            {/* Service name */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: BRAND.light }}>
              <span className="text-2xl">{displayEmoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>نوع الخدمة</p>
                <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{displayServiceName}</p>
                {requestData?.requestType === 'custom' && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>
                    خدمة مخصصة
                  </span>
                )}
              </div>
              {displayPrice && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>السعر</p>
                  <p className="text-sm font-bold" style={{ color: BRAND.primary }}>{displayPrice}</p>
                </div>
              )}
            </div>

            {/* Description */}
            {requestData?.description && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--muted)' }}>
                  <Icon name="DocumentTextIcon" size={16} style={{ color: 'var(--muted-foreground)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>وصف المشكلة</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{requestData.description}</p>
                </div>
              </div>
            )}

            {/* Location */}
            {requestData?.location && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--muted)' }}>
                  <Icon name="MapPinIcon" size={16} style={{ color: 'var(--muted-foreground)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>موقع الخدمة</p>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{requestData.location}</p>
                </div>
              </div>
            )}

            {/* Scheduled date */}
            {requestData?.scheduledDate && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--muted)' }}>
                  <Icon name="CalendarDaysIcon" size={16} style={{ color: 'var(--muted-foreground)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>الموعد المطلوب</p>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                    {formatDate(requestData.scheduledDate, requestData.scheduledTime)}
                  </p>
                </div>
              </div>
            )}

            {/* Images count */}
            {requestData?.imageCount > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--muted)' }}>
                  <Icon name="PhotoIcon" size={16} style={{ color: 'var(--muted-foreground)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>الصور المرفقة</p>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{requestData.imageCount} صورة مرفقة</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── ORDER SUMMARY ── */}
        <div
          className="rounded-2xl overflow-hidden shadow-lg"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-1 h-4 rounded-full" style={{ background: BRAND.primary }} />
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>ملخص الطلب</p>
          </div>
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>الحِرَفي</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{craftsman?.name || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>الخدمة</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{displayServiceName}</span>
            </div>
            {displayPrice && (
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>السعر التقديري</span>
                <span className="text-sm font-bold" style={{ color: BRAND.primary }}>{displayPrice}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>حالة الدفع</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>
                سيُحدَّد لاحقاً
              </span>
            </div>
            <div className="h-px" style={{ background: 'var(--border)' }} />
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>نوع الطلب</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: BRAND.light, color: BRAND.primary }}>
                {requestData?.requestType === 'custom' ? 'خدمة مخصصة' : 'خدمة من القائمة'}
              </span>
            </div>
          </div>
        </div>

        {/* ── CHAT FLOW INFO ── */}
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Icon name="ChatBubbleLeftEllipsisIcon" size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-800 mb-0.5">
              {requestData?.requestType === 'custom' ? 'سيتم فتح محادثة مع الحِرَفي' : 'سيتم فتح محادثة بعد إرسال الطلب'}
            </p>
            <p className="text-xs text-amber-700 leading-relaxed">
              {requestData?.requestType === 'custom' ?'الحِرَفي سيرسل لك عرض السعر، ويمكنك قبوله أو رفضه من داخل المحادثة' :'يمكنك التواصل مع الحِرَفي ومتابعة الطلب من خلال المحادثة'}
            </p>
          </div>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* ── BOTTOM ACTION BAR ── */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 z-20"
        style={{ background: 'var(--background)', borderTop: '1px solid var(--border)' }}
      >
        <div className="max-w-lg mx-auto space-y-2.5">
          <button
            onClick={handleConfirmOrder}
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 transition-opacity"
            style={{ background: isSubmitting ? 'rgba(42,114,77,0.6)' : BRAND.gradient }}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري إرسال الطلب...
              </>
            ) : (
              <>
                <Icon name="CheckCircleIcon" size={20} className="text-white" />
                تأكيد وإرسال الطلب
              </>
            )}
          </button>
          <button
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="w-full py-3 rounded-2xl font-semibold text-sm transition-colors"
            style={{ color: 'var(--muted-foreground)', background: 'var(--muted)' }}
          >
            تعديل الطلب
          </button>
        </div>
      </div>
    </div>
  );
}
