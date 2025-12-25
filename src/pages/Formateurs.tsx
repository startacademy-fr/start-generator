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
import { Plus, Pencil, Trash2, Search, Users, Mail, Calendar, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Profile } from '@/types/database';

export default function Formateurs() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFormateur, setEditingFormateur] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null);

  // Form state
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');

  // Fetch formateurs (all profiles that are used as formateurs in formations)
  const { data: formateurs, isLoading } = useQuery({
    queryKey: ['formateurs-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('nom', { ascending: true });
      if (error) throw error;
      return data as (Profile & { telephone?: string })[];
    },
  });

  // Fetch formations count per formateur
  const { data: formationsCounts } = useQuery({
    queryKey: ['formateurs-formations-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formations')
        .select('formateur_id')
        .not('formateur_id', 'is', null);
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach((f) => {
        if (f.formateur_id) {
          counts[f.formateur_id] = (counts[f.formateur_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  // Create formateur mutation (creates auth user + profile + role)
  const createMutation = useMutation({
    mutationFn: async (formData: { prenom: string; nom: string; email: string }) => {
      // Note: In a real scenario, we'd use an edge function to create users
      // For now, we'll create a profile and role entry
      // The actual user creation would require admin privileges

      // Check if profile with this email exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('email', formData.email)
        .maybeSingle();

      if (existingProfile) {
        // Add formateur role to existing user
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: existingProfile.user_id,
            role: 'formateur',
          });
        
        if (roleError && !roleError.message.includes('duplicate')) {
          throw roleError;
        }
        return { isExisting: true };
      }

      throw new Error('L\'utilisateur doit d\'abord créer un compte. Demandez-lui de s\'inscrire, puis ajoutez-lui le rôle formateur.');
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['formateurs-list'] });
      if (result.isExisting) {
        toast.success('Rôle formateur ajouté à l\'utilisateur existant');
      } else {
        toast.success('Formateur créé');
      }
      closeDialog();
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  // Update formateur mutation
  const updateMutation = useMutation({
    mutationFn: async (formData: { id: string; prenom: string; nom: string; email: string; telephone?: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          prenom: formData.prenom,
          nom: formData.nom,
          email: formData.email,
          telephone: formData.telephone || null,
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
    } else {
      setEditingFormateur(null);
      setPrenom('');
      setNom('');
      setEmail('');
      setTelephone('');
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
      });
    } else {
      createMutation.mutate({ prenom, nom, email });
    }
  };

  const filteredFormateurs = formateurs?.filter((f) =>
    f.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Formateurs</h1>
          <p className="text-muted-foreground mt-1">
            Gérez les formateurs de votre équipe
          </p>
        </div>
        {canManage && (
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
                      : 'Entrez l\'email d\'un utilisateur existant pour lui attribuer le rôle formateur'
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {editingFormateur && (
                    <>
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
                    </>
                  )}
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
                  {editingFormateur && (
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
                  )}
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
                <TableHead>Formateur</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Formations</TableHead>
                <TableHead>Ajouté le</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFormateurs?.map((formateur) => (
                <TableRow key={formateur.id}>
                  <TableCell>
                    <div className="font-medium">
                      {formateur.prenom} {formateur.nom}
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
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {formationsCounts?.[formateur.id] || 0} formation(s)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(formateur.created_at), 'dd/MM/yyyy', { locale: fr })}
                    </div>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
    </div>
  );
}
