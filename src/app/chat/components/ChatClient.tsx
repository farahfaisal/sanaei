'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'video' | 'quote';
  media_url: string | null;
  is_read: boolean;
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
    escrow_status: string;
    amount: number | null;
  };
}

type ChatStep = 'chat' | 'payment_method' | 'payment_held';

export default function ChatClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams?.get('conversation_id');
  const orderId = searchParams?.get('order_id');
  const { user, profile } = useAuth();
  const supabase = createClient();

  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [quotes, setQuotes] = useState<PriceQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [chatStep, setChatStep] = useState<ChatStep>('chat');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'wallet'>('cash');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  // Quote form (craftsman only)
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteDescription, setQuoteDescription] = useState('');
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);

  // Modification note (customer)
  const [showModificationInput, setShowModificationInput] = useState<string | null>(null);
  const [modificationNote, setModificationNote] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCraftsman = profile?.role === 'craftsman';
  const isCustomer = profile?.role === 'customer';
  const isAdmin = profile?.role === 'admin';

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    } else if (orderId) {
      findOrCreateConversation(orderId);
    }
  }, [conversationId, orderId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time subscription
  useEffect(() => {
    if (!conversation?.id) return;

    const channel = supabase
      .channel(`chat:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Fetch sender info
          const { data: senderData } = await supabase
            .from('user_profiles')
            .select('full_name, avatar_url, role')
            .eq('id', newMsg.sender_id)
            .maybeSingle();
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, sender: senderData || undefined }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  const findOrCreateConversation = async (oId: string) => {
    setIsLoading(true);
    try {
      // Check if conversation already exists for this order
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('order_id', oId)
        .maybeSingle();

      if (existing) {
        await loadConversation(existing.id);
        return;
      }

      // Get order info to create conversation
      const { data: order } = await supabase
        .from('orders')
        .select('id, customer_id, craftsman_id, craftsman_profiles(user_id)')
        .eq('id', oId)
        .maybeSingle();

      if (!order) {
        setIsLoading(false);
        return;
      }

      const craftsmanUserId = (order as any).craftsman_profiles?.user_id;

      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          customer_id: order.customer_id,
          craftsman_id: craftsmanUserId,
          order_id: oId,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Link conversation to order
      await supabase
        .from('orders')
        .update({ conversation_id: newConv.id })
        .eq('id', oId);

      await loadConversation(newConv.id);
    } catch (e) {
      setIsLoading(false);
    }
  };

  const loadConversation = async (convId: string) => {
    setIsLoading(true);
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select(`
          id, customer_id, craftsman_id, order_id,
          customer:customer_id(full_name, avatar_url),
          craftsman:craftsman_id(full_name, avatar_url)
        `)
        .eq('id', convId)
        .maybeSingle();

      if (!conv) {
        setIsLoading(false);
        return;
      }

      const convData: ConversationInfo = {
        id: conv.id,
        customer_id: conv.customer_id,
        craftsman_id: conv.craftsman_id,
        order_id: conv.order_id,
        customer: Array.isArray((conv as any).customer) ? (conv as any).customer[0] : (conv as any).customer,
        craftsman: Array.isArray((conv as any).craftsman) ? (conv as any).craftsman[0] : (conv as any).craftsman,
      };

      // Load order if linked
      if (conv.order_id) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('id, status, description, service_images, payment_method, escrow_status, amount')
          .eq('id', conv.order_id)
          .maybeSingle();
        if (orderData) {
          convData.order = orderData as any;
          if ((orderData as any).escrow_status === 'held') {
            setChatStep('payment_held');
          }
        }
      }

      setConversation(convData);

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*, sender:sender_id(full_name, avatar_url, role)')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (msgs) {
        setMessages(msgs.map((m: any) => ({
          ...m,
          sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
        })));
      }

      // Load quotes for this order
      if (conv.order_id) {
        const { data: quotesData } = await supabase
          .from('price_quotes')
          .select('*')
          .eq('order_id', conv.order_id)
          .order('created_at', { ascending: false });
        if (quotesData) setQuotes(quotesData as any);
      }

      // Mark messages as read
      if (user) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', convId)
          .neq('sender_id', user.id);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string, type: 'text' | 'image' = 'text', mediaUrl?: string) => {
    if (!conversation || !user) return;
    if (type === 'text' && !content.trim()) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: type === 'text' ? content.trim() : null,
        message_type: type,
        media_url: mediaUrl || null,
      });

      if (error) throw error;

      // Update conversation last_message
      await supabase
        .from('conversations')
        .update({
          last_message: type === 'text' ? content.trim() : '📷 صورة',
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversation.id);

      setMessageText('');
    } catch (e) {
      // ignore
    } finally {
      setIsSending(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!user || !conversation) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `chat/${conversation.id}/${user.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
      await sendMessage('', 'image', urlData.publicUrl);
    } catch (e) {
      // ignore
    } finally {
      setUploadingImage(false);
    }
  };

  const submitQuote = async () => {
    if (!conversation?.order_id || !user || !quoteAmount) return;
    setIsSubmittingQuote(true);
    try {
      // Get craftsman profile id
      const { data: cp } = await supabase
        .from('craftsman_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cp) throw new Error('لم يتم العثور على ملف الصنايعي');

      const { data: quote, error } = await supabase
        .from('price_quotes')
        .insert({
          order_id: conversation.order_id,
          craftsman_id: cp.id,
          amount: parseFloat(quoteAmount),
          description: quoteDescription.trim() || null,
          quote_status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      setQuotes((prev) => [quote as any, ...prev]);

      // Send a quote message in chat
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: `💰 عرض سعر: ${parseFloat(quoteAmount).toLocaleString('ar-SA')} ₪\n${quoteDescription || ''}`,
        message_type: 'quote',
      });

      await supabase
        .from('conversations')
        .update({ last_message: `💰 عرض سعر: ${quoteAmount} ₪`, last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);

      setShowQuoteForm(false);
      setQuoteAmount('');
      setQuoteDescription('');
    } catch (e: any) {
      alert(e?.message || 'حدث خطأ');
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  const handleQuoteAction = async (quote: PriceQuote, action: 'accepted' | 'rejected' | 'modification_requested') => {
    if (!conversation?.order_id) return;
    try {
      const updateData: any = { quote_status: action };
      if (action === 'modification_requested' && modificationNote.trim()) {
        updateData.modification_note = modificationNote.trim();
      }

      await supabase.from('price_quotes').update(updateData).eq('id', quote.id);

      setQuotes((prev) => prev.map((q) => q.id === quote.id ? { ...q, ...updateData } : q));

      if (action === 'accepted') {
        // Update order amount and status
        await supabase
          .from('orders')
          .update({ amount: quote.amount, status: 'accepted' })
          .eq('id', conversation.order_id);

        // Send acceptance message
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender_id: user!.id,
          content: `✅ تم قبول عرض السعر: ${quote.amount.toLocaleString('ar-SA')} ₪`,
          message_type: 'text',
        });

        setChatStep('payment_method');
      } else if (action === 'rejected') {
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender_id: user!.id,
          content: '❌ تم رفض عرض السعر',
          message_type: 'text',
        });
      } else if (action === 'modification_requested') {
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender_id: user!.id,
          content: `🔄 طلب تعديل على عرض السعر${modificationNote ? ': ' + modificationNote : ''}`,
          message_type: 'text',
        });
        setShowModificationInput(null);
        setModificationNote('');
      }
    } catch (e: any) {
      alert(e?.message || 'حدث خطأ');
    }
  };

  const handlePayment = async () => {
    if (!conversation?.order_id || !user) return;
    setIsProcessingPayment(true);
    try {
      // Hold payment in escrow (admin holds it)
      await supabase
        .from('orders')
        .update({
          payment_method: selectedPaymentMethod,
          payment_status: 'paid',
          escrow_status: 'held',
          status: 'in_progress',
        })
        .eq('id', conversation.order_id);

      // Send payment message
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: `💳 تم الدفع بنجاح — المبلغ محجوز لدى الإدارة حتى إتمام الخدمة`,
        message_type: 'text',
      });

      setConversation((prev) => prev ? {
        ...prev,
        order: prev.order ? { ...prev.order, escrow_status: 'held', payment_status: 'paid' } as any : prev.order
      } : prev);

      setChatStep('payment_held');
      setPaymentDone(true);
    } catch (e: any) {
      alert(e?.message || 'حدث خطأ في الدفع');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const activeQuote = quotes.find((q) => q.quote_status === 'pending');
  const acceptedQuote = quotes.find((q) => q.quote_status === 'accepted');

  const otherPartyName = isCraftsman
    ? conversation?.customer?.full_name || 'الزبون' : conversation?.craftsman?.full_name ||'الصنايعي';

  const otherPartyAvatar = isCraftsman
    ? conversation?.customer?.avatar_url
    : conversation?.craftsman?.avatar_url;

  if (isLoading) {
    return (
      <div className="screen-container bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">جاري تحميل المحادثة...</p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="screen-container bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center px-6">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-gray-500 text-sm">لم يتم العثور على المحادثة</p>
          <button onClick={() => router.back()} className="mt-4 text-primary text-sm font-semibold">العودة</button>
        </div>
      </div>
    );
  }

  // Payment method selection step
  if (chatStep === 'payment_method') {
    return (
      <div className="screen-container bg-gray-50" dir="rtl">
        <div className="flex items-center gap-3 px-4 pt-12 pb-4 bg-white border-b border-gray-100">
          <button onClick={() => setChatStep('chat')} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <Icon name="ChevronRightIcon" size={20} className="text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">اختر طريقة الدفع</h1>
        </div>
        <div className="px-4 py-6 space-y-4">
          {/* Amount summary */}
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">المبلغ المطلوب</p>
            <p className="text-3xl font-black text-primary">
              {acceptedQuote?.amount?.toLocaleString('ar-SA') || conversation.order?.amount?.toLocaleString('ar-SA') || '—'} ₪
            </p>
            <p className="text-xs text-gray-400 mt-1">سيتم الاحتفاظ بالمبلغ لدى الإدارة حتى إتمام الخدمة</p>
          </div>

          {/* Payment methods */}
          {[
            { value: 'cash' as const, label: 'نقداً', icon: '💵', desc: 'الدفع نقداً عند الخدمة' },
            { value: 'card' as const, label: 'بطاقة بنكية', icon: '💳', desc: 'Visa / Mastercard' },
            { value: 'wallet' as const, label: 'المحفظة', icon: '👛', desc: 'من رصيد محفظتك' },
          ].map((pm) => (
            <button
              key={pm.value}
              onClick={() => setSelectedPaymentMethod(pm.value)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-right ${
                selectedPaymentMethod === pm.value ? 'border-primary bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selectedPaymentMethod === pm.value ? 'border-primary bg-primary' : 'border-gray-300'
              }`}>
                {selectedPaymentMethod === pm.value && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-2xl">{pm.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{pm.label}</p>
                <p className="text-xs text-gray-400">{pm.desc}</p>
              </div>
            </button>
          ))}

          <button
            onClick={handlePayment}
            disabled={isProcessingPayment}
            className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2"
            style={{ background: '#1B5E20' }}
          >
            {isProcessingPayment ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري المعالجة...
              </>
            ) : (
              <>
                <Icon name="LockClosedIcon" size={18} className="text-white" />
                تأكيد الدفع وحجز المبلغ
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container bg-gray-50 flex flex-col" dir="rtl" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-3 bg-white border-b border-gray-100 flex-shrink-0">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <Icon name="ChevronRightIcon" size={20} className="text-gray-700" />
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          {otherPartyAvatar ? (
            <AppImage src={otherPartyAvatar} alt={otherPartyName} width={40} height={40} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon name="UserCircleIcon" size={24} className="text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{otherPartyName}</p>
          {conversation.order && (
            <p className="text-xs text-gray-400 truncate">
              {conversation.order.description?.slice(0, 40) || 'طلب خدمة'}
            </p>
          )}
        </div>
        {chatStep === 'payment_held' && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold flex-shrink-0">
            💰 محجوز
          </span>
        )}
      </div>

      {/* Service images (if any) */}
      {conversation.order?.service_images && conversation.order.service_images.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
          <p className="text-xs text-amber-700 font-semibold mb-1.5">📷 صور الخدمة المطلوبة</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {conversation.order.service_images.map((url, i) => (
              <div key={i} className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-amber-200">
                <AppImage src={url} alt={`صورة الخدمة ${i + 1}`} width={64} height={64} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active quote banner */}
      {activeQuote && isCustomer && (
        <div className="mx-4 mt-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-blue-800">💰 عرض سعر جديد</p>
            <p className="text-lg font-black text-blue-900">{activeQuote.amount.toLocaleString('ar-SA')} ₪</p>
          </div>
          {activeQuote.description && (
            <p className="text-xs text-blue-600 mb-3">{activeQuote.description}</p>
          )}
          {showModificationInput === activeQuote.id ? (
            <div className="space-y-2">
              <textarea
                rows={2}
                placeholder="اشرح التعديل المطلوب..."
                value={modificationNote}
                onChange={(e) => setModificationNote(e.target.value)}
                className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleQuoteAction(activeQuote, 'modification_requested')}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-orange-500"
                >
                  إرسال طلب التعديل
                </button>
                <button
                  onClick={() => { setShowModificationInput(null); setModificationNote(''); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleQuoteAction(activeQuote, 'accepted')}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600"
              >
                ✅ قبول
              </button>
              <button
                onClick={() => handleQuoteAction(activeQuote, 'rejected')}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500"
              >
                ❌ رفض
              </button>
              <button
                onClick={() => setShowModificationInput(activeQuote.id)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-orange-600 bg-orange-50 border border-orange-200"
              >
                🔄 تعديل
              </button>
            </div>
          )}
        </div>
      )}

      {/* Payment held banner */}
      {chatStep === 'payment_held' && (
        <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-2xl p-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Icon name="LockClosedIcon" size={16} className="text-green-600" />
            <p className="text-xs text-green-700 font-semibold">
              المبلغ محجوز لدى الإدارة — سيُحرَّر للصنايعي عند إتمام الخدمة
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm text-gray-400">ابدأ المحادثة مع {otherPartyName}</p>
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === user?.id;
          const senderName = msg.sender?.full_name || (isOwn ? 'أنت' : otherPartyName);

          return (
            <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 mt-1">
                {msg.sender?.avatar_url ? (
                  <AppImage src={msg.sender.avatar_url} alt={senderName} width={28} height={28} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="UserCircleIcon" size={16} className="text-gray-400" />
                  </div>
                )}
              </div>

              <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isOwn && (
                  <p className="text-xs text-gray-400 px-1">{senderName}</p>
                )}
                <div
                  className={`rounded-2xl px-3 py-2.5 ${
                    msg.message_type === 'quote' ?'bg-blue-100 border border-blue-200'
                      : isOwn
                      ? 'text-white' :'bg-white border border-gray-100 text-gray-900'
                  }`}
                  style={isOwn && msg.message_type !== 'quote' ? { background: '#1B5E20' } : {}}
                >
                  {msg.message_type === 'image' && msg.media_url ? (
                    <div className="w-48 h-48 rounded-xl overflow-hidden">
                      <AppImage src={msg.media_url} alt="صورة مرسلة" width={192} height={192} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.message_type === 'quote' ? 'text-blue-800 font-semibold' : ''}`}>
                      {msg.content}
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-300 px-1">
                  {new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quote form (craftsman) */}
      {showQuoteForm && isCraftsman && (
        <div className="mx-4 mb-2 bg-white border border-gray-200 rounded-2xl p-4 flex-shrink-0 shadow-sm">
          <p className="text-sm font-bold text-gray-800 mb-3">💰 إرسال عرض سعر</p>
          <div className="space-y-2">
            <input
              type="number"
              placeholder="المبلغ (₪)"
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-gray-50"
            />
            <textarea
              rows={2}
              placeholder="وصف العرض (اختياري)"
              value={quoteDescription}
              onChange={(e) => setQuoteDescription(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={submitQuote}
                disabled={isSubmittingQuote || !quoteAmount}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1"
                style={{ background: '#1B5E20' }}
              >
                {isSubmittingQuote ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : 'إرسال العرض'}
              </button>
              <button
                onClick={() => setShowQuoteForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-gray-100"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 py-3 bg-white border-t border-gray-100 flex-shrink-0 pb-safe">
        <div className="flex items-end gap-2">
          {/* Image upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"
          >
            {uploadingImage ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="PhotoIcon" size={20} className="text-gray-500" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = '';
            }}
          />

          {/* Quote button (craftsman only) */}
          {isCraftsman && !showQuoteForm && (
            <button
              onClick={() => setShowQuoteForm(true)}
              className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0"
            >
              <Icon name="CurrencyDollarIcon" size={20} className="text-blue-600" />
            </button>
          )}

          {/* Text input */}
          <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 flex items-end gap-2">
            <textarea
              rows={1}
              placeholder="اكتب رسالة..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(messageText);
                }
              }}
              className="flex-1 bg-transparent text-sm text-gray-900 resize-none focus:outline-none leading-relaxed max-h-24"
              style={{ minHeight: '20px' }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={() => sendMessage(messageText)}
            disabled={isSending || !messageText.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
            style={{ background: messageText.trim() ? '#1B5E20' : '#e5e7eb' }}
          >
            <Icon name="PaperAirplaneIcon" size={18} className={messageText.trim() ? 'text-white' : 'text-gray-400'} />
          </button>
        </div>
      </div>
    </div>
  );
}
