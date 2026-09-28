'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';

const BRAND = {
  primary: '#2a724d',
  light: 'rgba(42,114,77,0.12)',
};

interface RatingModalProps {
  orderId: string;
  craftsmanId: string;
  craftsmanName: string;
  craftsmanAvatar: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const STAR_LABELS = ['', 'سيء', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'];

export default function RatingModal({
  orderId,
  craftsmanId,
  craftsmanName,
  craftsmanAvatar,
  onClose,
  onSuccess,
}: RatingModalProps) {
  const supabase = createClient();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeRating = hovered || rating;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('يرجى اختيار تقييم');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('يجب تسجيل الدخول أولاً'); setSaving(false); return; }

      // Check if already reviewed
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', orderId)
        .eq('customer_id', user.id)
        .maybeSingle();

      if (existing) {
        setError('لقد قمت بتقييم هذا الطلب مسبقاً');
        setSaving(false);
        return;
      }

      const { error: insertError } = await supabase.from('reviews').insert({
        order_id: orderId,
        customer_id: user.id,
        craftsman_id: craftsmanId,
        rating,
        comment: comment.trim() || null,
      });

      if (insertError) {
        setError('حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى');
        setSaving(false);
        return;
      }

      onSuccess();
    } catch {
      setError('حدث خطأ غير متوقع');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-6 pb-10"
        style={{ background: 'var(--card)', maxHeight: '90vh', overflowY: 'auto' }}
        dir="rtl"
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border)' }} />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>تقييم الصنايعي</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--muted)' }}
          >
            <Icon name="XMarkIcon" size={16} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Craftsman info */}
        <div className="flex items-center gap-3 mb-6 p-3 rounded-2xl" style={{ background: 'var(--background)' }}>
          <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: `2px solid ${BRAND.primary}30` }}>
            {craftsmanAvatar ? (
              <AppImage src={craftsmanAvatar} alt={`صورة ${craftsmanName}`} width={56} height={56} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: BRAND.light }}>
                <Icon name="UserCircleIcon" size={28} style={{ color: BRAND.primary }} />
              </div>
            )}
          </div>
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--foreground)' }}>{craftsmanName}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>كيف كانت تجربتك معه؟</p>
          </div>
        </div>

        {/* Stars */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="transition-transform active:scale-90"
                style={{ transform: activeRating >= star ? 'scale(1.15)' : 'scale(1)' }}
              >
                <Icon
                  name="StarIcon"
                  size={40}
                  variant={activeRating >= star ? 'solid' : 'outline'}
                  style={{ color: activeRating >= star ? '#F59E0B' : 'var(--border)' }}
                />
              </button>
            ))}
          </div>
          {activeRating > 0 && (
            <p className="text-sm font-semibold" style={{ color: '#F59E0B' }}>
              {STAR_LABELS[activeRating]}
            </p>
          )}
        </div>

        {/* Comment */}
        <div className="mb-5">
          <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            تعليق (اختياري)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="شاركنا تجربتك مع هذا الصنايعي..."
            rows={3}
            maxLength={500}
            className="w-full rounded-xl p-3 text-sm resize-none outline-none"
            style={{
              background: 'var(--background)',
              border: '1.5px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
          <p className="text-xs mt-1 text-left" style={{ color: 'var(--muted-foreground)' }}>
            {comment.length}/500
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl mb-4 text-sm"
            style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}
          >
            <Icon name="ExclamationCircleIcon" size={16} />
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving || rating === 0}
          className="w-full py-3.5 rounded-2xl font-bold text-white text-base transition-opacity"
          style={{
            background: rating === 0 ? 'var(--muted)' : BRAND.primary,
            color: rating === 0 ? 'var(--muted-foreground)' : '#fff',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              جاري الحفظ...
            </span>
          ) : (
            'إرسال التقييم'
          )}
        </button>
      </div>
    </div>
  );
}
