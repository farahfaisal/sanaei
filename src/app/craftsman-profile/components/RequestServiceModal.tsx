'use client';

import React, { useState, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sendPushToUser } from '@/lib/pushNotifications';
import { useRouter } from 'next/navigation';

interface RequestServiceModalProps {
  craftsmanProfileId: string;
  craftsmanUserId: string;
  craftsmanName: string;
  serviceId?: string;
  serviceName?: string;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

export default function RequestServiceModal({
  craftsmanProfileId,
  craftsmanUserId,
  craftsmanName,
  serviceId,
  serviceName,
  onClose,
  onSuccess,
}: RequestServiceModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image upload
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newFiles = [...selectedImages, ...files].slice(0, 4); // max 4 images
    setSelectedImages(newFiles);
    const previews = newFiles.map((f) => URL.createObjectURL(f));
    setImagePreviews(previews);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const newFiles = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setSelectedImages(newFiles);
    setImagePreviews(newPreviews);
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

  const handleConfirm = async () => {
    if (!user) {
      setError('يجب تسجيل الدخول أولاً');
      return;
    }
    if (!description.trim()) {
      setError('يرجى وصف الخدمة المطلوبة');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const scheduledAt = scheduledDate
        ? new Date(`${scheduledDate}T${scheduledTime || '09:00'}:00`).toISOString()
        : null;

      const insertPayload: Record<string, any> = {
        customer_id: user.id,
        craftsman_id: craftsmanProfileId,
        status: 'pending',
        description: description.trim(),
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

      // Upload images if any
      if (selectedImages.length > 0) {
        setUploadingImages(true);
        const imageUrls = await uploadImages(order.id);
        if (imageUrls.length > 0) {
          await supabase
            .from('orders')
            .update({ service_images: imageUrls })
            .eq('id', order.id);
        }
        setUploadingImages(false);
      }

      // Create conversation linked to this order
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          customer_id: user.id,
          craftsman_id: craftsmanUserId,
          order_id: order.id,
          last_message: `طلب خدمة جديد${serviceName ? ': ' + serviceName : ''}`,
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (!convError && conversation) {
        // Link conversation to order
        await supabase
          .from('orders')
          .update({ conversation_id: conversation.id })
          .eq('id', order.id);

        // Send initial message in chat
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: `مرحباً، أحتاج خدمة${serviceName ? ' ' + serviceName : ''}.\n${description.trim()}`,
          message_type: 'text',
        });
      }

      // Insert notification record for craftsman
      await supabase.from('notifications').insert({
        user_id: craftsmanUserId,
        title: 'طلب خدمة جديد 🔔',
        body: `لديك طلب خدمة جديد${serviceName ? ` - ${serviceName}` : ''} بانتظار موافقتك`,
        type: 'new_order',
        order_id: order.id,
      });

      // Trigger push notification to craftsman
      sendPushToUser(
        craftsmanUserId,
        'طلب خدمة جديد 🔔',
        `لديك طلب خدمة جديد${serviceName ? ` - ${serviceName}` : ''} بانتظار موافقتك`,
        { url: '/craftsman-profile', orderId: order.id }
      );

      // Navigate to chat
      if (conversation) {
        onClose();
        router.push(`/chat?conversation_id=${conversation.id}`);
      } else {
        onSuccess(order.id);
      }
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ، يرجى المحاولة مجدداً');
      setUploadingImages(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 max-h-[90vh] overflow-y-auto" dir="rtl">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <Icon name="XMarkIcon" size={18} className="text-gray-600" />
          </button>
          <h2 className="text-base font-bold text-gray-900">طلب خدمة وبدء محادثة</h2>
          <div className="w-8" />
        </div>

        {/* Craftsman info */}
        <div className="flex items-center gap-2 mb-5 p-3 bg-green-50 rounded-2xl border border-green-100">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <Icon name="WrenchScrewdriverIcon" size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500">الصنايعي</p>
            <p className="text-sm font-bold text-gray-900">{craftsmanName}</p>
            {serviceName && <p className="text-xs text-primary">{serviceName}</p>}
          </div>
        </div>

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              تاريخ الخدمة <span className="text-gray-400 text-xs">(اختياري)</span>
            </label>
            <input
              type="date"
              min={today}
              value={scheduledDate}
              onChange={(e) => { setScheduledDate(e.target.value); setError(null); }}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary bg-gray-50"
            />
          </div>

          {/* Time */}
          {scheduledDate && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                الوقت المفضل <span className="text-gray-400 text-xs">(اختياري)</span>
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary bg-gray-50"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              وصف المشكلة / الخدمة المطلوبة <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="اشرح بالتفصيل ما تحتاجه..."
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(null); }}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary bg-gray-50 resize-none leading-relaxed"
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              صور المشكلة <span className="text-gray-400 text-xs">(اختياري — حتى 4 صور)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {imagePreviews.map((preview, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                  <AppImage src={preview} alt={`صورة ${i + 1}`} width={80} height={80} className="w-full h-full object-cover" />
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
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <Icon name="PhotoIcon" size={20} className="text-gray-400" />
                  <span className="text-xs text-gray-400">إضافة</span>
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

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <Icon name="ExclamationCircleIcon" size={14} className="text-red-500" />
              {error}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={isSubmitting || uploadingImages}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2"
            style={{ background: '#1B5E20' }}
          >
            {isSubmitting || uploadingImages ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {uploadingImages ? 'جاري رفع الصور...' : 'جاري الإرسال...'}
              </>
            ) : (
              <>
                <Icon name="ChatBubbleLeftRightIcon" size={16} className="text-white" />
                إرسال الطلب وبدء المحادثة
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
