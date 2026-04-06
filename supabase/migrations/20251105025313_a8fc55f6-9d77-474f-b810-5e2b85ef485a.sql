-- Fix RLS to allow creating new conversations and groups by inserting the creator first, then others
-- Adjust INSERT policy on conversation_participants to allow the first participant to be the creator

-- Ensure RLS is enabled (already should be, but safe)
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Drop the overly restrictive INSERT policy if it exists
DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.conversation_participants;

-- Create improved INSERT policy:
-- 1) Allow the creator (auth user) to add themselves as the FIRST participant of a conversation
-- 2) Allow any existing participant to add other users afterwards
CREATE POLICY "Users can add participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id
    )
  )
  OR public.is_conversation_participant(conversation_id, auth.uid())
);

-- Keep existing SELECT policy as-is (participants can view members). If it had a different name, leave it untouched.
-- No changes needed for messages/conversations policies.