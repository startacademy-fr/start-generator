import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { KeyRound, Loader2, Search, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AppRole } from '@/types/database';

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrateur',
  assistante: 'Assistante',
  formateur: 'Formateur',
  lecteur: 'Lecteur',
};

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-destructive/10 text-destructive border-destructive/20',
  admin: 'bg-primary/10 text-primary border-primary/20',
  assistante: 'bg-accent text-accent-foreground',
  formateur: 'bg-secondary text-secondary-foreground',
  lecteur: 'bg-muted text-muted-foreground',
};

export default function RoleManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<{ user_id: string; prenom: string; nom: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Fetch all profiles with their roles
  const { data: usersWithRoles, isLoading } = useQuery({
    queryKey: ['role-management-users'],
    queryFn: async () => {
      const [{ data: profiles, error: pError }, { data: roles, error: rError }] = await Promise.all([
        supabase.from('profiles').select('*').order('nom'),
        supabase.from('user_roles').select('*'),
      ]);
      if (pError) throw pError;
      if (rError) throw rError;

      return (profiles || []).map((p) => ({
        ...p,
        roles: (roles || []).filter((r) => r.user_id === p.user_id).map((r) => r.role as AppRole),
      }));
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole, currentRoles }: { userId: string; newRole: AppRole; currentRoles: AppRole[] }) => {
      // Don't allow changing own role
      if (userId === user?.id) throw new Error('Vous ne pouvez pas modifier votre propre rôle');

      // Remove all current non-formateur roles, then add new one
      // Keep formateur role if it exists and new role isn't formateur
      const rolesToRemove = currentRoles.filter(r => r !== 'formateur' || newRole === 'formateur');

      for (const role of rolesToRemove) {
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
      }

      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-management-users'] });
      toast.success('Rôle mis à jour avec succès');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!targetUser) throw new Error('Utilisateur invalide');
      if (newPassword !== confirmPassword) throw new Error('Les mots de passe ne correspondent pas');
      if (newPassword.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères');

      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          user_id: targetUser.user_id,
          new_password: newPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success('Mot de passe réinitialisé avec succès');
      setIsResetDialogOpen(false);
      setTargetUser(null);
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la réinitialisation');
    },
  });

  const filtered = usersWithRoles?.filter((u) =>
    `${u.nom} ${u.prenom} ${u.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPrimaryRole = (roles: AppRole[]): AppRole => {
    const priority: AppRole[] = ['super_admin', 'admin', 'assistante', 'formateur', 'lecteur'];
    return priority.find(r => roles.includes(r)) || 'lecteur';
  };

  const openResetDialog = (u: { user_id: string; prenom: string; nom: string; email: string }) => {
    setTargetUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setIsResetDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-display font-bold text-foreground">Gestion des rôles</h1>
          {usersWithRoles && (
            <Badge variant="secondary" className="text-sm font-mono">{usersWithRoles.length}</Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1">
          Attribuez et modifiez les rôles des utilisateurs
        </p>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3 p-4 rounded-lg border bg-card">
        {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([role, label]) => (
          <div key={role} className="flex items-center gap-2 text-sm">
            <Badge className={ROLE_COLORS[role]}>{label}</Badge>
            <span className="text-muted-foreground text-xs">
              {role === 'super_admin' && '— Accès total + gestion des rôles'}
              {role === 'admin' && '— Tout sauf documents et rôles'}
              {role === 'assistante' && '— Gestion + documents, pas de formateurs/rôles'}
              {role === 'formateur' && '— Ses formations uniquement'}
              {role === 'lecteur' && '— Consultation seule'}
            </span>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un utilisateur..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle actuel</TableHead>
                <TableHead>Modifier le rôle</TableHead>
                <TableHead>Mot de passe</TableHead>
                <TableHead>Inscrit le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((u) => {
                const primaryRole = getPrimaryRole(u.roles);
                const isSelf = u.user_id === user?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {u.prenom} {u.nom}
                        {isSelf && <Badge variant="outline" className="text-[10px]">Vous</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((role) => (
                          <Badge key={role} className={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
                        ))}
                        {u.roles.length === 0 && <span className="text-muted-foreground text-sm">Aucun rôle</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={primaryRole}
                        onValueChange={(val) => changeRoleMutation.mutate({
                          userId: u.user_id,
                          newRole: val as AppRole,
                          currentRoles: u.roles,
                        })}
                        disabled={isSelf || changeRoleMutation.isPending}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([role, label]) => (
                            <SelectItem key={role} value={role}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openResetDialog(u)}
                        disabled={isSelf}
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        Nouveau mot de passe
                      </Button>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(u.created_at), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
