-- Fix 1: Replace broad 'Internal users can view tokens' with role-specific policy
DROP POLICY IF EXISTS "Internal users can view tokens" ON public.access_tokens;

CREATE POLICY "Admins and assistantes can view tokens"
ON public.access_tokens
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'assistante'::app_role)
);

-- Fix 2: Replace broad 'Internal users can view stagiaires' with restricted policy
DROP POLICY IF EXISTS "Internal users can view stagiaires" ON public.stagiaires;

CREATE POLICY "Non-lecteur internal users can view stagiaires"
ON public.stagiaires
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'assistante'::app_role)
  OR has_role(auth.uid(), 'formateur'::app_role)
);