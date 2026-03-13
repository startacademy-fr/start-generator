
-- Add objectifs column to formations_catalogue (separate from programme which becomes "programme détaillé")
ALTER TABLE public.formations_catalogue ADD COLUMN IF NOT EXISTS objectifs text;

-- Copy existing programme data to objectifs (since users were putting objectives there)
UPDATE public.formations_catalogue SET objectifs = programme WHERE programme IS NOT NULL;

-- Add objectifs column to formations (sessions)
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS objectifs text;

-- Copy existing programme data to objectifs in formations too
UPDATE public.formations SET objectifs = programme WHERE programme IS NOT NULL;
