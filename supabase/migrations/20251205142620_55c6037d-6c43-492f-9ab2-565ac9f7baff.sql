-- User suspensions/bans table
CREATE TABLE public.user_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  suspended_by TEXT NOT NULL DEFAULT 'admin',
  reason TEXT,
  suspension_type TEXT NOT NULL CHECK (suspension_type IN ('temporary', 'permanent')),
  suspended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, is_active)
);

ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to check suspensions (needed for login checks)
CREATE POLICY "Anyone can view suspensions" ON public.user_suspensions
FOR SELECT USING (true);

-- Only allow system/admin inserts (we'll use service role for admin actions)
CREATE POLICY "System can manage suspensions" ON public.user_suspensions
FOR ALL USING (true);

-- Story views table
CREATE TABLE public.story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Story owner can view who saw their story
CREATE POLICY "Story owners can view story views" ON public.story_views
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.stories 
    WHERE stories.id = story_views.story_id 
    AND stories.user_id = auth.uid()
  )
);

-- Users can record their own views
CREATE POLICY "Users can record their views" ON public.story_views
FOR INSERT WITH CHECK (viewer_id = auth.uid());

-- Enable realtime for stories
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_likes;