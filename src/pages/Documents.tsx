import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { findMatchingQCMTemplate } from '@/lib/qcm-templates';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  FileText, 
  Search, 
  Sparkles, 
  Download, 
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileArchive,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Formation, Stagiaire, DocumentStagiaire } from '@/types/database';
import { downloadPDF } from '@/lib/pdf-generator';
import { ExportTemplatesSection } from '@/components/ExportTemplatesSection';

const DOCUMENT_TYPES = [
  { id: 'questionnaire_positionnement', label: 'Questionnaire de positionnement', icon: '📋' },
  { id: 'analyse_besoin', label: 'Analyse du besoin', icon: '🎯' },
  { id: 'qcm', label: 'QCM', icon: '✅' },
  { id: 'satisfaction_chaud', label: 'Satisfaction à chaud', icon: '🔥' },
  { id: 'satisfaction_froid', label: 'Satisfaction à froid', icon: '❄️' },
  { id: 'deroule_pedagogique', label: 'Déroulé pédagogique', icon: '📖' },
  { id: 'grille_observation', label: 'Grille d\'observation', icon: '👁️' },
];

interface InscriptionWithDetails {
  id: string;
  stagiaire_id: string;
  formation_id: string;
  statut: string;
  stagiaire: Stagiaire;
  formation: Formation;
}

export default function Documents() {
  const { isAdmin, isAssistante } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin() || isAssistante();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormation, setSelectedFormation] = useState<string>('all');
  const [selectedDocType, setSelectedDocType] = useState<string>('all');
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [generateFormation, setGenerateFormation] = useState<string>('');
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>(DOCUMENT_TYPES.map(d => d.id));
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Handle autoGenerate param from Audit page
  useEffect(() => {
    const autoGenerate = searchParams.get('autoGenerate');
    if (autoGenerate) {
      setGenerateFormation(autoGenerate);
      setSelectedDocTypes(DOCUMENT_TYPES.map(d => d.id));
      setIsGenerateDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch formations
  const { data: formations } = useQuery({
    queryKey: ['formations-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formations')
        .select('*')
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data as Formation[];
    },
  });

  // Fetch inscriptions with details
  const { data: inscriptions } = useQuery({
    queryKey: ['inscriptions-with-details'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inscriptions')
        .select(`
          id,
          stagiaire_id,
          formation_id,
          statut,
          stagiaire:stagiaires(*),
          formation:formations(*)
        `);
      if (error) throw error;
      return data as unknown as InscriptionWithDetails[];
    },
  });

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents_stagiaires')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DocumentStagiaire[];
    },
  });

  // Generate documents mutation
  // Cache for AI-generated QCM questions per formation (generated once, applied differently per stagiaire)
  const qcmCacheRef = { current: {} as Record<string, any[]> };

  const generateMutation = useMutation({
    mutationFn: async ({ formationId, docTypes }: { formationId: string; docTypes: string[] }) => {
      const formationInscriptions = inscriptions?.filter(i => i.formation_id === formationId) || [];
      const formation = formations?.find(f => f.id === formationId);
      
      if (!formation || formationInscriptions.length === 0) {
        throw new Error('Aucun stagiaire inscrit à cette formation');
      }

      setIsGenerating(true);
      setGeneratingProgress(0);

      // Pre-generate QCM questions once for the whole formation if QCM is in docTypes
      if (docTypes.includes('qcm') && !qcmCacheRef.current[formationId]) {
        try {
          const { data, error } = await supabase.functions.invoke('generate-qcm', {
            body: {
              formationTitre: formation.titre,
              programme: formation.programme,
              nombreQuestions: 13,
            },
          });
          if (!error && data?.questions?.length > 0) {
            qcmCacheRef.current[formationId] = data.questions;
          }
        } catch (e) {
          console.error('Failed to pre-generate QCM:', e);
        }
      }

      const totalDocs = formationInscriptions.length * docTypes.length;
      let completedDocs = 0;

      for (const inscription of formationInscriptions) {
        for (const docType of docTypes) {
          // Check if document already exists
          const existing = documents?.find(
            d => d.inscription_id === inscription.id && d.type === docType
          );

          if (!existing) {
            // Generate document content based on type (async for AI-powered generation)
            const content = await generateDocumentContent(docType, inscription.stagiaire, formation);
            
            const { error } = await supabase
              .from('documents_stagiaires')
              .insert({
                inscription_id: inscription.id,
                type: docType,
                contenu: content as any,
                statut: 'genere_auto',
                genere_automatiquement: true,
                score: docType === 'qcm' ? (content as any).score ?? Math.floor(Math.random() * 10) + 90 :
                       docType.includes('satisfaction') ? Math.floor(Math.random() * 10) + 90 :
                       null,
                date_soumission: generateSubmissionDate(docType, formation),
              });

            if (error) throw error;
          }

          completedDocs++;
          setGeneratingProgress((completedDocs / totalDocs) * 100);
        }
      }

      return { generated: completedDocs };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Documents générés avec succès');
      setIsGenerateDialogOpen(false);
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
      setIsGenerating(false);
    },
  });

  // Delete documents mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('documents_stagiaires')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`${selectedIds.length} document(s) supprimé(s)`);
      setSelectedIds([]);
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  // Helper functions for document generation
  const generateDocumentContent = async (type: string, stagiaire: Stagiaire, formation: Formation) => {
    const baseContent = {
      stagiaire: {
        prenom: stagiaire.prenom,
        nom: stagiaire.nom,
        email: stagiaire.email,
        entreprise: stagiaire.entreprise,
        fonction: stagiaire.fonction,
        anciennete: stagiaire.anciennete,
        diplomes: stagiaire.diplome_plus_eleve,
        taches_quotidiennes: stagiaire.taches_quotidiennes,
      },
      formation: {
        titre: formation.titre,
        lieu: formation.lieu,
        date_debut: formation.date_debut,
        date_fin: formation.date_fin,
        nombre_heures: formation.nombre_heures,
        programme: formation.programme,
      },
    };

    switch (type) {
      case 'questionnaire_positionnement':
        const competencies = await generateCompetenciesWithAI(formation);
        return {
          ...baseContent,
          competences: generatePositionnementReponses(competencies),
          objectifs_personnels: generateObjectifsPersonnels(),
          commentaires: generateCommentaires(),
          objectifs_formation: generateObjectifsFormation(stagiaire, formation),
          demande_specifique: generateDemandeSpecifique(stagiaire, formation),
          prerequis: generatePrerequis(stagiaire),
        };
      case 'analyse_besoin':
        const analyseData = await generateAnalyseBesoinWithAI(stagiaire, formation);
        return {
          ...baseContent,
          ...analyseData,
        };
      case 'qcm':
        const qcmData = await generateQCMWithAI(formation);
        return {
          ...baseContent,
          questions: qcmData.questions,
          score: qcmData.score,
        };
      case 'satisfaction_chaud':
        return {
          ...baseContent,
          ...generateSatisfactionChaud(),
        };
      case 'satisfaction_froid':
        return {
          ...baseContent,
          ...generateSatisfactionFroid(),
        };
      case 'deroule_pedagogique':
        const sequences = await generateSequences(formation);
        return {
          ...baseContent,
          sequences,
        };
      case 'grille_observation':
        const grilleData = await generateGrilleObservation(stagiaire, formation);
        return {
          ...baseContent,
          ...grilleData,
        };
      default:
        return baseContent;
    }
  };

  const generateSubmissionDate = (type: string, formation: Formation) => {
    const dateDebut = new Date(formation.date_debut);
    const dateFin = formation.date_fin ? new Date(formation.date_fin) : dateDebut;
    
    switch (type) {
      case 'positionnement':
      case 'analyse_besoin':
        // Before formation
        const beforeDate = new Date(dateDebut);
        beforeDate.setDate(beforeDate.getDate() - Math.floor(Math.random() * 7 + 1));
        return beforeDate.toISOString();
      case 'qcm':
      case 'satisfaction_chaud':
      case 'deroule_pedagogique':
      case 'grille_observation':
        // During or end of formation
        return dateFin.toISOString();
      case 'satisfaction_froid':
        // After formation (1-3 months)
        const afterDate = new Date(dateFin);
        afterDate.setMonth(afterDate.getMonth() + Math.floor(Math.random() * 2 + 1));
        return afterDate.toISOString();
      default:
        return new Date().toISOString();
    }
  };

  // AI-powered competency generation
  const generateCompetenciesWithAI = async (formation: Formation): Promise<string[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-competencies', {
        body: {
          formationTitre: formation.titre,
          programme: formation.programme,
          nombreCompetences: 6,
        },
      });

      if (error) {
        console.error('AI generation error:', error);
        // Fallback to default competencies based on title
        return generateFallbackCompetencies(formation.titre);
      }

      return data.competencies || generateFallbackCompetencies(formation.titre);
    } catch (error) {
      console.error('Failed to generate competencies:', error);
      return generateFallbackCompetencies(formation.titre);
    }
  };

  // Fallback competencies when AI is unavailable
  const generateFallbackCompetencies = (titre: string): string[] => {
    const lowerTitre = titre.toLowerCase();
    
    if (lowerTitre.includes('immobilier') || lowerTitre.includes('agent')) {
      return [
        'Maîtriser les techniques de prospection immobilière',
        'Évaluer un bien immobilier selon les critères du marché',
        'Conduire un entretien de découverte client',
        'Négocier les conditions de vente ou de location',
        'Rédiger les documents contractuels conformes',
        'Utiliser les outils numériques de l\'immobilier',
      ];
    }
    
    if (lowerTitre.includes('vente') || lowerTitre.includes('commercial')) {
      return [
        'Maîtriser les techniques de vente',
        'Identifier les besoins du client',
        'Argumenter et convaincre',
        'Gérer les objections',
        'Conclure une vente',
        'Fidéliser la clientèle',
      ];
    }
    
    if (lowerTitre.includes('management') || lowerTitre.includes('manager')) {
      return [
        'Animer et motiver son équipe',
        'Déléguer efficacement',
        'Conduire des entretiens professionnels',
        'Gérer les conflits',
        'Fixer des objectifs SMART',
        'Évaluer les performances',
      ];
    }
    
    // Default generic competencies
    return [
      'Comprendre les fondamentaux du domaine',
      'Appliquer les méthodologies apprises',
      'Analyser des situations professionnelles',
      'Mettre en pratique les acquis',
      'Communiquer efficacement',
      'Développer son autonomie professionnelle',
    ];
  };

  // Random content generators
  const generatePositionnementReponses = (competencies: string[]) => {
    return competencies.map((label) => {
      // Générer des scores avant/après cohérents (progression visible)
      const avant = Math.floor(Math.random() * 2) + 1; // 1 ou 2 (ne maîtrise pas / doit approfondir)
      const apres = Math.min(4, avant + Math.floor(Math.random() * 2) + 1); // +1 à +2 niveaux, max 4
      return { label, avant, apres };
    });
  };

  const generateObjectifsPersonnels = () => {
    const objectifs = [
      'Renforcer mes compétences techniques pour évoluer dans mon poste',
      'Acquérir de nouvelles méthodes de travail plus efficaces',
      'Développer mon expertise pour devenir référent dans mon domaine',
      'Améliorer ma performance quotidienne grâce aux nouvelles techniques',
      'Valider mes acquis et obtenir une reconnaissance professionnelle',
    ];
    return objectifs[Math.floor(Math.random() * objectifs.length)];
  };

  const generateCommentaires = () => {
    const commentaires = [
      'Formation très enrichissante qui correspond à mes attentes.',
      'J\'ai pu mettre en pratique les acquis dès le retour en poste.',
      'Excellent formateur, pédagogie adaptée à notre niveau.',
      'Contenu complet et bien structuré.',
      '',
    ];
    return commentaires[Math.floor(Math.random() * commentaires.length)];
  };

  const generateObjectifsFormation = (stagiaire: Stagiaire, formation: Formation) => {
    const fonction = stagiaire.fonction?.toLowerCase() || '';
    const titre = formation.titre.toLowerCase();
    
    const objectifsParProfil = [
      `Acquérir les compétences clés liées à ${formation.titre} pour les appliquer dans mon quotidien professionnel`,
      `Monter en compétence sur les techniques abordées afin d'être plus performant(e) dans mes missions`,
      `Comprendre et maîtriser les outils et méthodes présentés pour gagner en efficacité`,
      `Développer de nouvelles pratiques professionnelles en lien avec ${formation.titre}`,
      `Me perfectionner dans ce domaine pour apporter une réelle valeur ajoutée à mon entreprise`,
      `Consolider mes connaissances et acquérir des compétences opérationnelles immédiatement applicables`,
    ];
    
    if (titre.includes('immobilier') || titre.includes('prospection')) {
      objectifsParProfil.push(
        'Améliorer mes techniques de prospection et de prise de mandats',
        'Développer ma capacité à capter de nouveaux clients et à fidéliser mon portefeuille',
      );
    }
    if (titre.includes('ia') || titre.includes('agent augmenté')) {
      objectifsParProfil.push(
        'Comprendre comment intégrer l\'IA dans mon quotidien professionnel',
        'Maîtriser les outils d\'intelligence artificielle pour gagner en productivité',
      );
    }
    if (titre.includes('recrutement')) {
      objectifsParProfil.push(
        'Structurer ma démarche de recrutement pour attirer les meilleurs profils',
        'Améliorer ma capacité à évaluer les candidats lors des entretiens',
      );
    }
    
    return objectifsParProfil[Math.floor(Math.random() * objectifsParProfil.length)];
  };

  const generateDemandeSpecifique = (stagiaire: Stagiaire, formation: Formation) => {
    const demandes = [
      'J\'aimerais des exemples concrets et des mises en situation pratiques',
      'Je souhaite pouvoir échanger sur des cas réels rencontrés dans mon activité',
      'J\'attends des outils et des méthodes directement applicables sur le terrain',
      'Je voudrais approfondir les aspects pratiques plus que la théorie',
      'Pas de demande particulière, j\'ai hâte de découvrir le programme',
      'J\'aimerais avoir des supports récapitulatifs à conserver après la formation',
      'Je souhaite pouvoir poser des questions sur mes problématiques spécifiques',
      '',
    ];
    return demandes[Math.floor(Math.random() * demandes.length)];
  };

  const generatePrerequis = (stagiaire: Stagiaire) => {
    const niveaux = [
      'Aucune notion particulière, je pars de zéro sur ce sujet',
      'Notion de base acquise par la pratique quotidienne',
      'Quelques connaissances de base, principalement autodidacte',
      'Notions de base, j\'ai déjà eu une première approche du sujet',
      'Connaissances limitées, j\'ai besoin de structurer mes acquis',
      'Bases acquises mais besoin d\'approfondir et de me perfectionner',
    ];
    return niveaux[Math.floor(Math.random() * niveaux.length)];
  };

  const generateAnalyseBesoinWithAI = async (stagiaire: Stagiaire, formation: Formation) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-analyse-besoin', {
        body: {
          formationTitre: formation.titre,
          programme: formation.programme,
          stagiaire: {
            prenom: stagiaire.prenom,
            nom: stagiaire.nom,
            entreprise: stagiaire.entreprise,
            fonction: stagiaire.fonction,
            anciennete: stagiaire.anciennete,
            diplomes: stagiaire.diplome_plus_eleve,
            taches_quotidiennes: stagiaire.taches_quotidiennes,
          },
        },
      });

      if (!error && data) {
        return {
          contexte_professionnel: data.contexte_professionnel,
          objectifs_stagiaire: data.objectifs_stagiaire,
          attentes: data.attentes,
          competences_visees: data.competences_visees,
          freins_identifies: data.freins_identifies,
          motivation: data.motivation,
          // Keep legacy fields for backward compatibility
          objectifs: data.objectifs_stagiaire,
        };
      }
    } catch (e) {
      console.error('Failed to generate analyse besoin with AI:', e);
    }

    // Fallback
    return {
      objectifs: [
        'Maîtriser les fondamentaux de la formation',
        'Appliquer les techniques apprises dans mon quotidien',
        'Développer mon autonomie sur ces sujets',
      ],
      attentes: [
        'Formation pratique et concrète',
        'Exemples concrets du terrain',
        'Supports de cours complets',
      ],
    };
  };

  // Apply random answers to cached QCM questions (unique per stagiaire)
  const applyRandomAnswers = (questions: any[]): { questions: any[]; score: number } => {
    // 0 to 3 errors for variety (score range ~77%-100% on 13 questions)
    const rand = Math.random();
    const nbErrors = rand < 0.2 ? 0 : rand < 0.5 ? 1 : rand < 0.8 ? 2 : 3;
    
    // Pick unique random indices for errors
    const errorIndices = new Set<number>();
    while (errorIndices.size < nbErrors) {
      errorIndices.add(Math.floor(Math.random() * questions.length));
    }

    const filledQuestions = questions.map((q: any, idx: number) => {
      const isError = errorIndices.has(idx);
      let selectedAnswer = q.correct_answer;

      if (isError) {
        const wrongOptions = q.options.filter((o: any) => o.letter !== q.correct_answer);
        if (wrongOptions.length > 0) {
          selectedAnswer = wrongOptions[Math.floor(Math.random() * wrongOptions.length)].letter;
        }
      }

      return {
        numero: idx + 1,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        selected_answer: selectedAnswer,
        is_correct: selectedAnswer === q.correct_answer,
      };
    });

    const correctCount = filledQuestions.filter((q: any) => q.is_correct).length;
    const score = Math.round((correctCount / filledQuestions.length) * 100);

    return { questions: filledQuestions, score };
  };

  // QCM generation: template match first, then AI fallback
  const generateQCMWithAI = async (formation: Formation): Promise<{ questions: any[]; score: number }> => {
    // Use cached questions if available (same questions, different answers per stagiaire)
    const cached = qcmCacheRef.current[formation.id];
    if (cached && cached.length > 0) {
      return applyRandomAnswers(cached);
    }

    // Try to find a matching template first
    const template = findMatchingQCMTemplate(formation.titre, formation.programme);
    if (template) {
      console.log(`QCM template matched: ${template.label}`);
      qcmCacheRef.current[formation.id] = template.questions;
      return applyRandomAnswers(template.questions);
    }

    // No template match → AI generation

    try {
      const { data, error } = await supabase.functions.invoke('generate-qcm', {
        body: {
          formationTitre: formation.titre,
          programme: formation.programme,
          nombreQuestions: 13,
        },
      });

      if (error) {
        console.error('AI QCM generation error:', error);
        return generateFallbackQCM();
      }

      const questions = data.questions || [];
      if (questions.length === 0) return generateFallbackQCM();

      // Cache for other stagiaires
      qcmCacheRef.current[formation.id] = questions;
      return applyRandomAnswers(questions);
    } catch (error) {
      console.error('Failed to generate QCM:', error);
      return generateFallbackQCM();
    }
  };

  const generateFallbackQCM = (): { questions: any[]; score: number } => {
    const fallbackQuestions = [
      { question: "Quel est l'objectif principal de cette formation ?", options: [{ letter: 'A', text: 'Acquérir de nouvelles compétences' }, { letter: 'B', text: 'Se divertir' }, { letter: 'C', text: 'Obtenir un diplôme' }], correct_answer: 'A' },
      { question: "La formation permet-elle une application pratique ?", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'A' },
      { question: "Quel élément est essentiel pour réussir ?", options: [{ letter: 'A', text: 'La chance' }, { letter: 'B', text: 'La pratique régulière' }, { letter: 'C', text: 'Le hasard' }], correct_answer: 'B' },
    ];
    return applyRandomAnswers(fallbackQuestions);
  };

  const generateSatisfactionChaud = () => {
    const ratings = ['Très bien', 'Bien'];
    const randomRating = () => ratings[Math.floor(Math.random() * 2)];
    
    const connaissances = [
      'Par mon employeur',
      'Recherche internet',
      'Recommandation d\'un collègue',
      'Réseaux sociaux',
    ];
    
    const initiatives = [
      'Mon employeur',
      'Moi-même',
      'Décision commune avec mon manager',
    ];
    
    const commentairesOrga = [
      'Organisation parfaite, communication claire et réactive.',
      'Très bien organisé, délais respectés.',
      'Excellente coordination entre les intervenants.',
    ];
    
    const commentairesMoyens = [
      'Locaux agréables et bien équipés.',
      'Supports de qualité, matériel fonctionnel.',
      'Environnement propice à l\'apprentissage.',
    ];
    
    const commentairesPeda = [
      'Formateur très pédagogue et à l\'écoute.',
      'Approche pratique appréciée, bon rythme.',
      'Contenu adapté à nos besoins, exercices pertinents.',
    ];
    
    const commentairesGroupe = [
      'Groupe dynamique et participatif.',
      'Bonne ambiance, échanges enrichissants.',
      'Cohésion du groupe, entraide entre participants.',
    ];
    
    const utilites = [
      'Application immédiate dans mon travail quotidien.',
      'Compétences directement utilisables sur le terrain.',
      'Amélioration significative de mes pratiques.',
    ];
    
    const remarques = [
      'Formation très complète et bien structurée.',
      'Je recommande vivement cette formation.',
      'Rien à redire, tout était parfait.',
      '',
    ];
    
    const autresThemes = [
      'Négociation avancée',
      'Gestion du temps',
      'Communication digitale',
      '',
    ];
    
    return {
      questions_initiales: {
        connaissance: connaissances[Math.floor(Math.random() * connaissances.length)],
        initiative: initiatives[Math.floor(Math.random() * initiatives.length)],
      },
      organisation: {
        communication: randomRating(),
        delai: randomRating(),
        duree: randomRating(),
        engagements: randomRating(),
        commentaire: commentairesOrga[Math.floor(Math.random() * commentairesOrga.length)],
      },
      moyens: {
        cadre: randomRating(),
        locaux: randomRating(),
        supports: randomRating(),
        materiel: randomRating(),
        commentaire: commentairesMoyens[Math.floor(Math.random() * commentairesMoyens.length)],
      },
      pedagogie: {
        difficulte: randomRating(),
        articulation: randomRating(),
        theorique: randomRating(),
        pratique: randomRating(),
        rythme: randomRating(),
        approche: 'Très bien',
        ecoute: 'Très bien',
        animation: randomRating(),
        commentaire: commentairesPeda[Math.floor(Math.random() * commentairesPeda.length)],
      },
      groupe: {
        ambiance: randomRating(),
        nombre: randomRating(),
        heterogeneite: randomRating(),
        attention: randomRating(),
        commentaire: commentairesGroupe[Math.floor(Math.random() * commentairesGroupe.length)],
      },
      benefice: {
        adequation: randomRating(),
        utilite: utilites[Math.floor(Math.random() * utilites.length)],
        commentaire: 'Formation très enrichissante.',
      },
      questions_finales: {
        recommandation: 'Oui, sans hésitation',
        remarques: remarques[Math.floor(Math.random() * remarques.length)],
        autres_themes: autresThemes[Math.floor(Math.random() * autresThemes.length)],
      },
      donnees_personnelles: {
        ville: 'Nice',
        date: format(new Date(), 'dd/MM/yyyy', { locale: fr }),
      },
    };
  };

  const generateSatisfactionFroid = () => {
    const n_plus_1 = [
      'Marie Dupont',
      'Pierre Martin',
      'Sophie Bernard',
      'Jean Moreau',
    ];
    
    const pourquois = [
      'Les objectifs de formation correspondent parfaitement aux besoins du poste.',
      'Le contenu était en adéquation avec les attentes exprimées.',
      'La formation a permis de combler les lacunes identifiées.',
    ];
    
    const remarquesCollab = [
      'Le collaborateur a montré une réelle progression depuis la formation. Il applique quotidiennement les techniques apprises et a gagné en confiance.',
      'Amélioration notable des compétences, mise en pratique régulière des acquis.',
      'Très satisfait de l\'évolution du collaborateur suite à cette formation.',
    ];
    
    return {
      info: {
        n_plus_1: n_plus_1[Math.floor(Math.random() * n_plus_1.length)],
        plan_formation: 'Oui',
      },
      q1: {
        reponse: 'Oui tout à fait',
        pourquoi: pourquois[Math.floor(Math.random() * pourquois.length)],
      },
      q2: {
        initiative: ['Vous et votre collaborateur'],
      },
      q3: {
        mise_pratique: 'Oui tout à fait',
        frequence: 'Quotidiennement',
      },
      q4: {
        entretien: 'Oui',
      },
      remarques: remarquesCollab[Math.floor(Math.random() * remarquesCollab.length)],
    };
  };

  const generateCommentaire = () => {
    const commentaires = [
      'Très bonne formation, je recommande.',
      'Formation enrichissante et pratique.',
      'Excellent formateur, très pédagogue.',
      'Contenu adapté à mes besoins professionnels.',
      'Je suis satisfait de cette formation.',
    ];
    return commentaires[Math.floor(Math.random() * commentaires.length)];
  };

  const generateSequences = async (formation: Formation) => {
    const nombreJours = Math.max(1, Math.ceil(formation.nombre_heures / 7));
    const dateDebut = new Date(formation.date_debut);
    const dateFin = formation.date_fin ? new Date(formation.date_fin) : dateDebut;

    let jours: any[] = [];

    // Try AI-powered generation based on actual programme content
    try {
      const { data, error } = await supabase.functions.invoke('generate-deroule', {
        body: {
          formationTitre: formation.titre,
          programme: formation.programme,
          nombreHeures: formation.nombre_heures,
        },
      });

      if (!error && data?.jours?.length > 0) {
        jours = data.jours.map((jour: any, i: number) => ({
          numero: i + 1,
          titre: `Jour ${i + 1} : ${jour.theme}`,
          sequences: jour.sequences,
        }));
      }
    } catch (e) {
      console.error('Failed to generate deroule with AI:', e);
    }

    // Fallback si l'IA échoue
    if (jours.length === 0) {
      for (let i = 0; i < nombreJours; i++) {
        const isLastDay = i === nombreJours - 1;
        jours.push({
          numero: i + 1,
          titre: `Jour ${i + 1}`,
          sequences: [
            { duree: '30 min', objectifs: 'Accueil des stagiaires et introduction', contenu: 'Présentation, tour de table, feuille d\'émargement', outils: 'Diaporama, paperboard', exercice: 'Se présenter', evaluation: 'Questionnaire de positionnement' },
            { duree: '2h30', objectifs: 'Module principal du matin', contenu: 'Contenu théorique et pratique', outils: 'Diaporama, études de cas', exercice: 'Mise en pratique', evaluation: 'Débriefing' },
            { duree: '90 min', objectifs: 'Pause déjeuner', contenu: '', outils: '', exercice: '', evaluation: '' },
            { duree: '1h10', objectifs: 'Module après-midi 1', contenu: 'Approfondissement', outils: 'Diaporama, démonstration', exercice: 'Simulation en binôme', evaluation: 'Retour d\'expérience' },
            { duree: '10 min', objectifs: 'Pause', contenu: '', outils: '', exercice: '', evaluation: '' },
            { duree: '1h10', objectifs: 'Module après-midi 2', contenu: 'Mise en situation', outils: 'Jeux de rôle', exercice: 'Mise en situation pratique', evaluation: 'Correction collective' },
            { duree: '20 min', objectifs: isLastDay ? 'Évaluation des acquis et clôture' : 'Bilan de la journée', contenu: isLastDay ? 'Synthèse et remise des certificats' : 'Synthèse', outils: 'Tour de table', exercice: '', evaluation: 'QCM et satisfaction' },
          ],
        });
      }
    }

    const satisfactionGroupe = [
      { numero: 1, question: "L'homogénéité du groupe était-elle satisfaisante ?", score: 4 + Math.floor(Math.random() * 2) },
      { numero: 2, question: "Le niveau de base du groupe était-il suffisant par rapport au contenu du stage ?", score: 4 + Math.floor(Math.random() * 2) },
      { numero: 3, question: "Le nombre de stagiaires était-il correct ?", score: 5 },
      { numero: 4, question: "Les stagiaires ont-ils bien participé aux échanges ?", score: 4 + Math.floor(Math.random() * 2) },
      { numero: 5, question: "Jugez-vous que les stagiaires ont globalement assimilé les techniques enseignées ?", score: 4 + Math.floor(Math.random() * 2) },
    ];

    const satisfactionOrga = [
      { numero: 6, question: "La salle de travail était-elle adaptée au stage ?", score: 4 + Math.floor(Math.random() * 2) },
      { numero: 7, question: "Les stagiaires étaient-ils bien informés sur le stage ?", score: 5 },
    ];

    const remarquesGroupe = [
      "J'ai particulièrement apprécié l'implication et la dynamique du groupe tout au long de la formation.",
      "Groupe très motivé et participatif.",
      "Excellente dynamique de groupe avec des échanges constructifs.",
    ];

    const bilans = [
      "Les objectifs pédagogiques ont été atteints. Les participants repartent avec des outils concrets.",
      "Formation très réussie avec une excellente participation.",
      "L'approche pratique a permis aux stagiaires d'acquérir des compétences directement applicables.",
    ];

    const adaptations = [
      "Étude de cas réelle en fonction d'un cas concret de l'un des participants. Travail en sous-groupes pour renforcer la cohésion.",
      "Adaptation du rythme selon les besoins du groupe. Ajout d'exercices pratiques supplémentaires.",
      "Modification de l'ordre de certains modules pour mieux répondre aux attentes exprimées.",
    ];

    return {
      jours,
      formateur_info: {
        nom: 'Julien Lafitte',
        titre_stage: formation.titre,
        dates: `${format(dateDebut, 'dd/MM/yy', { locale: fr })} au ${format(dateFin, 'dd/MM/yy', { locale: fr })}`,
      },
      adaptations_pedagogiques: adaptations[Math.floor(Math.random() * adaptations.length)],
      satisfaction_formateur: {
        groupe: satisfactionGroupe,
        remarques_groupe: remarquesGroupe[Math.floor(Math.random() * remarquesGroupe.length)],
        organisation: satisfactionOrga,
        bilan_formation: bilans[Math.floor(Math.random() * bilans.length)],
      },
    };
  };

  const generateGrilleObservation = async (stagiaire: Stagiaire, formation: Formation) => {
    const niveaux = ['A', 'B'];
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-grille', {
        body: {
          formationTitre: formation.titre,
          programme: formation.programme,
          programmePdfUrl: formation.programme_pdf_url,
          stagiairePrenom: stagiaire.prenom,
          stagiaireNom: stagiaire.nom,
        },
      });

      if (!error && data?.competences) {
        const competences = data.competences.map((nom: string) => ({
          nom,
          niveau: niveaux[Math.floor(Math.random() * 2)],
          observation: '',
        }));

        return {
          competences,
          moyenne: niveaux[Math.floor(Math.random() * 2)],
          observations_globales: {
            commentaire: data.commentaire || '',
            axe_amelioration: data.axe_amelioration || '',
          },
        };
      }
    } catch (e) {
      console.error('Failed to generate grille with AI:', e);
    }

    // Fallback générique
    const fallbackCompetences = [
      'Maîtrise des fondamentaux',
      'Application des méthodes',
      'Analyse de situations',
      'Mise en pratique',
      'Communication professionnelle',
      'Autonomie dans les tâches',
      'Esprit d\'initiative',
    ];

    return {
      competences: fallbackCompetences.map(nom => ({
        nom,
        niveau: niveaux[Math.floor(Math.random() * 2)],
        observation: '',
      })),
      moyenne: niveaux[Math.floor(Math.random() * 2)],
      observations_globales: {
        commentaire: `${stagiaire.prenom} fait preuve d'une bonne implication et participe activement aux exercices.`,
        axe_amelioration: 'Approfondir les aspects théoriques pour mieux structurer sa pratique.',
      },
    };
  };

  const generateObservations = () => ({
    participation: 'Active et constructive',
    comprehension: 'Bonne compréhension des concepts',
    application: 'Mise en pratique réussie',
    axes_amelioration: 'Approfondir les aspects théoriques',
  });

  // Preview QCM with sample data
  const handlePreviewQCM = () => {
    const sampleQuestions = [
      { numero: 1, question: "Combien de techniques d'IA connaissez-vous ?", options: [{ letter: 'A', text: '1 à 2' }, { letter: 'B', text: '3 à 5' }, { letter: 'C', text: 'Plus de 5' }, { letter: 'D', text: 'Aucune' }], correct_answer: 'C', selected_answer: 'C', is_correct: true },
      { numero: 2, question: "Quel est l'objectif principal de la formation ?", options: [{ letter: 'A', text: 'Vendre plus' }, { letter: 'B', text: "Comprendre et utiliser l'IA" }, { letter: 'C', text: 'Automatiser totalement' }, { letter: 'D', text: "Remplacer l'humain" }], correct_answer: 'B', selected_answer: 'B', is_correct: true },
      { numero: 3, question: "Quelle est la première étape de la méthode avancée ?", options: [{ letter: 'A', text: 'Analyser le besoin' }, { letter: 'B', text: 'Tester des outils' }, { letter: 'C', text: 'Automatiser' }, { letter: 'D', text: 'Optimiser' }], correct_answer: 'A', selected_answer: 'A', is_correct: true },
      { numero: 4, question: "Vrai ou faux : L'IA peut rédiger des mails automatiquement.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'A', selected_answer: 'A', is_correct: true },
      { numero: 5, question: "Quel est le but de l'atelier Prompt Parfait ?", options: [{ letter: 'A', text: 'Créer des images' }, { letter: 'B', text: 'Rédiger des prompts efficaces' }, { letter: 'C', text: 'Coder une IA' }, { letter: 'D', text: 'Automatiser un CRM' }], correct_answer: 'B', selected_answer: 'B', is_correct: true },
      { numero: 6, question: "Quel est un des éléments à évaluer lors de la conception de prompt ?", options: [{ letter: 'A', text: 'La clarté' }, { letter: 'B', text: 'La longueur' }, { letter: 'C', text: 'La couleur' }, { letter: 'D', text: 'Le design' }], correct_answer: 'A', selected_answer: 'A', is_correct: true },
      { numero: 7, question: "Vrai ou faux : L'IA ne peut pas analyser les performances.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'B', selected_answer: 'B', is_correct: true },
      { numero: 8, question: "Quel est l'objectif de la rédaction optimisée ?", options: [{ letter: 'A', text: 'Faire du volume' }, { letter: 'B', text: 'Gagner du temps' }, { letter: 'C', text: "Améliorer l'impact commercial" }, { letter: 'D', text: 'Copier-coller' }], correct_answer: 'C', selected_answer: 'C', is_correct: true },
      { numero: 9, question: "Vrai ou faux : L'IA peut améliorer les photos immobilières.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'A', selected_answer: 'A', is_correct: true },
      { numero: 10, question: "Vrai ou faux : L'IA ne peut pas générer de bilans.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'B', selected_answer: 'A', is_correct: false },
      { numero: 11, question: "Quel est le rôle de l'IA dans le suivi vendeur ?", options: [{ letter: 'A', text: 'Envoyer des pubs' }, { letter: 'B', text: 'Analyser et personnaliser le suivi' }, { letter: 'C', text: "Remplacer l'agent immobilier" }, { letter: 'D', text: 'Archiver les dossiers' }], correct_answer: 'B', selected_answer: 'B', is_correct: true },
      { numero: 12, question: "Quel est un des bénéfices de l'IA pour les clients ?", options: [{ letter: 'A', text: 'Plus de complexité' }, { letter: 'B', text: 'Réponses plus rapides et personnalisées' }, { letter: 'C', text: 'Moins de contact humain' }, { letter: 'D', text: 'Moins de données' }], correct_answer: 'B', selected_answer: 'B', is_correct: true },
      { numero: 13, question: "Vrai ou faux : L'IA ne peut pas aider à la prospection.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'B', selected_answer: 'B', is_correct: true },
    ];

    const sampleData = {
      type: 'qcm',
      stagiaire: { prenom: 'Jean', nom: 'Dupont', email: 'jean.dupont@example.com', entreprise: 'Immobilier Plus', fonction: 'Agent commercial' },
      formation: { titre: "Agent Augmenté par l'IA - Immobilier", lieu: 'Vence', date_debut: '2026-02-24', date_fin: '2026-02-28', nombre_heures: 35 },
      contenu: { questions: sampleQuestions, score: 92 },
      score: 92,
    };

    downloadPDF(sampleData);
    toast.success('PDF de prévisualisation QCM téléchargé');
  };

  // Get document stats for a formation
  const getFormationStats = (formationId: string) => {
    const formationInscriptions = inscriptions?.filter(i => i.formation_id === formationId) || [];
    const expectedDocs = formationInscriptions.length * DOCUMENT_TYPES.length;
    const actualDocs = documents?.filter(d => 
      formationInscriptions.some(i => i.id === d.inscription_id)
    ).length || 0;
    return { expected: expectedDocs, actual: actualDocs, complete: expectedDocs > 0 && actualDocs >= expectedDocs };
  };

  // Filter documents
  const filteredDocuments = documents?.filter(doc => {
    const inscription = inscriptions?.find(i => i.id === doc.inscription_id);
    if (!inscription) return false;

    const matchesSearch = 
      inscription.stagiaire.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inscription.stagiaire.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inscription.formation.titre.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFormation = selectedFormation === 'all' || inscription.formation_id === selectedFormation;
    const matchesDocType = selectedDocType === 'all' || doc.type === selectedDocType;

    return matchesSearch && matchesFormation && matchesDocType;
  });

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'genere_auto':
        return <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />Généré auto</Badge>;
      case 'complete':
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Complété</Badge>;
      case 'en_cours':
        return <Badge variant="outline" className="gap-1"><RefreshCw className="h-3 w-3" />En cours</Badge>;
      case 'en_attente':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />En attente</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  const getDocTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(d => d.id === type)?.label || type;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredDocuments?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDocuments?.map(d => d.id) || []);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1">
            Gérez et générez les documents Qualiopi
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && selectedIds.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer ({selectedIds.length})
            </Button>
          )}
          {canManage && (
            <>
              <Button variant="outline" onClick={handlePreviewQCM}>
                <Eye className="mr-2 h-4 w-4" />
                Prévisualiser QCM
              </Button>
              <Button onClick={() => setIsGenerateDialogOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Générer des documents
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {formations?.slice(0, 3).map(formation => {
          const stats = getFormationStats(formation.id);
          return (
            <Card key={formation.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium truncate">{formation.titre}</CardTitle>
                <CardDescription>
                  {format(new Date(formation.date_debut), 'dd/MM/yyyy', { locale: fr })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Progression</span>
                  <span className="text-sm font-medium">
                    {stats.actual}/{stats.expected}
                  </span>
                </div>
                <Progress 
                  value={stats.expected > 0 ? (stats.actual / stats.expected) * 100 : 0} 
                  className="h-2"
                />
                {stats.complete && (
                  <div className="flex items-center gap-1 mt-2 text-green-600 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Dossier complet
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Export templates vierges */}
      <ExportTemplatesSection />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedFormation} onValueChange={setSelectedFormation}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Formation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les formations</SelectItem>
            {formations?.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.titre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedDocType} onValueChange={setSelectedDocType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Type de document" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {DOCUMENT_TYPES.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Documents table */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredDocuments?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucun document trouvé</p>
            {canManage && (
              <Button 
                variant="link" 
                className="mt-2"
                onClick={() => setIsGenerateDialogOpen(true)}
              >
                Générer des documents
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === filteredDocuments?.length && filteredDocuments?.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>Type</TableHead>
                <TableHead>Stagiaire</TableHead>
                <TableHead>Formation</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments?.map(doc => {
                const inscription = inscriptions?.find(i => i.id === doc.inscription_id);
                if (!inscription) return null;
                
                return (
                  <TableRow key={doc.id} className={selectedIds.includes(doc.id) ? 'bg-muted/50' : ''}>
                    {canManage && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(doc.id)}
                          onCheckedChange={() => toggleSelect(doc.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{getDocTypeLabel(doc.type)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {inscription.stagiaire.prenom} {inscription.stagiaire.nom}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {inscription.formation.titre}
                    </TableCell>
                    <TableCell>{getStatusBadge(doc.statut)}</TableCell>
                    <TableCell>
                      {doc.score !== null ? (
                        <Badge variant={doc.score >= 80 ? 'default' : 'destructive'}>
                          {doc.score}%
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.date_soumission 
                        ? format(new Date(doc.date_soumission), 'dd/MM/yyyy', { locale: fr })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Visualiser">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Télécharger PDF"
                          onClick={() => {
                            const contenu = doc.contenu as any;
                            downloadPDF({
                              type: doc.type,
                              stagiaire: {
                                prenom: inscription.stagiaire.prenom,
                                nom: inscription.stagiaire.nom,
                                email: inscription.stagiaire.email,
                                entreprise: inscription.stagiaire.entreprise || undefined,
                                fonction: inscription.stagiaire.fonction || undefined,
                              },
                              formation: {
                                titre: inscription.formation.titre,
                                lieu: inscription.formation.lieu,
                                date_debut: inscription.formation.date_debut,
                                date_fin: inscription.formation.date_fin,
                                nombre_heures: inscription.formation.nombre_heures,
                              },
                              contenu: contenu,
                              score: doc.score,
                              date_soumission: doc.date_soumission,
                            });
                            toast.success('PDF téléchargé');
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canManage && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            title="Supprimer"
                            onClick={() => {
                              setSelectedIds([doc.id]);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Generate dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Générer des documents
            </DialogTitle>
            <DialogDescription>
              Générez automatiquement les documents Qualiopi pour une formation
            </DialogDescription>
          </DialogHeader>

          {isGenerating ? (
            <div className="py-8 space-y-4">
              <div className="flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
              <Progress value={generatingProgress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">
                Génération en cours... {Math.round(generatingProgress)}%
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Session de formation</label>
                  <Select value={generateFormation} onValueChange={setGenerateFormation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une session" />
                    </SelectTrigger>
                    <SelectContent>
                      {formations?.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.titre} ({format(new Date(f.date_debut), 'dd/MM/yyyy', { locale: fr })})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Types de documents</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DOCUMENT_TYPES.map(docType => (
                      <div key={docType.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={docType.id}
                          checked={selectedDocTypes.includes(docType.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDocTypes([...selectedDocTypes, docType.id]);
                            } else {
                              setSelectedDocTypes(selectedDocTypes.filter(d => d !== docType.id));
                            }
                          }}
                        />
                        <label htmlFor={docType.id} className="text-sm">
                          {docType.icon} {docType.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {generateFormation && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="font-medium mb-1">Résumé</p>
                    <p className="text-muted-foreground">
                      {inscriptions?.filter(i => i.formation_id === generateFormation).length || 0} stagiaire(s) × {selectedDocTypes.length} type(s) de document
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                  Annuler
                </Button>
                <Button 
                  onClick={() => generateMutation.mutate({ 
                    formationId: generateFormation, 
                    docTypes: selectedDocTypes 
                  })}
                  disabled={!generateFormation || selectedDocTypes.length === 0}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Générer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Supprimer les documents"
        description="Cette action est irréversible. Les documents sélectionnés seront définitivement supprimés."
        itemCount={selectedIds.length}
        onConfirm={() => deleteMutation.mutate(selectedIds)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
