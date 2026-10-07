import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Opens THE conversation between a customer and a craftsman (one thread per
 * pair, like WhatsApp), creating it the first time they talk.
 *
 * Pass `orderId` when the chat is about a specific order: the thread then
 * switches to that order (quotes, payment, status messages).
 *
 * Both ids are user ids (user_profiles.id) — for the craftsman use
 * craftsman_profiles.user_id, NOT craftsman_profiles.id.
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  params: { customerId: string; craftsmanUserId: string; orderId?: string | null }
): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    p_customer_id: params.customerId,
    p_craftsman_id: params.craftsmanUserId,
    p_order_id: params.orderId ?? null,
  });
  if (error) throw error;
  if (!data) throw new Error('تعذّر فتح المحادثة');
  return data as string;
}
