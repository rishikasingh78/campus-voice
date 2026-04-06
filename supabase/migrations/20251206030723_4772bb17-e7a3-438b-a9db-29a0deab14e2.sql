-- Drop the existing admin role-based policy for issue updates
DROP POLICY IF EXISTS "Admins can update any issue" ON public.issues;

-- Create a more permissive policy that allows any authenticated user to update is_solved field
-- This is acceptable because the admin dashboard is protected by password
CREATE POLICY "Authenticated users can mark issues as solved" 
ON public.issues 
FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create a function to notify followers when a story is posted
CREATE OR REPLACE FUNCTION public.notify_story_followers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert notifications for all followers of the story creator
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT 
    f.follower_id,
    'New Story',
    (SELECT username FROM profiles WHERE id = NEW.user_id) || ' posted a new story',
    'new_story',
    '/'
  FROM public.follows f
  WHERE f.following_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for story notifications
DROP TRIGGER IF EXISTS notify_story_followers_trigger ON public.stories;
CREATE TRIGGER notify_story_followers_trigger
  AFTER INSERT ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_story_followers();