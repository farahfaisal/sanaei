-- Chat Enhancements Migration
-- Adds: read_at timestamp, file message type, file_name/file_size, typing indicators

-- 1. Add read_at timestamp to messages (for read receipts with exact time)
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 2. Add file metadata columns to messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS file_name TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- 3. Add typing indicator columns to conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS customer_typing_at TIMESTAMPTZ;

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS craftsman_typing_at TIMESTAMPTZ;

-- 4. Extend message_type enum to include 'file'
-- We need to add 'file' to the existing enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'file'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'message_type')
  ) THEN
    ALTER TYPE public.message_type ADD VALUE 'file';
  END IF;
END $$;

-- 5. Index for faster read receipt queries
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON public.messages(conversation_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON public.messages(conversation_id, read_at);

-- 6. Function to mark messages as read and set read_at timestamp
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id UUID, p_reader_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.messages
  SET is_read = true,
      read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND sender_id != p_reader_id
    AND is_read = false;
END;
$$;

-- 7. Storage policy: make chat-media bucket accessible to conversation participants
-- Allow authenticated users to upload to their conversation folder
DROP POLICY IF EXISTS "chat_media_upload" ON storage.objects;
CREATE POLICY "chat_media_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "chat_media_read" ON storage.objects;
CREATE POLICY "chat_media_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "chat_media_delete" ON storage.objects;
CREATE POLICY "chat_media_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
