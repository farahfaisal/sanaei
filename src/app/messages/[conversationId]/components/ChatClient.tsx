'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  formatMessageTime,
  getConversation,
  listMessages,
  markConversationRead,
  MAX_MESSAGE_LENGTH,
  otherParticipant,
  sendTextMessage,
  type ChatMessage,
  type Conversation,
} from '@/lib/chat';

/** A message shown before the server confirms it. */
interface PendingMessage extends ChatMessage {
  status: 'sending' | 'failed';
}

type DisplayMessage = ChatMessage | PendingMessage;

function isPending(message: DisplayMessage): message is PendingMessage {
  return 'status' in message;
}

export default function ChatClient() {
  const router = useRouter();
  const params = useParams<{ conversationId: string }>();
  const conversationId = params?.conversationId ?? '';
  const supabase = useMemo(() => createClient(), []);
  const { user, role, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Adds or replaces a confirmed message, keeping chronological order and no duplicates.
  const upsertMessage = useCallback((incoming: ChatMessage) => {
    setMessages((prev) => {
      const withoutDup = prev.filter((m) => m.id !== incoming.id);
      return [...withoutDup, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  // Initial load.
  useEffect(() => {
    if (authLoading || !userId || !conversationId) return;
    let active = true;
    (async () => {
      try {
        const [conv, history] = await Promise.all([
          getConversation(supabase, conversationId),
          listMessages(supabase, conversationId),
        ]);
        if (!active) return;
        if (!conv) {
          setNotFound(true);
          return;
        }
        setConversation(conv);
        setMessages(history);
        void markConversationRead(supabase, conversationId, userId);
      } catch (err) {
        console.error('Failed to load chat:', err);
        if (active) setNotFound(true);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase, conversationId, userId, authLoading]);

  // Live updates: new messages and read receipts.
  useEffect(() => {
    if (!userId || !conversationId) return;
    const filter = `conversation_id=eq.${conversationId}`;
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, (payload) => {
        const message = payload.new as ChatMessage;
        upsertMessage(message);
        if (message.sender_id !== userId) void markConversationRead(supabase, conversationId, userId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter }, (payload) => {
        upsertMessage(payload.new as ChatMessage);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, userId, upsertMessage]);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const deliver = useCallback(
    async (pending: PendingMessage) => {
      if (!userId) return;
      try {
        const saved = await sendTextMessage(supabase, conversationId, userId, pending.content ?? '');
        setMessages((prev) => prev.filter((m) => m.id !== pending.id));
        upsertMessage(saved);
      } catch (err) {
        console.error('Failed to send message:', err);
        setMessages((prev) => prev.map((m) => (m.id === pending.id ? { ...pending, status: 'failed' } : m)));
      }
    },
    [supabase, conversationId, userId, upsertMessage]
  );

  const handleSend = (event?: React.FormEvent) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || !userId) return;
    const pending: PendingMessage = {
      id: `pending-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: userId,
      content,
      message_type: 'text',
      media_url: null,
      is_read: false,
      created_at: new Date().toISOString(),
      status: 'sending',
    };
    setMessages((prev) => [...prev, pending]);
    setDraft('');
    void deliver(pending);
  };

  const retry = (message: PendingMessage) => {
    const again: PendingMessage = { ...message, status: 'sending' };
    setMessages((prev) => prev.map((m) => (m.id === message.id ? again : m)));
    void deliver(again);
  };

  const other = conversation && userId ? otherParticipant(conversation, userId) : null;
  const otherName = other?.full_name || (role === 'craftsman' ? 'زبون' : 'حِرَفي');

  if (isLoading || authLoading) {
    return (
      <div className="screen-container min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !conversation) {
    return (
      <div className="screen-container min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center" dir="rtl">
        <p className="text-sm text-gray-500 mb-4">لم يتم العثور على المحادثة</p>
        <button type="button" onClick={() => router.replace('/messages')} className="text-primary text-sm font-semibold">
          العودة إلى المحادثات
        </button>
      </div>
    );
  }

  return (
    <div className="screen-container flex flex-col h-[100dvh] bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-12 pb-3 bg-white border-b border-gray-100">
        <button
          type="button"
          onClick={() => router.push('/messages')}
          aria-label="رجوع"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"
        >
          <Icon name="ChevronRightIcon" size={20} className="text-gray-700" />
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-green-100 flex items-center justify-center flex-shrink-0">
          {other?.avatar_url ? (
            <AppImage src={other.avatar_url} alt={otherName} width={40} height={40} className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-bold text-primary">{otherName.charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-gray-900 truncate">{otherName}</h1>
          <p className="text-xs text-gray-400">{role === 'craftsman' ? 'زبون' : 'حِرَفي'}</p>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-2" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">لا توجد رسائل بعد — اكتب أول رسالة 👋</p>
        )}
        {messages.map((message) => {
          const mine = message.sender_id === userId;
          const pending = isPending(message) ? message : null;
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm ${
                  mine ? 'bg-primary text-white rounded-br-md' : 'bg-white text-gray-900 rounded-bl-md'
                } ${pending?.status === 'failed' ? 'opacity-70' : ''}`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                <div className={`flex items-center gap-1 mt-1 text-[11px] ${mine ? 'text-green-100' : 'text-gray-400'}`}>
                  <span>{formatMessageTime(message.created_at)}</span>
                  {mine && !pending && (
                    <Icon
                      name={message.is_read ? 'CheckBadgeIcon' : 'CheckIcon'}
                      size={13}
                      className={mine ? 'text-green-100' : ''}
                      aria-label={message.is_read ? 'مقروءة' : 'تم الإرسال'}
                    />
                  )}
                  {pending?.status === 'sending' && <span>جاري الإرسال…</span>}
                </div>
                {pending?.status === 'failed' && (
                  <button type="button" onClick={() => retry(pending)} className="mt-1 text-[11px] font-semibold underline">
                    فشل الإرسال — إعادة المحاولة
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* Composer */}
      <form onSubmit={handleSend} className="flex items-end gap-2 px-3 py-3 bg-white border-t border-gray-100">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder="اكتب رسالتك…"
          aria-label="نص الرسالة"
          className="flex-1 resize-none max-h-32 py-3 px-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="إرسال"
          className="w-11 h-11 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
        >
          <Icon name="PaperAirplaneIcon" size={20} className="text-white rtl-flip" />
        </button>
      </form>
    </div>
  );
}
