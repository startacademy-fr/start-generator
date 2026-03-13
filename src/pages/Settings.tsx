import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Settings as SettingsIcon, User, Building2, Palette, ShieldCheck, Save, Loader2 } from 'lucide-react';
import RoleManagement from './RoleManagement';

export default function Settings() {
  const { profile, user, isSuperAdmin, isAdmin, roles } = useAuth();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-display font-bold text-foreground">Paramètres</h1>
        </div>
        <p className="text-muted-foreground mt-1">Gérez votre profil, votre organisme et les préférences de l'application</p>
      </div>

      <Tabs defaultValue="profil" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="profil" className="gap-2">
            <User className="h-4 w-4" />
            Mon profil
          </TabsTrigger>
          <TabsTrigger value="organisme" className="gap-2">
            <Building2 className="h-4 w-4" />
            Organisme
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Palette className="h-4 w-4" />
            Préférences
          </TabsTrigger>
          {isSuperAdmin() && (
            <TabsTrigger value="roles" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Rôles
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profil">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="organisme">
          <OrganismeTab />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab />
        </TabsContent>

        {isSuperAdmin() && (
          <TabsContent value="roles">
            <RoleManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [prenom, setPrenom] = useState(profile?.prenom || '');
  const [nom, setNom] = useState(profile?.nom || '');
  const [telephone, setTelephone] = useState((profile as any)?.telephone || '');

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const { error } = await supabase
        .from('profiles')
        .update({ prenom, nom, telephone })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profil mis à jour');
    },
    onError: (e) => toast.error(e.message),
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error('Les mots de passe ne correspondent pas');
      if (newPassword.length < 6) throw new Error('Le mot de passe doit faire au moins 6 caractères');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Mot de passe mis à jour');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
          <CardDescription>Modifiez vos informations de profil</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email || ''} disabled className="bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <Input id="prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input id="telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="06 XX XX XX XX" />
          </div>
          <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="w-full">
            {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Changer le mot de passe</CardTitle>
          <CardDescription>Mettez à jour votre mot de passe de connexion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
            <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button onClick={() => changePassword.mutate()} disabled={changePassword.isPending} variant="outline" className="w-full">
            {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Changer le mot de passe
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OrganismeTab() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const canEdit = isSuperAdmin() || isAdmin();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['organisme-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisme_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});

  // Sync form with loaded data
  const getVal = (key: string) => form[key] ?? (settings as any)?.[key] ?? '';

  const updateSettings = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      const { error } = await supabase
        .from('organisme_settings')
        .update(form)
        .eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisme-settings'] });
      toast.success('Paramètres de l\'organisme mis à jour');
      setForm({});
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const fields = [
    { key: 'nom_organisme', label: 'Nom de l\'organisme', placeholder: 'Start Academy' },
    { key: 'siret', label: 'SIRET', placeholder: '123 456 789 00012' },
    { key: 'nda', label: 'N° de déclaration d\'activité (NDA)', placeholder: '11 75 XXXXX 75' },
    { key: 'adresse', label: 'Adresse', placeholder: '123 rue de la Formation, 75001 Paris' },
    { key: 'telephone', label: 'Téléphone', placeholder: '01 XX XX XX XX' },
    { key: 'email', label: 'Email de contact', placeholder: 'contact@start-academy.fr' },
    { key: 'site_web', label: 'Site web', placeholder: 'https://www.start-academy.fr' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Organisme de formation
        </CardTitle>
        <CardDescription>
          Ces informations seront utilisées dans les documents générés (conventions, attestations, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                value={getVal(key)}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                disabled={!canEdit}
                className={!canEdit ? 'bg-muted' : ''}
              />
            </div>
          ))}
        </div>
        {canEdit && (
          <Button onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending || Object.keys(form).length === 0}>
            {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Enregistrer les modifications
          </Button>
        )}
        {!canEdit && (
          <p className="text-sm text-muted-foreground">Seuls les administrateurs peuvent modifier ces paramètres.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PreferencesTab() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light';
  });

  const toggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    toast.success(`Thème ${newTheme === 'dark' ? 'sombre' : 'clair'} activé`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Préférences d'affichage
        </CardTitle>
        <CardDescription>Personnalisez l'apparence de l'application</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Thème</Label>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <button
              onClick={() => toggleTheme('light')}
              className={`flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-colors ${
                theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="h-16 w-full rounded-md bg-background border shadow-sm flex items-end p-2">
                <div className="flex gap-1">
                  <div className="h-2 w-6 rounded-full bg-primary" />
                  <div className="h-2 w-4 rounded-full bg-muted" />
                </div>
              </div>
              <span className="text-sm font-medium">Clair</span>
            </button>
            <button
              onClick={() => toggleTheme('dark')}
              className={`flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-colors ${
                theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="h-16 w-full rounded-md bg-[hsl(220,25%,10%)] border border-[hsl(220,20%,20%)] shadow-sm flex items-end p-2">
                <div className="flex gap-1">
                  <div className="h-2 w-6 rounded-full bg-[hsl(199,89%,48%)]" />
                  <div className="h-2 w-4 rounded-full bg-[hsl(220,20%,18%)]" />
                </div>
              </div>
              <span className="text-sm font-medium">Sombre</span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
