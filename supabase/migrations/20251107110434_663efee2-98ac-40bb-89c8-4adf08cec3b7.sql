-- Ensure creator is auto-added as a participant so INSERT ... RETURNING works under RLS
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
END $$;