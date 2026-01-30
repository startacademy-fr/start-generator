-- Add new required fields to stagiaires table
ALTER TABLE public.stagiaires 
ADD COLUMN IF NOT EXISTS date_naissance date,
ADD COLUMN IF NOT EXISTS nom_jeune_fille text,
ADD COLUMN IF NOT EXISTS numero_securite_sociale text;

-- Rename diplomes to diplome_plus_eleve for clarity
ALTER TABLE public.stagiaires 
RENAME COLUMN diplomes TO diplome_plus_eleve;

-- Add comments for documentation
COMMENT ON COLUMN public.stagiaires.date_naissance IS 'Date de naissance du stagiaire (obligatoire)';
COMMENT ON COLUMN public.stagiaires.nom_jeune_fille IS 'Nom de jeune fille (optionnel)';
COMMENT ON COLUMN public.stagiaires.diplome_plus_eleve IS 'Diplôme le plus élevé obtenu (obligatoire)';
COMMENT ON COLUMN public.stagiaires.numero_securite_sociale IS 'Numéro de sécurité sociale (optionnel)';