-- Add civilite field to stagiaires table
ALTER TABLE public.stagiaires
ADD COLUMN civilite text CHECK (civilite IN ('M.', 'Mme'));