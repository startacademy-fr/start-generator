import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo-dark.png';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [initializing, setInitializing] = useState(true);
  const [validRecoveryLink, setValidRecoveryLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const initRecoverySession = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

        const tokenHash = searchParams.get('token_hash');
        const typeFromQuery = searchParams.get('type');
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');
        const typeFromHash = hashParams.get('type');

        // New flow: token_hash + type=recovery in query params
        if (tokenHash && typeFromQuery === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: tokenHash,
          });

          if (error) throw error;
          setValidRecoveryLink(true);
          setInitializing(false);
          return;
        }

        // Standard implicit flow: access/refresh tokens in hash params
        if (hashAccessToken && hashRefreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken,
          });

          if (error) throw error;

          if (typeFromHash === 'recovery') {
            setValidRecoveryLink(true);
            window.history.replaceState({}, document.title, '/reset-password');
            setInitializing(false);
            return;
          }
        }

        // Fallback: if session already exists, allow password update screen
        const { data: { session } } = await supabase.auth.getSession();
        setValidRecoveryLink(Boolean(session?.user));
      } catch (error) {
        console.error('Recovery link initialization error:', error);
        setValidRecoveryLink(false);
      } finally {
        setInitializing(false);
      }
    };

    initRecoverySession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Mot de passe invalide',
        description: 'Le mot de passe doit contenir au moins 6 caractères.',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Erreur de validation',
        description: 'Les mots de passe ne correspondent pas.',
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré.",
      });
      return;
    }

    toast({
      title: 'Mot de passe mis à jour',
      description: 'Votre mot de passe a été modifié avec succès.',
    });

    navigate('/dashboard', { replace: true });
  };

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!validRecoveryLink) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <img src={logo} alt="Start Academy" className="h-16 w-auto" />
            </div>
            <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Start Academy
            </h1>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Lien invalide ou expiré</CardTitle>
              <CardDescription>
                Demandez un nouveau lien de réinitialisation depuis la page de connexion.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/auth', { replace: true })}>
                Retour à la connexion
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img src={logo} alt="Start Academy" className="h-16 w-auto" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Start Academy
          </h1>
          <p className="text-muted-foreground">Nouveau mot de passe</p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Définir un nouveau mot de passe</CardTitle>
            <CardDescription>Entrez votre nouveau mot de passe ci-dessous.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mise à jour...
                  </>
                ) : (
                  'Mettre à jour le mot de passe'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
