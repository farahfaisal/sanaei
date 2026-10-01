'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useRouter } from 'next/navigation';

interface ActivityEvent {
  id: string;
  type: 'new_order' | 'order_status' | 'message' | 'review';
  title: string;
  description: string;
  timestamp: string;
  actionLabel?: string;
  actionHref?: string;
  meta?: Record<string, string | number | null>;
}

const EVENT_CONFIG: Record<ActivityEvent['type'], { icon: string; emoji: string; color: string; bg: string; border: string }> = {
  new_order: {
    icon: 'ClipboardDocumentListIcon',
    emoji: '🆕',
    color: 'text-blue-300',
    bg: 'bg-blue-900/40',
    border: 'border-blue-800/50',
  },
  order_status: {
    icon: 'ArrowPathIcon',
    emoji: '📦',
    color: 'text-amber-300',
    bg: 'bg-amber-900/40',
    border: 'border-amber-800/50',
  },
  message: {
    icon: 'ChatBubbleLeftRightIcon',
    emoji: '💬',
    color: 'text-violet-300',
    bg: 'bg-violet-900/40',
    border: 'border-violet-800/50',
  },
  review: {
    icon: 'StarIcon',
    emoji: '⭐',
    color: 'text-yellow-300',
    bg: 'bg-yellow-900/40',
    border: 'border-yellow-800/50',
  },
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'معلق',
  accepted: 'مقبول',
  in_progress: 'جاري التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `منذ ${days} يوم`;
  return new Date(dateStr).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

function formatAbsoluteTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ar-SA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ActivityFeedTab() {
  const supabase = createClient();
  const router = useRouter();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | ActivityEvent['type']>('all');
  const [newCount, setNewCount] = useState(0);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  useEffect(() => {
    loadInitialEvents();
    setupRealtime();
    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
    };
  }, []);

  const loadInitialEvents = async () => {
    setIsLoading(true);
    try {
      const [ordersRes, messagesRes, reviewsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, status, description, amount, created_at, customer:customer_id(full_name), craftsman_profiles(user_profiles(full_name), specialty)')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('messages')
          .select('id, content, created_at, conversation_id, sender:sender_id(full_name, role)')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('reviews')
          .select('id, rating, comment, created_at, customer:customer_id(full_name), craftsman_profiles(user_profiles(full_name))')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const allEvents: ActivityEvent[] = [];

      // Orders → new_order + order_status events
      (ordersRes.data || []).forEach((order: any) => {
        const customerName = Array.isArray(order.customer) ? order.customer[0]?.full_name : order.customer?.full_name;
        const craftsmanProfile = Array.isArray(order.craftsman_profiles) ? order.craftsman_profiles[0] : order.craftsman_profiles;
        const craftsmanName = craftsmanProfile?.user_profiles?.full_name || craftsmanProfile?.user_profiles?.[0]?.full_name;
        const specialty = craftsmanProfile?.specialty;

        // New order event
        allEvents.push({
          id: `order-new-${order.id}`,
          type: 'new_order',
          title: 'طلب خدمة جديد',
          description: `${customerName || 'عميل'} طلب ${specialty || 'خدمة'}${craftsmanName ? ` من ${craftsmanName}` : ''}`,
          timestamp: order.created_at,
          actionLabel: 'عرض الطلب',
          actionHref: `/order-details?orderId=${order.id}`,
          meta: { amount: order.amount, status: order.status },
        });

        // Status change event (non-pending orders)
        if (order.status !== 'pending') {
          allEvents.push({
            id: `order-status-${order.id}`,
            type: 'order_status',
            title: `تغيير حالة الطلب إلى "${STATUS_LABELS[order.status] || order.status}"`,
            description: `${customerName || 'عميل'} ← ${craftsmanName || 'صنايعي'}${order.description ? `: ${order.description.slice(0, 60)}` : ''}`,
            timestamp: order.created_at,
            actionLabel: 'عرض الطلب',
            actionHref: `/order-details?orderId=${order.id}`,
            meta: { status: order.status, amount: order.amount },
          });
        }
      });

      // Messages
      (messagesRes.data || []).forEach((msg: any) => {
        const sender = Array.isArray(msg.sender) ? msg.sender[0] : msg.sender;
        allEvents.push({
          id: `msg-${msg.id}`,
          type: 'message',
          title: 'رسالة جديدة',
          description: `${sender?.full_name || 'مستخدم'}: ${msg.content?.slice(0, 80) || '📎 مرفق'}`,
          timestamp: msg.created_at,
          actionLabel: 'فتح المحادثة',
          actionHref: `/chat?conversationId=${msg.conversation_id}`,
          meta: { role: sender?.role },
        });
      });

      // Reviews
      (reviewsRes.data || []).forEach((review: any) => {
        const customerName = Array.isArray(review.customer) ? review.customer[0]?.full_name : review.customer?.full_name;
        const craftsmanProfile = Array.isArray(review.craftsman_profiles) ? review.craftsman_profiles[0] : review.craftsman_profiles;
        const craftsmanName = craftsmanProfile?.user_profiles?.full_name || craftsmanProfile?.user_profiles?.[0]?.full_name;
        allEvents.push({
          id: `review-${review.id}`,
          type: 'review',
          title: `تقييم جديد ${Array.from({ length: review.rating || 0 }).map(() => '⭐').join('')}`,
          description: `${customerName || 'عميل'} قيّم ${craftsmanName || 'صنايعي'}${review.comment ? `: "${review.comment.slice(0, 60)}"` : ''}`,
          timestamp: review.created_at,
          meta: { rating: review.rating },
        });
      });

      // Sort by timestamp descending
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEvents(allEvents);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtime = () => {
    // New orders
    const ordersChannel = supabase
      .channel('activity-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload) => {
        const order = payload.new as any;
        const newEvent: ActivityEvent = {
          id: `order-new-${order.id}`,
          type: 'new_order',
          title: 'طلب خدمة جديد',
          description: `طلب جديد وارد`,
          timestamp: order.created_at,
          actionLabel: 'عرض الطلب',
          actionHref: `/order-details?orderId=${order.id}`,
          meta: { amount: order.amount, status: order.status },
        };
        setEvents((prev) => [newEvent, ...prev]);
        setNewCount((c) => c + 1);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, async (payload) => {
        const order = payload.new as any;
        if (order.status && order.status !== 'pending') {
          const newEvent: ActivityEvent = {
            id: `order-status-${order.id}-${Date.now()}`,
            type: 'order_status',
            title: `تغيير حالة الطلب إلى "${STATUS_LABELS[order.status] || order.status}"`,
            description: `تم تحديث حالة الطلب`,
            timestamp: new Date().toISOString(),
            actionLabel: 'عرض الطلب',
            actionHref: `/order-details?orderId=${order.id}`,
            meta: { status: order.status, amount: order.amount },
          };
          setEvents((prev) => [newEvent, ...prev]);
          setNewCount((c) => c + 1);
        }
      })
      .subscribe();

    // New messages
    const messagesChannel = supabase
      .channel('activity-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any;
        const newEvent: ActivityEvent = {
          id: `msg-${msg.id}`,
          type: 'message',
          title: 'رسالة جديدة',
          description: msg.content?.slice(0, 80) || '📎 مرفق',
          timestamp: msg.created_at,
          actionLabel: 'فتح المحادثة',
          actionHref: `/chat?conversationId=${msg.conversation_id}`,
        };
        setEvents((prev) => [newEvent, ...prev]);
        setNewCount((c) => c + 1);
      })
      .subscribe();

    // New reviews
    const reviewsChannel = supabase
      .channel('activity-reviews')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, (payload) => {
        const review = payload.new as any;
        const newEvent: ActivityEvent = {
          id: `review-${review.id}`,
          type: 'review',
          title: `تقييم جديد ${Array.from({ length: review.rating || 0 }).map(() => '⭐').join('')}`,
          description: review.comment?.slice(0, 80) || 'تقييم بدون تعليق',
          timestamp: review.created_at || new Date().toISOString(),
          meta: { rating: review.rating },
        };
        setEvents((prev) => [newEvent, ...prev]);
        setNewCount((c) => c + 1);
      })
      .subscribe();

    channelsRef.current = [ordersChannel, messagesChannel, reviewsChannel];
  };

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter);

  const FILTER_OPTIONS: { id: 'all' | ActivityEvent['type']; label: string; emoji: string }[] = [
    { id: 'all', label: 'الكل', emoji: '📋' },
    { id: 'new_order', label: 'طلبات جديدة', emoji: '🆕' },
    { id: 'order_status', label: 'تغييرات الحالة', emoji: '📦' },
    { id: 'message', label: 'الرسائل', emoji: '💬' },
    { id: 'review', label: 'التقييمات', emoji: '⭐' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-white">سجل النشاط الفوري</h2>
          {newCount > 0 && (
            <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              +{newCount} جديد
            </span>
          )}
        </div>
        <button
          onClick={() => { loadInitialEvents(); setNewCount(0); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
        >
          <Icon name="ArrowPathIcon" size={14} />
          <span>تحديث</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              filter === opt.id
                ? 'bg-emerald-600 border-emerald-600 text-white' :'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
            }`}
          >
            <span>{opt.emoji}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-gray-800 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-800 rounded w-1/3" />
                  <div className="h-3 bg-gray-800 rounded w-2/3" />
                  <div className="h-2 bg-gray-800 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-sm">لا توجد أحداث</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filtered.map((event, idx) => {
              const cfg = EVENT_CONFIG[event.type];
              return (
                <div
                  key={event.id}
                  className={`flex items-start gap-3 px-4 py-4 hover:bg-gray-800/30 transition-colors ${
                    idx === 0 && newCount > 0 ? 'bg-emerald-900/10' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} ${cfg.border} border flex items-center justify-center flex-shrink-0`}>
                    <span className="text-lg">{cfg.emoji}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${cfg.color} truncate`}>{event.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{event.description}</p>

                        {/* Meta badges */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {event.meta?.amount && (
                            <span className="text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded-lg font-semibold">
                              {Number(event.meta.amount).toLocaleString('ar-SA')} ₪
                            </span>
                          )}
                          {event.meta?.status && (
                            <span className="text-xs bg-gray-800 text-gray-300 border border-gray-700 px-2 py-0.5 rounded-lg">
                              {STATUS_LABELS[String(event.meta.status)] || String(event.meta.status)}
                            </span>
                          )}
                          {event.meta?.rating && (
                            <span className="text-xs text-yellow-300">
                              {'⭐'.repeat(Number(event.meta.rating))}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Timestamp + action */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span
                          className="text-xs text-gray-500 whitespace-nowrap"
                          title={formatAbsoluteTime(event.timestamp)}
                        >
                          {formatRelativeTime(event.timestamp)}
                        </span>
                        {event.actionLabel && event.actionHref && (
                          <a
                            href={event.actionHref}
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold bg-emerald-900/30 hover:bg-emerald-900/50 px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {event.actionLabel} ←
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer count */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-500">{filtered.length} حدث</span>
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse inline-block" />
              مباشر
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
