// Custom types for the Qualiopi Generator application

export type AppRole = 'admin' | 'assistante' | 'formateur';

export type InscriptionStatut = 'inscrit' | 'en_cours' | 'termine' | 'abandonne';

export type DocumentType = 
  | 'analyse_besoin'
  | 'questionnaire_positionnement'
  | 'qcm'
  | 'satisfaction_chaud'
  | 'satisfaction_froid'
  | 'deroule_pedagogique'
  | 'grille_observation'
  | 'fiche_emargement';

export type DocumentStatut = 'en_attente' | 'en_cours' | 'complete' | 'genere_auto';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  prenom: string;
  nom: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface FormationCatalogue {
  id: string;
  reference: string;
  titre: string;
  nombre_heures: number | null;
  programme: string | null;
  programme_pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Formation {
  id: string;
  titre: string;
  formateur_id: string | null;
  formation_catalogue_id: string | null;
  lieu: string;
  nombre_heures: number;
  date_debut: string;
  date_fin: string | null;
  archived: boolean;
  programme: string | null;
  programme_pdf_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  formateur?: Profile;
  formation_catalogue?: FormationCatalogue;
}

export type Civilite = 'M.' | 'Mme';

export interface Stagiaire {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  civilite: Civilite | null;
  telephone: string | null;
  entreprise: string | null;
  fonction: string | null;
  siret: string | null;
  adresse: string | null;
  situation_handicap: boolean;
  besoins_specifiques: string | null;
  anciennete: string | null;
  diplome_plus_eleve: string | null;
  taches_quotidiennes: string | null;
  date_naissance: string | null;
  nom_jeune_fille: string | null;
  numero_securite_sociale: string | null;
  est_salarie: boolean;
  created_at: string;
  updated_at: string;
}

export interface Inscription {
  id: string;
  formation_id: string;
  stagiaire_id: string;
  statut: InscriptionStatut;
  created_at: string;
  updated_at: string;
  // Joined fields
  formation?: Formation;
  stagiaire?: Stagiaire;
}

export interface AccessToken {
  id: string;
  inscription_id: string;
  token_hash: string;
  expires_at: string;
  revoked: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface DocumentTemplate {
  id: string;
  type: DocumentType;
  nom: string;
  contenu_template: Record<string, unknown>;
  formation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentStagiaire {
  id: string;
  inscription_id: string;
  template_id: string | null;
  type: DocumentType;
  contenu: Record<string, unknown>;
  score: number | null;
  statut: DocumentStatut;
  pdf_url: string | null;
  genere_automatiquement: boolean;
  date_soumission: string | null;
  ip_soumission: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  inscription?: Inscription;
  template?: DocumentTemplate;
}

export interface PieceJointe {
  id: string;
  document_id: string;
  nom_fichier: string;
  url: string;
  type_mime: string | null;
  taille: number | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Document type labels in French
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  analyse_besoin: "Fiche d'analyse du besoin",
  questionnaire_positionnement: "Questionnaire de positionnement",
  qcm: "QCM d'évaluation",
  satisfaction_chaud: "Satisfaction à chaud",
  satisfaction_froid: "Satisfaction à froid",
  deroule_pedagogique: "Déroulé pédagogique",
  grille_observation: "Grille d'observation",
  fiche_emargement: "Fiche d'émargement"
};

export const INSCRIPTION_STATUT_LABELS: Record<InscriptionStatut, string> = {
  inscrit: "Inscrit",
  en_cours: "En cours",
  termine: "Terminé",
  abandonne: "Abandonné"
};

export const DOCUMENT_STATUT_LABELS: Record<DocumentStatut, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  complete: "Complété",
  genere_auto: "Généré automatiquement"
};
