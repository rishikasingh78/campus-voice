-- Create conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_group BOOLEAN NOT NULL DEFAULT false,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversation_participants table
CREATE TABLE public.conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  goal TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign_participants table
CREATE TABLE public.campaign_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);

-- Create user_mutes table
CREATE TABLE public.user_mutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, muted_user_id)
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view conversations they are part of"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their conversations"
  ON public.conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for conversation_participants
CREATE POLICY "Participants can view conversation members"
  ON public.conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add participants to conversations"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = conversation_participants.conversation_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
    AND sender_id = auth.uid()
  );

-- RLS Policies for campaigns
CREATE POLICY "Campaigns are viewable by everyone"
  ON public.campaigns FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their campaigns"
  ON public.campaigns FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their campaigns"
  ON public.campaigns FOR DELETE
  USING (auth.uid() = creator_id);

-- RLS Policies for campaign_participants
CREATE POLICY "Campaign participants are viewable by everyone"
  ON public.campaign_participants FOR SELECT
  USING (true);

CREATE POLICY "Users can join campaigns"
  ON public.campaign_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave campaigns"
  ON public.campaign_participants FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_mutes
CREATE POLICY "Users can view their own mutes"
  ON public.user_mutes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mutes"
  ON public.user_mutes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mutes"
  ON public.user_mutes FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updating conversations updated_at
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updating campaigns updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_mutes;

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat images
CREATE POLICY "Anyone can view chat images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-images');

CREATE POLICY "Authenticated users can upload chat images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own chat images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own chat images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage bucket for campaign images
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-images', 'campaign-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for campaign images
CREATE POLICY "Anyone can view campaign images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-images');

CREATE POLICY "Authenticated users can upload campaign images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'campaign-images' AND auth.uid() IS NOT NULL);

-- Function to create notification for new issues (excluding muted users)
CREATE OR REPLACE FUNCTION public.notify_new_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert notifications for all users except the creator and users who muted the creator
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT 
    p.id,
    'New Issue Posted',
    'Check out the latest issue: ' || NEW.title,
    'new_issue',
    '/issue/' || NEW.id
  FROM public.profiles p
  WHERE p.id != NEW.user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.user_mutes
    WHERE user_id = p.id
    AND muted_user_id = NEW.user_id
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for new issue notifications
CREATE TRIGGER notify_users_on_new_issue
  AFTER INSERT ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_issue();