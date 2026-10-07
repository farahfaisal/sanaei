'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type TabId = 'home' | 'search' | 'orders' | 'wallet' | 'profile' | 'chat' | 'create-job';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  href: string;
  badge?: number;
}

const BASE_TABS: Tab[] = [
  { id: 'home', label: 'الرئيسية', icon: 'HomeIcon', href: '/home-screen' },
  { id: 'search', label: 'البحث', icon: 'MagnifyingGlassIcon', href: '/search' },
  { id: 'chat', label: 'المحادثات', icon: 'ChatBubbleLeftRightIcon', href: '/conversations' },
  { id: 'orders', label: 'الطلبات', icon: 'ClipboardDocumentListIcon', href: '/order-details' },
  { id: 'wallet', label: 'المحفظة', icon: 'WalletIcon', href: '/wallet-earnings-dashboard' },
  { id: 'profile', label: 'حسابي', icon: 'UserCircleIcon', href: '/customer-profile' },
];

export default function BottomTabBar({ activeTab }: { activeTab: TabId }) {
  const { profile } = useAuth();
  const router = useRouter();
  const isCraftsman = profile?.role === 'craftsman';

  const tabs = BASE_TABS.map((tab) => {
    if (tab.id === 'profile') {
      return { ...tab, href: isCraftsman ? '/craftsman-account' : '/customer-profile' };
    }
    if (tab.id === 'orders') {
      return { ...tab, href: isCraftsman ? '/craftsman-orders' : '/customer-orders' };
    }
    return tab;
  }).filter((tab) => {
    if (isCraftsman && tab.id === 'home') return false;
    return true;
  });

  // For customers: split tabs around a center FAB
  const isCustomer = !isCraftsman;
  const leftTabs = isCustomer ? tabs.slice(0, Math.floor(tabs.length / 2)) : tabs;
  const rightTabs = isCustomer ? tabs.slice(Math.floor(tabs.length / 2)) : [];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1100] flex justify-center pb-3 px-4 pointer-events-none">
      <nav
        className="pointer-events-auto flex items-center justify-around w-full max-w-md relative"
        style={{
          height: '68px',
          borderRadius: '28px',
          background: 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(20, 82, 48, 0.35)',
          boxShadow:
            '0 8px 32px rgba(20, 82, 48, 0.25), 0 2px 12px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.7)',
        }}
      >
        {isCustomer ? (
          <>
            {leftTabs.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <Link
                  key={`nav-tab-${tab.id}`}
                  href={tab.href}
                  onClick={(e) => { e.preventDefault(); router.push(tab.href); }}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative"
                >
                  {isActive && (
                    <span className="absolute inset-x-1 top-2 bottom-2 rounded-2xl"
                      style={{ background: 'linear-gradient(135deg, rgba(20,82,48,0.20) 0%, rgba(10,46,24,0.14) 100%)', border: '1px solid rgba(20,82,48,0.28)' }} />
                  )}
                  <div className="relative z-10">
                    <div className="flex items-center justify-center rounded-xl transition-all duration-200"
                      style={{ width: '36px', height: '36px', background: isActive ? 'linear-gradient(135deg, #145230 0%, #0a2e18 100%)' : 'transparent', boxShadow: isActive ? '0 4px 12px rgba(20,82,48,0.5), 0 1px 3px rgba(0,0,0,0.15)' : 'none', transform: isActive ? 'translateY(-2px)' : 'none' }}>
                      <Icon name={tab.icon as never} size={20} variant={isActive ? 'solid' : 'outline'} className={isActive ? 'text-white' : 'text-gray-400'} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold z-10 transition-all duration-200"
                    style={{ color: isActive ? '#145230' : '#9ca3af', fontSize: '10px', letterSpacing: '0.01em' }}>
                    {tab.label}
                  </span>
                </Link>
              );
            })}

            {/* Center FAB — Create Job */}
            <div className="flex flex-col items-center justify-center flex-shrink-0 relative" style={{ width: '64px' }}>
              <button
                onClick={() => router.push('/create-job')}
                className="flex items-center justify-center rounded-2xl transition-all duration-200 active:scale-95"
                style={{
                  width: '52px',
                  height: '52px',
                  background: activeTab === 'create-job' ?'linear-gradient(135deg, #0a2e18 0%, #145230 100%)' :'linear-gradient(135deg, #145230 0%, #2a724d 100%)',
                  boxShadow: '0 6px 20px rgba(20,82,48,0.55), 0 2px 6px rgba(0,0,0,0.15)',
                  marginTop: '-18px',
                  border: '3px solid rgba(255,255,255,0.9)',
                }}
              >
                <Icon name="PlusIcon" size={26} className="text-white" variant="solid" />
              </button>
              <span className="text-xs font-semibold mt-0.5"
                style={{ color: activeTab === 'create-job' ? '#145230' : '#9ca3af', fontSize: '10px' }}>
                طلب جديد
              </span>
            </div>

            {rightTabs.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <Link
                  key={`nav-tab-${tab.id}`}
                  href={tab.href}
                  onClick={(e) => { e.preventDefault(); router.push(tab.href); }}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative"
                >
                  {isActive && (
                    <span className="absolute inset-x-1 top-2 bottom-2 rounded-2xl"
                      style={{ background: 'linear-gradient(135deg, rgba(20,82,48,0.20) 0%, rgba(10,46,24,0.14) 100%)', border: '1px solid rgba(20,82,48,0.28)' }} />
                  )}
                  <div className="relative z-10">
                    <div className="flex items-center justify-center rounded-xl transition-all duration-200"
                      style={{ width: '36px', height: '36px', background: isActive ? 'linear-gradient(135deg, #145230 0%, #0a2e18 100%)' : 'transparent', boxShadow: isActive ? '0 4px 12px rgba(20,82,48,0.5), 0 1px 3px rgba(0,0,0,0.15)' : 'none', transform: isActive ? 'translateY(-2px)' : 'none' }}>
                      <Icon name={tab.icon as never} size={20} variant={isActive ? 'solid' : 'outline'} className={isActive ? 'text-white' : 'text-gray-400'} />
                    </div>
                    {tab.badge && tab.badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center z-20">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold z-10 transition-all duration-200"
                    style={{ color: isActive ? '#145230' : '#9ca3af', fontSize: '10px', letterSpacing: '0.01em' }}>
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </>
        ) : (
          tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <Link
                key={`nav-tab-${tab.id}`}
                href={tab.href}
                onClick={(e) => { e.preventDefault(); router.push(tab.href); }}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative"
              >
                {isActive && (
                  <span className="absolute inset-x-1 top-2 bottom-2 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, rgba(20,82,48,0.20) 0%, rgba(10,46,24,0.14) 100%)', border: '1px solid rgba(20,82,48,0.28)' }} />
                )}
                <div className="relative z-10">
                  <div className="flex items-center justify-center rounded-xl transition-all duration-200"
                    style={{ width: '36px', height: '36px', background: isActive ? 'linear-gradient(135deg, #145230 0%, #0a2e18 100%)' : 'transparent', boxShadow: isActive ? '0 4px 12px rgba(20,82,48,0.5), 0 1px 3px rgba(0,0,0,0.15)' : 'none', transform: isActive ? 'translateY(-2px)' : 'none' }}>
                    <Icon name={tab.icon as never} size={20} variant={isActive ? 'solid' : 'outline'} className={isActive ? 'text-white' : 'text-gray-400'} />
                  </div>
                  {tab.badge && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center z-20">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold z-10 transition-all duration-200"
                  style={{ color: isActive ? '#145230' : '#9ca3af', fontSize: '10px', letterSpacing: '0.01em' }}>
                  {tab.label}
                </span>
              </Link>
            );
          })
        )}
      </nav>
    </div>
  );
}