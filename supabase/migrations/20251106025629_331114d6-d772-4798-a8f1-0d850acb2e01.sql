-- Fix conversations INSERT policy and auto-add creator as participant
BEGIN;

-- Ensure conversations insert policy allows authenticated users
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Helper unique index to prevent duplicate participants
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_conversation_user 
ON public.conversation_participants (conversation_id, user_id);

-- Trigger function to auto-add the creator as first participant
CREATE OR REPLACE FUNCTION public.add_creator_as_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if this conversation has no participants yet
  IF public.is_first_conversation_participant(NEW.id) THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (NEW.id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to call after conversation insert
DROP TRIGGER IF EXISTS trg_add_creator_as_participant ON public.conversations;
CREATE TRIGGER trg_add_creator_as_participant
AFTER INSERT ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.add_creator_as_participant();

COMMIT;