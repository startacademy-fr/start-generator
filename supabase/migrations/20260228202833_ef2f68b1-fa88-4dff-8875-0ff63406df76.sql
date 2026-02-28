
-- Fix 1: Replace permissive audit_logs INSERT policy with internal-user-only policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "Internal users can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (is_internal_user(auth.uid()));
