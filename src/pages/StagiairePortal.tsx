import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Clock, 
  GraduationCap,
  Calendar,
  MapPin,
  Loader2,
  ShieldAlert,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DocumentFormDialog } from '@/components/stagiaire-portal/DocumentFormDialog';

interface TokenData {
  inscription_id: string;
  stagiaire: { prenom: string; nom: string; email: string };
  formation: { titre: string; lieu: string; date_debut: string; date_fin: string | null; nombre_heures: number };
}

interface PortalDocument {
  id: string;
  type: string;
  statut: string;
  genere_automatiquement: boolean;
}

const DOCUMENT_TYPES = [
  { id: 'questionnaire_positionnement', label: 'Questionnaire de positionnement', icon: '📋', phase: 'avant' },
  { id: 'analyse_besoin', label: 'Analyse du besoin', icon: '🎯', phase: 'avant' },
  { id: 'qcm', label: "QCM d'évaluation", icon: '✅', phase: 'pendant' },
  { id: 'satisfaction_chaud', label: 'Satisfaction à chaud', icon: '🔥', phase: 'pendant' },
  { id: 'satisfaction_froid', label: 'Satisfaction à froid', icon: '❄️', phase: 'apres' },
];

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-token`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callTokenApi(body: Record<string, any>) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
}

export default function StagiairePortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [selectedDocType, setSelectedDocType] = useState<typeof DOCUMENT_TYPES[0] | null>(null);

  // Validate token
  useEffect(() => {
    if (!token) { setTokenError('Aucun token fourni'); setIsValidating(false); return; }
    if (token.length > 500) { setTokenError('Lien invalide'); setIsValidating(false); return; }

    callTokenApi({ action: 'validate', token })
      .then(data => {
        setTokenData({
          inscription_id: data.inscription.id,
          stagiaire: data.inscription.stagiaire as any,
          formation: data.inscription.formation as any,
        });
      })
      .catch(() => setTokenError('Lien invalide ou expiré'))
      .finally(() => setIsValidating(false));
  }, [token]);

  // Fetch documents via edge function (bypasses RLS)
  const fetchDocuments = useCallback(() => {
    if (!token) return;
    callTokenApi({ action: 'get-documents', token })
      .then(data => setDocuments(data.documents || []))
      .catch(() => {});
  }, [token]);

  useEffect(() => { if (tokenData) fetchDocuments(); }, [tokenData, fetchDocuments]);

  // Progress calculation
  const getDocStatus = (docTypeId: string): 'completed' | 'in_progress' | 'pending' => {
    const doc = documents.find(d => d.type === docTypeId);
    if (!doc) return 'pending';
    if (doc.statut === 'complete' || doc.statut === 'genere_auto') return 'completed';
    if (doc.statut === 'en_cours') return 'in_progress';
    return 'pending';
  };

  const completedDocs = DOCUMENT_TYPES.filter(d => getDocStatus(d.id) === 'completed').length;
  const progressPercent = (completedDocs / DOCUMENT_TYPES.length) * 100;

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Validation de votre accès...</p>
        </div>
      </div>
    );
  }

  if (tokenError || !tokenData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-destructive/5 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle className="text-destructive">Accès refusé</CardTitle>
            <CardDescription>{tokenError || 'Impossible de valider votre accès'}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Si vous pensez qu'il s'agit d'une erreur, contactez votre organisme de formation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const phases = [
    { key: 'avant', label: 'Avant la formation', icon: <Clock className="h-4 w-4" /> },
    { key: 'pendant', label: 'Pendant la formation', icon: <GraduationCap className="h-4 w-4" /> },
    { key: 'apres', label: 'Après la formation', icon: <CheckCircle2 className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="bg-background/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="container py-4 px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-display font-bold text-primary">Start Academy</h1>
              <p className="text-xs text-muted-foreground">Espace stagiaire</p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {tokenData.stagiaire.prenom} {tokenData.stagiaire.nom}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container py-6 px-4 space-y-6">
        {/* Formation info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">{tokenData.formation.titre}</CardTitle>
                <CardDescription className="mt-1 space-y-1">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {tokenData.formation.lieu}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(tokenData.formation.date_debut), 'dd MMMM yyyy', { locale: fr })}
                    {tokenData.formation.date_fin && (
                      <span> - {format(new Date(tokenData.formation.date_fin), 'dd MMMM yyyy', { locale: fr })}</span>
                    )}
                  </div>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Progress */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Progression</CardTitle>
              <span className="text-sm font-medium text-primary">{completedDocs}/{DOCUMENT_TYPES.length}</span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {progressPercent === 100
                ? '✨ Tous les documents sont complétés !'
                : `${DOCUMENT_TYPES.length - completedDocs} document(s) restant(s)`}
            </p>
          </CardContent>
        </Card>

        {/* Documents by phase */}
        <div className="space-y-4">
          {phases.map(phase => (
            <div key={phase.key}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                {phase.icon}
                {phase.label}
              </h3>
              <div className="space-y-2">
                {DOCUMENT_TYPES.filter(d => d.phase === phase.key).map(docType => {
                  const status = getDocStatus(docType.id);
                  const isAutoGenerated = documents.find(d => d.type === docType.id)?.genere_automatiquement;
                  return (
                    <Card
                      key={docType.id}
                      className={`transition-all ${status === 'completed' ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900' : ''}`}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{docType.icon}</span>
                          <div>
                            <p className="font-medium text-sm">{docType.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {status === 'completed'
                                ? isAutoGenerated ? 'Généré automatiquement' : 'Complété'
                                : status === 'in_progress' ? 'En cours' : 'À compléter'}
                            </p>
                          </div>
                        </div>
                        <div>
                          {status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : status === 'in_progress' ? (
                            <Clock className="h-5 w-5 text-amber-500" />
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setSelectedDocType(docType)}>
                              Compléter
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t bg-muted/30 mt-8">
        <div className="container py-4 px-4 text-center">
          <p className="text-xs text-muted-foreground">
            Start Academy – 618 boulevard Jean Maurel inférieur 06140 Vence
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Contact : info@start-academy.fr – 06 22 80 65 09
          </p>
        </div>
      </footer>

      {/* Document form dialog */}
      {selectedDocType && token && (
        <DocumentFormDialog
          open={!!selectedDocType}
          onOpenChange={(open) => { if (!open) setSelectedDocType(null); }}
          docType={selectedDocType}
          token={token}
          stagiaire={tokenData.stagiaire}
          formation={tokenData.formation}
          onSubmitted={fetchDocuments}
        />
      )}
    </div>
  );
}
