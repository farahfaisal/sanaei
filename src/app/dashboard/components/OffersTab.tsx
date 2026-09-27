'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface Offer {
  id: string;
  title: string;
  description: string | null;
  discount_percent: number | null;
  image_url: string | null;
  badge_text: string | null;
  button_text: string;
  bg_color_from: string;
  bg_color_to: string;
  is_active: boolean;
  sort_order: number;
  expires_at: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  discount_percent: '',
  image_url: '',
  badge_text: '',
  button_text: 'اكتشف العرض',
  bg_color_from: '#1B5E20',
  bg_color_to: '#2E7D32',
  is_active: true,
  sort_order: 0,
  expires_at: '',
};

export default function OffersTab() {
  const supabase = createClient();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('promotional_offers')
        .select('*')
        .order('sort_order');
      if (data) setOffers(data);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowForm(true);
  };

  const openEdit = (offer: Offer) => {
    setEditingId(offer.id);
    setForm({
      title: offer.title,
      description: offer.description || '',
      discount_percent: offer.discount_percent?.toString() || '',
      image_url: offer.image_url || '',
      badge_text: offer.badge_text || '',
      button_text: offer.button_text,
      bg_color_from: offer.bg_color_from,
      bg_color_to: offer.bg_color_to,
      is_active: offer.is_active,
      sort_order: offer.sort_order,
      expires_at: offer.expires_at ? offer.expires_at.slice(0, 10) : '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('يرجى إدخال عنوان العرض');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        discount_percent: form.discount_percent ? parseInt(form.discount_percent as string) : null,
        image_url: form.image_url.trim() || null,
        badge_text: form.badge_text.trim() || null,
        button_text: form.button_text.trim() || 'اكتشف العرض',
        bg_color_from: form.bg_color_from,
        bg_color_to: form.bg_color_to,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
        expires_at: form.expires_at || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        await supabase.from('promotional_offers').update(payload).eq('id', editingId);
      } else {
        await supabase.from('promotional_offers').insert(payload);
      }
      setShowForm(false);
      setEditingId(null);
      await loadOffers();
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('promotional_offers').delete().eq('id', id);
      setDeleteConfirmId(null);
      await loadOffers();
    } catch (e) {
      // ignore
    }
  };

  const handleToggleActive = async (offer: Offer) => {
    await supabase
      .from('promotional_offers')
      .update({ is_active: !offer.is_active, updated_at: new Date().toISOString() })
      .eq('id', offer.id);
    await loadOffers();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">إدارة العروض والخصومات</h2>
          <p className="text-xs text-gray-400 mt-0.5">أضف وعدّل العروض الترويجية التي تظهر في الصفحة الرئيسية</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors"
        >
          <Icon name="PlusIcon" size={16} />
          <span>إضافة عرض</span>
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-base font-bold text-white">
                {editingId ? 'تعديل العرض' : 'إضافة عرض جديد'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  عنوان العرض <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: خصم 20% على خدمات التكييف"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-500"
                />
              </div>
              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">الوصف</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="وصف مختصر للعرض..."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-500 resize-none"
                />
              </div>
              {/* Badge + Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">نص الشارة</label>
                  <input
                    type="text"
                    value={form.badge_text}
                    onChange={(e) => setForm({ ...form, badge_text: e.target.value })}
                    placeholder="مثال: 🌬️ عرض الصيف"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">نسبة الخصم %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.discount_percent}
                    onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                    placeholder="20"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              {/* Button text */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">نص الزر</label>
                <input
                  type="text"
                  value={form.button_text}
                  onChange={(e) => setForm({ ...form, button_text: e.target.value })}
                  placeholder="اكتشف العرض"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-500"
                />
              </div>
              {/* Image URL */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">رابط الصورة</label>
                <input
                  type="text"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-500"
                  dir="ltr"
                />
              </div>
              {/* Colors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">لون البداية</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.bg_color_from}
                      onChange={(e) => setForm({ ...form, bg_color_from: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={form.bg_color_from}
                      onChange={(e) => setForm({ ...form, bg_color_from: e.target.value })}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">لون النهاية</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.bg_color_to}
                      onChange={(e) => setForm({ ...form, bg_color_to: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={form.bg_color_to}
                      onChange={(e) => setForm({ ...form, bg_color_to: e.target.value })}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">معاينة</label>
                <div
                  className="rounded-xl p-3"
                  style={{ background: `linear-gradient(135deg, ${form.bg_color_from} 0%, ${form.bg_color_to} 100%)` }}
                >
                  {form.badge_text && (
                    <div className="inline-flex bg-white/15 rounded-lg px-2 py-0.5 mb-1">
                      <span className="text-white text-xs font-bold">{form.badge_text}</span>
                    </div>
                  )}
                  <p className="text-white font-bold text-sm">{form.title || 'عنوان العرض'}</p>
                  {form.discount_percent && (
                    <span className="inline-block mt-1 bg-yellow-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                      {form.discount_percent}%
                    </span>
                  )}
                </div>
              </div>
              {/* Sort + Expires */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">الترتيب</label>
                  <input
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              {/* Active toggle */}
              <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                <span className="text-sm text-gray-300">تفعيل العرض</span>
                <button
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  className={`w-11 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-emerald-500' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.is_active ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              {error && (
                <p className="text-red-400 text-xs bg-red-900/30 border border-red-800/40 rounded-xl px-4 py-3">{error}</p>
              )}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-800">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-60"
              >
                {isSaving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة العرض'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offers List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon name="TagIcon" size={28} className="text-gray-500" />
          </div>
          <p className="text-gray-400 text-sm font-medium">لا توجد عروض حالياً</p>
          <p className="text-gray-600 text-xs mt-1">اضغط على "إضافة عرض" لإنشاء أول عرض</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
            >
              <div className="flex items-stretch">
                {/* Color preview strip */}
                <div
                  className="w-2 flex-shrink-0"
                  style={{ background: `linear-gradient(180deg, ${offer.bg_color_from} 0%, ${offer.bg_color_to} 100%)` }}
                />
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-bold text-white truncate">{offer.title}</h3>
                        {offer.discount_percent && (
                          <span className="flex-shrink-0 bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-full border border-yellow-500/30">
                            {offer.discount_percent}% خصم
                          </span>
                        )}
                        <span
                          className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            offer.is_active
                              ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/40' :'bg-gray-800 text-gray-500 border border-gray-700'
                          }`}
                        >
                          {offer.is_active ? 'نشط' : 'معطل'}
                        </span>
                      </div>
                      {offer.description && (
                        <p className="text-xs text-gray-400 line-clamp-1">{offer.description}</p>
                      )}
                      {offer.badge_text && (
                        <p className="text-xs text-gray-500 mt-0.5">{offer.badge_text}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Toggle active */}
                      <button
                        onClick={() => handleToggleActive(offer)}
                        title={offer.is_active ? 'تعطيل' : 'تفعيل'}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                          offer.is_active
                            ? 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60' :'bg-gray-800 text-gray-500 hover:bg-gray-700'
                        }`}
                      >
                        <Icon name={offer.is_active ? 'EyeIcon' : 'EyeSlashIcon'} size={16} />
                      </button>
                      {/* Edit */}
                      <button
                        onClick={() => openEdit(offer)}
                        className="w-9 h-9 rounded-xl bg-blue-900/40 text-blue-400 hover:bg-blue-900/60 flex items-center justify-center transition-colors"
                      >
                        <Icon name="PencilSquareIcon" size={16} />
                      </button>
                      {/* Delete */}
                      {deleteConfirmId === offer.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(offer.id)}
                            className="px-2 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            تأكيد
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1.5 bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(offer.id)}
                          className="w-9 h-9 rounded-xl bg-red-900/40 text-red-400 hover:bg-red-900/60 flex items-center justify-center transition-colors"
                        >
                          <Icon name="TrashIcon" size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
