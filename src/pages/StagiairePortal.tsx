import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  GraduationCap,
  Calendar,
  MapPin,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TokenData {
  inscription_id: string;
  stagiaire: {
    prenom: string;
    nom: string;
    email: string;
  };
  formation: {
    titre: string;
    lieu: string;
    date_debut: string;
    date_fin: string | null;
    nombre_heures: number;
  };
}

const DOCUMENT_TYPES = [
  { id: 'questionnaire_positionnement', label: 'Questionnaire de positionnement', icon: '📋', phase: 'avant' },
  { id: 'analyse_besoin', label: 'Analyse du besoin', icon: '🎯', phase: 'avant' },
  { id: 'qcm', label: 'QCM d\'évaluation', icon: '✅', phase: 'pendant' },
  { id: 'satisfaction_chaud', label: 'Satisfaction à chaud', icon: '🔥', phase: 'pendant' },
  { id: 'satisfaction_froid', label: 'Satisfaction à froid', icon: '❄️', phase: 'apres' },
];

export default function StagiairePortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  // Validate token via edge function
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenError('Aucun token fourni');
        setIsValidating(false);
        return;
      }

      // Basic format validation
      if (token.length > 500) {
        setTokenError('Lien invalide');
        setIsValidating(false);
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ action: 'validate', token }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.valid) {
          throw new Error(data.error || 'Token invalide');
        }

        setTokenData({
          inscription_id: data.inscription.id,
          stagiaire: data.inscription.stagiaire as any,
          formation: data.inscription.formation as any,
        });
      } catch (error) {
        setTokenError('Lien invalide ou expiré');
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Fetch documents for this inscription
  const { data: documents } = useQuery({
    queryKey: ['stagiaire-documents', tokenData?.inscription_id],
    enabled: !!tokenData?.inscription_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents_stagiaires')
        .select('*')
        .eq('inscription_id', tokenData!.inscription_id);
      if (error) throw error;
      return data;
    },
  });

  // Calculate progress
  const completedDocs = documents?.filter(d => d.statut === 'complete' || d.statut === 'genere_auto').length || 0;
  const totalDocs = DOCUMENT_TYPES.length;
  const progressPercent = (completedDocs / totalDocs) * 100;

  const getDocStatus = (docType: string) => {
    const doc = documents?.find(d => d.type === docType);
    if (!doc) return 'pending';
    if (doc.statut === 'complete' || doc.statut === 'genere_auto') return 'completed';
    if (doc.statut === 'en_cours') return 'in_progress';
    return 'pending';
  };

  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  // Loading state
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

  // Error state
  if (tokenError || !tokenData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-destructive/5 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle className="text-destructive">Accès refusé</CardTitle>
            <CardDescription>
              {tokenError || 'Impossible de valider votre accès'}
            </CardDescription>
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Header */}
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
              <span className="text-sm font-medium text-primary">{completedDocs}/{totalDocs}</span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {progressPercent === 100 
                ? '✨ Tous les documents sont complétés !'
                : `${totalDocs - completedDocs} document(s) restant(s)`}
            </p>
          </CardContent>
        </Card>

        {/* Documents by phase */}
        <div className="space-y-4">
          {/* Avant la formation */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avant la formation
            </h3>
            <div className="space-y-2">
              {DOCUMENT_TYPES.filter(d => d.phase === 'avant').map(docType => {
                const status = getDocStatus(docType.id);
                return (
                  <DocumentCard 
                    key={docType.id} 
                    docType={docType} 
                    status={status}
                    inscriptionId={tokenData.inscription_id}
                  />
                );
              })}
            </div>
          </div>

          {/* Pendant la formation */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Pendant la formation
            </h3>
            <div className="space-y-2">
              {DOCUMENT_TYPES.filter(d => d.phase === 'pendant').map(docType => {
                const status = getDocStatus(docType.id);
                return (
                  <DocumentCard 
                    key={docType.id} 
                    docType={docType} 
                    status={status}
                    inscriptionId={tokenData.inscription_id}
                  />
                );
              })}
            </div>
          </div>

          {/* Après la formation */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Après la formation
            </h3>
            <div className="space-y-2">
              {DOCUMENT_TYPES.filter(d => d.phase === 'apres').map(docType => {
                const status = getDocStatus(docType.id);
                return (
                  <DocumentCard 
                    key={docType.id} 
                    docType={docType} 
                    status={status}
                    inscriptionId={tokenData.inscription_id}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
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
    </div>
  );
}

function DocumentCard({ 
  docType, 
  status,
  inscriptionId
}: { 
  docType: { id: string; label: string; icon: string }; 
  status: 'pending' | 'in_progress' | 'completed';
  inscriptionId: string;
}) {
  const handleComplete = () => {
    window.location.href = `/stagiaire/document?inscription=${inscriptionId}&type=${docType.id}`;
  };

  return (
    <Card className={`transition-all ${status === 'completed' ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900' : ''}`}>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{docType.icon}</span>
          <div>
            <p className="font-medium text-sm">{docType.label}</p>
            <p className="text-xs text-muted-foreground">
              {status === 'completed' ? 'Complété' : status === 'in_progress' ? 'En cours' : 'À compléter'}
            </p>
          </div>
        </div>
        <div>
          {status === 'completed' ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : status === 'in_progress' ? (
            <Clock className="h-5 w-5 text-amber-500" />
          ) : (
            <Button size="sm" variant="outline" onClick={handleComplete}>
              Compléter
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
