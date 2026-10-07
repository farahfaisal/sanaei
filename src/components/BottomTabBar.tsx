'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/lib/auth/roles';

type TabId = 'home' | 'search' | 'orders' | 'messages' | 'wallet' | 'profile';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  href: string;
  badge?: number;
}

const CUSTOMER_TABS: Tab[] = [
  { id: 'home', label: 'الرئيسية', icon: 'HomeIcon', href: '/home-screen' },
  { id: 'search', label: 'البحث', icon: 'MagnifyingGlassIcon', href: '/home-screen' },
  { id: 'orders', label: 'طلباتي', icon: 'ClipboardDocumentListIcon', href: '/home-screen' },
  { id: 'messages', label: 'المحادثات', icon: 'ChatBubbleLeftRightIcon', href: '/messages' },
];

const CRAFTSMAN_TABS: Tab[] = [
  { id: 'wallet', label: 'الأرباح', icon: 'WalletIcon', href: '/wallet-earnings-dashboard' },
  { id: 'messages', label: 'المحادثات', icon: 'ChatBubbleLeftRightIcon', href: '/messages' },
  { id: 'profile', label: 'ملفي', icon: 'UserCircleIcon', href: '/craftsman-profile' },
];

/** Guests browsing public pages (e.g. a craftsman profile) get a path to sign in. */
const GUEST_TABS: Tab[] = [
  { id: 'home', label: 'الرئيسية', icon: 'HomeIcon', href: '/' },
  { id: 'profile', label: 'دخول', icon: 'ArrowLeftEndOnRectangleIcon', href: '/phone-login-otp-verification' },
];

function tabsFor(role: UserRole | null): Tab[] {
  if (role === 'craftsman') return CRAFTSMAN_TABS;
  if (role === 'customer' || role === 'admin') return CUSTOMER_TABS;
  return GUEST_TABS;
}

export default function BottomTabBar({ activeTab }: { activeTab: TabId }) {
  const router = useRouter();
  const { role, user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const tabs = tabsFor(role);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed:', err);
    } finally {
      setIsSigningOut(false);
      router.replace('/');
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-white border-t border-gray-200"
      style={{ height: 'var(--nav-height)' }}
      aria-label="التنقل الرئيسي"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Link
            key={`nav-tab-${tab.id}-${tab.label}`}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
          >
            <div className="relative">
              <Icon
                name={tab.icon}
                size={22}
                variant={isActive ? 'solid' : 'outline'}
                className={isActive ? 'text-primary' : 'text-gray-400'}
              />
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-gray-400'}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}

      {user && (
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full disabled:opacity-50"
        >
          <Icon name="ArrowRightStartOnRectangleIcon" size={22} variant="outline" className="text-gray-400" />
          <span className="text-xs font-medium text-gray-400">خروج</span>
        </button>
      )}
    </nav>
  );
}
