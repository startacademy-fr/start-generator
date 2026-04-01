import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Archive, ArchiveRestore, Search, Calendar, MapPin, Clock, User, UserPlus, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Upload, Download, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Formation, FormationCatalogue, Profile, Stagiaire } from '@/types/database';
import { AddStagiaireToFormationDialog } from '@/components/AddStagiaireToFormationDialog';
import { StagiaireMultiSelect } from '@/components/StagiaireMultiSelect';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { ImportInscriptionsDialog } from '@/components/ImportInscriptionsDialog';

export default function Sessions() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const canManage = canEdit();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFormation, setEditingFormation] = useState<Formation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [filterFormateurId, setFilterFormateurId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortField, setSortField] = useState<'date' | 'titre'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [addStagiaireFormation, setAddStagiaireFormation] = useState<Formation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Formation | null>(null);
  const [isImportInscriptionsOpen, setIsImportInscriptionsOpen] = useState(false);

  // Form state
  const [catalogueId, setCatalogueId] = useState('');
  const [lieu, setLieu] = useState('');
  const [nombreHeures, setNombreHeures] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [formateurId, setFormateurId] = useState('');
  const [selectedStagiaireIds, setSelectedStagiaireIds] = useState<string[]>([]);
  const [montantTotal, setMontantTotal] = useState('');

  // Fetch formations catalogue
  const { data: catalogue } = useQuery({
    queryKey: ['formations-catalogue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formations_catalogue')
        .select('*')
        .order('titre', { ascending: true })
        .limit(10000);
      if (error) throw error;
      return data as FormationCatalogue[];
    },
  });

  // Fetch sessions (formations)
  const { data: formations, isLoading } = useQuery({
    queryKey: ['sessions', showArchived],
    queryFn: async () => {
      const query = supabase
        .from('formations')
        .select('*')
        .order('date_debut', { ascending: false })
        .limit(10000);
      if (!showArchived) query.eq('archived', false);
      const { data, error } = await query;
      if (error) throw error;
      return data as Formation[];
    },
  });

  const { data: formateurs } = useQuery({
    queryKey: ['formateurs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, prenom, nom, user_id').limit(10000);
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: inscriptionsCounts } = useQuery({
    queryKey: ['inscriptions-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inscriptions').select('formation_id').limit(10000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((i) => { counts[i.formation_id] = (counts[i.formation_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: stagiaires } = useQuery({
    queryKey: ['stagiaires-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stagiaires').select('*').order('nom', { ascending: true }).limit(10000);
      if (error) throw error;
      return data as Stagiaire[];
    },
  });

  const { data: editFormationInscriptions } = useQuery({
    queryKey: ['formation-stagiaires-edit', editingFormation?.id],
    queryFn: async () => {
      if (!editingFormation) return [];
      const { data, error } = await supabase.from('inscriptions').select('stagiaire_id').eq('formation_id', editingFormation.id);
      if (error) throw error;
      return data.map(i => i.stagiaire_id);
    },
    enabled: !!editingFormation,
  });

  const { data: formationInscriptions } = useQuery({
    queryKey: ['formation-stagiaires', addStagiaireFormation?.id],
    queryFn: async () => {
      if (!addStagiaireFormation) return [];
      const { data, error } = await supabase.from('inscriptions').select('stagiaire_id').eq('formation_id', addStagiaireFormation.id);
      if (error) throw error;
      return data.map(i => i.stagiaire_id);
    },
    enabled: !!addStagiaireFormation,
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: {
      formation_catalogue_id: string | null;
      lieu: string;
      nombre_heures: number;
      date_debut: string;
      date_fin: string | null;
      formateur_id: string | null;
      montant_total: number | null;
      stagiaireIds: string[];
    }) => {
      // Get titre from catalogue
      const selectedCatalogue = catalogue?.find(c => c.id === formData.formation_catalogue_id);
      const titre = selectedCatalogue?.titre || 'Session sans formation';
      const objectifs = selectedCatalogue?.objectifs || null;
      const programme = selectedCatalogue?.programme || null;
      const programme_pdf_url = selectedCatalogue?.programme_pdf_url || null;

      let formationId: string;

      if (editingFormation) {
        const { error } = await supabase
          .from('formations')
          .update({
            titre,
            lieu: formData.lieu,
            nombre_heures: formData.nombre_heures,
            date_debut: formData.date_debut,
            date_fin: formData.date_fin,
            formateur_id: formData.formateur_id,
            formation_catalogue_id: formData.formation_catalogue_id,
            montant_total: formData.montant_total,
            objectifs,
            programme,
            programme_pdf_url,
          })
          .eq('id', editingFormation.id);
        if (error) throw error;
        formationId = editingFormation.id;

        const currentIds = editFormationInscriptions || [];
        const toRemove = currentIds.filter(id => !formData.stagiaireIds.includes(id));
        const toAdd = formData.stagiaireIds.filter(id => !currentIds.includes(id));

        if (toRemove.length > 0) {
          const { error: delError } = await supabase.from('inscriptions').delete().eq('formation_id', formationId).in('stagiaire_id', toRemove);
          if (delError) throw delError;
        }
        if (toAdd.length > 0) {
          const inscriptions = toAdd.map(s => ({ formation_id: formationId, stagiaire_id: s }));
          const { error: addError } = await supabase.from('inscriptions').insert(inscriptions);
          if (addError) throw addError;
        }
      } else {
        const { data, error } = await supabase
          .from('formations')
          .insert({
            titre,
            lieu: formData.lieu,
            nombre_heures: formData.nombre_heures,
            date_debut: formData.date_debut,
            date_fin: formData.date_fin,
            formateur_id: formData.formateur_id,
            formation_catalogue_id: formData.formation_catalogue_id,
            montant_total: formData.montant_total,
            objectifs,
            programme,
            programme_pdf_url,
          })
          .select('id')
          .single();
        if (error) throw error;
        formationId = data.id;

        if (formData.stagiaireIds.length > 0) {
          const inscriptions = formData.stagiaireIds.map(s => ({ formation_id: formationId, stagiaire_id: s }));
          const { error: inscError } = await supabase.from('inscriptions').insert(inscriptions);
          if (inscError) throw inscError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['inscriptions-counts'] });
      queryClient.invalidateQueries({ queryKey: ['formation-stagiaires-edit'] });
      toast.success(editingFormation ? 'Session modifiée' : 'Session créée');
      closeDialog();
    },
    onError: (error) => toast.error('Erreur: ' + error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from('formations').update({ archived }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { archived }) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success(archived ? 'Session archivée' : 'Session restaurée');
    },
    onError: (error) => toast.error('Erreur: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete inscriptions first
      await supabase.from('inscriptions').delete().eq('formation_id', id);
      const { error } = await supabase.from('formations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['inscriptions-counts'] });
      toast.success('Session supprimée');
      setDeleteTarget(null);
    },
    onError: (error) => toast.error('Erreur: ' + error.message),
  });

  const openDialog = async (formation?: Formation) => {
    if (formation) {
      setEditingFormation(formation);
      setCatalogueId(formation.formation_catalogue_id || '');
      setLieu(formation.lieu);
      setNombreHeures(formation.nombre_heures.toString());
      setDateDebut(formation.date_debut);
      setDateFin(formation.date_fin || '');
      setFormateurId(formation.formateur_id || '');
      setMontantTotal(formation.montant_total?.toString() || '');
      const { data } = await supabase.from('inscriptions').select('stagiaire_id').eq('formation_id', formation.id);
      setSelectedStagiaireIds(data?.map(i => i.stagiaire_id) || []);
    } else {
      setEditingFormation(null);
      setCatalogueId('');
      setLieu('');
      setNombreHeures('');
      setDateDebut('');
      setDateFin('');
      setFormateurId('');
      setMontantTotal('');
      setSelectedStagiaireIds([]);
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingFormation(null);
    setSelectedStagiaireIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      formation_catalogue_id: catalogueId || null,
      lieu,
      nombre_heures: parseInt(nombreHeures),
      date_debut: dateDebut,
      date_fin: dateFin || null,
      formateur_id: formateurId || null,
      stagiaireIds: selectedStagiaireIds,
    });
  };

  const getFormateurName = (formateurId: string | null) => {
    if (!formateurId || !formateurs) return '—';
    const formateur = formateurs.find((f) => f.id === formateurId);
    return formateur ? `${formateur.prenom} ${formateur.nom}` : '—';
  };

  const getCatalogueTitre = (catalogueId: string | null) => {
    if (!catalogueId || !catalogue) return null;
    return catalogue.find(c => c.id === catalogueId)?.titre || null;
  };

  const toggleSort = (field: 'date' | 'titre') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ field }: { field: 'date' | 'titre' }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    return sortAsc ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  // Assign chronological numbers based on date_debut ascending
  const allSortedByDate = [...(formations || [])].sort(
    (a, b) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime()
  );
  const sessionNumberMap = new Map<string, number>();
  allSortedByDate.forEach((f, i) => sessionNumberMap.set(f.id, i + 1));

  const isIncomplete = (f: Formation) => {
    return !f.formateur_id || !f.date_fin || !f.montant_total || !(inscriptionsCounts?.[f.id]);
  };

  const incompleteCount = formations?.filter(isIncomplete).length || 0;

  const filteredFormations = formations?.filter((f) => {
    const matchesSearch = f.titre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.lieu.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFormateur = !filterFormateurId || f.formateur_id === filterFormateurId;
    const matchesDateFrom = !filterDateFrom || f.date_debut >= filterDateFrom;
    const matchesDateTo = !filterDateTo || f.date_debut <= filterDateTo;
    const matchesIncomplete = !showIncomplete || isIncomplete(f);
    return matchesSearch && matchesFormateur && matchesDateFrom && matchesDateTo && matchesIncomplete;
  })?.sort((a, b) => {
    if (sortField === 'date') {
      const cmp = new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime();
      return sortAsc ? cmp : -cmp;
    }
    const cmp = a.titre.localeCompare(b.titre, 'fr');
    return sortAsc ? cmp : -cmp;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-foreground">Sessions de formation</h1>
            {formations && (
              <Badge variant="secondary" className="text-sm font-mono">
                {formations.length}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Gérez vos sessions de formation</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => {
            if (!formations || formations.length === 0) return;
            const headers = ['N°', 'Titre', 'Formation catalogue', 'Formateur', 'Lieu', 'Heures', 'Date début', 'Date fin', 'Stagiaires', 'Archivée'];
            const csvContent = [
              headers.join(';'),
              ...formations.map(f => [
                sessionNumberMap.get(f.id) || '',
                f.titre,
                getCatalogueTitre(f.formation_catalogue_id) || '',
                getFormateurName(f.formateur_id),
                f.lieu,
                f.nombre_heures,
                f.date_debut,
                f.date_fin || '',
                inscriptionsCounts?.[f.id] || 0,
                f.archived ? 'Oui' : 'Non',
              ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
            ].join('\n');
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `sessions_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success('Export CSV téléchargé');
          }}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
        {canManage && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Button variant="outline" onClick={() => setIsImportInscriptionsOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importer inscriptions
            </Button>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle session
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingFormation ? 'Modifier la session' : 'Nouvelle session de formation'}</DialogTitle>
                  <DialogDescription>Renseignez les informations de la session</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="catalogue">Formation *</Label>
                    <select
                      id="catalogue"
                      value={catalogueId}
                      onChange={(e) => setCatalogueId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      required
                    >
                      <option value="">Sélectionner une formation</option>
                      {catalogue?.map((c) => (
                        <option key={c.id} value={c.id}>{c.titre} ({c.reference})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lieu">Lieu *</Label>
                    <Input id="lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Ex: Vence" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date_debut">Date début *</Label>
                      <Input id="date_debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date_fin">Date fin</Label>
                      <Input id="date_fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombre_heures">Nombre d'heures *</Label>
                    <Input id="nombre_heures" type="number" min="1" value={nombreHeures} onChange={(e) => setNombreHeures(e.target.value)} placeholder="Ex: 14" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formateur">Formateur</Label>
                    <select
                      id="formateur"
                      value={formateurId}
                      onChange={(e) => setFormateurId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Sélectionner un formateur</option>
                      {formateurs?.map((f) => (
                        <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Stagiaires inscrits</Label>
                    {stagiaires && (
                      <StagiaireMultiSelect
                        stagiaires={stagiaires}
                        selectedIds={selectedStagiaireIds}
                        onChange={setSelectedStagiaireIds}
                      />
                    )}
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
        )}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher une session..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <select
          value={filterFormateurId}
          onChange={(e) => setFilterFormateurId(e.target.value)}
          className="flex h-10 w-full sm:w-auto sm:min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Tous les formateurs</option>
          {formateurs?.map((f) => (
            <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[150px]" placeholder="Du" />
          <span className="text-muted-foreground text-sm">→</span>
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[150px]" placeholder="Au" />
        </div>
        <Button variant={showIncomplete ? 'destructive' : 'outline'} onClick={() => setShowIncomplete(!showIncomplete)} size="sm">
          <AlertTriangle className="mr-2 h-4 w-4" />
          {showIncomplete ? `${incompleteCount} incomplète(s)` : `Incomplètes (${incompleteCount})`}
        </Button>
        <Button variant={showArchived ? 'secondary' : 'outline'} onClick={() => setShowArchived(!showArchived)} size="sm">
          <Archive className="mr-2 h-4 w-4" />
          {showArchived ? 'Masquer archivées' : 'Voir archivées'}
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredFormations?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucune session trouvée</p>
          </div>
        ) : (
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">N°</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('titre')}>
                  <div className="flex items-center">Formation <SortIcon field="titre" /></div>
                </TableHead>
                <TableHead>Lieu</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('date')}>
                  <div className="flex items-center">Dates <SortIcon field="date" /></div>
                </TableHead>
                <TableHead>Heures</TableHead>
                <TableHead>Formateur</TableHead>
                <TableHead>Stagiaires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFormations?.map((formation) => {
                const incomplete = isIncomplete(formation);
                return (
                <TableRow key={formation.id} className={incomplete ? 'bg-destructive/5' : ''}>
                  <TableCell className="font-mono text-muted-foreground text-sm">
                    {sessionNumberMap.get(formation.id) || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {incomplete && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      <span className="font-medium">{formation.titre}</span>
                      {formation.archived && <Badge variant="secondary" className="text-xs">Archivée</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {formation.lieu}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(new Date(formation.date_debut), 'dd/MM/yyyy', { locale: fr })}
                      {formation.date_fin && (
                        <span className="text-muted-foreground">
                          {' → '}{format(new Date(formation.date_fin), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {formation.nombre_heures}h
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`flex items-center gap-1 ${!formation.formateur_id ? 'text-destructive font-medium' : ''}`}>
                      <User className={`h-3.5 w-3.5 ${!formation.formateur_id ? 'text-destructive' : 'text-muted-foreground'}`} />
                      {getFormateurName(formation.formateur_id)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={!(inscriptionsCounts?.[formation.id]) ? 'destructive' : 'outline'}>
                      {inscriptionsCounts?.[formation.id] || 0} inscrit(s)
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setAddStagiaireFormation(formation)} title="Ajouter des stagiaires">
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDialog(formation)} title="Modifier">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => archiveMutation.mutate({ id: formation.id, archived: !formation.archived })} title={formation.archived ? 'Restaurer' : 'Archiver'}>
                          {formation.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(formation)} title="Supprimer" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {addStagiaireFormation && stagiaires && (
        <AddStagiaireToFormationDialog
          open={!!addStagiaireFormation}
          onOpenChange={(open) => !open && setAddStagiaireFormation(null)}
          formationId={addStagiaireFormation.id}
          formationTitre={addStagiaireFormation.titre}
          stagiaires={stagiaires}
          existingInscriptionIds={formationInscriptions || []}
        />
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Supprimer cette session ?"
        description="Cette action supprimera la session et toutes les inscriptions associées. Cette action est irréversible."
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
      <ImportInscriptionsDialog
        open={isImportInscriptionsOpen}
        onOpenChange={setIsImportInscriptionsOpen}
      />
    </div>
  );
}
