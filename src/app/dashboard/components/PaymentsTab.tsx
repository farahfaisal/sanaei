'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface WalletTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  label: string;
  created_at: string;
  wallets: {
    user_id: string;
    balance: number;
    total_earned: number;
    user_profiles: { full_name: string; phone: string | null } | null;
  } | null;
}

const TX_LABELS: Record<string, string> = {
  income: 'دخل',
  withdrawal: 'سحب',
  locked: 'معلق',
  refund: 'استرداد',
};

const TX_COLORS: Record<string, string> = {
  income: 'bg-emerald-900/50 text-emerald-300 border-emerald-800/50',
  withdrawal: 'bg-red-900/50 text-red-300 border-red-800/50',
  locked: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  refund: 'bg-blue-900/50 text-blue-300 border-blue-800/50',
};

export default function PaymentsTab() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  const PAGE_SIZE = 15;

  useEffect(() => {
    loadTransactions();
  }, [page, typeFilter]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('wallet_transactions')
        .select(`
          *,
          wallets(user_id, balance, total_earned, user_profiles(full_name, phone))
        `)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (typeFilter !== 'all') {
        query = query.eq('transaction_type', typeFilter);
      }

      const { data } = await query;
      if (data) setTransactions(data as any);

      // Load totals
      const { data: allTx } = await supabase
        .from('wallet_transactions')
        .select('transaction_type, amount');

      if (allTx) {
        setTotalRevenue(
          allTx.filter((t) => t.transaction_type === 'income').reduce((s, t) => s + t.amount, 0)
        );
        setTotalWithdrawals(
          allTx.filter((t) => t.transaction_type === 'withdrawal').reduce((s, t) => s + t.amount, 0)
        );
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = transactions.filter(
    (t) =>
      !search ||
      t.wallets?.user_profiles?.full_name?.includes(search) ||
      t.label?.includes(search)
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الإيرادات', value: totalRevenue, icon: 'BanknotesIcon', color: 'from-emerald-500 to-green-700', bg: 'bg-emerald-950/40 border-emerald-800/40' },
          { label: 'إجمالي السحوبات', value: totalWithdrawals, icon: 'ArrowUpTrayIcon', color: 'from-red-500 to-rose-700', bg: 'bg-red-950/40 border-red-800/40' },
          { label: 'صافي الإيرادات', value: totalRevenue - totalWithdrawals, icon: 'ChartBarIcon', color: 'from-blue-500 to-blue-700', bg: 'bg-blue-950/40 border-blue-800/40' },
          { label: 'عدد المعاملات', value: transactions.length, icon: 'QueueListIcon', color: 'from-violet-500 to-purple-700', bg: 'bg-violet-950/40 border-violet-800/40', isCount: true },
        ].map((card, i) => (
          <div key={i} className={`${card.bg} border rounded-2xl p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center flex-shrink-0`}>
              <Icon name={card.icon as any} size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400">{card.label}</p>
              <p className="text-base font-black text-white">
                {isLoading ? '...' : card.isCount ? card.value : `${card.value.toLocaleString('ar-SA')} ر.س`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الوصف..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pr-9 pl-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-600"
            dir="rtl"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'income', 'withdrawal', 'locked', 'refund'].map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(0); }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                typeFilter === t
                  ? 'bg-emerald-600 border-emerald-600 text-white' :'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {t === 'all' ? 'الكل' : TX_LABELS[t]}
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
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">المستخدم</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">نوع المعاملة</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">المبلغ</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">الوصف</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">رصيد المحفظة</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500 text-sm">
                    لا توجد معاملات
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white text-xs font-medium">{tx.wallets?.user_profiles?.full_name || '—'}</p>
                      <p className="text-gray-500 text-xs">{tx.wallets?.user_profiles?.phone || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg border text-xs font-semibold ${TX_COLORS[tx.transaction_type] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {TX_LABELS[tx.transaction_type] || tx.transaction_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${tx.transaction_type === 'income' ? 'text-emerald-400' : tx.transaction_type === 'withdrawal' ? 'text-red-400' : 'text-gray-300'}`}>
                        {tx.transaction_type === 'income' ? '+' : tx.transaction_type === 'withdrawal' ? '-' : ''}
                        {tx.amount.toLocaleString('ar-SA')} ر.س
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-40 truncate">{tx.label}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {tx.wallets?.balance !== undefined ? `${tx.wallets.balance.toLocaleString('ar-SA')} ر.س` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(tx.created_at).toLocaleDateString('ar-SA')}
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
