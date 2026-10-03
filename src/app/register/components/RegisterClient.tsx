'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

const SPECIALTIES = [
  { id: 'plumbing', label: 'سباكة', emoji: '🔧' },
  { id: 'electrical', label: 'كهرباء', emoji: '⚡' },
  { id: 'carpentry', label: 'نجارة', emoji: '🪚' },
  { id: 'painting', label: 'دهانات', emoji: '🎨' },
  { id: 'ac', label: 'تكييف', emoji: '❄️' },
  { id: 'cleaning', label: 'تنظيف', emoji: '🧹' },
  { id: 'masonry', label: 'بناء وتشطيب', emoji: '🧱' },
  { id: 'other', label: 'أخرى', emoji: '🔨' },
];

const SERVICE_AREAS = [
  'رام الله',
  'البيرة',
  'بيتونيا',
  'بيت عور',
  'دير دبوان',
  'رافات',
  'سلواد',
  'عين عريك',
  'كفر عين',
  'المزرعة الغربية',
  'أبو قش',
  'بيت نبالا',
  'جفنا',
  'قبيبة',
  'صفا',
  'بيت سيرا',
  'خربثا بني حارث',
  'دير قديس',
  'عبود',
  'نعلين',
];

const PALESTINE_CITIES = [
  'رام الله',
  'البيرة',
  'نابلس',
  'الخليل',
  'بيت لحم',
  'جنين',
  'طولكرم',
  'قلقيلية',
  'أريحا',
  'سلفيت',
  'طوباس',
  'أبو ديس',
  'بيتونيا',
  'بيت جالا',
  'بيت ساحور',
  'دورا',
  'يطا',
  'الظاهرية',
  'حلحول',
  'سعير',
  'ترقوميا',
  'عنبتا',
  'بيت أمين',
  'كفر قاسم',
  'عزون',
  'حارة الشيخ',
];

interface PreviousWork {
  label: string;
  description: string;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { registerUser } = useAuth();
  const supabase = createClient();

  const phone = searchParams.get('phone') || '';
  const role = (searchParams.get('role') as 'customer' | 'craftsman') || 'customer';

  // Common fields
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('رام الله');
  const [neighborhood, setNeighborhood] = useState('');
  const [street, setStreet] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Craftsman-specific fields
  const [specialty, setSpecialty] = useState('');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [services, setServices] = useState<string[]>(['']);
  const [serviceArea, setServiceArea] = useState('');
  const [serviceRadius, setServiceRadius] = useState('10');
  const [previousWorks, setPreviousWorks] = useState<PreviousWork[]>([{ label: '', description: '' }]);
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string; emoji: string }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  useEffect(() => {
    if (role === 'craftsman') {
      supabase
        .from('service_categories')
        .select('id, name, emoji')
        .eq('is_active', true)
        .then(({ data }) => {
          if (data) setCategories(data);
        });
    }
  }, [role]);

  const addService = () => setServices((prev) => [...prev, '']);
  const removeService = (i: number) => setServices((prev) => prev.filter((_, idx) => idx !== i));
  const updateService = (i: number, val: string) =>
    setServices((prev) => prev.map((s, idx) => (idx === i ? val : s)));

  const addWork = () => setPreviousWorks((prev) => [...prev, { label: '', description: '' }]);
  const removeWork = (i: number) => setPreviousWorks((prev) => prev.filter((_, idx) => idx !== i));
  const updateWork = (i: number, field: keyof PreviousWork, val: string) =>
    setPreviousWorks((prev) =>
      prev.map((w, idx) => (idx === i ? { ...w, [field]: val } : w))
    );

  const handleRegister = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('يرجى إدخال الاسم الكامل');
      return;
    }
    if (!city.trim()) {
      setError('يرجى إدخال المدينة');
      return;
    }
    if (role === 'craftsman' && !specialty) {
      setError('يرجى اختيار التخصص');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const addressParts = [street.trim(), neighborhood.trim(), city.trim()].filter(Boolean);
      const location = addressParts.join('، ');

      // Register user (creates auth + user_profiles)
      const signInData = await registerUser(phone, fullName.trim(), role, location);

      // If craftsman, create craftsman_profiles + services + portfolio
      if (role === 'craftsman' && signInData?.user) {
        const userId = signInData.user.id;
        const finalSpecialty = specialty === 'other' ? customSpecialty.trim() : specialty;
        const finalLocation = serviceArea || city.trim();

        // Create craftsman_profiles record
        const { data: craftsmanProfile, error: cpError } = await supabase
          .from('craftsman_profiles')
          .insert({
            user_id: userId,
            specialty: finalSpecialty,
            bio: bio.trim() || null,
            location: finalLocation,
            service_radius_km: parseInt(serviceRadius) || 10,
            experience_years: parseInt(experienceYears) || 0,
          })
          .select('id')
          .single();

        if (cpError) throw cpError;

        const craftsmanId = craftsmanProfile.id;

        // Insert services
        const validServices = services.filter((s) => s.trim());
        if (validServices.length > 0) {
          const serviceRows = validServices.map((name) => ({
            craftsman_id: craftsmanId,
            name: name.trim(),
            category_id: selectedCategoryId || null,
            emoji: '🔧',
          }));
          await supabase.from('craftsman_services').insert(serviceRows);
        }

        // Insert portfolio items (previous work as text descriptions)
        const validWorks = previousWorks.filter((w) => w.label.trim());
        if (validWorks.length > 0) {
          const portfolioRows = validWorks.map((w) => ({
            craftsman_id: craftsmanId,
            image_url: 'https://via.placeholder.com/400x300?text=عمل+سابق',
            label: w.label.trim(),
            description: w.description.trim() || null,
          }));
          await supabase.from('portfolio_items').insert(portfolioRows);
        }
      }

      router.replace('/home-screen');
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة مجدداً');
    } finally {
      setIsLoading(false);
    }
  };

  const roleLabel = role === 'craftsman' ? 'صنايعي' : 'زبون';
  const roleEmoji = role === 'craftsman' ? '🔧' : '👤';
  const canSubmit =
    fullName.trim().length >= 2 &&
    city.trim() &&
    (role !== 'craftsman' || specialty);

  return (
    <div className="screen-container flex flex-col min-h-screen bg-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <Icon name="ChevronRightIcon" size={20} className="text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">إنشاء حساب جديد</h1>
      </div>

      <div className="flex-1 px-5 pt-2 pb-6 flex flex-col overflow-y-auto">
        {/* Welcome */}
        <div className="text-center mb-6 mt-4">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">{roleEmoji}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">أهلاً بك!</h2>
          <p className="text-sm text-gray-500">
            رقمك غير مسجل، أنشئ حسابك كـ{' '}
            <span className="font-semibold text-primary">{roleLabel}</span>
          </p>
        </div>

        {/* Phone display (read-only) */}
        <div className="mb-4">
          <label className="text-sm font-semibold text-gray-700 block mb-2">رقم الجوال</label>
          <div className="py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 font-tabular" dir="ltr">
            {phone}
          </div>
        </div>

        {/* Role display (read-only) */}
        <div className="mb-4">
          <label className="text-sm font-semibold text-gray-700 block mb-2">نوع الحساب</label>
          <div className="py-3.5 px-4 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary font-semibold flex items-center gap-2">
            <span>{roleEmoji}</span>
            <span>{roleLabel}</span>
          </div>
        </div>

        {/* Full name input */}
        <div className="mb-4">
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            الاسم الكامل <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setError(''); }}
            placeholder="أدخل اسمك الكامل"
            className="w-full py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary"
            autoFocus
          />
        </div>

        {/* Address Section */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="MapPinIcon" size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-gray-800">العنوان</h3>
          </div>

          <div className="mb-3">
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              المدينة / المنطقة <span className="text-red-500">*</span>
            </label>
            <select
              value={city}
              onChange={(e) => { setCity(e.target.value); setError(''); }}
              className="w-full py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-primary"
            >
              <option value=""></option>
              {PALESTINE_CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="text-sm font-semibold text-gray-700 block mb-2">الحي / المنطقة</label>
            <input
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder=""
              className="w-full py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">الشارع / التفاصيل</label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder=""
              className="w-full py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* ===== CRAFTSMAN-SPECIFIC FIELDS ===== */}
        {role === 'craftsman' && (
          <>
            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">معلومات الصنايعي</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Specialty / Category */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="WrenchScrewdriverIcon" size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-gray-800">
                  التخصص <span className="text-red-500">*</span>
                </h3>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {SPECIALTIES.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => { setSpecialty(sp.id); setError(''); }}
                    className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 transition-all ${
                      specialty === sp.id
                        ? 'border-primary bg-primary/10' :'border-gray-200 bg-white'
                    }`}
                  >
                    <span className="text-xl">{sp.emoji}</span>
                    <span className={`text-xs font-medium leading-tight text-center ${specialty === sp.id ? 'text-primary' : 'text-gray-600'}`}>
                      {sp.label}
                    </span>
                  </button>
                ))}
              </div>
              {specialty === 'other' && (
                <input
                  type="text"
                  value={customSpecialty}
                  onChange={(e) => setCustomSpecialty(e.target.value)}
                  placeholder="اكتب تخصصك..."
                  className="w-full py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary"
                />
              )}
            </div>

            {/* Category (from DB) */}
            {categories.length > 0 && (
              <div className="mb-4">
                <label className="text-sm font-semibold text-gray-700 block mb-2">فئة الخدمة</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-primary"
                >
                  <option value="">اختر الفئة (اختياري)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.emoji} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Services Offered */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon name="ClipboardDocumentListIcon" size={16} className="text-primary" />
                  <h3 className="text-sm font-bold text-gray-800">الخدمات المقدمة</h3>
                </div>
                <button
                  type="button"
                  onClick={addService}
                  className="text-xs text-primary font-semibold flex items-center gap-1"
                >
                  <Icon name="PlusIcon" size={14} className="text-primary" />
                  إضافة
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {services.map((svc, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={svc}
                      onChange={(e) => updateService(i, e.target.value)}
                      placeholder={`مثال: تركيب أنابيب، إصلاح تسرب...`}
                      className="flex-1 py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary"
                    />
                    {services.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeService(i)}
                        className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0"
                      >
                        <Icon name="XMarkIcon" size={14} className="text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Service Area */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="MapIcon" size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-gray-800">منطقة الخدمة</h3>
              </div>
              <select
                value={serviceArea}
                onChange={(e) => setServiceArea(e.target.value)}
                className="w-full py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-primary mb-3"
              >
                <option value="">اختر المنطقة الرئيسية</option>
                {SERVICE_AREAS.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  نطاق الخدمة (كم)
                </label>
                <div className="flex gap-2">
                  {['5', '10', '20', '30', '50'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setServiceRadius(r)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                        serviceRadius === r
                          ? 'border-primary bg-primary/10 text-primary' :'border-gray-200 text-gray-500'
                      }`}
                    >
                      {r} كم
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Experience */}
            <div className="mb-4">
              <label className="text-sm font-semibold text-gray-700 block mb-2">سنوات الخبرة</label>
              <div className="flex gap-2">
                {['1', '2', '3', '5', '10+'].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setExperienceYears(yr === '10+' ? '10' : yr)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                      experienceYears === (yr === '10+' ? '10' : yr)
                        ? 'border-primary bg-primary/10 text-primary' :'border-gray-200 text-gray-500'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            {/* Bio */}
            <div className="mb-4">
              <label className="text-sm font-semibold text-gray-700 block mb-2">نبذة عنك (اختياري)</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="اكتب نبذة مختصرة عن خبرتك وأسلوب عملك..."
                rows={3}
                className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Previous Work */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon name="PhotoIcon" size={16} className="text-primary" />
                  <h3 className="text-sm font-bold text-gray-800">الأعمال السابقة</h3>
                </div>
                <button
                  type="button"
                  onClick={addWork}
                  className="text-xs text-primary font-semibold flex items-center gap-1"
                >
                  <Icon name="PlusIcon" size={14} className="text-primary" />
                  إضافة
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {previousWorks.map((work, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500">عمل #{i + 1}</span>
                      {previousWorks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWork(i)}
                          className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center"
                        >
                          <Icon name="XMarkIcon" size={12} className="text-red-500" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={work.label}
                      onChange={(e) => updateWork(i, 'label', e.target.value)}
                      placeholder="عنوان العمل (مثال: تركيب حمام كامل)"
                      className="w-full py-2.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary mb-2"
                    />
                    <textarea
                      value={work.description}
                      onChange={(e) => updateWork(i, 'description', e.target.value)}
                      placeholder="وصف مختصر للعمل (اختياري)"
                      rows={2}
                      className="w-full py-2.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {error && (
          <p className="text-red-500 text-xs mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}

        {/* Register button */}
        <button
          onClick={handleRegister}
          disabled={isLoading || !canSubmit}
          className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all"
          style={{ background: '#2a724d', opacity: (!canSubmit || isLoading) ? 0.6 : 1 }}
        >
          {isLoading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-5 flex items-center justify-center gap-1">
          <Icon name="LockClosedIcon" size={12} className="text-gray-400" />
          سيتم حفظ بياناتك بشكل آمن
        </p>
      </div>
    </div>
  );
}

export default function RegisterClient() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
