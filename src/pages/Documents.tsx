import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Formation, Stagiaire, DocumentStagiaire } from '@/types/database';
import { downloadPDF } from '@/lib/pdf-generator';

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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormation, setSelectedFormation] = useState<string>('all');
  const [selectedDocType, setSelectedDocType] = useState<string>('all');
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [generateFormation, setGenerateFormation] = useState<string>('');
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>(DOCUMENT_TYPES.map(d => d.id));
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

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
  const generateMutation = useMutation({
    mutationFn: async ({ formationId, docTypes }: { formationId: string; docTypes: string[] }) => {
      const formationInscriptions = inscriptions?.filter(i => i.formation_id === formationId) || [];
      const formation = formations?.find(f => f.id === formationId);
      
      if (!formation || formationInscriptions.length === 0) {
        throw new Error('Aucun stagiaire inscrit à cette formation');
      }

      setIsGenerating(true);
      setGeneratingProgress(0);

      const totalDocs = formationInscriptions.length * docTypes.length;
      let completedDocs = 0;

      for (const inscription of formationInscriptions) {
        for (const docType of docTypes) {
          // Check if document already exists
          const existing = documents?.find(
            d => d.inscription_id === inscription.id && d.type === docType
          );

          if (!existing) {
            // Generate document content based on type
            const content = generateDocumentContent(docType, inscription.stagiaire, formation);
            
            const { error } = await supabase
              .from('documents_stagiaires')
              .insert({
                inscription_id: inscription.id,
                type: docType,
                contenu: content,
                statut: 'genere_auto',
                genere_automatiquement: true,
                score: docType === 'qcm' ? Math.floor(Math.random() * 20) + 80 : // 80-100%
                       docType.includes('satisfaction') ? Math.floor(Math.random() * 10) + 90 : // 90-100%
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

  // Helper functions for document generation
  const generateDocumentContent = (type: string, stagiaire: Stagiaire, formation: Formation) => {
    const baseContent = {
      stagiaire: {
        prenom: stagiaire.prenom,
        nom: stagiaire.nom,
        email: stagiaire.email,
        entreprise: stagiaire.entreprise,
        fonction: stagiaire.fonction,
      },
      formation: {
        titre: formation.titre,
        lieu: formation.lieu,
        date_debut: formation.date_debut,
        date_fin: formation.date_fin,
        nombre_heures: formation.nombre_heures,
      },
    };

    switch (type) {
      case 'questionnaire_positionnement':
        return {
          ...baseContent,
          reponses: generatePositionnementReponses(),
        };
      case 'analyse_besoin':
        return {
          ...baseContent,
          objectifs: generateObjectifs(),
          attentes: generateAttentes(),
        };
      case 'qcm':
        return {
          ...baseContent,
          questions: generateQCMReponses(),
        };
      case 'satisfaction_chaud':
      case 'satisfaction_froid':
        return {
          ...baseContent,
          evaluations: generateSatisfactionReponses(),
          commentaires: generateCommentaire(),
        };
      case 'deroule_pedagogique':
        return {
          ...baseContent,
          sequences: generateSequences(formation),
        };
      case 'grille_observation':
        return {
          ...baseContent,
          ...generateGrilleObservation(stagiaire, formation),
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

  // Random content generators
  const generatePositionnementReponses = () => {
    const niveaux = ['Débutant', 'Intermédiaire', 'Avancé'];
    return {
      niveau_actuel: niveaux[Math.floor(Math.random() * 3)],
      experience_anterieure: Math.random() > 0.5 ? 'Oui' : 'Non',
      objectifs_personnels: 'Développer mes compétences professionnelles',
    };
  };

  const generateObjectifs = () => [
    'Maîtriser les fondamentaux',
    'Appliquer les techniques apprises',
    'Développer son autonomie',
  ];

  const generateAttentes = () => [
    'Formation pratique et concrète',
    'Exemples concrets du terrain',
    'Supports de cours complets',
  ];

  const generateQCMReponses = () => {
    const questions = [];
    for (let i = 1; i <= 10; i++) {
      questions.push({
        numero: i,
        reponse: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
        correct: Math.random() > 0.15, // 85% correct average
      });
    }
    return questions;
  };

  const generateSatisfactionReponses = () => ({
    organisation: 4 + Math.floor(Math.random() * 2), // 4-5
    contenu: 4 + Math.floor(Math.random() * 2),
    formateur: 5,
    supports: 4 + Math.floor(Math.random() * 2),
    global: 4 + Math.floor(Math.random() * 2),
  });

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

  const generateSequences = (formation: Formation) => {
    const sequences = [];
    const heures = formation.nombre_heures;
    let heuresRestantes = heures;
    
    // Generate realistic sequences based on formation
    const activites = [
      { duree: '30 minutes', objectifs: 'Accueil des stagiaires', contenu: 'Présentation des stagiaires et du formateur\nFeuille d\'émargement ½ journée\nQuestionnaire de positionnement du participant', outils: 'Café ou autre\nDiaporama Canva pour la présentation et paperboard\nLivret de formation fourni aux participants', exercice: 'Se présenter en moins de deux minutes\nTour de table', evaluation: 'Questionnaire de positionnement' },
      { duree: '3h30', objectifs: 'Introduction et bases', contenu: 'Introduction aux concepts fondamentaux\nBases théoriques et enjeux', outils: 'Diaporama Canva pour la présentation et paperboard\nLivret de formation fourni aux participants', exercice: 'Réflexion des participants sur les méthodes qu\'ils emploient\nJeux de Rôle Script', evaluation: 'Débriefing du participant\nÉvaluation par l\'observation' },
      { duree: '90 minutes', objectifs: 'Pause Déjeuner', contenu: '', outils: '', exercice: '', evaluation: '' },
      { duree: '2h00', objectifs: 'Approfondissement', contenu: 'Atelier pratique: mise en application des concepts\nÉtude de cas réels', outils: 'Diaporama Canva pour la présentation et paperboard\nLivret de formation fourni aux participants\nÉchanges sur les différents acteurs de la sphère', exercice: 'Exercice pratique', evaluation: 'Évaluation orale' },
      { duree: '10 minutes', objectifs: 'Pause', contenu: '', outils: '', exercice: '', evaluation: '' },
      { duree: '2h00', objectifs: 'Techniques avancées', contenu: 'Techniques avancées et bonnes pratiques\nStratégies et méthodologies', outils: 'Diaporama Canva pour la présentation et paperboard\nLivret de formation fourni aux participants\nExercice pratique', exercice: 'Mise en situation', evaluation: 'Vérification par le formateur que le stagiaire est autonome\nÉvaluation par observation' },
      { duree: '4h00', objectifs: 'Mise en pratique', contenu: 'Atelier pratique intensif\nÉtude de cas: analyse et identification des facteurs clés de succès', outils: 'Tour de table\nAuto-positionnement fin de formation\nFiche d\'évaluation satisfaction', exercice: 'QCM évaluation des acquis', evaluation: 'QCM d\'évaluation finale reprenant tous les modules\nCertificat de réalisation remis aux stagiaires' },
    ];
    
    // Select sequences based on formation hours
    let totalHeures = 0;
    for (const activite of activites) {
      if (totalHeures >= heures) break;
      sequences.push(activite);
      const dureeNum = parseFloat(activite.duree.replace('h', '').replace(' minutes', '')) || 0;
      totalHeures += activite.duree.includes('minutes') ? dureeNum / 60 : dureeNum;
    }
    
    return sequences;
  };

  const generateGrilleObservation = (stagiaire: Stagiaire, formation: Formation) => {
    const niveaux = ['A', 'B'];
    const competences = [
      { nom: 'Prospection porte à porte', niveau: niveaux[Math.floor(Math.random() * 2)], observation: '' },
      { nom: 'Prospection téléphonique', niveau: niveaux[Math.floor(Math.random() * 2)], observation: '' },
      { nom: 'Veille concurrentielle', niveau: niveaux[Math.floor(Math.random() * 2)], observation: '' },
      { nom: 'Base de données', niveau: niveaux[Math.floor(Math.random() * 2)], observation: '' },
      { nom: 'Réseaux sociaux', niveau: niveaux[Math.floor(Math.random() * 2)], observation: '' },
      { nom: 'Sphère d\'influence', niveau: niveaux[Math.floor(Math.random() * 2)], observation: '' },
      { nom: 'Relation clients', niveau: niveaux[Math.floor(Math.random() * 2)], observation: '' },
    ];
    
    const commentaires = [
      `${stagiaire.prenom} établit un bon premier contact, mais son discours manque de structure pour captiver l'interlocuteur dès les premières secondes.`,
      `${stagiaire.prenom} est souriante et engageante, avec une bonne capacité d'adaptation.`,
      `${stagiaire.prenom} présente bien son service et sait créer un climat de confiance.`,
      `${stagiaire.prenom} capte bien l'intérêt des interlocuteurs et pose les bonnes questions.`,
      `${stagiaire.prenom} a une bonne énergie et une posture dynamique.`,
    ];
    
    const axes = [
      'Travailler un pitch d\'accroche percutant pour capter immédiatement l\'attention et susciter l\'intérêt.',
      'Développer des techniques de reformulation et de contournement des objections pour maintenir le dialogue.',
      'Adopter une approche plus interrogative et centrée sur le besoin du prospect avant de proposer un service.',
      'Rendre son discours plus fluide et naturel, en s\'adaptant au ton et à la personnalité du prospect.',
      'Mieux structurer la conclusion de l\'échange en proposant directement un rendez-vous avec une date précise.',
    ];
    
    return {
      competences,
      moyenne: niveaux[Math.floor(Math.random() * 2)],
      observations_globales: {
        commentaire: commentaires[Math.floor(Math.random() * commentaires.length)],
        axe_amelioration: axes[Math.floor(Math.random() * axes.length)],
      },
    };
  };

  const generateObservations = () => ({
    participation: 'Active et constructive',
    comprehension: 'Bonne compréhension des concepts',
    application: 'Mise en pratique réussie',
    axes_amelioration: 'Approfondir les aspects théoriques',
  });

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
          {canManage && (
            <Button onClick={() => setIsGenerateDialogOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Générer des documents
            </Button>
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
                  <TableRow key={doc.id}>
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
                  <label className="text-sm font-medium">Formation</label>
                  <Select value={generateFormation} onValueChange={setGenerateFormation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une formation" />
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
    </div>
  );
}
