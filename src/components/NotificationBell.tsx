'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';
import { subscribeToPush, isPushSubscribed, getNotificationPermission } from '@/lib/pushNotifications';
import { isNativeApp, nativePushPermission, registerNativePush } from '@/lib/nativeApp';
import { rtChannelName } from '@/lib/supabase/realtime';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  order_id: string | null;
  url?: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushDenied, setPushDenied] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    checkPushStatus();

    // Real-time subscription
    const channel = supabase
      .channel(rtChannelName(`notifications:${user.id}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  const checkPushStatus = async () => {
    if (isNativeApp()) {
      const native = await nativePushPermission();
      setPushDenied(native === 'denied');
      setPushEnabled(native === 'granted');
      return;
    }
    const permission = getNotificationPermission();
    if (permission === 'denied') {
      setPushDenied(true);
      setPushEnabled(false);
      return;
    }
    const subscribed = await isPushSubscribed();
    setPushEnabled(subscribed);
    setPushDenied(false);
  };

  const handleEnablePush = async () => {
    if (!user) return;
    setPushLoading(true);
    if (isNativeApp()) {
      const ok = await registerNativePush();
      setPushEnabled(ok);
      if (!ok) setPushDenied((await nativePushPermission()) === 'denied');
      setPushLoading(false);
      return;
    }
    const ok = await subscribeToPush(user.id);
    setPushEnabled(ok);
    if (!ok) {
      const permission = getNotificationPermission();
      setPushDenied(permission === 'denied');
    }
    setPushLoading(false);
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_order': return '🔔';
      case 'order_assigned': return '📋';
      case 'order_accepted':
      case 'quote_accepted': return '✅';
      case 'order_paid': return '💳';
      case 'order_in_progress': return '🔧';
      case 'order_progress': return '🚗';
      case 'order_completed': return '🎉';
      case 'order_cancelled':
      case 'quote_rejected': return '❌';
      case 'quote_received': return '💰';
      case 'quote_modification': return '🔄';
      case 'broadcast': return '📣';
      case 'open_job': return '📢';
      case 'order_claimed': return '🙌';
      case 'order_status': return '📦';
      default: return '💬';
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 bg-white/15 rounded-full flex items-center justify-center"
        aria-label="الإشعارات"
      >
        <Icon name="BellIcon" size={18} className="text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
          dir="rtl"
          style={{ maxHeight: '420px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">الإشعارات</h3>
            <div className="flex items-center gap-2">
              {!pushEnabled && !pushDenied && (
                <button
                  onClick={handleEnablePush}
                  disabled={pushLoading}
                  className="text-xs text-primary font-semibold bg-green-50 px-2 py-1 rounded-lg disabled:opacity-60"
                >
                  {pushLoading ? '...' : 'تفعيل الإشعارات'}
                </button>
              )}
              {pushDenied && (
                <span className="text-xs text-red-500 font-medium px-2 py-1">
                  الإشعارات محجوبة
                </span>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-gray-500 hover:text-primary"
                >
                  تحديد الكل كمقروء
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: '340px' }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Icon name="BellSlashIcon" size={32} className="mb-2 text-gray-300" />
                <p className="text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => {
                    void markRead(notif.id);
                    if (notif.url) { setOpen(false); router.push(notif.url); }
                  }}
                  className={`w-full text-right flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !notif.is_read ? 'bg-green-50/60' : ''
                  }`}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{getIcon(notif.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{notif.title}</p>
                      {!notif.is_read && (
                        <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notif.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatTime(notif.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
