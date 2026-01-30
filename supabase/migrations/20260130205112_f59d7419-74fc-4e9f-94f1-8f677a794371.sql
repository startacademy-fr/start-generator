
-- Force RLS on stagiaires and documents_stagiaires tables to prevent bypassing
ALTER TABLE public.stagiaires FORCE ROW LEVEL SECURITY;
ALTER TABLE public.documents_stagiaires FORCE ROW LEVEL SECURITY;

-- Drop existing policies and recreate with explicit authentication check
DROP POLICY IF EXISTS "Internal users can view stagiaires" ON public.stagiaires;
DROP POLICY IF EXISTS "Admins and assistantes can manage stagiaires" ON public.stagiaires;

DROP POLICY IF EXISTS "Internal users can view documents" ON public.documents_stagiaires;
DROP POLICY IF EXISTS "Internal users can manage documents" ON public.documents_stagiaires;

-- Recreate policies with explicit authentication requirement
-- stagiaires table policies
CREATE POLICY "Internal users can view stagiaires" 
ON public.stagiaires 
FOR SELECT 
TO authenticated
USING (is_internal_user(auth.uid()));

CREATE POLICY "Admins and assistantes can manage stagiaires" 
ON public.stagiaires 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role));

-- documents_stagiaires table policies
CREATE POLICY "Internal users can view documents" 
ON public.documents_stagiaires 
FOR SELECT 
TO authenticated
USING (is_internal_user(auth.uid()));

CREATE POLICY "Internal users can manage documents" 
ON public.documents_stagiaires 
FOR ALL 
TO authenticated
USING (is_internal_user(auth.uid()))
WITH CHECK (is_internal_user(auth.uid()));
