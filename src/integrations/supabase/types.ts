export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          inscription_id: string
          last_used_at: string | null
          revoked: boolean
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          inscription_id: string
          last_used_at?: string | null
          revoked?: boolean
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          inscription_id?: string
          last_used_at?: string | null
          revoked?: boolean
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_tokens_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "inscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          contenu_template: Json
          created_at: string
          formation_id: string | null
          id: string
          nom: string
          type: string
          updated_at: string
        }
        Insert: {
          contenu_template?: Json
          created_at?: string
          formation_id?: string | null
          id?: string
          nom: string
          type: string
          updated_at?: string
        }
        Update: {
          contenu_template?: Json
          created_at?: string
          formation_id?: string | null
          id?: string
          nom?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_stagiaires: {
        Row: {
          contenu: Json
          created_at: string
          date_soumission: string | null
          genere_automatiquement: boolean
          id: string
          inscription_id: string
          ip_soumission: unknown
          pdf_url: string | null
          score: number | null
          statut: string
          template_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          contenu?: Json
          created_at?: string
          date_soumission?: string | null
          genere_automatiquement?: boolean
          id?: string
          inscription_id: string
          ip_soumission?: unknown
          pdf_url?: string | null
          score?: number | null
          statut?: string
          template_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          contenu?: Json
          created_at?: string
          date_soumission?: string | null
          genere_automatiquement?: boolean
          id?: string
          inscription_id?: string
          ip_soumission?: unknown
          pdf_url?: string | null
          score?: number | null
          statut?: string
          template_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_stagiaires_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_stagiaires_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      formations: {
        Row: {
          archived: boolean
          created_at: string
          date_debut: string
          date_fin: string | null
          formateur_id: string | null
          formation_catalogue_id: string | null
          id: string
          lieu: string
          montant_total: number | null
          nombre_heures: number
          objectifs: string | null
          programme: string | null
          programme_pdf_url: string | null
          specialite_nsf: string | null
          titre: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          date_debut: string
          date_fin?: string | null
          formateur_id?: string | null
          formation_catalogue_id?: string | null
          id?: string
          lieu: string
          montant_total?: number | null
          nombre_heures: number
          objectifs?: string | null
          programme?: string | null
          programme_pdf_url?: string | null
          specialite_nsf?: string | null
          titre: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          formateur_id?: string | null
          formation_catalogue_id?: string | null
          id?: string
          lieu?: string
          montant_total?: number | null
          nombre_heures?: number
          objectifs?: string | null
          programme?: string | null
          programme_pdf_url?: string | null
          specialite_nsf?: string | null
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formations_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formations_formation_catalogue_id_fkey"
            columns: ["formation_catalogue_id"]
            isOneToOne: false
            referencedRelation: "formations_catalogue"
            referencedColumns: ["id"]
          },
        ]
      }
      formations_catalogue: {
        Row: {
          created_at: string
          id: string
          nombre_heures: number | null
          objectifs: string | null
          programme: string | null
          programme_pdf_url: string | null
          reference: string
          specialite_nsf: string | null
          titre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre_heures?: number | null
          objectifs?: string | null
          programme?: string | null
          programme_pdf_url?: string | null
          reference: string
          specialite_nsf?: string | null
          titre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre_heures?: number | null
          objectifs?: string | null
          programme?: string | null
          programme_pdf_url?: string | null
          reference?: string
          specialite_nsf?: string | null
          titre?: string
          updated_at?: string
        }
        Relationships: []
      }
      inscriptions: {
        Row: {
          created_at: string
          formation_id: string
          id: string
          organisme_prise_en_charge: string | null
          stagiaire_id: string
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          formation_id: string
          id?: string
          organisme_prise_en_charge?: string | null
          stagiaire_id: string
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          formation_id?: string
          id?: string
          organisme_prise_en_charge?: string | null
          stagiaire_id?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscriptions_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_stagiaire_id_fkey"
            columns: ["stagiaire_id"]
            isOneToOne: false
            referencedRelation: "stagiaires"
            referencedColumns: ["id"]
          },
        ]
      }
      organisme_settings: {
        Row: {
          adresse: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          nda: string | null
          nom_organisme: string
          siret: string | null
          site_web: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          nda?: string | null
          nom_organisme?: string
          siret?: string | null
          site_web?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          nda?: string | null
          nom_organisme?: string
          siret?: string | null
          site_web?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pieces_jointes: {
        Row: {
          created_at: string
          document_id: string
          id: string
          nom_fichier: string
          taille: number | null
          type_mime: string | null
          url: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          nom_fichier: string
          taille?: number | null
          type_mime?: string | null
          url: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          nom_fichier?: string
          taille?: number | null
          type_mime?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "pieces_jointes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents_stagiaires"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nda: string | null
          nom: string
          prenom: string
          telephone: string | null
          type_formateur: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nda?: string | null
          nom: string
          prenom: string
          telephone?: string | null
          type_formateur?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nda?: string | null
          nom?: string
          prenom?: string
          telephone?: string | null
          type_formateur?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reclamations: {
        Row: {
          created_at: string
          date_reclamation: string
          date_resolution: string | null
          description: string | null
          formation_id: string | null
          id: string
          objet: string
          resolution: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_reclamation?: string
          date_resolution?: string | null
          description?: string | null
          formation_id?: string | null
          id?: string
          objet: string
          resolution?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_reclamation?: string
          date_resolution?: string | null
          description?: string | null
          formation_id?: string | null
          id?: string
          objet?: string
          resolution?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reclamations_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
        ]
      }
      stagiaires: {
        Row: {
          adresse: string | null
          anciennete: string | null
          besoins_specifiques: string | null
          chef_entreprise: boolean | null
          civilite: string | null
          created_at: string
          date_naissance: string | null
          diplome_plus_eleve: string | null
          email: string
          entreprise: string | null
          est_salarie: boolean | null
          fonction: string | null
          id: string
          nom: string
          nom_jeune_fille: string | null
          prenom: string
          siret: string | null
          situation_handicap: boolean | null
          taches_quotidiennes: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          anciennete?: string | null
          besoins_specifiques?: string | null
          chef_entreprise?: boolean | null
          civilite?: string | null
          created_at?: string
          date_naissance?: string | null
          diplome_plus_eleve?: string | null
          email: string
          entreprise?: string | null
          est_salarie?: boolean | null
          fonction?: string | null
          id?: string
          nom: string
          nom_jeune_fille?: string | null
          prenom: string
          siret?: string | null
          situation_handicap?: boolean | null
          taches_quotidiennes?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          anciennete?: string | null
          besoins_specifiques?: string | null
          chef_entreprise?: boolean | null
          civilite?: string | null
          created_at?: string
          date_naissance?: string | null
          diplome_plus_eleve?: string | null
          email?: string
          entreprise?: string | null
          est_salarie?: boolean | null
          fonction?: string | null
          id?: string
          nom?: string
          nom_jeune_fille?: string | null
          prenom?: string
          siret?: string | null
          situation_handicap?: boolean | null
          taches_quotidiennes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      templates_vierges: {
        Row: {
          created_at: string
          id: string
          nom_fichier: string
          storage_path: string
          taille: number | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom_fichier: string
          storage_path: string
          taille?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nom_fichier?: string
          storage_path?: string
          taille?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_internal_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "assistante" | "formateur" | "super_admin" | "lecteur"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "assistante", "formateur", "super_admin", "lecteur"],
    },
  },
} as const
