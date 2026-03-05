import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Pencil, Search, Users, Mail, Building2, Accessibility, Trash2, AlertTriangle, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Stagiaire, Civilite } from '@/types/database';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImportStagiairesDialog } from '@/components/ImportStagiairesDialog';

export default function Stagiaires() {
  const { isAdmin, isAssistante } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin() || isAssistante();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStagiaire, setEditingStagiaire] = useState<Stagiaire | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [sortField, setSortField] = useState<'nom' | 'entreprise' | 'formations'>('nom');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [filterNoFormation, setFilterNoFormation] = useState(false);

  // Form state
  const [civilite, setCivilite] = useState<Civilite | ''>('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [entreprise, setEntreprise] = useState('');
  const [siret, setSiret] = useState('');
  const [fonction, setFonction] = useState('');
  const [fonctionAutre, setFonctionAutre] = useState('');
  const FONCTIONS_LIST = ['Agent immobilier', 'Courtier en assurances', 'Courtier en crédits', 'Commercial', 'Assistante commerciale', 'Assistante de direction', 'Comptable', 'Artisan'];
  const [adresse, setAdresse] = useState('');
  const [situationHandicap, setSituationHandicap] = useState(false);
  const [besoinsSpecifiques, setBesoinsSpecifiques] = useState('');
  const [anciennete, setAnciennete] = useState('');
  const [diplomePlusEleve, setDiplomePlusEleve] = useState('');
  const [tachesQuotidiennes, setTachesQuotidiennes] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [nomJeuneFille, setNomJeuneFille] = useState('');
  const [estSalarie, setEstSalarie] = useState(false);
  const [chefEntreprise, setChefEntreprise] = useState(false);

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
      civilite: Civilite | null;
      prenom: string;
      nom: string;
      email: string;
      entreprise: string | null;
      siret: string | null;
      fonction: string | null;
      adresse: string | null;
      situation_handicap: boolean;
      besoins_specifiques: string | null;
      anciennete: string | null;
      diplome_plus_eleve: string | null;
      taches_quotidiennes: string | null;
      date_naissance: string | null;
      nom_jeune_fille: string | null;
      est_salarie: boolean;
      chef_entreprise: boolean;
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
      setCivilite(stagiaire.civilite || '');
      setPrenom(stagiaire.prenom);
      setNom(stagiaire.nom);
      setEmail(stagiaire.email);
      setEntreprise(stagiaire.entreprise || '');
      setSiret(stagiaire.siret || '');
      const existingFonction = stagiaire.fonction || '';
      if (existingFonction && !FONCTIONS_LIST.includes(existingFonction)) {
        setFonction('Autre');
        setFonctionAutre(existingFonction);
      } else {
        setFonction(existingFonction);
        setFonctionAutre('');
      }
      setAdresse(stagiaire.adresse || '');
      setSituationHandicap(stagiaire.situation_handicap || false);
      setBesoinsSpecifiques(stagiaire.besoins_specifiques || '');
      setAnciennete(stagiaire.anciennete || '');
      setDiplomePlusEleve(stagiaire.diplome_plus_eleve || '');
      setTachesQuotidiennes(stagiaire.taches_quotidiennes || '');
      setDateNaissance(stagiaire.date_naissance || '');
      setNomJeuneFille(stagiaire.nom_jeune_fille || '');
      setEstSalarie(stagiaire.est_salarie || false);
      setChefEntreprise((stagiaire as any).chef_entreprise || false);
    } else {
      setEditingStagiaire(null);
      setCivilite('');
      setPrenom('');
      setNom('');
      setEmail('');
      setEntreprise('');
      setSiret('');
      setFonction('');
      setFonctionAutre('');
      setAdresse('');
      setSituationHandicap(false);
      setBesoinsSpecifiques('');
      setAnciennete('');
      setDiplomePlusEleve('');
      setTachesQuotidiennes('');
      setDateNaissance('');
      setNomJeuneFille('');
      setEstSalarie(false);
      setChefEntreprise(false);
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
      civilite: civilite || null,
      prenom,
      nom,
      email,
      entreprise: entreprise || null,
      siret: siret || null,
      fonction: fonction === 'Autre' ? (fonctionAutre || null) : (fonction || null),
      adresse: adresse || null,
      situation_handicap: situationHandicap,
      besoins_specifiques: besoinsSpecifiques || null,
      anciennete: anciennete || null,
      diplome_plus_eleve: diplomePlusEleve || null,
      taches_quotidiennes: tachesQuotidiennes || null,
      date_naissance: dateNaissance || null,
      nom_jeune_fille: civilite === 'Mme' ? (nomJeuneFille || null) : null,
      est_salarie: estSalarie,
      chef_entreprise: chefEntreprise,
    });
  };

  const toggleSort = (field: 'nom' | 'entreprise' | 'formations') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ field }: { field: 'nom' | 'entreprise' | 'formations' }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    return sortAsc ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  // Alphabetical numbering based on nom+prenom
  const allSortedAlpha = [...(stagiaires || [])].sort((a, b) =>
    `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr')
  );
  const stagiaireNumberMap = new Map<string, number>();
  allSortedAlpha.forEach((s, i) => stagiaireNumberMap.set(s.id, i + 1));

  // Check if a stagiaire has incomplete required profile fields
  const isProfileIncomplete = (stagiaire: Stagiaire): boolean => {
    return (!stagiaire.date_naissance && !stagiaire.est_salarie && !stagiaire.chef_entreprise) || 
           !stagiaire.anciennete || 
           !stagiaire.diplome_plus_eleve;
  };

  const filteredStagiaires = stagiaires?.filter((s) => {
    if (filterIncomplete && !isProfileIncomplete(s)) return false;
    if (filterNoFormation && (inscriptionsCounts?.[s.id] || 0) > 0) return false;
    return s.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.entreprise && s.entreprise.toLowerCase().includes(searchQuery.toLowerCase()));
  })?.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'nom') {
      cmp = `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr');
    } else if (sortField === 'entreprise') {
      cmp = (a.entreprise || '').localeCompare(b.entreprise || '', 'fr');
    } else if (sortField === 'formations') {
      cmp = (inscriptionsCounts?.[a.id] || 0) - (inscriptionsCounts?.[b.id] || 0);
    }
    return sortAsc ? cmp : -cmp;
  });

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

  // Get list of missing fields for tooltip
  const getMissingFields = (stagiaire: Stagiaire): string[] => {
    const missing: string[] = [];
    if (!stagiaire.date_naissance && !stagiaire.est_salarie && !stagiaire.chef_entreprise) missing.push('Date de naissance');
    if (!stagiaire.anciennete) missing.push('Ancienneté');
    if (!stagiaire.diplome_plus_eleve) missing.push('Diplôme le plus élevé');
    return missing;
  };

  const exportToCSV = () => {
    if (!stagiaires || stagiaires.length === 0) {
      toast.error('Aucun stagiaire à exporter');
      return;
    }

    const headers = [
      'Civilité',
      'Prénom',
      'Nom',
      'Nom de jeune fille',
      'Date de naissance',
      'Email',
      'Entreprise',
      'SIRET',
      'Fonction',
      'Ancienneté',
      'Diplôme le plus élevé',
      'Tâches quotidiennes',
      'Adresse',
      'Situation handicap',
      'Besoins spécifiques'
    ];

    const csvContent = [
      headers.join(';'),
      ...stagiaires.map(s => [
        s.civilite || '',
        s.prenom,
        s.nom,
        s.nom_jeune_fille || '',
        s.date_naissance || '',
        s.email,
        s.entreprise || '',
        s.siret || '',
        s.fonction || '',
        s.anciennete || '',
        s.diplome_plus_eleve || '',
        (s.taches_quotidiennes || '').replace(/[\n\r]+/g, ' '),
        (s.adresse || '').replace(/[\n\r]+/g, ' '),
        s.situation_handicap ? 'Oui' : 'Non',
        (s.besoins_specifiques || '').replace(/[\n\r]+/g, ' ')
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stagiaires_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-foreground">Stagiaires</h1>
            {stagiaires && (
              <Badge variant="secondary" className="text-sm font-mono">
                {stagiaires.length}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Gérez les stagiaires inscrits aux formations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          {canManage && (
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importer
            </Button>
          )}
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
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="civilite">Civilité</Label>
                        <Select value={civilite} onValueChange={(v) => setCivilite(v as Civilite)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Civilité" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M.">M.</SelectItem>
                            <SelectItem value="Mme">Mme</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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
                    <div className="flex items-center gap-6 py-1">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="est_salarie"
                          checked={estSalarie}
                          onCheckedChange={(checked) => setEstSalarie(checked as boolean)}
                        />
                        <Label htmlFor="est_salarie" className="text-sm font-normal">
                          Salarié(e)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="chef_entreprise"
                          checked={chefEntreprise}
                          onCheckedChange={(checked) => setChefEntreprise(checked as boolean)}
                        />
                        <Label htmlFor="chef_entreprise" className="text-sm font-normal">
                          Chef d'entreprise
                        </Label>
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
                    </div>
                    {civilite === 'Mme' && (
                      <div className="space-y-2">
                        <Label htmlFor="nom_jeune_fille">Nom de jeune fille</Label>
                        <Input
                          id="nom_jeune_fille"
                          value={nomJeuneFille}
                          onChange={(e) => setNomJeuneFille(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="date_naissance">Date de naissance {!estSalarie && !chefEntreprise ? '*' : ''}</Label>
                        <Input
                          id="date_naissance"
                          type="date"
                          value={dateNaissance}
                          onChange={(e) => setDateNaissance(e.target.value)}
                          required={!estSalarie && !chefEntreprise}
                        />
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
                        <Select value={fonction} onValueChange={(val) => { setFonction(val); if (val !== 'Autre') setFonctionAutre(''); }}>
                          <SelectTrigger id="fonction">
                            <SelectValue placeholder="Sélectionner une fonction" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Agent immobilier">Agent immobilier</SelectItem>
                            <SelectItem value="Courtier en assurances">Courtier en assurances</SelectItem>
                            <SelectItem value="Courtier en crédits">Courtier en crédits</SelectItem>
                            <SelectItem value="Commercial">Commercial</SelectItem>
                            <SelectItem value="Assistante commerciale">Assistante commerciale</SelectItem>
                            <SelectItem value="Assistante de direction">Assistante de direction</SelectItem>
                            <SelectItem value="Comptable">Comptable</SelectItem>
                            <SelectItem value="Artisan">Artisan</SelectItem>
                            <SelectItem value="Autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                        {fonction === 'Autre' && (
                          <Input
                            placeholder="Précisez la fonction"
                            value={fonctionAutre}
                            onChange={(e) => setFonctionAutre(e.target.value)}
                            className="mt-2"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="anciennete">Ancienneté *</Label>
                        <Input
                          id="anciennete"
                          value={anciennete}
                          onChange={(e) => setAnciennete(e.target.value)}
                          placeholder="Ex: 3 ans"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diplome_plus_eleve">Diplôme le plus élevé *</Label>
                      <Input
                        id="diplome_plus_eleve"
                        value={diplomePlusEleve}
                        onChange={(e) => setDiplomePlusEleve(e.target.value)}
                        placeholder="Ex: BTS Commerce, Licence Pro, Master..."
                        required
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un stagiaire..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={filterIncomplete}
            onCheckedChange={(checked) => setFilterIncomplete(!!checked)}
          />
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-muted-foreground">Fiches incomplètes uniquement</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={filterNoFormation}
            onCheckedChange={(checked) => setFilterNoFormation(!!checked)}
          />
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sans formation</span>
        </label>
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
                <TableHead className="w-[60px]">N°</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('nom')}>
                  <div className="flex items-center">Stagiaire <SortIcon field="nom" /></div>
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('entreprise')}>
                  <div className="flex items-center">Entreprise <SortIcon field="entreprise" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('formations')}>
                  <div className="flex items-center">Formations <SortIcon field="formations" /></div>
                </TableHead>
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
                  <TableCell className="font-mono text-muted-foreground text-sm">
                    {stagiaireNumberMap.get(stagiaire.id) || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium">
                          {stagiaire.prenom} {stagiaire.nom}
                        </div>
                        {stagiaire.fonction && (
                          <div className="text-sm text-muted-foreground">
                            {stagiaire.fonction}
                          </div>
                        )}
                      </div>
                      {isProfileIncomplete(stagiaire) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="font-semibold text-amber-600 mb-1">Profil incomplet</p>
                              <p className="text-xs">Champs manquants :</p>
                              <ul className="text-xs list-disc list-inside">
                                {getMissingFields(stagiaire).map((field) => (
                                  <li key={field}>{field}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {stagiaire.email}
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
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {inscriptionsCounts?.[stagiaire.id] || 0} formation(s)
                      </Badge>
                      {stagiaire.situation_handicap && (
                        <Badge variant="secondary" className="gap-1">
                          <Accessibility className="h-3 w-3" />
                          PSH
                        </Badge>
                      )}
                    </div>
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

      <ImportStagiairesDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        existingStagiaires={stagiaires?.map(s => ({ id: s.id, email: s.email, prenom: s.prenom, nom: s.nom })) || []}
      />
    </div>
  );
}
