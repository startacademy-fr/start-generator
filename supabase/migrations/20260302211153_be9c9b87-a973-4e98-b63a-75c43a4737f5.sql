-- Create storage bucket for blank templates
INSERT INTO storage.buckets (id, name, public) VALUES ('templates-vierges', 'templates-vierges', true);

-- RLS policies for templates-vierges bucket
CREATE POLICY "Anyone can view templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'templates-vierges');

CREATE POLICY "Admins and assistantes can upload templates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'templates-vierges' 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'assistante'))
);

CREATE POLICY "Admins and assistantes can update templates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'templates-vierges' 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'assistante'))
);

CREATE POLICY "Admins and assistantes can delete templates"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'templates-vierges' 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'assistante'))
);

-- Table to track uploaded blank templates
CREATE TABLE public.templates_vierges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  nom_fichier text NOT NULL,
  storage_path text NOT NULL,
  taille integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(type)
);

ALTER TABLE public.templates_vierges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view templates_vierges"
ON public.templates_vierges FOR SELECT
USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Admins and assistantes can manage templates_vierges"
ON public.templates_vierges FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'assistante'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'assistante'));

CREATE TRIGGER update_templates_vierges_updated_at
BEFORE UPDATE ON public.templates_vierges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();