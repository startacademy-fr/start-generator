-- Create app_role enum for internal users
CREATE TYPE public.app_role AS ENUM ('admin', 'assistante', 'formateur');

-- Create profiles table for authenticated users (Admin/Assistante/Formateur)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Formations table
CREATE TABLE public.formations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  formateur_id UUID REFERENCES public.profiles(id),
  lieu TEXT NOT NULL,
  nombre_heures INTEGER NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stagiaires table  
CREATE TABLE public.stagiaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  telephone TEXT,
  entreprise TEXT,
  fonction TEXT,
  siret TEXT,
  adresse TEXT,
  situation_handicap BOOLEAN DEFAULT false,
  besoins_specifiques TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inscriptions (link between formations and stagiaires)
CREATE TABLE public.inscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id UUID NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  stagiaire_id UUID NOT NULL REFERENCES public.stagiaires(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'inscrit' CHECK (statut IN ('inscrit', 'en_cours', 'termine', 'abandonne')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(formation_id, stagiaire_id)
);

-- Access tokens for stagiaire portal (stored hashed)
CREATE TABLE public.access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id UUID NOT NULL REFERENCES public.inscriptions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Document templates (modèles de documents)
CREATE TABLE public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'analyse_besoin',
    'questionnaire_positionnement', 
    'qcm',
    'satisfaction_chaud',
    'satisfaction_froid',
    'deroule_pedagogique',
    'grille_observation',
    'fiche_emargement'
  )),
  nom TEXT NOT NULL,
  contenu_template JSONB NOT NULL DEFAULT '{}',
  formation_id UUID REFERENCES public.formations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents stagiaires (generated documents)
CREATE TABLE public.documents_stagiaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id UUID NOT NULL REFERENCES public.inscriptions(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'analyse_besoin',
    'questionnaire_positionnement',
    'qcm', 
    'satisfaction_chaud',
    'satisfaction_froid',
    'deroule_pedagogique',
    'grille_observation',
    'fiche_emargement'
  )),
  contenu JSONB NOT NULL DEFAULT '{}',
  score INTEGER,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'en_cours', 'complete', 'genere_auto')),
  pdf_url TEXT,
  genere_automatiquement BOOLEAN NOT NULL DEFAULT false,
  date_soumission TIMESTAMPTZ,
  ip_soumission INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pieces jointes (file attachments)
CREATE TABLE public.pieces_jointes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents_stagiaires(id) ON DELETE CASCADE,
  nom_fichier TEXT NOT NULL,
  url TEXT NOT NULL,
  type_mime TEXT,
  taille INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stagiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents_stagiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pieces_jointes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is any internal role
CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Internal users can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_internal_user(auth.uid()));
  
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Internal users can view roles" ON public.user_roles
  FOR SELECT USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for formations
CREATE POLICY "Internal users can view formations" ON public.formations
  FOR SELECT USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Admins and assistantes can manage formations" ON public.formations
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'assistante')
  );

-- RLS Policies for stagiaires
CREATE POLICY "Internal users can view stagiaires" ON public.stagiaires
  FOR SELECT USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Admins and assistantes can manage stagiaires" ON public.stagiaires
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'assistante')
  );

-- RLS Policies for inscriptions
CREATE POLICY "Internal users can view inscriptions" ON public.inscriptions
  FOR SELECT USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Admins and assistantes can manage inscriptions" ON public.inscriptions
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'assistante')
  );

-- RLS Policies for access_tokens
CREATE POLICY "Internal users can view tokens" ON public.access_tokens
  FOR SELECT USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Admins and assistantes can manage tokens" ON public.access_tokens
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'assistante')
  );

-- RLS Policies for document_templates
CREATE POLICY "Internal users can view templates" ON public.document_templates
  FOR SELECT USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Admins and assistantes can manage templates" ON public.document_templates
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'assistante')
  );

-- RLS Policies for documents_stagiaires
CREATE POLICY "Internal users can view documents" ON public.documents_stagiaires
  FOR SELECT USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users can manage documents" ON public.documents_stagiaires
  FOR ALL USING (public.is_internal_user(auth.uid()));

-- RLS Policies for pieces_jointes
CREATE POLICY "Internal users can view attachments" ON public.pieces_jointes
  FOR SELECT USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users can manage attachments" ON public.pieces_jointes
  FOR ALL USING (public.is_internal_user(auth.uid()));

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- Trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_formations_updated_at BEFORE UPDATE ON public.formations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stagiaires_updated_at BEFORE UPDATE ON public.stagiaires
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inscriptions_updated_at BEFORE UPDATE ON public.inscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_stagiaires_updated_at BEFORE UPDATE ON public.documents_stagiaires
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, prenom, nom)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'nom', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_formations_archived ON public.formations(archived);
CREATE INDEX idx_formations_formateur ON public.formations(formateur_id);
CREATE INDEX idx_stagiaires_email ON public.stagiaires(email);
CREATE INDEX idx_inscriptions_formation ON public.inscriptions(formation_id);
CREATE INDEX idx_inscriptions_stagiaire ON public.inscriptions(stagiaire_id);
CREATE INDEX idx_access_tokens_hash ON public.access_tokens(token_hash);
CREATE INDEX idx_access_tokens_expires ON public.access_tokens(expires_at);
CREATE INDEX idx_documents_inscription ON public.documents_stagiaires(inscription_id);
CREATE INDEX idx_documents_type ON public.documents_stagiaires(type);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at);