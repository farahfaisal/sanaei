-- ============================================================
-- FCM Tokens Table for Firebase Cloud Messaging
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios', 'web')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);

-- Enable RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own FCM tokens
DROP POLICY IF EXISTS "users_manage_own_fcm_tokens" ON public.fcm_tokens;
CREATE POLICY "users_manage_own_fcm_tokens"
  ON public.fcm_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role can read all tokens (for edge functions sending notifications)
DROP POLICY IF EXISTS "service_role_read_fcm_tokens" ON public.fcm_tokens;
CREATE POLICY "service_role_read_fcm_tokens"
  ON public.fcm_tokens FOR SELECT TO service_role
  USING (true);

-- Service role can delete expired tokens
DROP POLICY IF EXISTS "service_role_delete_fcm_tokens" ON public.fcm_tokens;
CREATE POLICY "service_role_delete_fcm_tokens"
  ON public.fcm_tokens FOR DELETE TO service_role
  USING (true);
