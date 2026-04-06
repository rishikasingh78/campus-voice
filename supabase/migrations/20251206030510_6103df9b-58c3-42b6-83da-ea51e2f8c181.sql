-- Add unique constraint on story_views if not exists
ALTER TABLE public.story_views 
  DROP CONSTRAINT IF EXISTS story_views_story_viewer_unique;

ALTER TABLE public.story_views 
  ADD CONSTRAINT story_views_story_viewer_unique UNIQUE (story_id, viewer_id);

-- Create storage bucket for stories if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for story uploads
CREATE POLICY "Users can upload their own stories" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Story images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'stories');

CREATE POLICY "Users can delete their own story images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);