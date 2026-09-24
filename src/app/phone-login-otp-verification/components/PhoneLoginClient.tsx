'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const COUNTRY_CODES = [
  { code: '+970', flag: '🇵🇸', name: 'فلسطين' },
  { code: '+966', flag: '🇸🇦', name: 'السعودية' },
  { code: '+971', flag: '🇦🇪', name: 'الإمارات' },
  { code: '+962', flag: '🇯🇴', name: 'الأردن' },
  { code: '+965', flag: '🇰🇼', name: 'الكويت' },
];

export default function PhoneLoginClient() {
  const router = useRouter();
  const { sendOtp, verifyOtp, user, loading } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(42);
  const [isLoading, setIsLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<'customer' | 'craftsman'>('customer');

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace('/home-screen');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (step === 'otp') {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  const fullPhone = `${selectedCountry.code}${phone}`;

  const handleSendOtp = async () => {
    if (!phone || phone.length < 9) {
      setError('يرجى إدخال رقم جوال صحيح');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await sendOtp(fullPhone);
      setStep('otp');
      setCountdown(42);
      setCanResend(false);
    } catch (err: any) {
      setError(err?.message || 'فشل إرسال رمز التحقق، يرجى المحاولة مجدداً');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setError('يرجى إدخال رمز التحقق كاملاً');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await verifyOtp(fullPhone, code, selectedRole);
      router.push('/home-screen');
    } catch (err: any) {
      setError(err?.message || 'رمز التحقق غير صحيح، يرجى المحاولة مجدداً');
    } finally {
      setIsLoading(false);
    }
  };

  const maskedPhone = phone
    ? `${selectedCountry.code}${phone.slice(0, 3)}***${phone.slice(-3)}`
    : '';

  const circumference = 2 * Math.PI * 13;
  const dashOffset = circumference - (countdown / 42) * circumference;

  return (
    <div className="screen-container flex flex-col min-h-screen bg-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => step === 'otp' ? setStep('phone') : router.push('/')}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <Icon name="ChevronRightIcon" size={20} className="text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">
          {step === 'phone' ? 'تسجيل الدخول' : 'تحقق من رقمك'}
        </h1>
      </div>

      <div className="flex-1 px-5 pt-2 pb-6 flex flex-col">
        {step === 'phone' ? (
          <>
            {/* Welcome */}
            <div className="text-center mb-8 mt-4">
              <div className="w-28 h-28 mx-auto mb-4 flex items-center justify-center">
                <img
                  src="/assets/images/__________________24_-1790287739442.png"
                  alt="شعار صنايعي"
                  className="w-full h-full object-contain"
                />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">أهلاً بك</h2>
              <p className="text-sm text-gray-500">أدخل رقم جوالك للمتابعة</p>
            </div>

            {/* Role selection */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setSelectedRole('customer')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                  selectedRole === 'customer' ?'border-primary bg-green-50 text-primary' :'border-gray-200 text-gray-500'
                }`}
              >
                👤 زبون
              </button>
              <button
                onClick={() => setSelectedRole('craftsman')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                  selectedRole === 'craftsman' ?'border-primary bg-green-50 text-primary' :'border-gray-200 text-gray-500'
                }`}
              >
                🔧 صنايعي
              </button>
            </div>

            {/* Phone input */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">رقم الجوال</label>
                <label className="text-sm font-semibold text-gray-700">الدولة</label>
              </div>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, ''));
                    setError('');
                  }}
                  placeholder="0599 XXX XXX"
                  className="flex-1 py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary"
                  dir="ltr"
                  style={{ textAlign: 'left' }}
                  maxLength={10}
                />
                <div className="relative">
                  <button
                    onClick={() => setShowCountryPicker(!showCountryPicker)}
                    className="flex items-center gap-1.5 px-3 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium whitespace-nowrap"
                  >
                    <Icon name="ChevronDownIcon" size={14} className="text-gray-400" />
                    <span className="font-tabular text-sm text-gray-700">{selectedCountry.code}</span>
                    <span>{selectedCountry.flag}</span>
                  </button>

                  {showCountryPicker && (
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-44 overflow-hidden">
                      {COUNTRY_CODES.map((c) => (
                        <button
                          key={`country-${c.code}`}
                          onClick={() => {
                            setSelectedCountry(c);
                            setShowCountryPicker(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition-colors text-right ${
                            c.code === selectedCountry.code ? 'bg-green-50 text-primary font-semibold' : ''
                          }`}
                        >
                          <span>{c.flag}</span>
                          <span className="flex-1">{c.name}</span>
                          <span className="font-tabular text-gray-400">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-xs mt-2">{error}</p>
              )}
            </div>

            {/* Send OTP button */}
            <button
              onClick={handleSendOtp}
              disabled={isLoading || !phone}
              className="w-full py-4 rounded-2xl font-bold text-white text-base mb-5 transition-all"
              style={{ background: '#1B5E20', opacity: (!phone || isLoading) ? 0.6 : 1 }}
            >
              {isLoading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
            </button>

            {/* Demo accounts */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <span className="text-xs font-semibold text-gray-700">أرقام تجريبية</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-tabular">+970599000001</span>
                  <span className="text-xs text-gray-500">زبون: </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-primary font-tabular font-semibold">+970599000002</span>
                  <span className="text-xs text-gray-500">صنايعي: </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                  <span className="text-xs font-bold text-primary font-tabular">123456</span>
                  <span className="text-xs text-gray-500">رمز التحقق: </span>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
              <Icon name="LockClosedIcon" size={12} className="text-gray-400" />
              الدخول برقم جوالك ورمز التحقق فقط — بدون كلمات مرور
            </p>
          </>
        ) : (
          <>
            {/* OTP step */}
            <div className="text-center mb-8 mt-4">
              <div className="w-16 h-16 rounded-2xl bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-5">
                <Icon name="ShieldCheckIcon" size={32} className="text-primary" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">تحقق من رقم جوالك</h2>
              <p className="text-sm text-gray-500 mb-1">
                أدخل الرمز المرسل إلى{' '}
                <span className="font-semibold text-gray-800 font-tabular">{maskedPhone}</span>
              </p>
              <button
                onClick={() => setStep('phone')}
                className="text-primary text-sm font-semibold"
              >
                تغيير الرقم
              </button>
            </div>

            {/* OTP inputs */}
            <div className="flex gap-2 justify-center mb-6" dir="ltr">
              {otp.map((digit, i) => (
                <input
                  key={`otp-${i}`}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all ${
                    digit ? 'border-primary bg-green-50 text-primary' : 'border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-red-500 text-xs text-center mb-4">{error}</p>
            )}

            {/* Timer */}
            <div className="flex items-center justify-center gap-3 mb-6">
              {!canResend ? (
                <div className="flex items-center gap-2">
                  <svg width="32" height="32" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="13" fill="none" stroke="#E5E7EB" strokeWidth="2.5" />
                    <circle
                      cx="16" cy="16" r="13" fill="none"
                      stroke="#1B5E20" strokeWidth="2.5"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 16 16)"
                    />
                    <text x="16" y="20" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1B5E20">
                      {countdown}
                    </text>
                  </svg>
                  <span className="text-sm text-gray-500">إعادة الإرسال بعد {countdown} ثانية</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCanResend(false);
                    setCountdown(42);
                    handleSendOtp();
                  }}
                  className="text-primary text-sm font-semibold"
                >
                  إعادة إرسال الرمز
                </button>
              )}
            </div>

            {/* Verify button */}
            <button
              onClick={handleVerify}
              disabled={isLoading || otp.join('').length < 6}
              className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all"
              style={{ background: '#1B5E20', opacity: (isLoading || otp.join('').length < 6) ? 0.6 : 1 }}
            >
              {isLoading ? 'جاري التحقق...' : 'تأكيد'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}