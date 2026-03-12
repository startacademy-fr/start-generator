
-- Update has_role and is_internal_user are already generic (they check user_roles table), 
-- so they automatically work with new roles.
-- But we need to update RLS policies to grant super_admin same access as admin.

-- Drop and recreate policies that reference 'admin' to also include 'super_admin'

-- formations
DROP POLICY IF EXISTS "Admins and assistantes can manage formations" ON public.formations;
CREATE POLICY "Admins and assistantes can manage formations" ON public.formations
FOR ALL TO public
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role));

-- stagiaires
DROP POLICY IF EXISTS "Admins and assistantes can manage stagiaires" ON public.stagiaires;
CREATE POLICY "Admins and assistantes can manage stagiaires" ON public.stagiaires
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role));

-- inscriptions
DROP POLICY IF EXISTS "Admins and assistantes can manage inscriptions" ON public.inscriptions;
CREATE POLICY "Admins and assistantes can manage inscriptions" ON public.inscriptions
FOR ALL TO public
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role));

-- access_tokens
DROP POLICY IF EXISTS "Admins and assistantes can manage tokens" ON public.access_tokens;
CREATE POLICY "Admins and assistantes can manage tokens" ON public.access_tokens
FOR ALL TO public
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role));

-- document_templates
DROP POLICY IF EXISTS "Admins and assistantes can manage templates" ON public.document_templates;
CREATE POLICY "Admins and assistantes can manage templates" ON public.document_templates
FOR ALL TO public
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role));

-- formations_catalogue
DROP POLICY IF EXISTS "Admins and assistantes can manage catalogue" ON public.formations_catalogue;
CREATE POLICY "Admins and assistantes can manage catalogue" ON public.formations_catalogue
FOR ALL TO public
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role));

-- templates_vierges
DROP POLICY IF EXISTS "Admins and assistantes can manage templates_vierges" ON public.templates_vierges;
CREATE POLICY "Admins and assistantes can manage templates_vierges" ON public.templates_vierges
FOR ALL TO public
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role));

-- reclamations
DROP POLICY IF EXISTS "Admins and assistantes can manage reclamations" ON public.reclamations;
CREATE POLICY "Admins and assistantes can manage reclamations" ON public.reclamations
FOR ALL TO public
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role));

-- profiles - admin management
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles" ON public.profiles
FOR ALL TO public
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- user_roles - only super_admin can manage roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Super admins can manage roles" ON public.user_roles
FOR ALL TO public
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT TO public
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- documents_stagiaires - keep internal users can manage, but add lecteur SELECT
DROP POLICY IF EXISTS "Internal users can manage documents" ON public.documents_stagiaires;
CREATE POLICY "Internal users can manage documents" ON public.documents_stagiaires
FOR ALL TO authenticated
USING (is_internal_user(auth.uid()) AND NOT has_role(auth.uid(), 'lecteur'::app_role))
WITH CHECK (is_internal_user(auth.uid()) AND NOT has_role(auth.uid(), 'lecteur'::app_role));

-- Lecteurs can view documents
CREATE POLICY "Lecteurs can view documents" ON public.documents_stagiaires
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'lecteur'::app_role));

-- pieces_jointes
DROP POLICY IF EXISTS "Internal users can manage attachments" ON public.pieces_jointes;
CREATE POLICY "Internal users can manage attachments" ON public.pieces_jointes
FOR ALL TO public
USING (is_internal_user(auth.uid()) AND NOT has_role(auth.uid(), 'lecteur'::app_role));

CREATE POLICY "Lecteurs can view attachments" ON public.pieces_jointes
FOR SELECT TO public
USING (has_role(auth.uid(), 'lecteur'::app_role));
