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
    <div className="screen-container flex flex-col min-h-screen" style={{ background: '#0F1A14' }} dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => step === 'otp' ? setStep('phone') : router.push('/')}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#1A2E24' }}
        >
          <Icon name="ChevronRightIcon" size={20} style={{ color: '#F0EAD6' }} />
        </button>
        <h1 className="text-lg font-bold" style={{ color: '#F0EAD6' }}>
          {step === 'phone' ? 'تسجيل الدخول' : 'تحقق من رقمك'}
        </h1>
      </div>

      <div className="flex-1 px-5 pt-2 pb-6 flex flex-col">
        {step === 'phone' ? (
          <>
            {/* Welcome */}
            <div className="text-center mb-8 mt-4">
              <div className="w-28 h-28 mx-auto mb-4 flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-full blur-2xl opacity-20" style={{ background: '#C9A84C' }} />
                <img
                  src="/assets/images/__________________24_-1790287739442.png"
                  alt="شعار صنايعي"
                  className="w-full h-full object-contain relative z-10"
                />
              </div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: '#F0EAD6' }}>أهلاً بك</h2>
              <p className="text-sm" style={{ color: '#8A9E8E' }}>أدخل رقم جوالك للمتابعة</p>
            </div>

            {/* Role selection */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setSelectedRole('customer')}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                style={{
                  borderColor: selectedRole === 'customer' ? '#C9A84C' : '#243B2C',
                  background: selectedRole === 'customer' ? 'rgba(201,168,76,0.1)' : '#162219',
                  color: selectedRole === 'customer' ? '#C9A84C' : '#8A9E8E',
                }}
              >
                👤 زبون
              </button>
              <button
                onClick={() => setSelectedRole('craftsman')}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                style={{
                  borderColor: selectedRole === 'craftsman' ? '#C9A84C' : '#243B2C',
                  background: selectedRole === 'craftsman' ? 'rgba(201,168,76,0.1)' : '#162219',
                  color: selectedRole === 'craftsman' ? '#C9A84C' : '#8A9E8E',
                }}
              >
                🔧 صنايعي
              </button>
            </div>

            {/* Phone input */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold" style={{ color: '#8A9E8E' }}>رقم الجوال</label>
                <label className="text-sm font-semibold" style={{ color: '#8A9E8E' }}>الدولة</label>
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
                  className="flex-1 py-3.5 px-4 rounded-xl text-sm outline-none"
                  style={{
                    background: '#1A2E24',
                    border: '1.5px solid #243B2C',
                    color: '#F0EAD6',
                  }}
                  dir="ltr"
                  maxLength={10}
                />
                <div className="relative">
                  <button
                    onClick={() => setShowCountryPicker(!showCountryPicker)}
                    className="flex items-center gap-1.5 px-3 py-3.5 rounded-xl text-sm font-medium whitespace-nowrap"
                    style={{ background: '#1A2E24', border: '1.5px solid #243B2C', color: '#F0EAD6' }}
                  >
                    <Icon name="ChevronDownIcon" size={14} style={{ color: '#8A9E8E' }} />
                    <span className="font-tabular text-sm">{selectedCountry.code}</span>
                    <span>{selectedCountry.flag}</span>
                  </button>

                  {showCountryPicker && (
                    <div className="absolute top-full mt-1 left-0 rounded-xl shadow-lg z-50 min-w-44 overflow-hidden" style={{ background: '#162219', border: '1.5px solid #243B2C' }}>
                      {COUNTRY_CODES.map((c) => (
                        <button
                          key={`country-${c.code}`}
                          onClick={() => {
                            setSelectedCountry(c);
                            setShowCountryPicker(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-right"
                          style={{
                            background: c.code === selectedCountry.code ? 'rgba(201,168,76,0.1)' : 'transparent',
                            color: c.code === selectedCountry.code ? '#C9A84C' : '#F0EAD6',
                          }}
                        >
                          <span>{c.flag}</span>
                          <span className="flex-1">{c.name}</span>
                          <span className="font-tabular" style={{ color: '#8A9E8E' }}>{c.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-xs mt-2">{error}</p>
              )}
            </div>

            {/* Send OTP button */}
            <button
              onClick={handleSendOtp}
              disabled={isLoading || !phone}
              className="w-full py-4 rounded-2xl font-bold text-base mb-5 transition-all"
              style={{
                background: 'linear-gradient(135deg, #1B6B5A 0%, #23896F 100%)',
                color: '#FFFFFF',
                opacity: (!phone || isLoading) ? 0.6 : 1,
                boxShadow: (!phone || isLoading) ? 'none' : '0 4px 20px rgba(27,107,90,0.4)',
              }}
            >
              {isLoading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
            </button>

            {/* Demo accounts */}
            <div className="rounded-2xl p-4" style={{ background: '#162219', border: '1.5px solid #243B2C' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#C9A84C' }}>
                  <span className="text-xs font-bold" style={{ color: '#0F1A14' }}>!</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: '#C9A84C' }}>أرقام تجريبية</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-tabular" style={{ color: '#23896F' }}>+970599000001</span>
                  <span className="text-xs" style={{ color: '#8A9E8E' }}>زبون: </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-tabular font-semibold" style={{ color: '#23896F' }}>+970599000002</span>
                  <span className="text-xs" style={{ color: '#8A9E8E' }}>صنايعي: </span>
                </div>
                <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid #243B2C' }}>
                  <span className="text-xs font-bold font-tabular" style={{ color: '#C9A84C' }}>123456</span>
                  <span className="text-xs" style={{ color: '#8A9E8E' }}>رمز التحقق: </span>
                </div>
              </div>
            </div>

            <p className="text-center text-xs mt-4 flex items-center justify-center gap-1" style={{ color: '#5A7A60' }}>
              <Icon name="LockClosedIcon" size={12} style={{ color: '#5A7A60' }} />
              الدخول برقم جوالك ورمز التحقق فقط — بدون كلمات مرور
            </p>
          </>
        ) : (
          <>
            {/* OTP step */}
            <div className="text-center mb-8 mt-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(27,107,90,0.2)', border: '2px solid #1B6B5A' }}>
                <Icon name="ShieldCheckIcon" size={32} style={{ color: '#C9A84C' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#F0EAD6' }}>تحقق من رقم جوالك</h2>
              <p className="text-sm mb-1" style={{ color: '#8A9E8E' }}>
                أدخل الرمز المرسل إلى{' '}
                <span className="font-semibold font-tabular" style={{ color: '#F0EAD6' }}>{maskedPhone}</span>
              </p>
              <button
                onClick={() => setStep('phone')}
                className="text-sm font-semibold"
                style={{ color: '#C9A84C' }}
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
                  className="w-12 h-14 text-center text-xl font-bold rounded-xl outline-none transition-all"
                  style={{
                    border: `2px solid ${digit ? '#C9A84C' : '#243B2C'}`,
                    background: digit ? 'rgba(201,168,76,0.1)' : '#1A2E24',
                    color: digit ? '#C9A84C' : '#F0EAD6',
                  }}
                />
              ))}
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center mb-4">{error}</p>
            )}

            {/* Timer */}
            <div className="flex items-center justify-center gap-3 mb-6">
              {!canResend ? (
                <div className="flex items-center gap-2">
                  <svg width="32" height="32" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="13" fill="none" stroke="#243B2C" strokeWidth="2.5" />
                    <circle
                      cx="16" cy="16" r="13" fill="none"
                      stroke="#C9A84C" strokeWidth="2.5"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 16 16)"
                    />
                    <text x="16" y="20" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#C9A84C">
                      {countdown}
                    </text>
                  </svg>
                  <span className="text-sm" style={{ color: '#8A9E8E' }}>إعادة الإرسال بعد {countdown} ثانية</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCanResend(false);
                    setCountdown(42);
                    handleSendOtp();
                  }}
                  className="text-sm font-semibold"
                  style={{ color: '#C9A84C' }}
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
              style={{
                background: 'linear-gradient(135deg, #1B6B5A 0%, #23896F 100%)',
                opacity: (isLoading || otp.join('').length < 6) ? 0.6 : 1,
                boxShadow: (isLoading || otp.join('').length < 6) ? 'none' : '0 4px 20px rgba(27,107,90,0.4)',
              }}
            >
              {isLoading ? 'جاري التحقق...' : 'تأكيد'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}