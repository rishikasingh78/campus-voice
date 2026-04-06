-- Ensure trigger exists to auto-add creator as participant so INSERT ... SELECT works under RLS
-- This prevents RLS violation on conversations SELECT after INSERT because the user becomes a participant immediately
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'add_creator_as_participant_trigger'
  ) THEN
    CREATE TRIGGER add_creator_as_participant_trigger
    AFTER INSERT ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.add_creator_as_participant();
  END IF;
END$$;