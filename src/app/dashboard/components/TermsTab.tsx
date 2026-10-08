'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { Spinner } from '@/components/ui/Loader';

export default function TermsTab() {
  const supabase = createClient();
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadTerms();
  }, []);

  const loadTerms = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'terms_and_conditions')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const val = data?.value || '';
      setContent(val);
      setSavedContent(val);
    } catch (e: any) {
      setErrorMsg(e.message || 'حدث خطأ أثناء تحميل الشروط والأحكام');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'terms_and_conditions', value: content, updated_at: new Date().toISOString() }, { onConflict: 'key' });

      if (error) throw error;

      setSavedContent(content);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || 'حدث خطأ أثناء الحفظ');
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = content !== savedContent;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">الشروط والأحكام</h2>
          <p className="text-sm text-gray-400 mt-0.5">اكتب أو عدّل نص الشروط والأحكام الذي يظهر للمستخدمين</p>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'success' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-800/40 px-3 py-1.5 rounded-lg">
              <Icon name="CheckCircleIcon" size={14} />
              تم الحفظ بنجاح
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-900/30 border border-red-800/40 px-3 py-1.5 rounded-lg">
              <Icon name="ExclamationCircleIcon" size={14} />
              فشل الحفظ
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Icon name="CloudArrowUpIcon" size={16} />
                حفظ التغييرات
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-300">
          <Icon name="ExclamationTriangleIcon" size={16} className="flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Editor */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/80">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Icon name="DocumentTextIcon" size={16} />
            <span>محرر النص</span>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && !isLoading && (
              <span className="text-xs text-amber-400 bg-amber-900/30 border border-amber-800/40 px-2 py-0.5 rounded-full">
                يوجد تغييرات غير محفوظة
              </span>
            )}
            <span className="text-xs text-gray-500">
              {content.length} حرف
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <Spinner size={32} color="#10b981" />
              <span className="text-sm text-gray-500">جاري التحميل...</span>
            </div>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="اكتب هنا نص الشروط والأحكام..."
            className="w-full h-96 bg-transparent text-gray-200 text-sm leading-relaxed p-4 resize-none outline-none placeholder-gray-600 font-sans"
            dir="rtl"
          />
        )}
      </div>

      {/* Preview */}
      {content.trim() && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900/80">
            <Icon name="EyeIcon" size={16} className="text-gray-400" />
            <span className="text-sm text-gray-400">معاينة</span>
          </div>
          <div className="p-5">
            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap" dir="rtl">
              {content}
            </div>
          </div>
        </div>
      )}

      {/* Info card */}
      <div className="bg-blue-950/30 border border-blue-800/30 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon name="InformationCircleIcon" size={16} className="text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-300 mb-1">ملاحظة</p>
          <p className="text-xs text-blue-400/80 leading-relaxed">
            سيتم عرض هذا النص للمستخدمين عند التسجيل أو عند طلب عرض الشروط والأحكام داخل التطبيق.
          </p>
        </div>
      </div>
    </div>
  );
}
