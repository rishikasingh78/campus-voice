-- Add scheduled_at column to announcements table for scheduled announcements
ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone DEFAULT NULL;

-- Add index for better query performance on scheduled announcements
CREATE INDEX IF NOT EXISTS idx_announcements_scheduled_at ON public.announcements(scheduled_at);

-- First, let's safely delete related records before the issues
-- Delete likes for an issue before deleting the issue
CREATE OR REPLACE FUNCTION public.delete_issue_cascade(issue_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete related likes
    DELETE FROM public.likes WHERE issue_id = issue_id_param;
    -- Delete related comments
    DELETE FROM public.comments WHERE issue_id = issue_id_param;
    -- Delete related reposts
    DELETE FROM public.reposts WHERE issue_id = issue_id_param;
    -- Delete related bookmarks
    DELETE FROM public.bookmarks WHERE issue_id = issue_id_param;
    -- Delete pinned issues
    DELETE FROM public.pinned_issues WHERE issue_id = issue_id_param;
    -- Finally delete the issue
    DELETE FROM public.issues WHERE id = issue_id_param;
END;
$$;