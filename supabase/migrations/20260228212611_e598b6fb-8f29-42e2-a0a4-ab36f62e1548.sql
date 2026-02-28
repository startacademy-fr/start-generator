
-- Create formations catalogue table
CREATE TABLE public.formations_catalogue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference text NOT NULL,
  titre text NOT NULL,
  programme text,
  programme_pdf_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add auto-incrementing reference sequence
CREATE SEQUENCE formations_catalogue_ref_seq START 1;

-- Add formation_catalogue_id to formations (sessions)
ALTER TABLE public.formations ADD COLUMN formation_catalogue_id uuid REFERENCES public.formations_catalogue(id);

-- RLS
ALTER TABLE public.formations_catalogue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view catalogue" ON public.formations_catalogue
  FOR SELECT USING (is_internal_user(auth.uid()));

CREATE POLICY "Admins and assistantes can manage catalogue" ON public.formations_catalogue
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_formations_catalogue_updated_at
  BEFORE UPDATE ON public.formations_catalogue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
