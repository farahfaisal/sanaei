'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useRouter } from 'next/navigation';

interface ConversationRow {
  id: string;
  customer_id: string;
  craftsman_id: string;
  order_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  customer?: { full_name: string; avatar_url: string | null };
  craftsman?: { full_name: string; avatar_url: string | null };
  order?: { status: string; amount: number | null; escrow_status: string; description: string | null };
  message_count?: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  is_read: boolean;
  created_at: string;
  sender?: { full_name: string; avatar_url: string | null; role: string };
}

export default function ChatsTab() {
  const supabase = createClient();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'held' | 'active'>('all');

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('conversations')
        .select(`
          id, customer_id, craftsman_id, order_id, last_message, last_message_at, created_at,
          customer:customer_id(full_name, avatar_url),
          craftsman:craftsman_id(full_name, avatar_url),
          order:order_id(status, amount, escrow_status, description)
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(100);

      if (data) {
        setConversations(data.map((c: any) => ({
          ...c,
          customer: Array.isArray(c.customer) ? c.customer[0] : c.customer,
          craftsman: Array.isArray(c.craftsman) ? c.craftsman[0] : c.craftsman,
          order: Array.isArray(c.order) ? c.order[0] : c.order,
        })));
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (convId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:sender_id(full_name, avatar_url, role)')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data.map((m: any) => ({
          ...m,
          sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
        })));
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSelectConversation = (conv: ConversationRow) => {
    setSelectedConv(conv);
    loadMessages(conv.id);
  };

  const handleReleasePayment = async (conv: ConversationRow) => {
    if (!conv.order_id) return;
    if (!confirm('هل تريد تحرير المبلغ للحرفي؟')) return;
    try {
      await supabase
        .from('orders')
        .update({ escrow_status: 'released', status: 'completed' })
        .eq('id', conv.order_id);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conv.id
            ? { ...c, order: c.order ? { ...c.order, escrow_status: 'released', status: 'completed' } : c.order }
            : c
        )
      );
      if (selectedConv?.id === conv.id) {
        setSelectedConv((prev) =>
          prev ? { ...prev, order: prev.order ? { ...prev.order, escrow_status: 'released', status: 'completed' } : prev.order } : prev
        );
      }
      alert('تم تحرير المبلغ للحرفي بنجاح ✅');
    } catch (e: any) {
      alert(e?.message || 'حدث خطأ');
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const matchSearch =
      !searchQuery ||
      c.customer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.craftsman?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.last_message?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchFilter =
      filterStatus === 'all' ||
      (filterStatus === 'held' && c.order?.escrow_status === 'held') ||
      (filterStatus === 'active' && c.order?.status === 'in_progress');

    return matchSearch && matchFilter;
  });

  const getStatusBadge = (conv: ConversationRow) => {
    const escrow = conv.order?.escrow_status;
    const status = conv.order?.status;
    if (escrow === 'held') return { label: '💰 محجوز', color: 'bg-yellow-100 text-yellow-700' };
    if (escrow === 'released') return { label: '✅ محرَّر', color: 'bg-green-100 text-green-700' };
    if (status === 'in_progress') return { label: '🔄 جاري', color: 'bg-blue-100 text-blue-700' };
    if (status === 'completed') return { label: '✅ مكتمل', color: 'bg-emerald-100 text-emerald-700' };
    if (status === 'pending') return { label: '⏳ معلق', color: 'bg-gray-100 text-gray-600' };
    return null;
  };

  return (
    <div className="flex h-full gap-4" style={{ minHeight: '600px' }}>
      {/* Conversations list */}
      <div className="w-full lg:w-80 flex-shrink-0 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">المحادثات</h3>
            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">{conversations.length}</span>
          </div>
          {/* Search */}
          <div className="relative mb-2">
            <Icon name="MagnifyingGlassIcon" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="بحث..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pr-8 pl-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
            />
          </div>
          {/* Filter */}
          <div className="flex gap-1">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'held', label: '💰 محجوز' },
              { id: 'active', label: '🔄 جاري' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id as any)}
                className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === f.id ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-3xl mb-2">💬</div>
              <p className="text-xs text-gray-500">لا توجد محادثات</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const badge = getStatusBadge(conv);
              const isSelected = selectedConv?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full p-3 border-b border-gray-800 text-right transition-colors ${
                    isSelected ? 'bg-emerald-900/30' : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {conv.customer?.avatar_url ? (
                        <AppImage src={conv.customer.avatar_url} alt={conv.customer.full_name || ''} width={36} height={36} className="w-full h-full object-cover" />
                      ) : (
                        <Icon name="UserCircleIcon" size={18} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-xs font-bold text-white truncate">
                          {conv.customer?.full_name || 'زبون'} ↔ {conv.craftsman?.full_name || 'حرفي'}
                        </p>
                        {badge && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{conv.last_message || 'لا توجد رسائل'}</p>
                      {conv.order?.amount && (
                        <p className="text-xs text-emerald-400 mt-0.5">{conv.order.amount.toLocaleString('ar-SA')} ₪</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Message viewer */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden">
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm text-gray-400">اختر محادثة لعرض الرسائل</p>
            </div>
          </div>
        ) : (
          <>
            {/* Conv header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">
                  {selectedConv.customer?.full_name || 'زبون'} ↔ {selectedConv.craftsman?.full_name || 'حرفي'}
                </p>
                {selectedConv.order?.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{selectedConv.order.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedConv.order?.escrow_status === 'held' && (
                  <button
                    onClick={() => handleReleasePayment(selectedConv)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs text-white font-semibold transition-colors"
                  >
                    <Icon name="BanknotesIcon" size={14} />
                    تحرير المبلغ للحرفي
                  </button>
                )}
                {selectedConv.order?.escrow_status === 'released' && (
                  <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded-lg">✅ تم تحرير المبلغ</span>
                )}
              </div>
            </div>

            {/* Order info bar */}
            {selectedConv.order && (
              <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800 flex items-center gap-4 text-xs">
                <span className="text-gray-400">
                  الحالة: <span className="text-white font-semibold">{selectedConv.order.status}</span>
                </span>
                {selectedConv.order.amount && (
                  <span className="text-gray-400">
                    المبلغ: <span className="text-emerald-400 font-semibold">{selectedConv.order.amount.toLocaleString('ar-SA')} ₪</span>
                  </span>
                )}
                <span className="text-gray-400">
                  الضمان: <span className={`font-semibold ${selectedConv.order.escrow_status === 'held' ? 'text-yellow-400' : selectedConv.order.escrow_status === 'released' ? 'text-emerald-400' : 'text-gray-300'}`}>
                    {selectedConv.order.escrow_status === 'held' ? 'محجوز' : selectedConv.order.escrow_status === 'released' ? 'محرَّر' : 'لا يوجد'}
                  </span>
                </span>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingMessages ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                      <div className="w-7 h-7 rounded-full bg-gray-700 animate-pulse flex-shrink-0" />
                      <div className="h-10 w-48 bg-gray-700 rounded-2xl animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">لا توجد رسائل في هذه المحادثة</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isCustomerMsg = msg.sender?.role === 'customer';
                  const senderName = msg.sender?.full_name || 'مجهول';
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isCustomerMsg ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="w-7 h-7 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden mt-1">
                        {msg.sender?.avatar_url ? (
                          <AppImage src={msg.sender.avatar_url} alt={senderName} width={28} height={28} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon name="UserCircleIcon" size={14} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className={`max-w-[70%] flex flex-col gap-0.5 ${isCustomerMsg ? 'items-end' : 'items-start'}`}>
                        <p className="text-xs text-gray-500 px-1">{senderName}</p>
                        <div className={`rounded-2xl px-3 py-2 ${
                          msg.message_type === 'quote' ?'bg-blue-900/40 border border-blue-700/50'
                            : isCustomerMsg
                            ? 'bg-emerald-700' :'bg-gray-700'
                        }`}>
                          {msg.message_type === 'image' && msg.media_url ? (
                            <div className="w-40 h-40 rounded-xl overflow-hidden">
                              <AppImage src={msg.media_url} alt="صورة" width={160} height={160} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <p className={`text-xs leading-relaxed whitespace-pre-wrap ${
                              msg.message_type === 'quote' ? 'text-blue-300 font-semibold' : 'text-white'
                            }`}>
                              {msg.content}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 px-1">
                          {new Date(msg.created_at).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
