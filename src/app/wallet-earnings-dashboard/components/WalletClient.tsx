'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const EarningsChart = dynamic(() => import('./EarningsChart'), { ssr: false });

type EarningTab = 'today' | 'week' | 'month' | 'total';

interface WalletData {
  id: string;
  balance: number;
  locked_balance: number;
  total_earned: number;
  bank_account: string | null;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  label: string;
  created_at: string;
}

const EARNING_TABS: { id: EarningTab; label: string }[] = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'هذا الأسبوع' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'total', label: 'الإجمالي' },
];

function formatAmount(n: number) {
  return n.toLocaleString('ar-SA');
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const period = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 || 12;
    return `اليوم، ${h12}:${m} ${period}`;
  } else if (diffDays === 1) {
    return 'أمس';
  }
  return `منذ ${diffDays} أيام`;
}

export default function WalletClient() {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<EarningTab>('week');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isCustomer = profile?.role === 'customer';

  useEffect(() => {
    if (user) {
      loadWalletData();
    }
  }, [user]);

  const loadWalletData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletData) {
        setWallet(walletData);

        const { data: txData } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', walletData.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (txData) setTransactions(txData);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const getTabTotal = () => {
    if (!wallet) return '0';
    if (activeTab === 'total') return formatAmount(wallet.total_earned);

    const now = new Date();
    const filtered = transactions.filter((t) => {
      if (t.transaction_type !== 'income') return false;
      const d = new Date(t.created_at);
      if (activeTab === 'today') {
        return d.toDateString() === now.toDateString();
      } else if (activeTab === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= weekAgo;
      } else if (activeTab === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return false;
    });
    return formatAmount(filtered.reduce((sum, t) => sum + t.amount, 0));
  };

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsWithdrawing(false);
  };

  return (
    <div className="screen-container bg-gray-50" dir="rtl">
      {/* Header */}
      <div style={{ background: '#1a5857' }} className="px-4 pt-12 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center">
              <Icon name="UserCircleIcon" size={20} className="text-white" />
            </button>
            <button className="relative w-9 h-9 bg-white/15 rounded-full flex items-center justify-center">
              <Icon name="BellIcon" size={20} className="text-white" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full" />
            </button>
          </div>
          <h1 className="text-xl font-bold text-white">محفظتي</h1>
        </div>

        {/* Balance card */}
        <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <Icon name="ShieldCheckIcon" size={22} className="text-yellow-400" />
            </div>
            <div className="text-right">
              <p className="text-xs text-white/70 mb-1">الرصيد الحالي</p>
              <div className="flex items-end gap-2">
                <span className="text-sm font-semibold text-white/70">₪</span>
                <span className="text-4xl font-black text-white font-tabular">
                  {isLoading ? '...' : formatAmount(wallet?.balance || 0)}
                </span>
              </div>
            </div>
          </div>

          {wallet?.locked_balance && wallet.locked_balance > 0 ? (
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 mb-3">
              <Icon name="LockClosedIcon" size={13} className="text-yellow-300 flex-shrink-0" />
              <span className="text-xs text-white/80">
                مبلغ معلق {formatAmount(wallet.locked_balance)} ₪ — يُفرج عنه بعد 48 ساعة
              </span>
            </div>
          ) : null}

          <div className="flex gap-4 pt-3 border-t border-white/15">
            <div className="text-right">
              <p className="text-xs text-white/60 mb-0.5">الرصيد المتاح</p>
              <p className="text-base font-bold text-white font-tabular">
                {isLoading ? '...' : formatAmount((wallet?.balance || 0) - (wallet?.locked_balance || 0))} ₪
              </p>
            </div>
          </div>
        </div>

        {/* Withdraw button */}
        <button
          onClick={handleWithdraw}
          disabled={isWithdrawing}
          className="w-full mt-3 py-3.5 bg-white text-primary font-bold rounded-2xl flex items-center justify-center gap-2"
        >
          <Icon name="BuildingLibraryIcon" size={18} className="text-primary" />
          <span>{isWithdrawing ? 'جاري التحويل...' : 'سحب على الحساب البنكي'}</span>
          {wallet?.bank_account && (
            <span className="text-xs text-gray-400 font-normal">{wallet.bank_account}</span>
          )}
        </button>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        {/* Earnings chart section — only for craftsmen */}
        {!isCustomer && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-left">
              <span className="text-lg font-black text-primary font-tabular">
                {getTabTotal()} ₪
              </span>
              <p className="text-xs text-gray-400">أرباح {EARNING_TABS.find(t => t.id === activeTab)?.label}</p>
            </div>
            <h2 className="text-sm font-bold text-gray-900">أرباحي</h2>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
            {EARNING_TABS.map((tab) => (
              <button
                key={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <EarningsChart activeTab={activeTab} transactions={transactions} />
        </div>
        )}

        {/* Recent transactions */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <button className="text-primary text-xs font-semibold">عرض الكل</button>
            <h2 className="text-sm font-bold text-gray-900">آخر الحركات</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">لا توجد معاملات بعد</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 10).map((txn) => {
                const isIncome = txn.transaction_type === 'income';
                const isLocked = txn.transaction_type === 'locked';

                return (
                  <div key={txn.id} className="flex items-center gap-3">
                    <div className="text-left flex-shrink-0">
                      <span
                        className={`text-sm font-bold font-tabular ${
                          isIncome ? 'text-primary' : isLocked ? 'text-yellow-600' : 'text-red-500'
                        }`}
                      >
                        {txn.amount > 0 ? '+' : ''}{txn.amount} ₪
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-sm font-semibold text-gray-800 leading-tight truncate">
                        {txn.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatTime(txn.created_at)}</p>
                    </div>

                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isIncome ? 'bg-primary/10' : isLocked ? 'bg-yellow-50' : 'bg-red-50'
                      }`}
                    >
                      <Icon
                        name={isIncome ? 'ArrowDownLeftIcon' : isLocked ? 'LockClosedIcon' : 'ArrowUpRightIcon'}
                        size={16}
                        className={isIncome ? 'text-primary' : isLocked ? 'text-yellow-600' : 'text-red-500'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomTabBar activeTab="wallet" />
    </div>
  );
}