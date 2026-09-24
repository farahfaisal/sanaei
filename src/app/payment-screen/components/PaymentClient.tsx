'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type PaymentMethod = 'card' | 'cash' | 'apple';

interface ServiceData {
  id: string;
  name: string;
  emoji: string;
  base_price: number | null;
  price_label: string | null;
  craftsman_profiles: {
    id: string;
    rating: number;
    avatar_url: string | null;
    user_profiles: { full_name: string } | null;
  } | null;
}

const CARD_DATA = {
  last4: '4471',
  expiry: '09/28',
  brand: 'VISA',
  holder: 'محمد أحمد',
};

export default function PaymentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const supabase = createClient();

  const serviceId = searchParams?.get('service_id');
  const craftsmanId = searchParams?.get('craftsman_id');

  const [method, setMethod] = useState<PaymentMethod>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [serviceData, setServiceData] = useState<ServiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (serviceId) {
      loadServiceData(serviceId);
    } else if (craftsmanId) {
      loadCraftsmanDefault(craftsmanId);
    } else {
      setIsLoading(false);
    }
  }, [serviceId, craftsmanId]);

  const loadServiceData = async (id: string) => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('craftsman_services')
        .select('id, name, emoji, base_price, price_label, craftsman_profiles(id, rating, avatar_url, user_profiles(full_name))')
        .eq('id', id)
        .maybeSingle();
      if (data) setServiceData(data as any);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const loadCraftsmanDefault = async (id: string) => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('craftsman_services')
        .select('id, name, emoji, base_price, price_label, craftsman_profiles(id, rating, avatar_url, user_profiles(full_name))')
        .eq('craftsman_id', id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (data) setServiceData(data as any);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      if (user && serviceData?.craftsman_profiles?.id) {
        const { data: order } = await supabase
          .from('orders')
          .insert({
            customer_id: user.id,
            craftsman_id: serviceData.craftsman_profiles.id,
            service_id: serviceData.id,
            status: 'pending',
            amount: serviceData.base_price || 0,
            payment_method: method === 'apple' ? 'apple_pay' : method,
            payment_status: method === 'cash' ? 'pending' : 'paid',
          })
          .select()
          .single();

        if (order) setOrderId(order.id);
      } else {
        // Simulate for demo
        await new Promise((r) => setTimeout(r, 1500));
      }
      setIsPaid(true);
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1500));
      setIsPaid(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const craftsmanName = serviceData?.craftsman_profiles?.user_profiles?.full_name || 'الصنايعي';
  const serviceName = serviceData?.name || 'خدمة صيانة';
  const amount = serviceData?.base_price || 120;
  const avatarUrl = serviceData?.craftsman_profiles?.avatar_url;
  const rating = serviceData?.craftsman_profiles?.rating || 4.9;

  if (isPaid) {
    return (
      <div className="screen-container flex flex-col items-center justify-center min-h-screen bg-white px-6" dir="rtl">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ background: '#1B5E20' }}>
            <Icon name="CheckIcon" size={44} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">تم الدفع بنجاح!</h2>
          <p className="text-gray-500 text-sm mb-6">
            تم تأكيد حجزك مع {craftsmanName}
          </p>
          <div className="bg-green-50 rounded-2xl p-4 mb-8 text-right border border-green-100">
            <div className="flex justify-between items-center">
              <span className="text-xl font-black text-primary font-tabular">
                {amount} ر.س
              </span>
              <span className="text-sm text-gray-500">المبلغ المدفوع</span>
            </div>
          </div>
          <button
            onClick={() => router.push('/home-screen')}
            className="w-full py-4 rounded-2xl font-bold text-white text-base"
            style={{ background: '#1B5E20' }}
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 bg-white border-b border-gray-100">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <Icon name="ChevronRightIcon" size={20} className="text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">الدفع</h1>
      </div>

      <div className="px-4 py-4 space-y-4 pb-32">
        {/* Service summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          {isLoading ? (
            <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                {avatarUrl ? (
                  <AppImage
                    src={avatarUrl}
                    alt={`صورة ${craftsmanName}`}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="UserCircleIcon" size={32} className="text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 leading-tight mb-1">{serviceName}</p>
                <p className="text-xs text-gray-500 mb-1">{craftsmanName}</p>
                <div className="flex items-center gap-1">
                  <Icon name="StarIcon" size={12} variant="solid" className="text-yellow-500" />
                  <span className="text-xs text-gray-500 font-tabular">{rating}</span>
                </div>
              </div>
              <div className="text-left flex-shrink-0">
                <p className="text-xs text-gray-400 mb-0.5">المطلوب دفعه</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-gray-900 font-tabular">{amount}</span>
                  <span className="text-sm text-gray-500">ر.س</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment method selection */}
        <div className="space-y-2">
          {/* Credit Card */}
          <button
            onClick={() => setMethod('card')}
            className={`w-full text-right rounded-2xl border-2 p-4 transition-all ${
              method === 'card' ? 'border-primary bg-green-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                method === 'card' ? 'border-primary bg-primary' : 'border-gray-300'
              }`}>
                {method === 'card' && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">بطاقة إلكترونية</p>
                  <p className="text-xs text-gray-500">فيزا / ماستركارد</p>
                </div>
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Icon name="CreditCardIcon" size={22} className="text-blue-600" />
                </div>
              </div>
            </div>
          </button>

          {/* Cash */}
          <button
            onClick={() => setMethod('cash')}
            className={`w-full text-right rounded-2xl border-2 p-4 transition-all ${
              method === 'cash' ? 'border-primary bg-green-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                method === 'cash' ? 'border-primary bg-primary' : 'border-gray-300'
              }`}>
                {method === 'cash' && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">كاش</p>
                  <p className="text-xs text-gray-500">عند إتمام الخدمة</p>
                </div>
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <Icon name="BanknotesIcon" size={22} className="text-green-600" />
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Card details */}
        {method === 'card' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4">رقم البطاقة</h3>
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 mb-4 text-white">
              <div className="flex items-center justify-between mb-5">
                <div className="w-8 h-5 bg-yellow-400 rounded-sm opacity-80" />
                <span className="text-sm font-bold opacity-70">VISA</span>
              </div>
              <div className="text-base font-tabular tracking-widest mb-4">
                4532 **** **** {CARD_DATA.last4}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs opacity-50 mb-0.5">تاريخ الانتهاء</div>
                  <div className="text-sm font-semibold font-tabular">{CARD_DATA.expiry}</div>
                </div>
                <div>
                  <div className="text-xs opacity-50 mb-0.5">CVC</div>
                  <div className="text-sm font-semibold">•••</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-800 font-semibold">{CARD_DATA.holder}</span>
              <span className="text-xs text-gray-500">اسم حامل البطاقة</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Icon name="ShieldCheckIcon" size={14} className="text-primary flex-shrink-0" />
              <p className="text-xs text-gray-500">دفع مشفر وآمن — ضمان الضمان حتى إتمام الخدمة</p>
            </div>
          </div>
        )}
      </div>

      {/* Pay button - fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-white border-t border-gray-100">
        <button
          onClick={handlePay}
          disabled={isProcessing}
          className="w-full py-4 rounded-2xl font-bold text-white text-base mb-3 transition-all"
          style={{ background: '#1B5E20', opacity: isProcessing ? 0.7 : 1 }}
        >
          {isProcessing ? 'جاري المعالجة...' : `ادفع ${amount} ر.س الآن`}
        </button>
        <button
          onClick={() => setMethod('apple')}
          className="w-full py-3.5 rounded-2xl font-bold text-gray-800 text-sm border border-gray-200 bg-white flex items-center justify-center gap-2"
        >
          <span>🍎</span>
          أو الدفع عبر Apple Pay
        </button>
      </div>
    </div>
  );
}
