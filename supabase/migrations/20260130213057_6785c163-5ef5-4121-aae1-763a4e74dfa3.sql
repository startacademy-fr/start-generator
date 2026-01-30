-- Add new fields to stagiaires table for positioning questionnaire
ALTER TABLE public.stagiaires 
ADD COLUMN IF NOT EXISTS anciennete text,
ADD COLUMN IF NOT EXISTS diplomes text,
ADD COLUMN IF NOT EXISTS taches_quotidiennes text;

-- Add programme field to formations table for AI competency generation
ALTER TABLE public.formations 
ADD COLUMN IF NOT EXISTS programme text;

-- Add comment for documentation
COMMENT ON COLUMN public.stagiaires.anciennete IS 'Ancienneté du stagiaire dans son poste/entreprise';
COMMENT ON COLUMN public.stagiaires.diplomes IS 'Diplômes et certifications du stagiaire';
COMMENT ON COLUMN public.stagiaires.taches_quotidiennes IS 'Tâches quotidiennes principales du stagiaire';
COMMENT ON COLUMN public.formations.programme IS 'Programme détaillé de la formation pour génération IA des compétences';