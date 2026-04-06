-- Push subscriptions for Web Push (service worker)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own push subscriptions"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions"
ON public.push_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- Updated-at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Secure cascade delete for issues (owner OR admin)
CREATE OR REPLACE FUNCTION public.delete_issue_cascade(issue_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  issue_owner uuid;
BEGIN
  SELECT user_id INTO issue_owner FROM public.issues WHERE id = issue_id_param;
  IF issue_owner IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() <> issue_owner AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.likes WHERE issue_id = issue_id_param;
  DELETE FROM public.comments WHERE issue_id = issue_id_param;
  DELETE FROM public.reposts WHERE issue_id = issue_id_param;
  DELETE FROM public.bookmarks WHERE issue_id = issue_id_param;
  DELETE FROM public.pinned_issues WHERE issue_id = issue_id_param;
  DELETE FROM public.issues WHERE id = issue_id_param;
END;
$$;

-- Secure cascade delete for stories (owner OR admin)
CREATE OR REPLACE FUNCTION public.delete_story_cascade(story_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  story_owner uuid;
BEGIN
  SELECT user_id INTO story_owner FROM public.stories WHERE id = story_id_param;
  IF story_owner IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() <> story_owner AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.story_likes WHERE story_id = story_id_param;
  DELETE FROM public.story_views WHERE story_id = story_id_param;
  DELETE FROM public.stories WHERE id = story_id_param;
END;
$$;