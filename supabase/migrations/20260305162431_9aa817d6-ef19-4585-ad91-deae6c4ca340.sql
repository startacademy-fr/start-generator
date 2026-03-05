
-- Clear data first, then drop columns
UPDATE public.stagiaires SET telephone = NULL, numero_securite_sociale = NULL;
ALTER TABLE public.stagiaires DROP COLUMN telephone;
ALTER TABLE public.stagiaires DROP COLUMN numero_securite_sociale;
