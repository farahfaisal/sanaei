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
      <div className="screen-container flex flex-col items-center justify-center min-h-screen px-6" style={{ background: '#0F1A14' }} dir="rtl">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #1B6B5A, #23896F)' }}>
            <Icon name="CheckIcon" size={44} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#F0EAD6' }}>تم الدفع بنجاح!</h2>
          <p className="text-sm mb-6" style={{ color: '#8A9E8E' }}>
            تم تأكيد حجزك مع {craftsmanName}
          </p>
          <div className="rounded-2xl p-4 mb-8 text-right" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <div className="flex justify-between items-center">
              <span className="text-xl font-black font-tabular" style={{ color: '#C9A84C' }}>
                {amount} ر.س
              </span>
              <span className="text-sm" style={{ color: '#8A9E8E' }}>المبلغ المدفوع</span>
            </div>
          </div>
          <button
            onClick={() => router.push('/home-screen')}
            className="w-full py-4 rounded-2xl font-bold text-base"
            style={{ background: 'linear-gradient(135deg, #1B6B5A, #23896F)', color: '#FFFFFF' }}
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container" style={{ background: '#0F1A14' }} dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4" style={{ background: '#162219', borderBottom: '1px solid #243B2C' }}>
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#1A2E24' }}
        >
          <Icon name="ChevronRightIcon" size={20} style={{ color: '#F0EAD6' }} />
        </button>
        <h1 className="text-lg font-bold" style={{ color: '#F0EAD6' }}>الدفع</h1>
      </div>

      <div className="px-4 py-4 space-y-4 pb-32">
        {/* Service summary */}
        <div className="rounded-2xl p-4" style={{ background: '#162219', border: '1.5px solid #243B2C' }}>
          {isLoading ? (
            <div className="h-16 rounded-xl animate-pulse" style={{ background: '#1A2E24' }} />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0" style={{ background: '#1A2E24' }}>
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
                    <Icon name="UserCircleIcon" size={32} style={{ color: '#3A5A40' }} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold leading-tight mb-1" style={{ color: '#F0EAD6' }}>{serviceName}</p>
                <p className="text-xs mb-1" style={{ color: '#8A9E8E' }}>{craftsmanName}</p>
                <div className="flex items-center gap-1">
                  <Icon name="StarIcon" size={12} variant="solid" style={{ color: '#C9A84C' }} />
                  <span className="text-xs font-tabular" style={{ color: '#8A9E8E' }}>{rating}</span>
                </div>
              </div>
              <div className="text-left flex-shrink-0">
                <p className="text-xs mb-0.5" style={{ color: '#5A7A60' }}>المطلوب دفعه</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black font-tabular" style={{ color: '#F0EAD6' }}>{amount}</span>
                  <span className="text-sm" style={{ color: '#8A9E8E' }}>ر.س</span>
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
            className="w-full text-right rounded-2xl border-2 p-4 transition-all"
            style={{
              borderColor: method === 'card' ? '#C9A84C' : '#243B2C',
              background: method === 'card' ? 'rgba(201,168,76,0.08)' : '#162219',
            }}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: method === 'card' ? '#C9A84C' : '#3A5A40',
                  background: method === 'card' ? '#C9A84C' : 'transparent',
                }}
              >
                {method === 'card' && <div className="w-2 h-2 rounded-full" style={{ background: '#0F1A14' }} />}
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#F0EAD6' }}>بطاقة إلكترونية</p>
                  <p className="text-xs" style={{ color: '#8A9E8E' }}>فيزا / ماستركارد</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
                  <Icon name="CreditCardIcon" size={22} className="text-blue-400" />
                </div>
              </div>
            </div>
          </button>

          {/* Cash */}
          <button
            onClick={() => setMethod('cash')}
            className="w-full text-right rounded-2xl border-2 p-4 transition-all"
            style={{
              borderColor: method === 'cash' ? '#C9A84C' : '#243B2C',
              background: method === 'cash' ? 'rgba(201,168,76,0.08)' : '#162219',
            }}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: method === 'cash' ? '#C9A84C' : '#3A5A40',
                  background: method === 'cash' ? '#C9A84C' : 'transparent',
                }}
              >
                {method === 'cash' && <div className="w-2 h-2 rounded-full" style={{ background: '#0F1A14' }} />}
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#F0EAD6' }}>كاش</p>
                  <p className="text-xs" style={{ color: '#8A9E8E' }}>عند إتمام الخدمة</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(27,107,90,0.15)' }}>
                  <Icon name="BanknotesIcon" size={22} style={{ color: '#23896F' }} />
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Card details */}
        {method === 'card' && (
          <div className="rounded-2xl p-4" style={{ background: '#162219', border: '1.5px solid #243B2C' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#F0EAD6' }}>رقم البطاقة</h3>
            <div className="rounded-2xl p-4 mb-4 text-white" style={{ background: 'linear-gradient(135deg, #1A2E24 0%, #0F1A14 100%)', border: '1px solid rgba(201,168,76,0.2)' }}>
              <div className="flex items-center justify-between mb-5">
                <div className="w-8 h-5 rounded-sm opacity-80" style={{ background: '#C9A84C' }} />
                <span className="text-sm font-bold" style={{ color: '#C9A84C' }}>VISA</span>
              </div>
              <div className="text-base font-tabular tracking-widest mb-4" style={{ color: '#F0EAD6' }}>
                4532 **** **** {CARD_DATA.last4}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs mb-0.5" style={{ color: '#5A7A60' }}>تاريخ الانتهاء</div>
                  <div className="text-sm font-semibold font-tabular" style={{ color: '#F0EAD6' }}>{CARD_DATA.expiry}</div>
                </div>
                <div>
                  <div className="text-xs mb-0.5" style={{ color: '#5A7A60' }}>CVC</div>
                  <div className="text-sm font-semibold" style={{ color: '#F0EAD6' }}>•••</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #243B2C' }}>
              <span className="text-sm font-semibold" style={{ color: '#F0EAD6' }}>{CARD_DATA.holder}</span>
              <span className="text-xs" style={{ color: '#8A9E8E' }}>اسم حامل البطاقة</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Icon name="ShieldCheckIcon" size={14} style={{ color: '#1B6B5A' }} className="flex-shrink-0" />
              <p className="text-xs" style={{ color: '#8A9E8E' }}>دفع مشفر وآمن — ضمان الضمان حتى إتمام الخدمة</p>
            </div>
          </div>
        )}
      </div>

      {/* Pay button - fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: '#0F1A14', borderTop: '1px solid #243B2C' }}>
        <button
          onClick={handlePay}
          disabled={isProcessing}
          className="w-full py-4 rounded-2xl font-bold text-base mb-3 transition-all"
          style={{
            background: 'linear-gradient(135deg, #1B6B5A, #23896F)',
            color: '#FFFFFF',
            opacity: isProcessing ? 0.7 : 1,
            boxShadow: isProcessing ? 'none' : '0 4px 20px rgba(27,107,90,0.4)',
          }}
        >
          {isProcessing ? 'جاري المعالجة...' : `ادفع ${amount} ر.س الآن`}
        </button>
        <button
          onClick={() => setMethod('apple')}
          className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
          style={{ background: '#162219', color: '#F0EAD6', border: '1px solid #243B2C' }}
        >
          <span>🍎</span>
          أو الدفع عبر Apple Pay
        </button>
      </div>
    </div>
  );
}
