'use client';

import React, { useState, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { useRouter } from 'next/navigation';

interface ServiceOption {
  id: string;
  name: string;
  emoji: string;
  price_label: string | null;
  base_price: number | null;
}

interface RequestServiceModalProps {
  craftsmanProfileId: string;
  craftsmanUserId: string;
  craftsmanName: string;
  serviceId?: string;
  serviceName?: string;
  services?: ServiceOption[];
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

type RequestType = 'listed' | 'custom';

export default function RequestServiceModal({
  craftsmanProfileId,
  craftsmanUserId,
  craftsmanName,
  serviceId: initialServiceId,
  serviceName: initialServiceName,
  services = [],
  onClose,
  onSuccess,
}: RequestServiceModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  // If a specific service was pre-selected, start on listed tab
  const [requestType, setRequestType] = useState<RequestType>(
    initialServiceId ? 'listed' : services.length > 0 ? 'listed' : 'custom'
  );

  const [selectedServiceId, setSelectedServiceId] = useState<string>(initialServiceId || '');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [customServiceTitle, setCustomServiceTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image upload
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];

  const selectedService = services.find((s) => s.id === selectedServiceId) || null;
  const displayServiceName =
    requestType === 'custom' ? customServiceTitle.trim() ||'خدمة مخصصة' : selectedService?.name || initialServiceName ||'';

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
    if (!location.trim()) {
      setError('يرجى إدخال موقع الخدمة');
      return;
    }
    if (requestType === 'listed' && !selectedServiceId && !initialServiceId) {
      setError('يرجى اختيار الخدمة المطلوبة');
      return;
    }

    // Navigate to request summary screen for final confirmation
    const finalServiceId = requestType === 'listed' ? (selectedServiceId || initialServiceId || '') : '';
    const params = new URLSearchParams({
      craftsman_id: craftsmanProfileId,
      craftsman_user_id: craftsmanUserId,
      request_type: requestType,
      description: encodeURIComponent(description.trim()),
      location: encodeURIComponent(location.trim()),
      image_count: String(selectedImages.length),
    });
    if (finalServiceId) params.set('service_id', finalServiceId);
    if (displayServiceName) params.set('service_name', displayServiceName);
    if (requestType === 'custom' && customServiceTitle.trim()) params.set('custom_title', customServiceTitle.trim());
    if (scheduledDate) params.set('date', scheduledDate);
    if (scheduledTime) params.set('time', scheduledTime);

    onClose();
    router.push(`/request-summary?${params.toString()}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 max-h-[92vh] overflow-y-auto" dir="rtl">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <Icon name="XMarkIcon" size={18} className="text-gray-600" />
          </button>
          <h2 className="text-base font-bold text-gray-900">طلب خدمة</h2>
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
          </div>
        </div>

        {/* Request type tabs */}
        <div className="flex gap-2 mb-5 p-1 bg-gray-100 rounded-2xl">
          <button
            onClick={() => { setRequestType('listed'); setError(null); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              requestType === 'listed' ?'bg-white text-gray-900 shadow-sm' :'text-gray-500'
            }`}
          >
            <Icon name="ListBulletIcon" size={15} className={requestType === 'listed' ? 'text-primary' : 'text-gray-400'} />
            خدمة من القائمة
          </button>
          <button
            onClick={() => { setRequestType('custom'); setError(null); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              requestType === 'custom' ?'bg-white text-gray-900 shadow-sm' :'text-gray-500'
            }`}
          >
            <Icon name="PencilSquareIcon" size={15} className={requestType === 'custom' ? 'text-primary' : 'text-gray-400'} />
            خدمة مخصصة
          </button>
        </div>

        <div className="space-y-4">

          {/* Listed services */}
          {requestType === 'listed' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                اختر الخدمة <span className="text-red-500">*</span>
              </label>
              {services.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-xl text-center">
                  <p className="text-sm text-gray-400">لا توجد خدمات محددة لهذا الصنايعي</p>
                  <button
                    onClick={() => setRequestType('custom')}
                    className="mt-2 text-xs text-primary font-semibold underline"
                  >
                    أرسل طلباً مخصصاً
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSelectedServiceId(s.id); setError(null); }}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-right transition-all ${
                        selectedServiceId === s.id
                          ? 'border-primary bg-green-50' :'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{s.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{s.name}</p>
                        {(s.price_label || s.base_price) && (
                          <p className="text-xs text-primary">
                            {s.price_label || `${s.base_price} ر.س`}
                          </p>
                        )}
                      </div>
                      {selectedServiceId === s.id && (
                        <Icon name="CheckCircleIcon" size={16} className="text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom service title */}
          {requestType === 'custom' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                نوع الخدمة المطلوبة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="مثال: تركيب مكيف، إصلاح سباكة، دهان غرفة..."
                value={customServiceTitle}
                onChange={(e) => { setCustomServiceTitle(e.target.value); setError(null); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary bg-gray-50"
              />
              {/* Custom request info banner */}
              <div className="mt-2 flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <Icon name="InformationCircleIcon" size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  سيتواصل معك الصنايعي عبر المحادثة ويرسل لك عرض السعر المناسب، ويمكنك قبوله أو رفضه.
                </p>
              </div>
            </div>
          )}

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

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              موقع الخدمة <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Icon name="MapPinIcon" size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="أدخل العنوان أو الحي..."
                value={location}
                onChange={(e) => { setLocation(e.target.value); setError(null); }}
                className="w-full border border-gray-200 rounded-xl pr-9 pl-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary bg-gray-50"
              />
            </div>
          </div>

          {/* Notes / Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              وصف المشكلة / ملاحظات <span className="text-red-500">*</span>
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

          {/* Chat flow info */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold text-amber-900 flex items-center gap-1">
              <Icon name="ChatBubbleLeftEllipsisIcon" size={13} className="text-amber-700" />
              {requestType === 'custom' ?'سيتم فتح محادثة مع الصنايعي' :'سيتم فتح محادثة بعد إرسال الطلب'}
            </p>
            <p className="text-amber-700">
              {requestType === 'custom' ?'الصنايعي سيرسل لك عرض السعر، ويمكنك قبوله أو رفضه من داخل المحادثة' :'يمكنك التواصل مع الصنايعي ومتابعة الطلب من خلال المحادثة'}
            </p>
          </div>

          <button
            onClick={handleConfirm}
            disabled={isSubmitting || uploadingImages}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2"
            style={{ background: '#1B5E20' }}
          >
            <>
              <Icon name="ClipboardDocumentCheckIcon" size={16} className="text-white" />
              {requestType === 'custom' ? 'مراجعة الطلب قبل الإرسال' : 'مراجعة وتأكيد الطلب'}
            </>
          </button>
        </div>
      </div>
    </div>
  );
}
