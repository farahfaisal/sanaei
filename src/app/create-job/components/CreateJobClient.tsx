'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createOpenJob, JobUrgency } from '@/lib/supabase/marketplace';

const BRAND = {
  primary: '#2a724d',
  accent: '#1d5236',
  gradient: 'linear-gradient(145deg, #1d5236 0%, #2a724d 45%, #358f61 100%)',
  light: 'rgba(42,114,77,0.10)',
};

interface ServiceCategory {
  id: string;
  name: string;
  emoji: string;
}

const URGENCY_OPTIONS: { key: JobUrgency; label: string; desc: string; icon: string; color: string }[] = [
  { key: 'normal', label: 'عادي', desc: 'خلال يومين', icon: 'ClockIcon', color: '#6B7280' },
  { key: 'urgent', label: 'عاجل', desc: 'اليوم', icon: 'BoltIcon', color: '#DC2626' },
  { key: 'scheduled', label: 'مجدول', desc: 'تاريخ محدد', icon: 'CalendarDaysIcon', color: '#0284C7' },
];

export default function CreateJobClient() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  // Form state
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [urgency, setUrgency] = useState<JobUrgency>('normal');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 16);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/phone-login-otp-verification');
      return;
    }
    loadCategories();
  }, [user, authLoading]);

  const loadCategories = async () => {
    setLoadingCats(true);
    const { data } = await supabase
      .from('service_categories')
      .select('id, name, emoji')
      .order('name');
    setCategories(data ?? []);
    setLoadingCats(false);
  };

  const handleCategorySelect = (cat: ServiceCategory) => {
    setSelectedCategoryId(cat.id);
    if (!serviceType) setServiceType(cat.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!serviceType.trim()) { setError('يرجى تحديد نوع الخدمة'); return; }
    if (!description.trim()) { setError('يرجى كتابة وصف المشكلة'); return; }
    if (!address.trim()) { setError('يرجى إدخال العنوان'); return; }
    if (urgency === 'scheduled' && !scheduledAt) { setError('يرجى تحديد التاريخ والوقت'); return; }

    setIsSubmitting(true);
    try {
      const result = await createOpenJob(user!.id, {
        serviceType: serviceType.trim(),
        categoryId: selectedCategoryId || undefined,
        description: description.trim(),
        address: address.trim(),
        city: city.trim() || undefined,
        urgency,
        scheduledAt: urgency === 'scheduled' ? scheduledAt : undefined,
      });

      if (!result) {
        setError('حدث خطأ أثناء إنشاء الطلب. حاول مجدداً.');
      } else {
        setCreatedJobId(result.id);
        setSuccess(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success && createdJobId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" dir="rtl"
        style={{ background: 'linear-gradient(160deg, #f0faf4 0%, #e8f5ee 100%)' }}>
        <div className="w-full max-w-sm text-center">
          {/* Success icon */}
          <div className="mx-auto mb-6 flex items-center justify-center w-24 h-24 rounded-full"
            style={{ background: BRAND.gradient, boxShadow: '0 12px 40px rgba(42,114,77,0.35)' }}>
            <Icon name="CheckIcon" size={44} className="text-white" variant="solid" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: BRAND.accent }}>تم إرسال طلبك!</h2>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            سيتواصل معك الصنايعية المتاحون قريباً. يمكنك متابعة حالة طلبك من صفحة طلباتي.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/my-requests')}
              className="w-full py-3.5 rounded-2xl text-white font-bold text-base"
              style={{ background: BRAND.gradient, boxShadow: '0 6px 20px rgba(42,114,77,0.3)' }}
            >
              متابعة طلباتي
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setCreatedJobId(null);
                setServiceType('');
                setSelectedCategoryId('');
                setDescription('');
                setAddress('');
                setCity('');
                setUrgency('normal');
                setScheduledAt('');
              }}
              className="w-full py-3.5 rounded-2xl font-bold text-base border"
              style={{ color: BRAND.primary, borderColor: BRAND.primary, background: 'white' }}
            >
              إنشاء طلب جديد
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10" dir="rtl"
      style={{ background: 'linear-gradient(160deg, #f0faf4 0%, #e8f5ee 100%)' }}>

      {/* Header */}
      <div className="sticky top-0 z-50 px-4 pt-4 pb-3"
        style={{ background: 'rgba(240,250,244,0.92)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-2xl"
            style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <Icon name="ArrowRightIcon" size={20} style={{ color: BRAND.primary }} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ color: BRAND.accent }}>طلب خدمة جديد</h1>
            <p className="text-xs text-gray-400">أخبرنا بما تحتاجه</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 pt-2 max-w-lg mx-auto space-y-5">

        {/* Service Categories */}
        <div className="rounded-3xl p-5" style={{ background: 'white', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <label className="block text-sm font-bold mb-3" style={{ color: BRAND.accent }}>
            نوع الخدمة <span className="text-red-500">*</span>
          </label>

          {loadingCats ? (
            <div className="grid grid-cols-4 gap-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat)}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-2xl transition-all duration-200"
                    style={{
                      background: isSelected ? BRAND.light : '#f9fafb',
                      border: `1.5px solid ${isSelected ? BRAND.primary : 'transparent'}`,
                      boxShadow: isSelected ? `0 2px 10px rgba(42,114,77,0.18)` : 'none',
                    }}
                  >
                    <span className="text-xl">{cat.emoji}</span>
                    <span className="text-xs font-medium text-center leading-tight"
                      style={{ color: isSelected ? BRAND.primary : '#6B7280', fontSize: '10px' }}>
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <input
            type="text"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            placeholder="أو اكتب نوع الخدمة يدوياً..."
            className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
            style={{
              background: '#f9fafb',
              border: '1.5px solid #e5e7eb',
              color: '#1f2937',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => { e.target.style.borderColor = BRAND.primary; }}
            onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
          />
        </div>

        {/* Description */}
        <div className="rounded-3xl p-5" style={{ background: 'white', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <label className="block text-sm font-bold mb-3" style={{ color: BRAND.accent }}>
            وصف المشكلة <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="اشرح المشكلة بالتفصيل... مثال: الحنفية تسرب ماء منذ يومين"
            rows={4}
            className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none transition-all"
            style={{
              background: '#f9fafb',
              border: '1.5px solid #e5e7eb',
              color: '#1f2937',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => { e.target.style.borderColor = BRAND.primary; }}
            onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
          />
          <p className="text-xs text-gray-400 mt-1.5 text-left">{description.length}/500</p>
        </div>

        {/* Location */}
        <div className="rounded-3xl p-5" style={{ background: 'white', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <label className="block text-sm font-bold mb-3" style={{ color: BRAND.accent }}>
            الموقع <span className="text-red-500">*</span>
          </label>
          <div className="space-y-3">
            <div className="relative">
              <Icon name="MapPinIcon" size={18} className="absolute top-3.5 right-3.5 pointer-events-none"
                style={{ color: BRAND.primary }} />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="العنوان التفصيلي (الحي، الشارع، رقم المنزل)"
                className="w-full pr-10 pl-4 py-3 rounded-2xl text-sm outline-none transition-all"
                style={{
                  background: '#f9fafb',
                  border: '1.5px solid #e5e7eb',
                  color: '#1f2937',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => { e.target.style.borderColor = BRAND.primary; }}
                onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
              />
            </div>
            <div className="relative">
              <Icon name="BuildingOfficeIcon" size={18} className="absolute top-3.5 right-3.5 pointer-events-none"
                style={{ color: '#9CA3AF' }} />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="المدينة (اختياري)"
                className="w-full pr-10 pl-4 py-3 rounded-2xl text-sm outline-none transition-all"
                style={{
                  background: '#f9fafb',
                  border: '1.5px solid #e5e7eb',
                  color: '#1f2937',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => { e.target.style.borderColor = BRAND.primary; }}
                onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
              />
            </div>
          </div>
        </div>

        {/* Urgency */}
        <div className="rounded-3xl p-5" style={{ background: 'white', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <label className="block text-sm font-bold mb-3" style={{ color: BRAND.accent }}>
            مستوى الاستعجال
          </label>
          <div className="grid grid-cols-3 gap-2">
            {URGENCY_OPTIONS.map((opt) => {
              const isSelected = urgency === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setUrgency(opt.key)}
                  className="flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl transition-all duration-200"
                  style={{
                    background: isSelected ? `${opt.color}15` : '#f9fafb',
                    border: `1.5px solid ${isSelected ? opt.color : 'transparent'}`,
                    boxShadow: isSelected ? `0 2px 10px ${opt.color}25` : 'none',
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: isSelected ? `${opt.color}20` : '#e5e7eb' }}>
                    <Icon name={opt.icon as never} size={18}
                      style={{ color: isSelected ? opt.color : '#9CA3AF' }} variant="solid" />
                  </div>
                  <span className="text-xs font-bold" style={{ color: isSelected ? opt.color : '#6B7280' }}>
                    {opt.label}
                  </span>
                  <span className="text-xs" style={{ color: '#9CA3AF', fontSize: '10px' }}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>

          {urgency === 'scheduled' && (
            <div className="mt-3">
              <input
                type="datetime-local"
                value={scheduledAt}
                min={today}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                style={{
                  background: '#f9fafb',
                  border: `1.5px solid ${scheduledAt ? BRAND.primary : '#e5e7eb'}`,
                  color: '#1f2937',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
            style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
            <Icon name="ExclamationCircleIcon" size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all duration-200 flex items-center justify-center gap-2"
          style={{
            background: isSubmitting ? '#9CA3AF' : BRAND.gradient,
            boxShadow: isSubmitting ? 'none' : '0 8px 24px rgba(42,114,77,0.35)',
          }}
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>جاري الإرسال...</span>
            </>
          ) : (
            <>
              <Icon name="PaperAirplaneIcon" size={20} variant="solid" />
              <span>إرسال الطلب</span>
            </>
          )}
        </button>

      </form>
    </div>
  );
}
