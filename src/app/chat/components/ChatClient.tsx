'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateConversation } from '@/lib/supabase/chat';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'video' | 'quote' | 'file' | 'system';
  media_url: string | null;
  file_name: string | null;
  file_size: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender?: { full_name: string; avatar_url: string | null; role: string };
}

interface PriceQuote {
  id: string;
  order_id: string;
  craftsman_id: string;
  amount: number;
  description: string | null;
  quote_status: 'pending' | 'accepted' | 'rejected' | 'modification_requested';
  modification_note: string | null;
  created_at: string;
}

interface ConversationInfo {
  id: string;
  customer_id: string;
  craftsman_id: string;
  order_id: string | null;
  customer?: { full_name: string; avatar_url: string | null };
  craftsman?: { full_name: string; avatar_url: string | null };
  order?: {
    id: string;
    status: string;
    description: string | null;
    service_images: string[] | null;
    payment_method: string | null;
    payment_status?: string | null;
    escrow_status: string;
    amount: number | null;
  };
}

type ChatStep = 'chat' | 'payment_method' | 'payment_held';

// WhatsApp-style double tick SVG
const DoubleTick = ({ read, readAt }: { read: boolean; readAt?: string | null }) => (
  <span title={read && readAt ? `قُرئت ${new Date(readAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}` : ''}>
    <svg width="16" height="11" viewBox="0 0 16 11" className="inline-block ml-1">
      <path d="M11.071.653a.75.75 0 0 1 .025 1.06l-5.5 5.75a.75.75 0 0 1-1.085 0l-2.5-2.614a.75.75 0 1 1 1.085-1.037l1.957 2.047 4.957-5.181a.75.75 0 0 1 1.06-.025z" fill={read ? '#53bdeb' : '#8696a0'} />
      <path d="M14.571.653a.75.75 0 0 1 .025 1.06l-5.5 5.75a.75.75 0 0 1-.542.234.75.75 0 0 1-.025-1.06l5.5-5.75a.75.75 0 0 1 1.06-.025l.025.025-.543-.234z" fill={read ? '#53bdeb' : '#8696a0'} />
    </svg>
  </span>
);

// Typing indicator dots
const TypingIndicator = () => (
  <div className="flex mb-1 justify-end">
    <div className="relative max-w-[75%] rounded-2xl px-4 py-3 shadow-sm" style={{ background: 'white', borderTopLeftRadius: '4px' }}>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <div className="absolute top-0 left-[-6px]" style={{ width: 0, height: 0, borderTop: '8px solid white', borderRight: '8px solid transparent' }} />
    </div>
  </div>
);

// File size formatter
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// System message bubble (centered, pill-style)
const SystemMessage = ({ content }: { content: string }) => (
  <div className="flex justify-center my-2">
    <span
      className="px-4 py-1.5 rounded-full text-xs font-medium shadow-sm"
      style={{ background: 'rgba(255,255,255,0.85)', color: '#555', maxWidth: '80%', textAlign: 'center' }}
    >
      {content}
    </span>
  </div>
);

// Status label map
export default function ChatClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams?.get('conversation_id');
  const orderId = searchParams?.get('order_id');
  const craftsmanIdParam = searchParams?.get('craftsman_id');
  const { user, profile } = useAuth();
  const supabase = createClient();

  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [quotes, setQuotes] = useState<PriceQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [chatStep, setChatStep] = useState<ChatStep>('chat');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'wallet'>('cash');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteDescription, setQuoteDescription] = useState('');
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [isRespondingToQuote, setIsRespondingToQuote] = useState(false);

  const [showModificationInput, setShowModificationInput] = useState<string | null>(null);
  const [modificationNote, setModificationNote] = useState('');

  // Typing indicator state
  const [otherPartyTyping, setOtherPartyTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCraftsman = profile?.role === 'craftsman';
  const isCustomer = profile?.role === 'customer';

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    } else if (orderId) {
      findOrCreateConversation(orderId);
    } else if (craftsmanIdParam && user) {
      findOrCreateDirectConversation(craftsmanIdParam);
    }
  }, [conversationId, orderId, craftsmanIdParam, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, otherPartyTyping]);

  // Real-time: messages + typing via broadcast
  useEffect(() => {
    if (!conversation?.id || !user) return;

    const channel = supabase
      .channel(`chat:${conversation.id}`)
      // New messages
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        const { data: senderData } = await supabase
          .from('user_profiles')
          .select('full_name, avatar_url, role')
          .eq('id', newMsg.sender_id)
          .maybeSingle();
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMsg.id)) return prev;
          return [...prev, { ...newMsg, sender: senderData || undefined }];
        });
        // Mark as read if it's from the other party
        if (newMsg.sender_id !== user.id) {
          await supabase.rpc('mark_messages_read', {
            p_conversation_id: conversation.id,
            p_reader_id: user.id,
          });
        }
      })
      // Read receipt updates
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages((prev) =>
          prev.map((m) => m.id === updated.id ? { ...m, is_read: updated.is_read, read_at: updated.read_at } : m)
        );
      })
      // Typing indicator via broadcast
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.user_id !== user.id) {
          setOtherPartyTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherPartyTyping(false), 3000);
        }
      })
      .subscribe();

    chatChannelRef.current = channel;

    return () => {
      chatChannelRef.current = null;
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversation?.id, user]);

  // Reload this order's quotes (used on load and when a quote changes).
  const refreshQuotes = useCallback(async (orderId: string) => {
    const { data } = await supabase.from('price_quotes').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
    if (data) setQuotes(data as any);
  }, []);

  // Live order + quote updates. Status messages ("تم قبول الطلب"…) are posted once
  // by the database, so here we only keep the screen in sync.
  useEffect(() => {
    if (!conversation?.order_id || !conversation?.id || !user) return;
    const orderId = conversation.order_id;

    const orderChannel = supabase
      .channel(`order-live:${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        const updated = payload.new as any;
        setConversation((prev) => prev && prev.order
          ? { ...prev, order: { ...prev.order, status: updated.status, amount: updated.amount, payment_status: updated.payment_status, escrow_status: updated.escrow_status, payment_method: updated.payment_method } as any }
          : prev);
        if (updated.escrow_status === 'held') setChatStep('payment_held');
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'price_quotes',
        filter: `order_id=eq.${orderId}`,
      }, () => { void refreshQuotes(orderId); })
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [conversation?.order_id, conversation?.id, user, refreshQuotes]);

  const sendTypingIndicator = useCallback(() => {
    if (!conversation?.id || !user || !chatChannelRef.current) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      chatChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: user.id },
      });
      setTimeout(() => { isTypingRef.current = false; }, 2000);
    }
  }, [conversation?.id, user]);

  /**
   * Inserts a message and shows it right away (doesn't wait for realtime).
   * The realtime listener skips messages already in the list, so no duplicates.
   */
  const insertMessage = async (row: {
    conversation_id: string;
    sender_id: string;
    content: string | null;
    message_type: string;
    media_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
  }) => {
    const { data, error } = await supabase
      .from('messages')
      .insert(row)
      .select('*, sender:sender_id(full_name, avatar_url, role)')
      .single();
    if (error) throw error;
    const saved = { ...(data as any), sender: Array.isArray((data as any).sender) ? (data as any).sender[0] : (data as any).sender } as Message;
    setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
    return saved;
  };

  // Chat about a specific order: opens the single thread with that craftsman and switches it to this order.
  const findOrCreateConversation = async (oId: string) => {
    setIsLoading(true);
    try {
      const { data: order } = await supabase.from('orders').select('id, customer_id, craftsman_profiles(user_id)').eq('id', oId).maybeSingle();
      const craftsmanUserId = (order as any)?.craftsman_profiles?.user_id as string | undefined;
      if (!order || !craftsmanUserId) { setIsLoading(false); return; }
      const convId = await getOrCreateConversation(supabase, { customerId: order.customer_id, craftsmanUserId, orderId: oId });
      await loadConversation(convId);
    } catch (e) {
      console.error('Failed to open order conversation:', e);
      setIsLoading(false);
    }
  };

  // Direct chat with a craftsman: always the same single thread (like WhatsApp).
  const findOrCreateDirectConversation = async (craftsmanUserId: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const convId = await getOrCreateConversation(supabase, { customerId: user.id, craftsmanUserId });
      await loadConversation(convId);
    } catch (e) {
      console.error('Failed to open conversation:', e);
      setIsLoading(false);
    }
  };

  const loadConversation = async (convId: string) => {
    setIsLoading(true);
    try {
      const { data: conv } = await supabase.from('conversations').select(`id, customer_id, craftsman_id, order_id, customer:customer_id(full_name, avatar_url), craftsman:craftsman_id(full_name, avatar_url)`).eq('id', convId).maybeSingle();
      if (!conv) { setIsLoading(false); return; }
      const convData: ConversationInfo = {
        id: conv.id, customer_id: conv.customer_id, craftsman_id: conv.craftsman_id, order_id: conv.order_id,
        customer: Array.isArray((conv as any).customer) ? (conv as any).customer[0] : (conv as any).customer,
        craftsman: Array.isArray((conv as any).craftsman) ? (conv as any).craftsman[0] : (conv as any).craftsman,
      };
      if (conv.order_id) {
        const { data: orderData } = await supabase.from('orders').select('id, status, description, service_images, payment_method, payment_status, escrow_status, amount').eq('id', conv.order_id).maybeSingle();
        if (orderData) { convData.order = orderData as any; if ((orderData as any).escrow_status === 'held') setChatStep('payment_held'); }
      }
      setConversation(convData);
      const { data: msgs } = await supabase.from('messages').select('*, sender:sender_id(full_name, avatar_url, role)').eq('conversation_id', convId).order('created_at', { ascending: true });
      if (msgs) setMessages(msgs.map((m: any) => ({ ...m, sender: Array.isArray(m.sender) ? m.sender[0] : m.sender })));
      if (conv.order_id) await refreshQuotes(conv.order_id);
      // Mark all unread messages as read
      if (user) {
        await supabase.rpc('mark_messages_read', {
          p_conversation_id: convId,
          p_reader_id: user.id,
        });
      }
    } catch (e) {
    } finally { setIsLoading(false); }
  };

  const sendMessage = async (content: string, type: 'text' | 'image' | 'file' = 'text', mediaUrl?: string, fileName?: string, fileSize?: number) => {
    if (!conversation || !user) return;
    if (type === 'text' && !content.trim()) return;
    setIsSending(true);
    setSendError('');
    try {
      await insertMessage({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: type === 'text' ? content.trim() : null,
        message_type: type,
        media_url: mediaUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
      });
      // The conversation preview is updated by a database trigger.
      if (type === 'text') {
        setMessageText('');
        if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      setSendError('تعذّر إرسال الرسالة، تحقق من الاتصال وحاول مجدداً');
    } finally { setIsSending(false); }
  };

  const handleFileUpload = async (file: File, isImage: boolean) => {
    if (!user || !conversation) return;
    setUploadingFile(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `chat/${conversation.id}/${user.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
      if (isImage) {
        await sendMessage('', 'image', urlData.publicUrl);
      } else {
        await sendMessage('', 'file', urlData.publicUrl, file.name, file.size);
      }
    } catch (e) {
      console.error('Failed to upload file:', e);
      setSendError('تعذّر رفع الملف، حاول مجدداً');
    } finally { setUploadingFile(false); }
  };

  // The craftsman sends a quote. The database checks it's their order, replaces any
  // earlier pending quote and posts the quote message — all in one step.
  const submitQuote = async () => {
    if (!conversation || !user) return;
    if (!conversation.order_id) {
      setSendError('لا يوجد طلب خدمة مرتبط بهذه المحادثة بعد — يرسل الزبون الطلب أولاً');
      return;
    }
    const amount = Number(quoteAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSendError('أدخل مبلغاً صحيحاً أكبر من صفر');
      return;
    }
    setIsSubmittingQuote(true);
    setSendError('');
    try {
      const { error } = await supabase.rpc('submit_quote', {
        p_order_id: conversation.order_id,
        p_amount: amount,
        p_description: quoteDescription.trim() || null,
      });
      if (error) throw error;
      await refreshQuotes(conversation.order_id);
      setShowQuoteForm(false); setQuoteAmount(''); setQuoteDescription('');
    } catch (e: any) {
      setSendError(e?.message || 'تعذّر إرسال عرض السعر');
    } finally { setIsSubmittingQuote(false); }
  };

  // The customer answers a quote. The database updates the quote, the order (on accept)
  // and posts the chat message together, so the screen never shows a half-done state.
  const handleQuoteAction = async (quote: PriceQuote, action: 'accepted' | 'rejected' | 'modification_requested') => {
    if (!conversation?.order_id || isRespondingToQuote) return;
    setIsRespondingToQuote(true);
    setSendError('');
    try {
      const { error } = await supabase.rpc('respond_to_quote', {
        p_quote_id: quote.id,
        p_action: action,
        p_note: action === 'modification_requested' ? modificationNote.trim() || null : null,
      });
      if (error) throw error;
      await refreshQuotes(conversation.order_id);
      if (action === 'accepted') {
        setConversation((prev) => prev && prev.order ? { ...prev, order: { ...prev.order, status: 'accepted', amount: quote.amount } as any } : prev);
        setChatStep('payment_method');
      }
      if (action === 'modification_requested') { setShowModificationInput(null); setModificationNote(''); }
    } catch (e: any) {
      setSendError(e?.message || 'تعذّر تنفيذ العملية، حاول مجدداً');
      await refreshQuotes(conversation.order_id);
    } finally { setIsRespondingToQuote(false); }
  };

  const handlePayment = async () => {
    if (!conversation?.order_id || !user) return;
    setIsProcessingPayment(true);
    try {
      const { error: payError } = await supabase.from('orders').update({ payment_method: selectedPaymentMethod, payment_status: 'paid', escrow_status: 'held', status: 'in_progress' }).eq('id', conversation.order_id);
      if (payError) throw payError;
      // "بدأ تنفيذ الخدمة" is posted by the database when the status changes.
      await insertMessage({ conversation_id: conversation.id, sender_id: user.id, content: `💳 تم الدفع بنجاح — المبلغ محجوز لدى الإدارة حتى إتمام الخدمة`, message_type: 'text' });
      setConversation((prev) => prev ? { ...prev, order: prev.order ? { ...prev.order, escrow_status: 'held', payment_status: 'paid' } as any : prev.order } : prev);
      setChatStep('payment_held'); setPaymentDone(true);
    } catch (e: any) { alert(e?.message || 'حدث خطأ في الدفع'); } finally { setIsProcessingPayment(false); }
  };

  const activeQuote = quotes.find((q) => q.quote_status === 'pending');
  const latestQuote = quotes[0];
  const acceptedQuote = quotes.find((q) => q.quote_status === 'accepted');
  const otherPartyName = isCraftsman ? conversation?.customer?.full_name || 'الزبون' : conversation?.craftsman?.full_name || 'الحرفي';
  const otherPartyAvatar = isCraftsman ? conversation?.customer?.avatar_url : conversation?.craftsman?.avatar_url;

  // Group messages by date
  const groupedMessages = messages.reduce((acc: { date: string; msgs: Message[] }[], msg) => {
    const date = new Date(msg.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' });
    const last = acc[acc.length - 1];
    if (last && last.date === date) { last.msgs.push(msg); }
    else { acc.push({ date, msgs: [msg] }); }
    return acc;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100dvh', background: '#e5ddd5' }} dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#075E54', borderTopColor: 'transparent' }} />
          <p className="text-sm text-gray-600">جاري تحميل المحادثة...</p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100dvh', background: '#e5ddd5' }} dir="rtl">
        <div className="text-center px-6">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-gray-600 text-sm">لم يتم العثور على المحادثة</p>
          <button onClick={() => router.back()} className="mt-4 text-sm font-semibold" style={{ color: '#075E54' }}>العودة</button>
        </div>
      </div>
    );
  }

  // Payment method selection step
  if (chatStep === 'payment_method') {
    return (
      <div className="flex flex-col" style={{ height: '100dvh', background: '#f0f2f5' }} dir="rtl">
        {/* WhatsApp-style header */}
        <div className="flex items-center gap-3 px-4 pt-10 pb-3 flex-shrink-0" style={{ background: '#075E54' }}>
          <button onClick={() => setChatStep('chat')} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Icon name="ChevronRightIcon" size={20} className="text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">اختر طريقة الدفع</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          <div className="rounded-2xl p-4 text-center" style={{ background: '#dcf8c6', border: '1px solid #b7e4a0' }}>
            <p className="text-sm text-gray-600 mb-1">المبلغ المطلوب</p>
            <p className="text-3xl font-black" style={{ color: '#075E54' }}>
              {acceptedQuote?.amount?.toLocaleString('ar-SA') || conversation.order?.amount?.toLocaleString('ar-SA') || '—'} ر.س
            </p>
            <p className="text-xs text-gray-500 mt-1">سيتم الاحتفاظ بالمبلغ لدى الإدارة حتى إتمام الخدمة</p>
          </div>
          {[
            { value: 'cash' as const, label: 'نقداً', icon: '💵', desc: 'الدفع نقداً عند الخدمة' },
            { value: 'card' as const, label: 'بطاقة بنكية', icon: '💳', desc: 'Visa / Mastercard' },
            { value: 'wallet' as const, label: 'المحفظة', icon: '👛', desc: 'من رصيد محفظتك' },
          ].map((pm) => (
            <button key={pm.value} onClick={() => setSelectedPaymentMethod(pm.value)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl text-right transition-all"
              style={{ background: selectedPaymentMethod === pm.value ? '#dcf8c6' : 'white', border: `2px solid ${selectedPaymentMethod === pm.value ? '#25D366' : '#e5e7eb'}` }}>
              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={{ borderColor: selectedPaymentMethod === pm.value ? '#25D366' : '#d1d5db', background: selectedPaymentMethod === pm.value ? '#25D366' : 'transparent' }}>
                {selectedPaymentMethod === pm.value && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-2xl">{pm.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{pm.label}</p>
                <p className="text-xs text-gray-400">{pm.desc}</p>
              </div>
            </button>
          ))}
          <button onClick={handlePayment} disabled={isProcessingPayment}
            className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2"
            style={{ background: '#25D366' }}>
            {isProcessingPayment ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري المعالجة...</>
            ) : (
              <><Icon name="LockClosedIcon" size={18} className="text-white" />تأكيد الدفع وحجز المبلغ</>
            )}
          </button>
        </div>
      </div>
    );
  }

  const isCustomRequest = conversation.order?.description?.startsWith('[خدمة مخصصة:');

  return (
    <div className="flex flex-col" dir="rtl" style={{ height: '100dvh', background: '#e5ddd5' }}>
      {/* WhatsApp Header */}
      <div className="flex items-center gap-3 px-3 pt-10 pb-3 flex-shrink-0 shadow-md" style={{ background: '#075E54' }}>
        <button onClick={() => router.push('/conversations')} className="flex items-center justify-center flex-shrink-0">
          <Icon name="ChevronRightIcon" size={22} className="text-white" />
        </button>
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: '#128C7E' }}>
          {otherPartyAvatar ? (
            <AppImage src={otherPartyAvatar} alt={otherPartyName} width={40} height={40} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon name="UserCircleIcon" size={26} className="text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{otherPartyName}</p>
          <p className="text-xs truncate" style={{ color: '#b2dfdb' }}>
            {otherPartyTyping ? (
              <span className="animate-pulse">يكتب...</span>
            ) : chatStep === 'payment_held' ? '🔒 المبلغ محجوز' : 'متصل الآن'}
          </p>
        </div>
        {/* Header actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button className="flex items-center justify-center">
            <Icon name="PhoneIcon" size={20} className="text-white opacity-80" />
          </button>
          <button className="flex items-center justify-center">
            <Icon name="EllipsisVerticalIcon" size={20} className="text-white opacity-80" />
          </button>
        </div>
      </div>

      {/* Banners area */}
      <div className="flex-shrink-0">
        {/* Custom request banner */}
        {isCustomRequest && isCraftsman && !activeQuote && !acceptedQuote && (
          <div className="mx-3 mt-2 rounded-xl p-3 flex items-start gap-2" style={{ background: '#fff3cd', border: '1px solid #ffc107' }}>
            <Icon name="InformationCircleIcon" size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#856404' } as any} />
            <div>
              <p className="text-xs font-bold" style={{ color: '#856404' }}>طلب خدمة مخصصة</p>
              <p className="text-xs" style={{ color: '#856404' }}>راجع تفاصيل الطلب وأرسل عرض سعرك باستخدام زر 💰 في أسفل الشاشة</p>
            </div>
          </div>
        )}

        {/* Service images */}
        {conversation.order?.service_images && conversation.order.service_images.length > 0 && (
          <div className="mx-3 mt-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.85)' }}>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">📷 صور الخدمة المطلوبة</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {conversation.order.service_images.map((url, i) => (
                <div key={i} className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
                  <AppImage src={url} alt={`صورة الخدمة ${i + 1}`} width={64} height={64} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active quote — customer */}
        {activeQuote && isCustomer && (
          <div className="mx-3 mt-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid #25D366' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold" style={{ color: '#075E54' }}>💰 عرض سعر جديد</p>
              <p className="text-lg font-black" style={{ color: '#075E54' }}>{activeQuote.amount.toLocaleString('ar-SA')} ر.س</p>
            </div>
            {activeQuote.description && <p className="text-xs text-gray-500 mb-2">{activeQuote.description}</p>}
            {showModificationInput === activeQuote.id ? (
              <div className="space-y-2">
                <textarea rows={2} placeholder="اشرح التعديل المطلوب..." value={modificationNote} onChange={(e) => setModificationNote(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-gray-50 resize-none" />
                <div className="flex gap-2">
                  <button disabled={isRespondingToQuote} onClick={() => handleQuoteAction(activeQuote, 'modification_requested')} className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-orange-500 disabled:opacity-60">إرسال طلب التعديل</button>
                  <button onClick={() => { setShowModificationInput(null); setModificationNote(''); }} className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100">إلغاء</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button disabled={isRespondingToQuote} onClick={() => handleQuoteAction(activeQuote, 'accepted')} className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: '#25D366' }}>✅ قبول</button>
                <button disabled={isRespondingToQuote} onClick={() => handleQuoteAction(activeQuote, 'rejected')} className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-red-500 disabled:opacity-60">❌ رفض</button>
                <button disabled={isRespondingToQuote} onClick={() => setShowModificationInput(activeQuote.id)} className="flex-1 py-2 rounded-xl text-sm font-bold text-orange-600 bg-orange-50 border border-orange-200">🔄 تعديل</button>
              </div>
            )}
          </div>
        )}

        {/* Active quote — craftsman */}
        {activeQuote && isCraftsman && (
          <div className="mx-3 mt-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #ffc107' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-yellow-700">⏳ عرض السعر بانتظار رد الزبون</p>
              <p className="text-sm font-black text-yellow-800">{activeQuote.amount.toLocaleString('ar-SA')} ر.س</p>
            </div>
            {activeQuote.description && <p className="text-xs text-yellow-600 mt-1">{activeQuote.description}</p>}
          </div>
        )}

        {/* Customer asked for a change — tell the craftsman what to do next */}
        {isCraftsman && !activeQuote && latestQuote?.quote_status === 'modification_requested' && conversation.order?.status === 'pending' && (
          <div className="mx-3 mt-2 rounded-xl p-3" style={{ background: '#fff7ed', border: '1px solid #fdba74' }}>
            <p className="text-xs font-bold text-orange-700">🔄 الزبون طلب تعديل عرض السعر</p>
            {latestQuote.modification_note && <p className="text-xs text-orange-600 mt-1">«{latestQuote.modification_note}»</p>}
            <button onClick={() => setShowQuoteForm(true)} className="mt-2 w-full py-2 rounded-xl text-xs font-bold text-white" style={{ background: '#25D366' }}>
              💰 إرسال عرض جديد
            </button>
          </div>
        )}

        {/* Quote accepted but not paid yet — let the customer get back to payment */}
        {isCustomer && chatStep === 'chat' && conversation.order?.status === 'accepted' && conversation.order?.payment_status !== 'paid' && (
          <div className="mx-3 mt-2 rounded-xl p-3 flex items-center gap-3" style={{ background: '#dcf8c6', border: '1px solid #25D366' }}>
            <p className="flex-1 text-xs font-semibold" style={{ color: '#075E54' }}>
              تم قبول العرض{acceptedQuote ? ` (${Number(acceptedQuote.amount).toLocaleString('ar-SA')} ر.س)` : ''} — أكمل الدفع لبدء الخدمة
            </p>
            <button onClick={() => setChatStep('payment_method')} className="px-4 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0" style={{ background: '#075E54' }}>
              ادفع الآن
            </button>
          </div>
        )}

        {/* Payment held */}
        {chatStep === 'payment_held' && (
          <div className="mx-3 mt-2 rounded-xl p-3 flex items-center gap-2" style={{ background: '#dcf8c6', border: '1px solid #b7e4a0' }}>
            <Icon name="LockClosedIcon" size={15} style={{ color: '#075E54' } as any} />
            <p className="text-xs font-semibold" style={{ color: '#075E54' }}>المبلغ محجوز لدى الإدارة — سيُحرَّر للحرفي عند إتمام الخدمة</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23e5ddd5'/%3E%3C/svg%3E")` }}>
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block px-4 py-2 rounded-full text-xs text-gray-600" style={{ background: 'rgba(255,255,255,0.7)' }}>
              ابدأ المحادثة مع {otherPartyName}
            </div>
          </div>
        )}

        {groupedMessages.map(({ date, msgs }) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex justify-center my-3">
              <span className="px-3 py-1 rounded-full text-xs text-gray-600 shadow-sm" style={{ background: 'rgba(255,255,255,0.85)' }}>{date}</span>
            </div>

            {msgs.map((msg) => {
              const isOwn = msg.sender_id === user?.id;
              const isQuote = msg.message_type === 'quote';
              const isFile = msg.message_type === 'file';
              const isImage = msg.message_type === 'image';
              const isSystem = msg.message_type === 'system';
              const timeStr = new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

              // Render system messages as centered pill
              if (isSystem) {
                return <SystemMessage key={msg.id} content={msg.content || ''} />;
              }

              return (
                <div key={msg.id} className={`flex mb-1 ${isOwn ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className="relative max-w-[75%] rounded-2xl px-3 pt-2 pb-1 shadow-sm"
                    style={{
                      background: isQuote ? '#fff9c4' : isOwn ? '#dcf8c6' : 'white',
                      borderTopRightRadius: isOwn ? '4px' : '18px',
                      borderTopLeftRadius: isOwn ? '18px' : '4px',
                    }}
                  >
                    {/* Quote badge */}
                    {isQuote && (
                      <div className="flex items-center gap-1 mb-1 pb-1 border-b border-yellow-200">
                        <span className="text-xs font-bold text-yellow-700">💰 عرض سعر</span>
                      </div>
                    )}

                    {isImage && msg.media_url ? (
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                        <div className="w-48 h-48 rounded-xl overflow-hidden mb-1">
                          <AppImage src={msg.media_url} alt="صورة مرسلة" width={192} height={192} className="w-full h-full object-cover" />
                        </div>
                      </a>
                    ) : isFile && msg.media_url ? (
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-1 mb-1 min-w-[160px]">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isOwn ? 'rgba(7,94,84,0.12)' : 'rgba(0,0,0,0.06)' }}>
                          <Icon name="DocumentIcon" size={22} style={{ color: isOwn ? '#075E54' : '#555' } as any} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{msg.file_name || 'ملف'}</p>
                          {msg.file_size && <p className="text-xs text-gray-400">{formatFileSize(msg.file_size)}</p>}
                        </div>
                        <Icon name="ArrowDownTrayIcon" size={16} className="text-gray-400 flex-shrink-0" />
                      </a>
                    ) : (
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isQuote ? 'text-yellow-900 font-medium' : 'text-gray-900'}`}>
                        {msg.content}
                      </p>
                    )}

                    {/* Time + read receipt */}
                    <div className={`flex items-center gap-0.5 mt-0.5 ${isOwn ? 'justify-start' : 'justify-end'}`}>
                      {isOwn && msg.is_read && msg.read_at && (
                        <span className="text-xs mr-1" style={{ color: '#8696a0', fontSize: '10px' }}>
                          {new Date(msg.read_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: '#8696a0', fontSize: '11px' }}>{timeStr}</span>
                      {isOwn && <DoubleTick read={msg.is_read} readAt={msg.read_at} />}
                    </div>

                    {/* WhatsApp bubble tail */}
                    <div
                      className="absolute top-0"
                      style={{
                        [isOwn ? 'right' : 'left']: '-6px',
                        width: 0, height: 0,
                        borderTop: `8px solid ${isQuote ? '#fff9c4' : isOwn ? '#dcf8c6' : 'white'}`,
                        borderLeft: isOwn ? 'none' : '8px solid transparent',
                        borderRight: isOwn ? '8px solid transparent' : 'none',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Typing indicator */}
        {otherPartyTyping && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Quote form (craftsman) */}
      {showQuoteForm && isCraftsman && (
        <div className="mx-3 mb-2 rounded-2xl p-4 flex-shrink-0 shadow-md" style={{ background: 'white' }}>
          <p className="text-sm font-bold text-gray-800 mb-3">💰 إرسال عرض سعر</p>
          <div className="space-y-2">
            <div className="relative">
              <input type="number" placeholder="المبلغ" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-gray-50 pl-14" style={{ direction: 'rtl' }} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">ر.س</span>
            </div>
            <textarea rows={2} placeholder="وصف العرض (اختياري)" value={quoteDescription} onChange={(e) => setQuoteDescription(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-gray-50 resize-none" />
            <div className="flex gap-2">
              <button onClick={submitQuote} disabled={isSubmittingQuote || !quoteAmount}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1"
                style={{ background: '#25D366' }}>
                {isSubmittingQuote ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'إرسال العرض'}
              </button>
              <button onClick={() => setShowQuoteForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-gray-100">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {sendError && (
        <div role="alert" className="mx-3 mb-1 px-3 py-2 rounded-xl text-xs font-semibold text-red-700 bg-red-50 flex items-center justify-between flex-shrink-0">
          <span>{sendError}</span>
          <button type="button" onClick={() => setSendError('')} aria-label="إغلاق" className="text-red-400 px-1">✕</button>
        </div>
      )}

      {/* WhatsApp-style Input Bar */}
      <div className="px-2 py-2 flex-shrink-0 flex items-end gap-2" style={{ background: '#f0f2f5', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {/* Attach buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Image upload */}
          <button onClick={() => imageInputRef.current?.click()} disabled={uploadingFile}
            className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'white' }}
            title="إرسال صورة">
            {uploadingFile
              ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : <Icon name="PhotoIcon" size={20} className="text-gray-500" />}
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file, true); e.target.value = ''; }} />

          {/* File upload */}
          <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
            className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'white' }}
            title="إرسال ملف">
            <Icon name="PaperClipIcon" size={20} className="text-gray-500" />
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file, false); e.target.value = ''; }} />

          {isCraftsman && !showQuoteForm && (
            <button onClick={() => {
              if (!conversation.order_id) { setSendError('لا يوجد طلب خدمة مرتبط بهذه المحادثة بعد — يرسل الزبون الطلب أولاً'); return; }
              if (conversation.order && conversation.order.status !== 'pending') { setSendError('لا يمكن إرسال عرض سعر بعد قبول الطلب أو إلغائه'); return; }
              setShowQuoteForm(true);
            }} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'white' }} title="إرسال عرض سعر">
              <Icon name="CurrencyDollarIcon" size={20} style={{ color: '#25D366' } as any} />
            </button>
          )}
        </div>

        {/* Text input */}
        <div className="flex-1 flex items-end rounded-3xl px-4 py-2 gap-2" style={{ background: 'white', minHeight: '44px' }}>
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="اكتب رسالة..."
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
              sendTypingIndicator();
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(messageText); } }}
            className="flex-1 bg-transparent text-sm text-gray-900 resize-none focus:outline-none leading-relaxed"
            style={{ minHeight: '24px', maxHeight: '96px', direction: 'rtl' }}
          />
          {/* Emoji placeholder */}
          <button className="flex-shrink-0 mb-0.5">
            <span className="text-xl leading-none">😊</span>
          </button>
        </div>

        {/* Send / Mic button */}
        <button
          onClick={() => messageText.trim() ? sendMessage(messageText) : undefined}
          disabled={isSending}
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 shadow-md transition-all"
          style={{ background: '#25D366' }}
        >
          {messageText.trim()
            ? <Icon name="PaperAirplaneIcon" size={20} className="text-white" />
            : <Icon name="MicrophoneIcon" size={20} className="text-white" />}
        </button>
      </div>
    </div>
  );
}
