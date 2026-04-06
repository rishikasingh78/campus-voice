-- Drop existing problematic policies
DROP POLICY IF EXISTS "Participants can view conversation members" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations" ON conversation_participants;

-- Create security definer function to check if user is in conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

-- Create new policies using the security definer function
CREATE POLICY "Participants can view conversation members"
ON conversation_participants
FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can add participants to conversations"
ON conversation_participants
FOR INSERT
WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

-- Ensure conversations table has proper policies
DROP POLICY IF EXISTS "Users can view conversations they are part of" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;

CREATE POLICY "Users can view conversations they are part of"
ON conversations
FOR SELECT
USING (public.is_conversation_participant(id, auth.uid()));

CREATE POLICY "Users can update their conversations"
ON conversations
FOR UPDATE
USING (public.is_conversation_participant(id, auth.uid()));

-- Ensure messages table has proper policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON messages;

CREATE POLICY "Users can view messages in their conversations"
ON messages
FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can send messages to their conversations"
ON messages
FOR INSERT
WITH CHECK (
  public.is_conversation_participant(conversation_id, auth.uid())
  AND sender_id = auth.uid()
);