import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, AlertTriangle, FileText, Users, ClipboardCheck, FileArchive, Loader2, Sparkles, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { getPDFBlob } from '@/lib/pdf-generator';
import JSZip from 'jszip';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

const REQUIRED_DOC_TYPES = [
  { id: 'questionnaire_positionnement', short: 'Posit.', label: 'Positionnement' },
  { id: 'analyse_besoin', short: 'Analyse', label: 'Analyse besoin' },
  { id: 'qcm', short: 'QCM', label: 'QCM' },
  { id: 'satisfaction_chaud', short: 'Sat. ☀️', label: 'Satisfaction chaud' },
  { id: 'satisfaction_froid', short: 'Sat. ❄️', label: 'Satisfaction froid' },
  { id: 'deroule_pedagogique', short: 'Déroulé', label: 'Déroulé péda.' },
  { id: 'grille_observation', short: 'Grille', label: 'Grille observation' },
];

export default function AuditDashboard() {
  const navigate = useNavigate();
  const [selectedFormationId, setSelectedFormationId] = useState<string>('all');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  const { data: formations } = useQuery({
    queryKey: ['audit-formations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formations')
        .select('id, titre, date_debut, date_fin, nombre_heures, lieu')
        .eq('archived', false)
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Build session number map (same logic as Sessions page)
  const sessionNumberMap = new Map<string, number>();
  if (formations) {
    const sorted = [...formations].sort((a, b) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime());
    sorted.forEach((f, i) => sessionNumberMap.set(f.id, i + 1));
  }

  const { data: inscriptions } = useQuery({
    queryKey: ['audit-inscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inscriptions')
        .select('id, formation_id, stagiaire_id, stagiaires(id, prenom, nom, email, entreprise)');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: documents } = useQuery({
    queryKey: ['audit-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents_stagiaires')
        .select('id, inscription_id, type, statut, contenu, score, date_soumission, pdf_url');
      if (error) throw error;
      return data;
    },
    refetchOnMount: 'always',
  });

  // Build audit matrix
  const getFormationAudit = (formationId: string) => {
    const formationInscriptions = inscriptions?.filter(i => i.formation_id === formationId) || [];
    
    return formationInscriptions.map(insc => {
      const stagiaire = insc.stagiaires;
      const stagDocs = documents?.filter(d => d.inscription_id === insc.id) || [];
      
      const docStatus: Record<string, { status: 'complete' | 'missing'; doc?: any }> = {};
      REQUIRED_DOC_TYPES.forEach(dt => {
        const found = stagDocs.find(d => d.type === dt.id);
        docStatus[dt.id] = found ? { status: 'complete', doc: found } : { status: 'missing' };
      });

      const completedCount = Object.values(docStatus).filter(v => v.status === 'complete').length;
      
      return {
        inscriptionId: insc.id,
        stagiaire,
        docStatus,
        completedCount,
        totalRequired: REQUIRED_DOC_TYPES.length,
        isComplete: completedCount === REQUIRED_DOC_TYPES.length,
      };
    });
  };

  const filteredFormations = (() => {
    let list = selectedFormationId === 'all' 
      ? formations 
      : formations?.filter(f => f.id === selectedFormationId);
    if (onlyIncomplete) {
      list = list?.filter(f => {
        const auditRows = getFormationAudit(f.id);
        return auditRows.length > 0 && auditRows.some(r => !r.isComplete);
      });
    }
    return list;
  })();

  // Global stats
  const allAudits = formations?.flatMap(f => getFormationAudit(f.id)) || [];
  const totalStagiaires = allAudits.length;
  const completeDossiers = allAudits.filter(a => a.isComplete).length;
  const totalDocs = allAudits.reduce((sum, a) => sum + a.completedCount, 0);
  const totalExpected = allAudits.reduce((sum, a) => sum + a.totalRequired, 0);
  const globalProgress = totalExpected > 0 ? Math.round((totalDocs / totalExpected) * 100) : 0;

  const handleDownloadDoc = async (doc: any, stagiaire: any, formation: any) => {
    try {
      if (doc.pdf_url) {
        window.open(doc.pdf_url, '_blank');
        return;
      }
      const blob = await getPDFBlob({
        type: doc.type,
        stagiaire: {
          prenom: stagiaire.prenom,
          nom: stagiaire.nom,
          email: stagiaire.email || '',
          entreprise: stagiaire.entreprise || undefined,
          fonction: stagiaire.fonction || undefined,
        },
        formation: {
          titre: formation.titre,
          lieu: formation.lieu,
          date_debut: formation.date_debut,
          date_fin: formation.date_fin,
          nombre_heures: formation.nombre_heures,
        },
        contenu: doc.contenu,
        score: doc.score,
        date_soumission: doc.date_soumission,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.type}_${stagiaire.nom}_${stagiaire.prenom}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Erreur téléchargement: ' + err.message);
    }
  };

  const handleDownloadStagiaireZip = async (row: any, formation: any) => {
    try {
      const zip = new JSZip();
      const completeDocs = Object.entries(row.docStatus)
        .filter(([, v]: [string, any]) => v.status === 'complete')
        .map(([, v]: [string, any]) => v.doc);

      for (const doc of completeDocs) {
        const blob = await getPDFBlob({
          type: doc.type,
          stagiaire: {
            prenom: row.stagiaire.prenom,
            nom: row.stagiaire.nom,
            email: row.stagiaire.email || '',
            entreprise: row.stagiaire.entreprise || undefined,
            fonction: row.stagiaire.fonction || undefined,
          },
          formation: {
            titre: formation.titre,
            lieu: formation.lieu,
            date_debut: formation.date_debut,
            date_fin: formation.date_fin,
            nombre_heures: formation.nombre_heures,
          },
          contenu: doc.contenu,
          score: doc.score,
          date_soumission: doc.date_soumission,
        });
        zip.file(`${doc.type}.pdf`, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${row.stagiaire.nom}_${row.stagiaire.prenom}_documents.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('ZIP téléchargé');
    } catch (err: any) {
      toast.error('Erreur export: ' + err.message);
    }
  };

  const handleExportZip = async (formationId?: string) => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const targetFormations = formationId 
        ? formations?.filter(f => f.id === formationId) 
        : formations;

      if (!targetFormations?.length) {
        toast.error('Aucune formation à exporter');
        return;
      }

      // Fetch full documents with inscriptions
      const { data: allDocs } = await supabase
        .from('documents_stagiaires')
        .select('*, inscriptions(stagiaire_id, formation_id, stagiaires(prenom, nom, email, entreprise, fonction))');

      for (const formation of targetFormations) {
        const formationInscriptions = inscriptions?.filter(i => i.formation_id === formation.id) || [];
        const formationFolder = zip.folder(
          `${formation.titre.replace(/[/\\?%*:|"<>]/g, '-')} (${format(new Date(formation.date_debut), 'dd-MM-yyyy')})`
        );
        if (!formationFolder) continue;

        for (const insc of formationInscriptions) {
          const stagiaire = insc.stagiaires;
          if (!stagiaire) continue;

          const stagFolder = formationFolder.folder(`${stagiaire.nom} ${stagiaire.prenom}`);
          if (!stagFolder) continue;

          const stagDocs = allDocs?.filter((d: any) => d.inscription_id === insc.id) || [];

          for (const doc of stagDocs) {
            try {
              const blob = await getPDFBlob({
                type: doc.type,
                stagiaire: {
                  prenom: stagiaire.prenom,
                  nom: stagiaire.nom,
                  email: stagiaire.email || '',
                  entreprise: stagiaire.entreprise || undefined,
                  fonction: stagiaire.fonction || undefined,
                },
                formation: {
                  titre: formation.titre,
                  lieu: formation.lieu,
                  date_debut: formation.date_debut,
                  date_fin: formation.date_fin,
                  nombre_heures: formation.nombre_heures,
                },
                contenu: doc.contenu as any,
                score: doc.score,
                date_soumission: doc.date_soumission,
              });
              stagFolder.file(`${doc.type}.pdf`, blob);
            } catch (err) {
              console.error(`Error generating PDF for ${doc.type}:`, err);
            }
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = formationId 
        ? `qualiopi_${targetFormations[0].titre.replace(/[/\\?%*:|"<>]/g, '-')}.zip`
        : 'qualiopi_export_complet.zip';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export ZIP téléchargé');
    } catch (err: any) {
      toast.error('Erreur export: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Suivi Audit Qualiopi</h1>
          <p className="text-muted-foreground mt-1">
            Vue synthétique de la complétude des dossiers par formation et stagiaire
          </p>
        </div>
        <Button onClick={() => handleExportZip(selectedFormationId !== 'all' ? selectedFormationId : undefined)} disabled={isExporting}>
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileArchive className="mr-2 h-4 w-4" />}
          {isExporting ? 'Export en cours...' : 'Export ZIP Qualiopi'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" /> Stagiaires inscrits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalStagiaires}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <ClipboardCheck className="h-4 w-4" /> Dossiers complets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{completeDossiers}/{totalStagiaires}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <FileText className="h-4 w-4" /> Documents générés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalDocs}/{totalExpected}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Progression globale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{globalProgress}%</p>
            <Progress value={globalProgress} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="max-w-md flex-1">
          <Select value={selectedFormationId} onValueChange={setSelectedFormationId}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes les formations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les formations</SelectItem>
              {formations?.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.titre} ({format(new Date(f.date_debut), 'dd/MM/yyyy', { locale: fr })})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox 
            id="only-incomplete" 
            checked={onlyIncomplete} 
            onCheckedChange={(checked) => setOnlyIncomplete(checked === true)} 
          />
          <Label htmlFor="only-incomplete" className="text-sm cursor-pointer">
            Docs incomplets uniquement
          </Label>
        </div>
      </div>

      {/* Formation audit tables */}
      {filteredFormations?.map(formation => {
        const auditRows = getFormationAudit(formation.id);
        if (auditRows.length === 0) return null;
        
        const formComplete = auditRows.filter(r => r.isComplete).length;
        const formProgress = Math.round((auditRows.reduce((s, r) => s + r.completedCount, 0) / (auditRows.length * REQUIRED_DOC_TYPES.length)) * 100);

        return (
          <Card key={formation.id} className={formComplete === auditRows.length ? 'border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20' : ''}>
            {formComplete === auditRows.length && (
              <div className="flex items-center gap-2 px-6 pt-4 pb-0 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Dossier complet — Tous les documents sont générés pour cette formation</span>
              </div>
            )}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base">
                    <span className="font-mono text-muted-foreground mr-2">
                      N°{sessionNumberMap.get(formation.id) || '—'}
                    </span>
                    {formation.titre}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(formation.date_debut), 'dd/MM/yyyy', { locale: fr })} • {formation.lieu} • {formation.nombre_heures}h
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {formComplete < auditRows.length && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/documents?autoGenerate=${formation.id}`)}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Générer docs manquants
                    </Button>
                  )}
                  <Badge variant={formComplete === auditRows.length ? 'default' : 'secondary'}>
                    {formComplete}/{auditRows.length} complets
                  </Badge>
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <Progress value={formProgress} className="h-2" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formProgress}%</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Stagiaire</TableHead>
                      {REQUIRED_DOC_TYPES.map(dt => (
                        <TableHead key={dt.id} className="text-center text-xs px-1 min-w-[60px]" title={dt.label}>
                          {dt.short}
                        </TableHead>
                      ))}
                      <TableHead className="text-center text-xs">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditRows.map(row => (
                      <TableRow key={row.inscriptionId}>
                        <TableCell>
                          <div className="text-sm font-medium">{row.stagiaire?.prenom} {row.stagiaire?.nom}</div>
                          {row.stagiaire?.entreprise && (
                            <div className="text-xs text-muted-foreground">{row.stagiaire.entreprise}</div>
                          )}
                        </TableCell>
                        {REQUIRED_DOC_TYPES.map(dt => (
                          <TableCell key={dt.id} className="text-center px-1">
                            {row.docStatus[dt.id].status === 'complete' ? (
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleDownloadDoc(row.docStatus[dt.id].doc, row.stagiaire, formation)}
                                      className="inline-flex hover:scale-110 transition-transform cursor-pointer"
                                    >
                                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    Télécharger {dt.label}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive/40 mx-auto" />
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Badge 
                              variant={row.isComplete ? 'default' : row.completedCount > 0 ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {row.completedCount}/{row.totalRequired}
                            </Badge>
                            {row.completedCount > 0 && (
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleDownloadStagiaireZip(row, formation)}
                                      className="inline-flex hover:scale-110 transition-transform cursor-pointer text-muted-foreground hover:text-foreground"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    Télécharger ZIP du stagiaire
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {(!filteredFormations || filteredFormations.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
          <p>Aucune formation trouvée</p>
        </div>
      )}
    </div>
  );
}
