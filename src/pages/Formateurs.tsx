import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Users, Mail, Phone, Upload, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Profile } from '@/types/database';
import { ImportFormateursDialog } from '@/components/ImportFormateursDialog';

export default function Formateurs() {
  const { canManageAll } = useAuth();
  const queryClient = useQueryClient();
  const canManage = canManageAll();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFormateur, setEditingFormateur] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [sortField, setSortField] = useState<'nom' | 'formations' | 'heures'>('nom');
  const [sortAsc, setSortAsc] = useState(true);
  const currentYear = new Date().getFullYear();
  const [filterDateFrom, setFilterDateFrom] = useState(`${currentYear}-01-01`);
  const [filterDateTo, setFilterDateTo] = useState(`${currentYear}-12-31`);

  // Form state
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [nda, setNda] = useState('');
  const [typeFormateur, setTypeFormateur] = useState<'interne' | 'externe'>('interne');

  // Fetch formateurs (all profiles that are used as formateurs in formations)
  const { data: formateurs, isLoading } = useQuery({
    queryKey: ['formateurs-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('nom', { ascending: true })
        .limit(10000);
      if (error) throw error;
      return data as (Profile & { telephone?: string })[];
    },
  });

  // Fetch formations count and hours per formateur for selected period
  const { data: formateurStats } = useQuery({
    queryKey: ['formateurs-stats', filterDateFrom, filterDateTo],
    queryFn: async () => {
      let query = supabase
        .from('formations')
        .select('formateur_id, nombre_heures, titre, date_debut')
        .not('formateur_id', 'is', null)
        .limit(10000);
      if (filterDateFrom) query = query.gte('date_debut', filterDateFrom);
      if (filterDateTo) query = query.lte('date_debut', filterDateTo);
      const { data, error } = await query;
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      const hours: Record<string, number> = {};
      data.forEach((f) => {
        if (f.formateur_id) {
          counts[f.formateur_id] = (counts[f.formateur_id] || 0) + 1;
          hours[f.formateur_id] = (hours[f.formateur_id] || 0) + f.nombre_heures;
        }
      });
      return { counts, hours };
    },
  });

  const formationsCounts = formateurStats?.counts;
  const heuresCounts = formateurStats?.hours;

  // Fetch admin roles for formateurs
  const { data: adminUserIds } = useQuery({
    queryKey: ['formateurs-admin-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      if (error) throw error;
      return data.map((r) => r.user_id);
    },
  });

  // Toggle admin role mutation
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isCurrentlyAdmin }: { userId: string; isCurrentlyAdmin: boolean }) => {
      if (isCurrentlyAdmin) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formateurs-admin-roles'] });
      toast.success('Rôle admin mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });


  const createMutation = useMutation({
    mutationFn: async (formData: { prenom: string; nom: string; email: string; telephone?: string }) => {
      const { data, error } = await supabase.functions.invoke('invite-formateur', {
        body: formData,
      });

      if (error) throw new Error(error.message || 'Erreur lors de la création');
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; isExisting: boolean };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['formateurs-list'] });
      if (result.isExisting) {
        toast.success('Rôle formateur ajouté à l\'utilisateur existant');
      } else {
        toast.success('Formateur créé et invitation envoyée par email');
      }
      closeDialog();
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  // Update formateur mutation
  const updateMutation = useMutation({
    mutationFn: async (formData: { id: string; prenom: string; nom: string; email: string; telephone?: string; nda?: string; type_formateur?: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          prenom: formData.prenom,
          nom: formData.nom,
          email: formData.email,
          telephone: formData.telephone || null,
          nda: formData.nda || null,
          type_formateur: formData.type_formateur || 'interne',
        } as any)
        .eq('id', formData.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formateurs-list'] });
      toast.success('Formateur modifié');
      closeDialog();
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  // Delete formateur role mutation
  const deleteMutation = useMutation({
    mutationFn: async (formateur: Profile) => {
      // Remove formateur role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', formateur.user_id)
        .eq('role', 'formateur');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formateurs-list'] });
      toast.success('Rôle formateur supprimé');
      setDeleteConfirm(null);
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  const openDialog = (formateur?: Profile & { telephone?: string }) => {
    if (formateur) {
      setEditingFormateur(formateur);
      setPrenom(formateur.prenom);
      setNom(formateur.nom);
      setEmail(formateur.email);
      setTelephone((formateur as any).telephone || '');
      setNda((formateur as any).nda || '');
      setTypeFormateur((formateur as any).type_formateur || 'interne');
    } else {
      setEditingFormateur(null);
      setPrenom('');
      setNom('');
      setEmail('');
      setTelephone('');
      setNda('');
      setTypeFormateur('interne');
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingFormateur(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFormateur) {
      updateMutation.mutate({
        id: editingFormateur.id,
        prenom,
        nom,
        email,
        telephone,
        nda,
        type_formateur: typeFormateur,
      });
    } else {
      createMutation.mutate({ prenom, nom, email });
    }
  };

  const toggleSort = (field: 'nom' | 'formations' | 'heures') => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: 'nom' | 'formations' | 'heures' }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    return sortAsc ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const filteredFormateurs = formateurs?.filter((f) =>
    f.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.email.toLowerCase().includes(searchQuery.toLowerCase())
  )?.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'nom') {
      cmp = `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr');
    } else if (sortField === 'formations') {
      cmp = (formationsCounts?.[a.id] || 0) - (formationsCounts?.[b.id] || 0);
    } else if (sortField === 'heures') {
      cmp = (heuresCounts?.[a.id] || 0) - (heuresCounts?.[b.id] || 0);
    }
    return sortAsc ? cmp : -cmp;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-foreground">Formateurs</h1>
            {formateurs && (
              <Badge variant="secondary" className="text-sm font-mono">
                {formateurs.length}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Gérez les formateurs de votre équipe
          </p>
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
                  Ajouter un formateur
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingFormateur ? 'Modifier le formateur' : 'Ajouter un formateur'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingFormateur 
                      ? 'Modifiez les informations du formateur'
                      : 'Le formateur recevra un email d\'invitation pour créer son mot de passe'
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="prenom">Prénom</Label>
                    <Input
                      id="prenom"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom</Label>
                    <Input
                      id="nom"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemple.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telephone">Téléphone</Label>
                    <Input
                      id="telephone"
                      type="tel"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      placeholder="06 00 00 00 00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nda">NDA (N° de déclaration d'activité)</Label>
                    <Input
                      id="nda"
                      value={nda}
                      onChange={(e) => setNda(e.target.value)}
                      placeholder="Ex: 93060XXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type_formateur">Type de formateur</Label>
                    <Select value={typeFormateur} onValueChange={(v) => setTypeFormateur(v as 'interne' | 'externe')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interne">Interne</SelectItem>
                        <SelectItem value="externe">Externe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un formateur..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredFormateurs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucun formateur trouvé</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('nom')}>
                  <div className="flex items-center">Formateur <SortIcon field="nom" /></div>
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('formations')}>
                  <div className="flex items-center">Formations <SortIcon field="formations" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('heures')}>
                  <div className="flex items-center">Heures {currentYear} <SortIcon field="heures" /></div>
                </TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFormateurs?.map((formateur) => (
                <TableRow key={formateur.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formateur.prenom} {formateur.nom}</span>
                      <Badge variant={(formateur as any).type_formateur === 'externe' ? 'secondary' : 'default'} className="text-[10px] px-1.5 py-0">
                        {(formateur as any).type_formateur === 'externe' ? 'Externe' : 'Interne'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {formateur.email}
                      </div>
                      {(formateur as any).telephone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {(formateur as any).telephone}
                        </div>
                      )}
                      {(formateur as any).nda && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <span className="text-xs font-medium">NDA:</span>
                          {(formateur as any).nda}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {formationsCounts?.[formateur.id] || 0} formation(s)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {heuresCounts?.[formateur.id] || 0}h
                    </div>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {(() => {
                          const isFormateurAdmin = adminUserIds?.includes(formateur.user_id);
                          return (
                            <Button
                              variant={isFormateurAdmin ? "default" : "outline"}
                              size="icon"
                              title={isFormateurAdmin ? 'Retirer le rôle admin' : 'Promouvoir admin'}
                              onClick={() => toggleAdminMutation.mutate({ userId: formateur.user_id, isCurrentlyAdmin: !!isFormateurAdmin })}
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </Button>
                          );
                        })()}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(formateur)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(formateur)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le rôle formateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm && (
                <>
                  Voulez-vous vraiment retirer le rôle formateur à{' '}
                  <strong>{deleteConfirm.prenom} {deleteConfirm.nom}</strong> ?
                  <br />
                  Le compte utilisateur ne sera pas supprimé.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportFormateursDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        existingProfiles={formateurs?.map(f => ({ id: f.id, email: f.email, prenom: f.prenom, nom: f.nom })) || []}
      />
    </div>
  );
}
