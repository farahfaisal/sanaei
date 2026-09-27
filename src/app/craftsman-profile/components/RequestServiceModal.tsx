'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sendPushToUser } from '@/lib/pushNotifications';

type PaymentMethod = 'cash' | 'card' | 'wallet';

interface RequestServiceModalProps {
  craftsmanProfileId: string;
  craftsmanUserId: string;
  craftsmanName: string;
  serviceId?: string;
  serviceName?: string;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash', label: 'نقداً', icon: '💵' },
  { value: 'card', label: 'بطاقة بنكية', icon: '💳' },
  { value: 'wallet', label: 'المحفظة', icon: '👛' },
];

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

  const [step, setStep] = useState<1 | 2>(1);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const handleNext = () => {
    if (!scheduledDate) {
      setError('يرجى اختيار تاريخ الخدمة');
      return;
    }
    if (!description.trim()) {
      setError('يرجى وصف الخدمة المطلوبة');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleConfirm = async () => {
    if (!user) {
      setError('يجب تسجيل الدخول أولاً');
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
        payment_method: paymentMethod,
        payment_status: 'pending',
      };
      if (serviceId) insertPayload.service_id = serviceId;

      const { data: order, error: insertError } = await supabase
        .from('orders')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) throw insertError;

      // Insert notification record for craftsman
      await supabase.from('notifications').insert({
        user_id: craftsmanUserId,
        title: 'طلب خدمة جديد 🔔',
        body: `لديك طلب خدمة جديد${serviceName ? ` - ${serviceName}` : ''} بانتظار موافقتك`,
        type: 'new_order',
        order_id: order.id,
      });

      // Trigger FCM / Web Push notification to craftsman
      sendPushToUser(
        craftsmanUserId,
        'طلب خدمة جديد 🔔',
        `لديك طلب خدمة جديد${serviceName ? ` - ${serviceName}` : ''} بانتظار موافقتك`,
        { url: '/craftsman-profile', orderId: order.id }
      );

      onSuccess(order.id);
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ، يرجى المحاولة مجدداً');
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
      <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8" dir="rtl">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <Icon name="XMarkIcon" size={18} className="text-gray-600" />
          </button>
          <h2 className="text-base font-bold text-gray-900">
            {step === 1 ? 'تفاصيل الطلب' : 'تأكيد طريقة الدفع'}
          </h2>
          <div className="flex gap-1">
            <div className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-gray-200'}`} />
            <div className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`} />
          </div>
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

        {step === 1 ? (
          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                تاريخ الخدمة <span className="text-red-500">*</span>
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

            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-500" />
                {error}
              </p>
            )}

            <button
              onClick={handleNext}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-sm"
              style={{ background: '#1B5E20' }}
            >
              التالي — اختيار طريقة الدفع
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Order summary */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">التاريخ</span>
                <span className="text-sm font-semibold text-gray-900">
                  {new Date(scheduledDate).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              {scheduledTime && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">الوقت</span>
                  <span className="text-sm font-semibold text-gray-900">{scheduledTime}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2">
                <p className="text-xs text-gray-500 mb-1">الوصف</p>
                <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
              </div>
            </div>

            {/* Payment method */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">طريقة الدفع</p>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.value}
                    onClick={() => setPaymentMethod(pm.value)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-right ${
                      paymentMethod === pm.value
                        ? 'border-primary bg-green-50' :'border-gray-200 bg-white'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      paymentMethod === pm.value ? 'border-primary bg-primary' : 'border-gray-300'
                    }`}>
                      {paymentMethod === pm.value && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="text-lg">{pm.icon}</span>
                    <span className="text-sm font-semibold text-gray-800">{pm.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-500" />
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="flex-1 py-3.5 rounded-2xl font-bold text-gray-700 text-sm bg-gray-100"
              >
                رجوع
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="flex-[2] py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2"
                style={{ background: '#1B5E20' }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Icon name="PaperAirplaneIcon" size={16} className="text-white" />
                    تأكيد الطلب
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
