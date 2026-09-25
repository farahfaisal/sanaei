'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface Craftsman {
  id: string;
  user_id: string;
  specialty: string | null;
  experience_years: number;
  location: string | null;
  is_online: boolean;
  is_verified: boolean;
  rating: number;
  total_reviews: number;
  completed_jobs: number;
  created_at: string;
  user_profiles: {
    full_name: string;
    phone: string | null;
    is_active: boolean;
  } | null;
}

export default function CraftsmenTab() {
  const supabase = createClient();
  const [craftsmen, setCraftsmen] = useState<Craftsman[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified' | 'online'>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  useEffect(() => {
    loadCraftsmen();
  }, [page, filter]);

  const loadCraftsmen = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('craftsman_profiles')
        .select('*, user_profiles(full_name, phone, is_active)')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filter === 'verified') query = query.eq('is_verified', true);
      if (filter === 'unverified') query = query.eq('is_verified', false);
      if (filter === 'online') query = query.eq('is_online', true);

      const { data } = await query;
      if (data) setCraftsmen(data as any);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVerified = async (id: string, current: boolean) => {
    await supabase
      .from('craftsman_profiles')
      .update({ is_verified: !current })
      .eq('id', id);
    setCraftsmen((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_verified: !current } : c))
    );
  };

  const filtered = craftsmen.filter(
    (c) =>
      !search ||
      c.user_profiles?.full_name?.includes(search) ||
      c.specialty?.includes(search) ||
      c.location?.includes(search)
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو التخصص..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pr-9 pl-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-600"
            dir="rtl"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'verified', label: 'موثق' },
            { id: 'unverified', label: 'غير موثق' },
            { id: 'online', label: 'متصل' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id as any); setPage(0); }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                filter === f.id
                  ? 'bg-emerald-600 border-emerald-600 text-white' :'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الاسم</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">التخصص</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الموقع</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">التقييم</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الوظائف</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الحالة</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">التوثيق</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500 text-sm">
                    لا يوجد حرفيون
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                            <Icon name="WrenchScrewdriverIcon" size={14} className="text-amber-400" />
                          </div>
                          {c.is_online && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-gray-900" />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium text-xs">{c.user_profiles?.full_name || '—'}</p>
                          <p className="text-gray-500 text-xs">{c.user_profiles?.phone || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{c.specialty || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{c.location || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Icon name="StarIcon" size={12} className="text-yellow-400" />
                        <span className="text-yellow-300 text-xs font-semibold">{c.rating?.toFixed(1) || '0.0'}</span>
                        <span className="text-gray-500 text-xs">({c.total_reviews})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{c.completed_jobs}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border w-fit ${
                        c.is_online
                          ? 'bg-emerald-900/50 text-emerald-300 border-emerald-800/50' :'bg-gray-800 text-gray-500 border-gray-700'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${c.is_online ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                        {c.is_online ? 'متصل' : 'غير متصل'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleVerified(c.id, c.is_verified)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all ${
                          c.is_verified
                            ? 'bg-blue-900/50 text-blue-300 border-blue-800/50' :'bg-gray-800 text-gray-500 border-gray-700 hover:border-blue-700'
                        }`}
                      >
                        <Icon name={c.is_verified ? 'CheckBadgeIcon' : 'MinusCircleIcon'} size={12} />
                        {c.is_verified ? 'موثق' : 'توثيق'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleVerified(c.id, c.is_verified)}
                        className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                        title={c.is_verified ? 'إلغاء التوثيق' : 'توثيق'}
                      >
                        <Icon name={c.is_verified ? 'XCircleIcon' : 'CheckBadgeIcon'} size={14} className={c.is_verified ? 'text-red-400' : 'text-blue-400'} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <span className="text-xs text-gray-500">صفحة {page + 1}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-xs text-gray-300 transition-colors"
            >
              السابق
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={filtered.length < PAGE_SIZE}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-xs text-gray-300 transition-colors"
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
