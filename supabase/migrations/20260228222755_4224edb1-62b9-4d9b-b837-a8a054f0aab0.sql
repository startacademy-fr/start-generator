
-- Table réclamations pour le suivi Qualiopi (indicateur 31)
CREATE TABLE public.reclamations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_reclamation DATE NOT NULL DEFAULT CURRENT_DATE,
  objet TEXT NOT NULL,
  description TEXT,
  formation_id UUID REFERENCES public.formations(id),
  statut TEXT NOT NULL DEFAULT 'en_cours',
  date_resolution DATE,
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.reclamations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and assistantes can manage reclamations"
  ON public.reclamations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'assistante'::app_role));

CREATE POLICY "Internal users can view reclamations"
  ON public.reclamations FOR SELECT
  USING (is_internal_user(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_reclamations_updated_at
  BEFORE UPDATE ON public.reclamations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
