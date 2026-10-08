'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface BroadcastResult {
  sent: number;
  total: number;
  failed: number;
}

export default function BroadcastTab() {
  const supabase = createClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;

    setIsSending(true);
    setResult(null);
    setError(null);

    try {
      // The database saves an in-app notification for every active user and
      // pushes it to their phones (FCM) and browsers (Web Push). Admins only.
      const { data: count, error: rpcErr } = await supabase.rpc('broadcast_notification', {
        p_title: title.trim(),
        p_body: message.trim(),
        p_role: null,
      });
      if (rpcErr) throw new Error(rpcErr.message);

      const sent = typeof count === 'number' ? count : 0;
      setResult({ sent, total: sent, failed: 0 });
      setTitle('');
      setMessage('');
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء الإرسال');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg">
          <Icon name="BellAlertIcon" size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">إرسال إشعار جماعي</h2>
          <p className="text-xs text-gray-400">أرسل إشعاراً لجميع المستخدمين المشتركين</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            عنوان الإشعار <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: عرض خاص لفترة محدودة"
            maxLength={80}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500 transition-colors"
            dir="rtl"
          />
          <p className="text-xs text-gray-500 mt-1 text-left">{title.length}/80</p>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            نص الإشعار <span className="text-red-400">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب نص الإشعار هنا..."
            maxLength={200}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
            dir="rtl"
          />
          <p className="text-xs text-gray-500 mt-1 text-left">{message.length}/200</p>
        </div>

        {/* Preview */}
        {(title || message) && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <Icon name="EyeIcon" size={12} />
              معاينة الإشعار
            </p>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center flex-shrink-0">
                <img
                  src="/assets/images/a_clean_vector_style_transparent_background_logo_g__1_-1791328639649.png"
                  alt="شعار حِرَفي"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{title || 'عنوان الإشعار'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{message || 'نص الإشعار'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isSending || !title.trim() || !message.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-semibold text-sm hover:from-violet-500 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/30"
        >
          {isSending ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>جاري الإرسال...</span>
            </>
          ) : (
            <>
              <Icon name="PaperAirplaneIcon" size={16} />
              <span>إرسال للجميع</span>
            </>
          )}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <Icon name="CheckCircleIcon" size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-400">تم الإرسال بنجاح</p>
            <p className="text-xs text-gray-400 mt-1">
              تم إرسال الإشعار إلى <span className="text-white font-semibold">{result.sent}</span> مستخدم
              {result.failed > 0 && (
                <span className="text-red-400"> · فشل الإرسال لـ {result.failed}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-700 flex items-center justify-center flex-shrink-0">
            <Icon name="ExclamationTriangleIcon" size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-400">تعذّر الإرسال</p>
            <p className="text-xs text-gray-400 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-4 flex items-start gap-3">
        <Icon name="InformationCircleIcon" size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300 leading-relaxed">
          سيصل الإشعار فقط للمستخدمين الذين فعّلوا الإشعارات على أجهزتهم. المستخدمون الذين لم يفعّلوا الإشعارات لن يتلقوا الرسالة.
        </p>
      </div>
    </div>
  );
}
