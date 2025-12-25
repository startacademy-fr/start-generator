import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Archive, ArchiveRestore, Search, Calendar, MapPin, Clock, User, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Formation, Profile, Stagiaire } from '@/types/database';
import { AddStagiaireToFormationDialog } from '@/components/AddStagiaireToFormationDialog';

export default function Formations() {
  const { isAdmin, isAssistante } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin() || isAssistante();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFormation, setEditingFormation] = useState<Formation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [addStagiaireFormation, setAddStagiaireFormation] = useState<Formation | null>(null);

  // Form state
  const [titre, setTitre] = useState('');
  const [lieu, setLieu] = useState('');
  const [nombreHeures, setNombreHeures] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [formateurId, setFormateurId] = useState('');

  // Fetch formations
  const { data: formations, isLoading } = useQuery({
    queryKey: ['formations', showArchived],
    queryFn: async () => {
      const query = supabase
        .from('formations')
        .select('*')
        .order('date_debut', { ascending: false });
      
      if (!showArchived) {
        query.eq('archived', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Formation[];
    },
  });

  // Fetch formateurs (users with formateur role)
  const { data: formateurs } = useQuery({
    queryKey: ['formateurs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, prenom, nom, user_id');
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch inscriptions count per formation
  const { data: inscriptionsCounts } = useQuery({
    queryKey: ['inscriptions-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inscriptions')
        .select('formation_id');
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach((i) => {
        counts[i.formation_id] = (counts[i.formation_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Fetch all stagiaires
  const { data: stagiaires } = useQuery({
    queryKey: ['stagiaires-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stagiaires')
        .select('*')
        .order('nom', { ascending: true });
      if (error) throw error;
      return data as Stagiaire[];
    },
  });

  // Fetch inscriptions for the selected formation
  const { data: formationInscriptions } = useQuery({
    queryKey: ['formation-stagiaires', addStagiaireFormation?.id],
    queryFn: async () => {
      if (!addStagiaireFormation) return [];
      const { data, error } = await supabase
        .from('inscriptions')
        .select('stagiaire_id')
        .eq('formation_id', addStagiaireFormation.id);
      if (error) throw error;
      return data.map(i => i.stagiaire_id);
    },
    enabled: !!addStagiaireFormation,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (formData: {
      titre: string;
      lieu: string;
      nombre_heures: number;
      date_debut: string;
      date_fin: string | null;
      formateur_id: string | null;
    }) => {
      if (editingFormation) {
        const { error } = await supabase
          .from('formations')
          .update(formData)
          .eq('id', editingFormation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('formations')
          .insert(formData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formations'] });
      toast.success(editingFormation ? 'Formation modifiée' : 'Formation créée');
      closeDialog();
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('formations')
        .update({ archived })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { archived }) => {
      queryClient.invalidateQueries({ queryKey: ['formations'] });
      toast.success(archived ? 'Formation archivée' : 'Formation restaurée');
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  const openDialog = (formation?: Formation) => {
    if (formation) {
      setEditingFormation(formation);
      setTitre(formation.titre);
      setLieu(formation.lieu);
      setNombreHeures(formation.nombre_heures.toString());
      setDateDebut(formation.date_debut);
      setDateFin(formation.date_fin || '');
      setFormateurId(formation.formateur_id || '');
    } else {
      setEditingFormation(null);
      setTitre('');
      setLieu('');
      setNombreHeures('');
      setDateDebut('');
      setDateFin('');
      setFormateurId('');
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingFormation(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      titre,
      lieu,
      nombre_heures: parseInt(nombreHeures),
      date_debut: dateDebut,
      date_fin: dateFin || null,
      formateur_id: formateurId || null,
    });
  };

  const getFormateurName = (formateurId: string | null) => {
    if (!formateurId || !formateurs) return '—';
    const formateur = formateurs.find((f) => f.id === formateurId);
    return formateur ? `${formateur.prenom} ${formateur.nom}` : '—';
  };

  const filteredFormations = formations?.filter((f) =>
    f.titre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.lieu.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Formations</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos formations et sessions
          </p>
        </div>
        {canManage && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle formation
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingFormation ? 'Modifier la formation' : 'Nouvelle formation'}
                  </DialogTitle>
                  <DialogDescription>
                    Renseignez les informations de la formation
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="titre">Titre *</Label>
                    <Input
                      id="titre"
                      value={titre}
                      onChange={(e) => setTitre(e.target.value)}
                      placeholder="Ex: Formation Agent Immobilier"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lieu">Lieu *</Label>
                    <Input
                      id="lieu"
                      value={lieu}
                      onChange={(e) => setLieu(e.target.value)}
                      placeholder="Ex: Vence"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date_debut">Date début *</Label>
                      <Input
                        id="date_debut"
                        type="date"
                        value={dateDebut}
                        onChange={(e) => setDateDebut(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date_fin">Date fin</Label>
                      <Input
                        id="date_fin"
                        type="date"
                        value={dateFin}
                        onChange={(e) => setDateFin(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombre_heures">Nombre d'heures *</Label>
                    <Input
                      id="nombre_heures"
                      type="number"
                      min="1"
                      value={nombreHeures}
                      onChange={(e) => setNombreHeures(e.target.value)}
                      placeholder="Ex: 14"
                      required
                    />
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
                        <option key={f.id} value={f.id}>
                          {f.prenom} {f.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une formation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showArchived ? 'secondary' : 'outline'}
          onClick={() => setShowArchived(!showArchived)}
          size="sm"
        >
          <Archive className="mr-2 h-4 w-4" />
          {showArchived ? 'Masquer archivées' : 'Voir archivées'}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredFormations?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucune formation trouvée</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Formation</TableHead>
                <TableHead>Lieu</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Heures</TableHead>
                <TableHead>Formateur</TableHead>
                <TableHead>Stagiaires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFormations?.map((formation) => (
                <TableRow key={formation.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formation.titre}</span>
                      {formation.archived && (
                        <Badge variant="secondary" className="text-xs">
                          Archivée
                        </Badge>
                      )}
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
                          {' → '}
                          {format(new Date(formation.date_fin), 'dd/MM/yyyy', { locale: fr })}
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
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {getFormateurName(formation.formateur_id)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {inscriptionsCounts?.[formation.id] || 0} inscrit(s)
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setAddStagiaireFormation(formation)}
                          title="Ajouter des stagiaires"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(formation)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            archiveMutation.mutate({
                              id: formation.id,
                              archived: !formation.archived,
                            })
                          }
                        >
                          {formation.archived ? (
                            <ArchiveRestore className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
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

      {/* Add stagiaire dialog */}
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
    </div>
  );
}
