'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface Order {
  id: string;
  status: string;
  description: string | null;
  address: string | null;
  amount: number | null;
  payment_method: string | null;
  payment_status: string;
  scheduled_at: string | null;
  created_at: string;
  customer: { full_name: string; phone: string | null } | null;
  craftsman_profiles: {
    user_profiles: { full_name: string } | null;
    specialty: string | null;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'معلق',
  accepted: 'مقبول',
  in_progress: 'جاري',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  accepted: 'bg-blue-900/50 text-blue-300 border-blue-800/50',
  in_progress: 'bg-violet-900/50 text-violet-300 border-violet-800/50',
  completed: 'bg-emerald-900/50 text-emerald-300 border-emerald-800/50',
  cancelled: 'bg-red-900/50 text-red-300 border-red-800/50',
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'معلق',
  paid: 'مدفوع',
  refunded: 'مسترد',
  failed: 'فشل',
};

export default function OrdersTab() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  useEffect(() => {
    loadOrders();
  }, [page, statusFilter]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          customer:customer_id(full_name, phone),
          craftsman_profiles(user_profiles(full_name), specialty)
        `)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data } = await query;
      if (data) setOrders(data as any);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );
  };

  const filtered = orders.filter(
    (o) =>
      !search ||
      (o.customer as any)?.full_name?.includes(search) ||
      o.description?.includes(search) ||
      o.address?.includes(search)
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
            placeholder="بحث بالعميل أو الوصف..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pr-9 pl-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-600"
            dir="rtl"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === s
                  ? 'bg-emerald-600 border-emerald-600 text-white' :'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {s === 'all' ? 'الكل' : STATUS_LABELS[s]}
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
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">العميل</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الحرفي</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الوصف</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">المبلغ</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">حالة الطلب</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الدفع</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">التاريخ</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">تغيير الحالة</th>
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
                    لا توجد طلبات
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white text-xs font-medium">{(order.customer as any)?.full_name || '—'}</p>
                      <p className="text-gray-500 text-xs">{(order.customer as any)?.phone || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-300 text-xs">{order.craftsman_profiles?.user_profiles?.full_name || '—'}</p>
                      <p className="text-gray-500 text-xs">{order.craftsman_profiles?.specialty || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-400 text-xs max-w-32 truncate">{order.description || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-300 text-xs font-semibold">
                        {order.amount ? `${order.amount.toLocaleString('ar-SA')} ر.س` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg border text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg border text-xs font-semibold ${
                        order.payment_status === 'paid' ?'bg-emerald-900/50 text-emerald-300 border-emerald-800/50'
                          : order.payment_status === 'failed' ?'bg-red-900/50 text-red-300 border-red-800/50' :'bg-gray-800 text-gray-400 border-gray-700'
                      }`}>
                        {PAYMENT_LABELS[order.payment_status] || order.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(order.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none focus:border-emerald-600"
                        dir="rtl"
                      >
                        {Object.entries(STATUS_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
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
