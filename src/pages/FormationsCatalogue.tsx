import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Copy, Trash2, Search, FileText, X, Eye, Upload, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { ImportFormationsDialog } from '@/components/ImportFormationsDialog';

interface FormationCatalogue {
  id: string;
  reference: string;
  titre: string;
  nombre_heures: number | null;
  objectifs: string | null;
  programme: string | null;
  programme_pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function FormationsCatalogue() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const canManage = canEdit();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FormationCatalogue | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FormationCatalogue | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [sortField, setSortField] = useState<'titre' | 'sessions' | 'reference'>('titre');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterIncomplete, setFilterIncomplete] = useState(false);

  // Form state
  const [titre, setTitre] = useState('');
  const [nombreHeures, setNombreHeures] = useState('');
  const [objectifs, setObjectifs] = useState('');
  const [programme, setProgramme] = useState('');
  const [programmePdfFile, setProgrammePdfFile] = useState<File | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);

  const { data: formations, isLoading } = useQuery({
    queryKey: ['formations-catalogue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formations_catalogue')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FormationCatalogue[];
    },
  });

  // Count sessions per catalogue entry
  const { data: sessionCounts } = useQuery({
    queryKey: ['session-counts-catalogue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formations')
        .select('formation_catalogue_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((f: any) => {
        if (f.formation_catalogue_id) {
          counts[f.formation_catalogue_id] = (counts[f.formation_catalogue_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  const generateReference = () => {
    const year = new Date().getFullYear();
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `FORM-${year}-${rand}`;
  };

  const uploadPdf = async (file: File, id: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const filePath = `catalogue/${id}/programme.${fileExt}`;
    const { error } = await supabase.storage
      .from('formation-programmes')
      .upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from('formation-programmes')
      .getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let id: string;
      if (editing) {
        const { error } = await supabase
          .from('formations_catalogue')
          .update({ titre, nombre_heures: nombreHeures ? parseInt(nombreHeures) : null, programme: programme || null })
          .eq('id', editing.id);
        if (error) throw error;
        id = editing.id;
      } else {
        const { data, error } = await supabase
          .from('formations_catalogue')
          .insert({ titre, nombre_heures: nombreHeures ? parseInt(nombreHeures) : null, programme: programme || null, reference: generateReference() })
          .select('id')
          .single();
        if (error) throw error;
        id = data.id;
      }

      if (programmePdfFile) {
        const pdfUrl = await uploadPdf(programmePdfFile, id);
        await supabase.from('formations_catalogue').update({ programme_pdf_url: pdfUrl }).eq('id', id);
      } else if (existingPdfUrl === null && editing?.programme_pdf_url) {
        await supabase.from('formations_catalogue').update({ programme_pdf_url: null }).eq('id', id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formations-catalogue'] });
      toast.success(editing ? 'Formation modifiée' : 'Formation créée');
      closeDialog();
    },
    onError: (error) => toast.error('Erreur: ' + error.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (source: FormationCatalogue) => {
      const { error } = await supabase
        .from('formations_catalogue')
        .insert({
          titre: source.titre + ' (copie)',
          nombre_heures: source.nombre_heures,
          programme: source.programme,
          programme_pdf_url: source.programme_pdf_url,
          reference: generateReference(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formations-catalogue'] });
      toast.success('Formation dupliquée');
    },
    onError: (error) => toast.error('Erreur: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('formations_catalogue').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formations-catalogue'] });
      toast.success('Formation supprimée');
      setDeleteTarget(null);
    },
    onError: (error) => toast.error('Erreur: ' + error.message),
  });

  const openDialog = (formation?: FormationCatalogue) => {
    if (formation) {
      setEditing(formation);
      setTitre(formation.titre);
      setNombreHeures(formation.nombre_heures?.toString() || '');
      setProgramme(formation.programme || '');
      setExistingPdfUrl(formation.programme_pdf_url || null);
    } else {
      setEditing(null);
      setTitre('');
      setNombreHeures('');
      setProgramme('');
      setExistingPdfUrl(null);
    }
    setProgrammePdfFile(null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditing(null);
  };

  const toggleSort = (field: 'titre' | 'sessions' | 'reference') => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: 'titre' | 'sessions' | 'reference' }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    return sortAsc ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const isIncomplete = (f: FormationCatalogue) => !f.programme || !f.programme_pdf_url;

  const filtered = formations?.filter((f) =>
    f.titre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.reference.toLowerCase().includes(searchQuery.toLowerCase())
  )?.filter((f) => !filterIncomplete || isIncomplete(f))
  ?.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'titre') {
      cmp = a.titre.localeCompare(b.titre, 'fr');
    } else if (sortField === 'reference') {
      cmp = a.reference.localeCompare(b.reference, 'fr');
    } else if (sortField === 'sessions') {
      cmp = (sessionCounts?.[a.id] || 0) - (sessionCounts?.[b.id] || 0);
    }
    return sortAsc ? cmp : -cmp;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-foreground">Formations</h1>
            {formations && (
              <Badge variant="secondary" className="text-sm font-mono">
                {formations.length}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Catalogue des formations disponibles</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importer
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle formation
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}>
                <DialogHeader>
                  <DialogTitle>{editing ? 'Modifier la formation' : 'Nouvelle formation'}</DialogTitle>
                  <DialogDescription>Renseignez les informations de la formation</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="titre">Titre *</Label>
                    <Input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex: Formation Agent Immobilier" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombre_heures">Durée en heures</Label>
                    <Input id="nombre_heures" type="number" min="1" value={nombreHeures} onChange={(e) => setNombreHeures(e.target.value)} placeholder="Ex: 14" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="programme">Programme de formation (optionnel)</Label>
                    <Textarea id="programme" value={programme} onChange={(e) => setProgramme(e.target.value)} rows={4} placeholder="Collez ici le programme détaillé..." />
                    <p className="text-xs text-muted-foreground">Le programme est utilisé par l'IA pour générer des compétences pertinentes.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Programme PDF (optionnel)</Label>
                    {existingPdfUrl && !programmePdfFile ? (
                      <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm flex-1 truncate">Programme PDF existant</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(existingPdfUrl, '_blank')}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExistingPdfUrl(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : programmePdfFile ? (
                      <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm flex-1 truncate">{programmePdfFile.name}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setProgrammePdfFile(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Input type="file" accept=".pdf" className="cursor-pointer" onChange={(e) => { const f = e.target.files?.[0]; if (f) setProgrammePdfFile(f); }} />
                    )}
                    <p className="text-xs text-muted-foreground">Uploadez le programme en PDF pour une génération de documents plus précise.</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog}>Annuler</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher une formation..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={filterIncomplete}
            onCheckedChange={(checked) => setFilterIncomplete(!!checked)}
          />
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-muted-foreground">Fiches incomplètes uniquement</span>
        </label>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filtered?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucune formation trouvée</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('reference')}>
                  <div className="flex items-center">Référence <SortIcon field="reference" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('titre')}>
                  <div className="flex items-center">Formation <SortIcon field="titre" /></div>
                </TableHead>
                <TableHead>Programme</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('sessions')}>
                  <div className="flex items-center">Sessions <SortIcon field="sessions" /></div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">{f.reference}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {f.titre}
                      {isIncomplete(f) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {!f.programme && !f.programme_pdf_url
                                  ? 'Objectifs pédagogiques et programme PDF manquants'
                                  : !f.programme
                                  ? 'Objectifs pédagogiques (texte) manquants'
                                  : 'Programme PDF manquant'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">L'IA utilise ces informations pour générer des documents pertinents</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {f.programme && <Badge variant="secondary" className="text-xs">Texte</Badge>}
                      {f.programme_pdf_url && (
                        <Badge variant="outline" className="text-xs gap-1 cursor-pointer" onClick={() => window.open(f.programme_pdf_url!, '_blank')}>
                          <FileText className="h-3 w-3" /> PDF
                        </Badge>
                      )}
                      {!f.programme && !f.programme_pdf_url && <span className="text-muted-foreground text-sm">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{sessionCounts?.[f.id] || 0} session(s)</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDialog(f)} title="Modifier">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => duplicateMutation.mutate(f)} title="Dupliquer">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(f)} title="Supprimer" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Supprimer cette formation ?"
        description="Cette action est irréversible. Les sessions associées ne seront pas supprimées mais ne seront plus liées à cette formation."
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />

      <ImportFormationsDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        existingReferences={formations?.map(f => f.reference) || []}
      />
    </div>
  );
}
