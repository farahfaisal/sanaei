'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import BottomTabBar from '@/components/BottomTabBar';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ConversationItem {
  id: string;
  customer_id: string;
  craftsman_id: string;
  order_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count?: number;
  other_party: {
    full_name: string;
    avatar_url: string | null;
    role: string;
  } | null;
  order_status?: string | null;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `${diffMins} د`;
  if (diffHours < 24) return `${diffHours} س`;
  if (diffDays < 7) return `${diffDays} ي`;
  return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

const ORDER_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending:     { label: 'قيد الانتظار', color: '#D97706' },
  accepted:    { label: 'مقبول',        color: '#0284C7' },
  in_progress: { label: 'جاري التنفيذ', color: '#7C3AED' },
  completed:   { label: 'مكتمل',        color: '#059669' },
  cancelled:   { label: 'ملغي',         color: '#DC2626' },
};

export default function ConversationsClient() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: authLoading } = useAuth();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const isCraftsman = profile?.role === 'craftsman';

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch conversations where user is customer or craftsman
      const { data: convs } = await supabase
        .from('conversations')
        .select(`
          id, customer_id, craftsman_id, order_id,
          last_message, last_message_at
        `)
        .or(`customer_id.eq.${user.id},craftsman_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (!convs) { setLoading(false); return; }

      // Fetch other party profiles and order statuses
      const enriched: ConversationItem[] = await Promise.all(
        convs.map(async (conv) => {
          const otherPartyId = conv.customer_id === user.id ? conv.craftsman_id : conv.customer_id;

          const { data: otherProfile } = await supabase
            .from('user_profiles')
            .select('full_name, avatar_url, role')
            .eq('id', otherPartyId)
            .maybeSingle();

          // Count unread messages
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);

          let orderStatus: string | null = null;
          if (conv.order_id) {
            const { data: order } = await supabase
              .from('orders')
              .select('status')
              .eq('id', conv.order_id)
              .maybeSingle();
            orderStatus = order?.status || null;
          }

          return {
            ...conv,
            other_party: otherProfile || null,
            unread_count: unreadCount || 0,
            order_status: orderStatus,
          };
        })
      );

      setConversations(enriched);
    } catch (e) {
      console.error('Error loading conversations:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/phone-login-otp-verification'); return; }
    loadConversations();
  }, [user, authLoading, loadConversations]);

  // Real-time: update conversation list on new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`conversations-realtime:${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `customer_id=eq.${user.id}`,
      }, (payload) => {
        const updated = payload.new as any;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === updated.id
              ? { ...c, last_message: updated.last_message, last_message_at: updated.last_message_at }
              : c
          ).sort((a, b) => {
            const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return bTime - aTime;
          })
        );
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `craftsman_id=eq.${user.id}`,
      }, (payload) => {
        const updated = payload.new as any;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === updated.id
              ? { ...c, last_message: updated.last_message, last_message_at: updated.last_message_at }
              : c
          ).sort((a, b) => {
            const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return bTime - aTime;
          })
        );
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, async (payload) => {
        const newMsg = payload.new as any;
        // Only update if this message belongs to one of our conversations
        setConversations((prev) => {
          const conv = prev.find((c) => c.id === newMsg.conversation_id);
          if (!conv) return prev;
          // Increment unread count if message is from the other party
          const isFromOther = newMsg.sender_id !== user.id;
          return prev.map((c) =>
            c.id === newMsg.conversation_id
              ? {
                  ...c,
                  last_message: newMsg.content || (newMsg.message_type === 'image' ? '📷 صورة' : newMsg.message_type === 'file' ? '📎 ملف' : c.last_message),
                  last_message_at: newMsg.created_at,
                  unread_count: isFromOther ? (c.unread_count || 0) + 1 : c.unread_count,
                }
              : c
          ).sort((a, b) => {
            const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return bTime - aTime;
          });
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
      }, () => {
        // A new conversation was created — reload the full list
        loadConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, loadConversations]);

  const filtered = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const name = c.other_party?.full_name?.toLowerCase() || '';
    const msg = c.last_message?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return name.includes(q) || msg.includes(q);
  });

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#f0f2f5' }} dir="rtl">
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 pt-12 pb-4"
        style={{ background: 'linear-gradient(145deg, #1d5236 0%, #2a724d 45%, #358f61 100%)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <Icon name="ChevronRightIcon" size={20} className="text-white" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">المحادثات</h1>
              {totalUnread > 0 && (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {totalUnread} رسالة غير مقروءة
                </p>
              )}
            </div>
          </div>
          <button
            onClick={loadConversations}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <Icon name="ArrowPathIcon" size={18} className="text-white" />
          </button>
        </div>

        {/* Search bar */}
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          <Icon name="MagnifyingGlassIcon" size={18} className="text-white opacity-70 flex-shrink-0" />
          <input
            type="text"
            placeholder="ابحث في المحادثات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/60 focus:outline-none"
            style={{ direction: 'rtl' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <Icon name="XMarkIcon" size={16} className="text-white opacity-70" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div
              className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#2a724d', borderTopColor: 'transparent' }}
            />
            <p className="text-sm text-gray-500">جاري تحميل المحادثات...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 px-8">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(42,114,77,0.1)' }}
            >
              <Icon name="ChatBubbleLeftRightIcon" size={36} style={{ color: '#2a724d' } as any} />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-gray-700 mb-1">
                {searchQuery ? 'لا توجد نتائج' : 'لا توجد محادثات بعد'}
              </p>
              <p className="text-sm text-gray-400">
                {searchQuery
                  ? 'جرّب كلمة بحث مختلفة'
                  : isCraftsman
                  ? 'ستظهر هنا محادثاتك مع العملاء' :'ابدأ بطلب خدمة للتواصل مع صنايعي'}
              </p>
            </div>
            {!searchQuery && !isCraftsman && (
              <button
                onClick={() => router.push('/search')}
                className="px-6 py-3 rounded-2xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #2a724d, #1d5236)' }}
              >
                ابحث عن صنايعي
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((conv) => {
              const hasUnread = (conv.unread_count || 0) > 0;
              const statusBadge = conv.order_status ? ORDER_STATUS_BADGE[conv.order_status] : null;

              return (
                <button
                  key={conv.id}
                  onClick={() => router.push(`/chat?conversation_id=${conv.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-right transition-colors active:bg-gray-100"
                  style={{ background: hasUnread ? 'rgba(42,114,77,0.04)' : 'white' }}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center"
                      style={{ background: '#e8f5e9' }}
                    >
                      {conv.other_party?.avatar_url ? (
                        <AppImage
                          src={conv.other_party.avatar_url}
                          alt={conv.other_party.full_name || 'مستخدم'}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Icon name="UserCircleIcon" size={32} style={{ color: '#2a724d' } as any} />
                      )}
                    </div>
                    {/* Role badge */}
                    <div
                      className="absolute -bottom-0.5 -left-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white"
                      style={{ background: conv.other_party?.role === 'craftsman' ? '#2a724d' : '#0284C7' }}
                    >
                      <Icon
                        name={conv.other_party?.role === 'craftsman' ? 'WrenchScrewdriverIcon' : 'UserIcon'}
                        size={10}
                        className="text-white"
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span
                        className="text-sm font-bold truncate"
                        style={{ color: hasUnread ? '#1d5236' : '#111827' }}
                      >
                        {conv.other_party?.full_name || 'مستخدم'}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0 mr-2">
                        {timeAgo(conv.last_message_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="text-xs truncate flex-1"
                        style={{ color: hasUnread ? '#374151' : '#9ca3af', fontWeight: hasUnread ? 600 : 400 }}
                      >
                        {conv.last_message || 'ابدأ المحادثة...'}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {statusBadge && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ color: statusBadge.color, background: `${statusBadge.color}18` }}
                          >
                            {statusBadge.label}
                          </span>
                        )}
                        {hasUnread && (
                          <span
                            className="min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold text-white flex items-center justify-center"
                            style={{ background: '#2a724d' }}
                          >
                            {conv.unread_count! > 99 ? '99+' : conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom padding for tab bar */}
      <div className="h-24 flex-shrink-0" />
      <BottomTabBar activeTab="orders" />
    </div>
  );
}
