-- Avoid recursive RLS by using a SECURITY DEFINER helper for first participant check
create or replace function public.is_first_conversation_participant(_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = _conversation_id
  );
$$;

-- Replace insert policy to use the helper function
drop policy if exists "Users can add participants" on public.conversation_participants;
create policy "Users can add participants"
on public.conversation_participants
for insert
to authenticated
with check (
  (
    user_id = auth.uid() and public.is_first_conversation_participant(conversation_id)
  )
  or public.is_conversation_participant(conversation_id, auth.uid())
);