
CREATE TABLE public.organisme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_organisme text NOT NULL DEFAULT '',
  siret text DEFAULT '',
  nda text DEFAULT '',
  adresse text DEFAULT '',
  telephone text DEFAULT '',
  email text DEFAULT '',
  site_web text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.organisme_settings (nom_organisme) VALUES ('Start Academy');

ALTER TABLE public.organisme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view organisme settings"
ON public.organisme_settings FOR SELECT
TO authenticated
USING (is_internal_user(auth.uid()));

CREATE POLICY "Admins can manage organisme settings"
ON public.organisme_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_organisme_settings_updated_at
BEFORE UPDATE ON public.organisme_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
