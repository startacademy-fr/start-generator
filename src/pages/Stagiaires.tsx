import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Search, Users, Mail, Phone, Building2, Accessibility, Trash2 } from 'lucide-react';
import type { Stagiaire } from '@/types/database';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';

export default function Stagiaires() {
  const { isAdmin, isAssistante } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin() || isAssistante();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStagiaire, setEditingStagiaire] = useState<Stagiaire | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form state
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [entreprise, setEntreprise] = useState('');
  const [siret, setSiret] = useState('');
  const [fonction, setFonction] = useState('');
  const [adresse, setAdresse] = useState('');
  const [situationHandicap, setSituationHandicap] = useState(false);
  const [besoinsSpecifiques, setBesoinsSpecifiques] = useState('');
  const [anciennete, setAnciennete] = useState('');
  const [diplomes, setDiplomes] = useState('');
  const [tachesQuotidiennes, setTachesQuotidiennes] = useState('');

  // Fetch stagiaires
  const { data: stagiaires, isLoading } = useQuery({
    queryKey: ['stagiaires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stagiaires')
        .select('*')
        .order('nom', { ascending: true });
      if (error) throw error;
      return data as Stagiaire[];
    },
  });

  // Fetch inscriptions count per stagiaire
  const { data: inscriptionsCounts } = useQuery({
    queryKey: ['stagiaire-inscriptions-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inscriptions')
        .select('stagiaire_id');
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach((i) => {
        counts[i.stagiaire_id] = (counts[i.stagiaire_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (formData: {
      prenom: string;
      nom: string;
      email: string;
      telephone: string | null;
      entreprise: string | null;
      siret: string | null;
      fonction: string | null;
      adresse: string | null;
      situation_handicap: boolean;
      besoins_specifiques: string | null;
      anciennete: string | null;
      diplomes: string | null;
      taches_quotidiennes: string | null;
    }) => {
      if (editingStagiaire) {
        const { error } = await supabase
          .from('stagiaires')
          .update(formData)
          .eq('id', editingStagiaire.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stagiaires')
          .insert(formData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stagiaires'] });
      toast.success(editingStagiaire ? 'Stagiaire modifié' : 'Stagiaire créé');
      closeDialog();
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('stagiaires')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stagiaires'] });
      queryClient.invalidateQueries({ queryKey: ['stagiaire-inscriptions-counts'] });
      toast.success(`${selectedIds.length} stagiaire(s) supprimé(s)`);
      setSelectedIds([]);
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  const openDialog = (stagiaire?: Stagiaire) => {
    if (stagiaire) {
      setEditingStagiaire(stagiaire);
      setPrenom(stagiaire.prenom);
      setNom(stagiaire.nom);
      setEmail(stagiaire.email);
      setTelephone(stagiaire.telephone || '');
      setEntreprise(stagiaire.entreprise || '');
      setSiret(stagiaire.siret || '');
      setFonction(stagiaire.fonction || '');
      setAdresse(stagiaire.adresse || '');
      setSituationHandicap(stagiaire.situation_handicap || false);
      setBesoinsSpecifiques(stagiaire.besoins_specifiques || '');
      setAnciennete(stagiaire.anciennete || '');
      setDiplomes(stagiaire.diplomes || '');
      setTachesQuotidiennes(stagiaire.taches_quotidiennes || '');
    } else {
      setEditingStagiaire(null);
      setPrenom('');
      setNom('');
      setEmail('');
      setTelephone('');
      setEntreprise('');
      setSiret('');
      setFonction('');
      setAdresse('');
      setSituationHandicap(false);
      setBesoinsSpecifiques('');
      setAnciennete('');
      setDiplomes('');
      setTachesQuotidiennes('');
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingStagiaire(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      prenom,
      nom,
      email,
      telephone: telephone || null,
      entreprise: entreprise || null,
      siret: siret || null,
      fonction: fonction || null,
      adresse: adresse || null,
      situation_handicap: situationHandicap,
      besoins_specifiques: besoinsSpecifiques || null,
      anciennete: anciennete || null,
      diplomes: diplomes || null,
      taches_quotidiennes: tachesQuotidiennes || null,
    });
  };

  const filteredStagiaires = stagiaires?.filter((s) =>
    s.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.entreprise && s.entreprise.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStagiaires?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStagiaires?.map(s => s.id) || []);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Stagiaires</h1>
          <p className="text-muted-foreground mt-1">
            Gérez les stagiaires inscrits aux formations
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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau stagiaire
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>
                      {editingStagiaire ? 'Modifier le stagiaire' : 'Nouveau stagiaire'}
                    </DialogTitle>
                    <DialogDescription>
                      Renseignez les informations du stagiaire
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prenom">Prénom *</Label>
                        <Input
                          id="prenom"
                          value={prenom}
                          onChange={(e) => setPrenom(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nom">Nom *</Label>
                        <Input
                          id="nom"
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="entreprise">Entreprise</Label>
                        <Input
                          id="entreprise"
                          value={entreprise}
                          onChange={(e) => setEntreprise(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="siret">SIRET</Label>
                        <Input
                          id="siret"
                          value={siret}
                          onChange={(e) => setSiret(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fonction">Fonction</Label>
                        <Input
                          id="fonction"
                          value={fonction}
                          onChange={(e) => setFonction(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="anciennete">Ancienneté</Label>
                        <Input
                          id="anciennete"
                          value={anciennete}
                          onChange={(e) => setAnciennete(e.target.value)}
                          placeholder="Ex: 3 ans"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diplomes">Diplômes / Certifications</Label>
                      <Input
                        id="diplomes"
                        value={diplomes}
                        onChange={(e) => setDiplomes(e.target.value)}
                        placeholder="Ex: BTS Commerce, Licence Pro..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taches_quotidiennes">Tâches quotidiennes</Label>
                      <Textarea
                        id="taches_quotidiennes"
                        value={tachesQuotidiennes}
                        onChange={(e) => setTachesQuotidiennes(e.target.value)}
                        rows={2}
                        placeholder="Ex: Prospection, relation client, gestion de dossiers..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adresse">Adresse</Label>
                      <Textarea
                        id="adresse"
                        value={adresse}
                        onChange={(e) => setAdresse(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="situation_handicap"
                        checked={situationHandicap}
                        onCheckedChange={(checked) => setSituationHandicap(checked as boolean)}
                      />
                      <Label htmlFor="situation_handicap" className="text-sm font-normal">
                        Situation de handicap
                      </Label>
                    </div>
                    {situationHandicap && (
                      <div className="space-y-2">
                        <Label htmlFor="besoins_specifiques">Besoins spécifiques</Label>
                        <Textarea
                          id="besoins_specifiques"
                          value={besoinsSpecifiques}
                          onChange={(e) => setBesoinsSpecifiques(e.target.value)}
                          rows={2}
                          placeholder="Décrivez les aménagements nécessaires..."
                        />
                      </div>
                    )}
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
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un stagiaire..."
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
        ) : filteredStagiaires?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucun stagiaire trouvé</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === filteredStagiaires?.length && filteredStagiaires?.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>Stagiaire</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Entreprise</TableHead>
                <TableHead>Formations</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStagiaires?.map((stagiaire) => (
                <TableRow key={stagiaire.id} className={selectedIds.includes(stagiaire.id) ? 'bg-muted/50' : ''}>
                  {canManage && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(stagiaire.id)}
                        onCheckedChange={() => toggleSelect(stagiaire.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="font-medium">
                      {stagiaire.prenom} {stagiaire.nom}
                    </div>
                    {stagiaire.fonction && (
                      <div className="text-sm text-muted-foreground">
                        {stagiaire.fonction}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {stagiaire.email}
                      </div>
                      {stagiaire.telephone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {stagiaire.telephone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {stagiaire.entreprise ? (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {stagiaire.entreprise}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {inscriptionsCounts?.[stagiaire.id] || 0} formation(s)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {stagiaire.situation_handicap && (
                      <Badge variant="secondary" className="gap-1">
                        <Accessibility className="h-3 w-3" />
                        PSH
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(stagiaire)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedIds([stagiaire.id]);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Supprimer les stagiaires"
        description="Cette action est irréversible. Les stagiaires sélectionnés et leurs inscriptions associées seront définitivement supprimés."
        itemCount={selectedIds.length}
        onConfirm={() => deleteMutation.mutate(selectedIds)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
