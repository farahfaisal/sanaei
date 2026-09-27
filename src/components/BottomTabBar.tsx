'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type TabId = 'home' | 'search' | 'orders' | 'wallet' | 'profile';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  href: string;
  badge?: number;
}

const BASE_TABS: Tab[] = [
  { id: 'home', label: 'الرئيسية', icon: 'HomeIcon', href: '/home-screen' },
  { id: 'search', label: 'البحث', icon: 'MagnifyingGlassIcon', href: '/home-screen' },
  { id: 'orders', label: 'الطلبات', icon: 'ClipboardDocumentListIcon', href: '/home-screen' },
  { id: 'wallet', label: 'المحفظة', icon: 'WalletIcon', href: '/wallet-earnings-dashboard' },
  { id: 'profile', label: 'حسابي', icon: 'UserCircleIcon', href: '/customer-profile' },
];

export default function BottomTabBar({ activeTab }: { activeTab: TabId }) {
  const { profile } = useAuth();
  const isCraftsman = profile?.role === 'craftsman';

  const tabs = BASE_TABS.map((tab) => {
    if (tab.id === 'profile') {
      return { ...tab, href: isCraftsman ? '/craftsman-profile' : '/customer-profile' };
    }
    if (tab.id === 'orders') {
      return { ...tab, href: isCraftsman ? '/craftsman-orders' : '/home-screen' };
    }
    return tab;
  }).filter((tab) => {
    if (isCraftsman && (tab.id === 'home' || tab.id === 'search')) return false;
    return true;
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        height: '64px',
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Link
            key={`nav-tab-${tab.id}`}
            href={tab.href}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
          >
            <div className="relative">
              <Icon
                name={tab.icon as never}
                size={22}
                variant={isActive ? 'solid' : 'outline'}
                className={isActive ? 'text-primary' : 'text-gray-400'}
              />
              {tab.badge && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </div>
            <span
              className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-gray-400'}`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}