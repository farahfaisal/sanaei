'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import UsersTab from './UsersTab';
import CraftsmenTab from './CraftsmenTab';
import OrdersTab from './OrdersTab';
import PaymentsTab from './PaymentsTab';
import MapTab from './MapTab';
import BroadcastTab from './BroadcastTab';
import OffersTab from './OffersTab';
import ChatsTab from './ChatsTab';
import ActivityFeedTab from './ActivityFeedTab';
import TermsTab from './TermsTab';

type Tab = 'overview' | 'users' | 'craftsmen' | 'orders' | 'payments' | 'map' | 'broadcast' | 'offers' | 'chats' | 'activity' | 'terms';

interface Stats {
  totalUsers: number;
  totalCraftsmen: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  activeUsers: number;
  verifiedCraftsmen: number;
}

const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: 'ChartBarIcon' },
  { id: 'activity', label: 'سجل النشاط', icon: 'BoltIcon' },
  { id: 'users', label: 'المستخدمون', icon: 'UsersIcon' },
  { id: 'craftsmen', label: 'الحرفيون', icon: 'WrenchScrewdriverIcon' },
  { id: 'orders', label: 'الطلبات', icon: 'ClipboardDocumentListIcon' },
  { id: 'payments', label: 'المدفوعات', icon: 'CreditCardIcon' },
  { id: 'chats', label: 'المحادثات', icon: 'ChatBubbleLeftRightIcon' },
  { id: 'map', label: 'خريطة الحرفيين', icon: 'MapPinIcon' },
  { id: 'broadcast', label: 'إشعار جماعي', icon: 'BellAlertIcon' },
  { id: 'offers', label: 'العروض والخصومات', icon: 'TagIcon' },
  { id: 'terms', label: 'الشروط والأحكام', icon: 'DocumentTextIcon' },
];

export default function DashboardClient() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalCraftsmen: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    activeUsers: 0,
    verifiedCraftsmen: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [usersRes, craftsmenRes, ordersRes, walletsRes] = await Promise.all([
        supabase.from('user_profiles').select('id, is_active, role', { count: 'exact' }),
        supabase.from('craftsman_profiles').select('id, is_verified', { count: 'exact' }),
        supabase.from('orders').select('id, status, amount', { count: 'exact' }),
        supabase.from('wallets').select('total_earned'),
      ]);

      const users = usersRes.data || [];
      const craftsmen = craftsmenRes.data || [];
      const orders = ordersRes.data || [];
      const wallets = walletsRes.data || [];

      const totalRevenue = wallets.reduce((sum, w) => sum + (w.total_earned || 0), 0);

      setStats({
        totalUsers: usersRes.count || users.length,
        totalCraftsmen: craftsmenRes.count || craftsmen.length,
        totalOrders: ordersRes.count || orders.length,
        pendingOrders: orders.filter((o) => o.status === 'pending').length,
        completedOrders: orders.filter((o) => o.status === 'completed').length,
        totalRevenue,
        activeUsers: users.filter((u) => u.is_active).length,
        verifiedCraftsmen: craftsmen.filter((c) => c.is_verified).length,
      });
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      label: 'إجمالي المستخدمين',
      value: stats.totalUsers,
      sub: `${stats.activeUsers} نشط`,
      icon: 'UsersIcon',
      color: 'from-primary to-primary-dark',
      bg: 'bg-primary/20',
      border: 'border-primary/30',
    },
    {
      label: 'الحرفيون',
      value: stats.totalCraftsmen,
      sub: `${stats.verifiedCraftsmen} موثق`,
      icon: 'WrenchScrewdriverIcon',
      color: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-950/40',
      border: 'border-amber-800/40',
    },
    {
      label: 'إجمالي الطلبات',
      value: stats.totalOrders,
      sub: `${stats.pendingOrders} معلق`,
      icon: 'ClipboardDocumentListIcon',
      color: 'from-violet-500 to-purple-700',
      bg: 'bg-violet-950/40',
      border: 'border-violet-800/40',
    },
    {
      label: 'الطلبات المكتملة',
      value: stats.completedOrders,
      sub: `من ${stats.totalOrders} طلب`,
      icon: 'CheckCircleIcon',
      color: 'from-primary to-primary-dark',
      bg: 'bg-primary/20',
      border: 'border-primary/30',
    },
    {
      label: 'إجمالي الإيرادات',
      value: `${stats.totalRevenue.toLocaleString('ar-SA')} ر.س`,
      sub: 'من المحافظ',
      icon: 'BanknotesIcon',
      color: 'from-teal-400 to-cyan-600',
      bg: 'bg-teal-950/40',
      border: 'border-teal-800/40',
      isText: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex" dir="rtl">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-64 bg-gray-900 border-l border-gray-800 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } lg:translate-x-0 lg:static lg:flex`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-emerald-900 flex items-center justify-center flex-shrink-0">
            <img
              src="/assets/images/__________________24_-1790287739442.png"
              alt="شعار صنايعي"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <p className="text-sm font-bold text-white">صنايعي</p>
            <p className="text-xs text-gray-400">لوحة التحكم</p>
          </div>
          <button
            className="mr-auto lg:hidden text-gray-400"
            onClick={() => setSidebarOpen(false)}
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon name={item.icon as any} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center">
              <Icon name="ShieldCheckIcon" size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">المشرف</p>
              <p className="text-xs text-gray-500">admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-4 lg:px-6 py-3 flex items-center gap-3">
          <button
            className="lg:hidden w-9 h-9 bg-gray-800 rounded-xl flex items-center justify-center"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="Bars3Icon" size={18} className="text-gray-300" />
          </button>
          <h1 className="text-base font-bold text-white">
            {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
          </h1>
          <div className="mr-auto flex items-center gap-2">
            <button
              onClick={loadStats}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
            >
              <Icon name="ArrowPathIcon" size={14} />
              <span>تحديث</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 lg:gap-4">
                {statCards.map((card, i) => (
                  <div
                    key={i}
                    className={`${card.bg} ${card.border} border rounded-2xl p-4 flex flex-col gap-3`}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                      <Icon name={card.icon as any} size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                      <p className="text-xl font-black text-white">
                        {isLoading ? (
                          <span className="inline-block w-12 h-5 bg-gray-700 rounded animate-pulse" />
                        ) : (
                          card.isText ? card.value : Number(card.value).toLocaleString('ar-SA')
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{card.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-gray-200 mb-4">إجراءات سريعة</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'إدارة المستخدمين', tab: 'users' as Tab, icon: 'UsersIcon', color: 'bg-blue-900/50 border-blue-800/50 text-blue-300' },
                    { label: 'إدارة الحرفيين', tab: 'craftsmen' as Tab, icon: 'WrenchScrewdriverIcon', color: 'bg-amber-900/50 border-amber-800/50 text-amber-300' },
                    { label: 'مراجعة الطلبات', tab: 'orders' as Tab, icon: 'ClipboardDocumentListIcon', color: 'bg-violet-900/50 border-violet-800/50 text-violet-300' },
                    { label: 'المدفوعات', tab: 'payments' as Tab, icon: 'CreditCardIcon', color: 'bg-teal-900/50 border-teal-800/50 text-teal-300' },
                  ].map((action) => (
                    <button
                      key={action.tab}
                      onClick={() => setActiveTab(action.tab)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${action.color} hover:opacity-80 transition-opacity`}
                    >
                      <Icon name={action.icon as any} size={22} />
                      <span className="text-xs font-semibold text-center">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Demo Credentials Card */}
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Icon name="KeyIcon" size={16} className="text-amber-400" />
                  </div>
                  <h2 className="text-sm font-bold text-amber-300">بيانات الدخول التجريبية</h2>
                  <span className="mr-auto text-xs text-amber-500/70 bg-amber-900/40 px-2 py-0.5 rounded-full">للاختبار فقط</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Customer Account */}
                  <div className="bg-gray-900/60 border border-blue-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">👤</span>
                      <span className="text-xs font-bold text-blue-300">حساب الزبون</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-white bg-gray-800 px-2 py-1 rounded-lg" dir="ltr">+970599000001</span>
                        <span className="text-xs text-gray-400">رقم الجوال</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-emerald-400 bg-gray-800 px-2 py-1 rounded-lg" dir="ltr">123456</span>
                        <span className="text-xs text-gray-400">رمز التحقق</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">أحمد الزبون</span>
                        <span className="text-xs text-gray-400">الاسم</span>
                      </div>
                    </div>
                  </div>
                  {/* Craftsman Account */}
                  <div className="bg-gray-900/60 border border-amber-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">🔧</span>
                      <span className="text-xs font-bold text-amber-300">حساب الصنايعي</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-white bg-gray-800 px-2 py-1 rounded-lg" dir="ltr">+970599000002</span>
                        <span className="text-xs text-gray-400">رقم الجوال</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-emerald-400 bg-gray-800 px-2 py-1 rounded-lg" dir="ltr">123456</span>
                        <span className="text-xs text-gray-400">رمز التحقق</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">محمد الصنايعي</span>
                        <span className="text-xs text-gray-400">الاسم</span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-amber-600/70 mt-3 text-center">
                  استخدم هذه البيانات لتسجيل الدخول من صفحة تسجيل الدخول بالجوال
                </p>
              </div>

              {/* Summary table */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-gray-200 mb-4">ملخص الحالة</h2>
                <div className="space-y-3">
                  {[
                    { label: 'طلبات معلقة', value: stats.pendingOrders, color: 'text-yellow-400', bg: 'bg-yellow-400' },
                    { label: 'طلبات مكتملة', value: stats.completedOrders, color: 'text-emerald-400', bg: 'bg-emerald-400' },
                    { label: 'حرفيون موثقون', value: stats.verifiedCraftsmen, color: 'text-blue-400', bg: 'bg-blue-400' },
                    { label: 'مستخدمون نشطون', value: stats.activeUsers, color: 'text-violet-400', bg: 'bg-violet-400' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${row.bg} flex-shrink-0`} />
                      <span className="text-sm text-gray-400 flex-1">{row.label}</span>
                      <span className={`text-sm font-bold ${row.color}`}>
                        {isLoading ? '...' : row.value.toLocaleString('ar-SA')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'craftsmen' && <CraftsmenTab />}
          {activeTab === 'orders' && <OrdersTab />}
          {activeTab === 'payments' && <PaymentsTab />}
          {activeTab === 'chats' && <ChatsTab />}
          {activeTab === 'map' && <MapTab />}
          {activeTab === 'broadcast' && <BroadcastTab />}
          {activeTab === 'offers' && <OffersTab />}
          {activeTab === 'activity' && <ActivityFeedTab />}
          {activeTab === 'terms' && <TermsTab />}
        </main>
      </div>
    </div>
  );
}
