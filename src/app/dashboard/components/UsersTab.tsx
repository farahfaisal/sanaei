'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface UserProfile {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  location: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  customer: 'عميل',
  craftsman: 'حرفي',
  admin: 'مشرف',
};

const ROLE_COLORS: Record<string, string> = {
  customer: 'bg-blue-900/50 text-blue-300 border-blue-800/50',
  craftsman: 'bg-amber-900/50 text-amber-300 border-amber-800/50',
  admin: 'bg-emerald-900/50 text-emerald-300 border-emerald-800/50',
};

export default function UsersTab() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      }

      const { data } = await query;
      if (data) setUsers(data);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActive = async (userId: string, current: boolean) => {
    await supabase
      .from('user_profiles')
      .update({ is_active: !current })
      .eq('id', userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_active: !current } : u))
    );
  };

  const toggleVerified = async (userId: string, current: boolean) => {
    await supabase
      .from('user_profiles')
      .update({ is_verified: !current })
      .eq('id', userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_verified: !current } : u))
    );
  };

  const filtered = users.filter(
    (u) =>
      !search ||
      u.full_name?.includes(search) ||
      u.phone?.includes(search)
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
            placeholder="بحث بالاسم أو الهاتف..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pr-9 pl-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-600"
            dir="rtl"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'customer', 'craftsman', 'admin'].map((r) => (
            <button
              key={r}
              onClick={() => { setRoleFilter(r); setPage(0); }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                roleFilter === r
                  ? 'bg-emerald-600 border-emerald-600 text-white' :'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {r === 'all' ? 'الكل' : ROLE_LABELS[r]}
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
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الهاتف</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الدور</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الموقع</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الحالة</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">موثق</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">تاريخ التسجيل</th>
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
                    لا يوجد مستخدمون
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <Icon name="UserCircleIcon" size={16} className="text-gray-400" />
                        </div>
                        <span className="text-white font-medium text-xs">{user.full_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{user.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg border text-xs font-semibold ${ROLE_COLORS[user.role] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{user.location || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(user.id, user.is_active)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all ${
                          user.is_active
                            ? 'bg-emerald-900/50 text-emerald-300 border-emerald-800/50' :'bg-red-900/50 text-red-300 border-red-800/50'
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {user.is_active ? 'نشط' : 'موقوف'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleVerified(user.id, user.is_verified)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all ${
                          user.is_verified
                            ? 'bg-blue-900/50 text-blue-300 border-blue-800/50' :'bg-gray-800 text-gray-500 border-gray-700'
                        }`}
                      >
                        <Icon name={user.is_verified ? 'CheckBadgeIcon' : 'MinusCircleIcon'} size={12} />
                        {user.is_verified ? 'موثق' : 'غير موثق'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleActive(user.id, user.is_active)}
                          className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                          title={user.is_active ? 'إيقاف' : 'تفعيل'}
                        >
                          <Icon name={user.is_active ? 'NoSymbolIcon' : 'CheckCircleIcon'} size={14} className={user.is_active ? 'text-red-400' : 'text-emerald-400'} />
                        </button>
                      </div>
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
