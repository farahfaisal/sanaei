import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Chat data access.
 *
 * Note: conversations.customer_id and conversations.craftsman_id are both
 * user ids (user_profiles.id / auth user id) — NOT craftsman_profiles.id.
 */

export interface ChatParticipant {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface Conversation {
  id: string;
  customer_id: string;
  craftsman_id: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  customer: ChatParticipant | null;
  craftsman: ChatParticipant | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'video' | 'quote';
  media_url: string | null;
  is_read: boolean;
  created_at: string;
}

const CONVERSATION_SELECT = `
  id, customer_id, craftsman_id, last_message, last_message_at, created_at,
  customer:user_profiles!conversations_customer_id_fkey(id, full_name, avatar_url),
  craftsman:user_profiles!conversations_craftsman_id_fkey(id, full_name, avatar_url)
`;

export const MESSAGE_PAGE_SIZE = 100;
export const MAX_MESSAGE_LENGTH = 2000;

/** The other person in a conversation, from the viewer's point of view. */
export function otherParticipant(conversation: Conversation, viewerId: string): ChatParticipant | null {
  return conversation.customer_id === viewerId ? conversation.craftsman : conversation.customer;
}

export async function listConversations(supabase: SupabaseClient, userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .or(`customer_id.eq.${userId},craftsman_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Conversation[];
}

export async function getConversation(supabase: SupabaseClient, conversationId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Conversation | null) ?? null;
}

/** Opens the existing chat between a customer and a craftsman, or starts a new one. */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  customerId: string,
  craftsmanUserId: string
): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_id', customerId)
    .eq('craftsman_id', craftsmanUserId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert({ customer_id: customerId, craftsman_id: craftsmanUserId })
    .select('id')
    .single();
  if (createError) throw createError;
  return created.id as string;
}

export async function listMessages(supabase: SupabaseClient, conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);
  if (error) throw error;
  return ((data ?? []) as ChatMessage[]).reverse();
}

export async function sendTextMessage(
  supabase: SupabaseClient,
  conversationId: string,
  senderId: string,
  content: string
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content, message_type: 'text' })
    .select('*')
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

/** Marks every message the other person sent in this conversation as read. */
export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string,
  viewerId: string
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', viewerId)
    .eq('is_read', false);
  if (error) console.error('Failed to mark messages read:', error.message);
}

/** Unread message counts per conversation for the viewer. */
export async function unreadCounts(supabase: SupabaseClient, viewerId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id')
    .eq('is_read', false)
    .neq('sender_id', viewerId);
  if (error) {
    console.error('Failed to load unread counts:', error.message);
    return {};
  }
  return (data ?? []).reduce<Record<string, number>>((acc, row) => {
    const id = row.conversation_id as string;
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
}

const timeFormatter = new Intl.DateTimeFormat('ar', { hour: 'numeric', minute: '2-digit' });
const dateFormatter = new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'short' });

/** "١٠:٣٠ م" for today, "أمس" for yesterday, otherwise a short date. */
export function formatChatTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (date.getTime() >= startOfToday) return timeFormatter.format(date);
  if (date.getTime() >= startOfToday - dayMs) return 'أمس';
  return dateFormatter.format(date);
}

export function formatMessageTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}
