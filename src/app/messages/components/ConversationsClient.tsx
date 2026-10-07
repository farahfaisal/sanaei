'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BottomTabBar from '@/components/BottomTabBar';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
import LogoLoader from '@/components/LogoLoader';
  formatChatTime,
  listConversations,
  otherParticipant,
  unreadCounts,
  type Conversation,
} from '@/lib/chat';

export default function ConversationsClient() {
  const supabase = useMemo(() => createClient(), []);
  const { user, role } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [list, counts] = await Promise.all([
        listConversations(supabase, userId),
        unreadCounts(supabase, userId),
      ]);
      setConversations(list);
      setUnread(counts);
      setError('');
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('تعذّر تحميل المحادثات، يرجى المحاولة مجدداً');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh the list whenever a message arrives in any of my conversations.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`conversations-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => void load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  const emptyHint =
    role === 'craftsman'
      ? 'ستظهر هنا رسائل الزبائن عندما يتواصلون معك'
      : 'افتح ملف أي حِرَفي واضغط «رسالة» لبدء محادثة';

  return (
    <div className="screen-container min-h-screen bg-gray-50 pb-20" dir="rtl">
      <header className="bg-white px-5 pt-12 pb-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">المحادثات</h1>
      </header>

      {isLoading ? (
        <LogoLoader size={56} />
      ) : error ? (
        <div className="text-center py-16 px-6">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <button type="button" onClick={() => void load()} className="text-primary text-sm font-semibold">
            إعادة المحاولة
          </button>
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <Icon name="ChatBubbleLeftRightIcon" size={32} className="text-primary" />
          </div>
          <p className="text-base font-semibold text-gray-800 mb-1">لا توجد محادثات بعد</p>
          <p className="text-sm text-gray-500">{emptyHint}</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 bg-white">
          {conversations.map((conversation) => {
            const other = userId ? otherParticipant(conversation, userId) : null;
            const count = unread[conversation.id] ?? 0;
            const name = other?.full_name || (role === 'craftsman' ? 'زبون' : 'حِرَفي');
            return (
              <li key={conversation.id}>
                <Link
                  href={`/messages/${conversation.id}`}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-green-100 flex items-center justify-center flex-shrink-0">
                    {other?.avatar_url ? (
                      <AppImage src={other.avatar_url} alt={name} width={48} height={48} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-primary">{name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-bold text-gray-900 truncate">{name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatChatTime(conversation.last_message_at ?? conversation.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${count > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                        {conversation.last_message || 'ابدأ المحادثة'}
                      </p>
                      {count > 0 && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {count}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <BottomTabBar activeTab="messages" />
    </div>
  );
}
