-- Replace overly-permissive write policies with admin-only write policies.
-- Keep public/owner SELECT policies as-is.

-- announcements
DROP POLICY IF EXISTS "System can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements"
ON public.announcements
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- polls
DROP POLICY IF EXISTS "System can manage polls" ON public.polls;
CREATE POLICY "Admins can manage polls"
ON public.polls
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- pinned_issues
DROP POLICY IF EXISTS "System can manage pinned issues" ON public.pinned_issues;
CREATE POLICY "Admins can manage pinned issues"
ON public.pinned_issues
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- user_suspensions
DROP POLICY IF EXISTS "System can manage suspensions" ON public.user_suspensions;
CREATE POLICY "Admins can manage suspensions"
ON public.user_suspensions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- user_reports
DROP POLICY IF EXISTS "System can manage all reports" ON public.user_reports;
CREATE POLICY "Admins can manage all reports"
ON public.user_reports
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- notifications
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "Admins can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
