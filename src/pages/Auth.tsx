import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo-dark.png';

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

const signupSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  prenom: z.string().min(1, "Le prénom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
});

const resetSchema = z.object({
  email: z.string().email("Email invalide"),
});

const newPasswordSchema = z.object({
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  confirmPassword: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, resetPassword, user, loading: authLoading, isRecoveryMode, clearRecoveryMode } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryLinkInvalid, setRecoveryLinkInvalid] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPrenom, setSignupPrenom] = useState('');
  const [signupNom, setSignupNom] = useState('');

  // Reset password state
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Check if user came from password reset email (via URL param/hash or auth event)
  useEffect(() => {
    const isReset = searchParams.get('reset') === 'true';
    const hasRecoveryQuery = searchParams.get('type') === 'recovery' || Boolean(searchParams.get('token_hash'));
    const hasRecoveryHash = window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token=');

    if (isReset || hasRecoveryQuery || hasRecoveryHash || isRecoveryMode) {
      setShowNewPassword(true);
    }
  }, [searchParams, isRecoveryMode]);

  useEffect(() => {
    if (!showNewPassword) return;

    let isMounted = true;

    const initializeRecoverySession = async () => {
      setRecoveryLoading(true);
      setRecoveryLinkInvalid(false);

      try {
        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

        const tokenHash = queryParams.get('token_hash');
        const typeFromQuery = queryParams.get('type');
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');
        const typeFromHash = hashParams.get('type');

        if (tokenHash && typeFromQuery === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: tokenHash,
          });

          if (error) throw error;
        } else if (hashAccessToken && hashRefreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken,
          });

          if (error) throw error;
          if (typeFromHash && typeFromHash !== 'recovery') {
            throw new Error('Invalid recovery token type');
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          throw new Error('No recovery session found');
        }

        window.history.replaceState({}, document.title, '/auth?reset=true');
      } catch (error) {
        console.error('Recovery link initialization error:', error);

        if (isMounted) {
          setRecoveryLinkInvalid(true);
        }
      } finally {
        if (isMounted) {
          setRecoveryLoading(false);
        }
      }
    };

    initializeRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [showNewPassword]);

  useEffect(() => {
    // Don't redirect if we're in password reset mode
    if (showNewPassword || isRecoveryMode || searchParams.get('reset') === 'true') return;
    if (user && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate, showNewPassword, isRecoveryMode, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Erreur de validation",
        description: result.error.errors[0].message,
      });
      return;
    }

    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);

    if (error) {
      let message = "Une erreur est survenue lors de la connexion.";
      if (error.message.includes("Invalid login credentials")) {
        message = "Email ou mot de passe incorrect.";
      }
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: message,
      });
    } else {
      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur Qualiopi Generator !",
      });
      navigate('/dashboard', { replace: true });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = signupSchema.safeParse({ 
      email: signupEmail, 
      password: signupPassword,
      prenom: signupPrenom,
      nom: signupNom,
    });
    
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Erreur de validation",
        description: result.error.errors[0].message,
      });
      return;
    }

    setLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupPrenom, signupNom);
    setLoading(false);

    if (error) {
      let message = "Une erreur est survenue lors de l'inscription.";
      if (error.message.includes("User already registered")) {
        message = "Un compte existe déjà avec cet email.";
      }
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: message,
      });
    } else {
      toast({
        title: "Inscription réussie",
        description: "Votre compte a été créé. Vous pouvez maintenant vous connecter.",
      });
      setActiveTab('login');
      setLoginEmail(signupEmail);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = resetSchema.safeParse({ email: resetEmail });
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Erreur de validation",
        description: result.error.errors[0].message,
      });
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(resetEmail);
    setLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez réessayer.",
      });
    } else {
      toast({
        title: "Email envoyé",
        description: "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.",
      });
      setShowForgotPassword(false);
      setResetEmail('');
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = newPasswordSchema.safeParse({ password: newPassword, confirmPassword });
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Erreur de validation",
        description: result.error.errors[0].message,
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré.",
      });
    } else {
      toast({
        title: "Mot de passe mis à jour",
        description: "Votre mot de passe a été modifié avec succès.",
      });
      setShowNewPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      clearRecoveryMode();
      navigate('/dashboard', { replace: true });
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // New password form (after clicking reset link)
  if (showNewPassword) {
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
            <p className="text-muted-foreground">
              Nouveau mot de passe
            </p>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Définir un nouveau mot de passe</CardTitle>
              <CardDescription>
                Entrez votre nouveau mot de passe ci-dessous.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNewPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                    "Mettre à jour le mot de passe"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            START ACADEMY – 618 boulevard Jean Maurel inférieur 06140 Vence
          </p>
        </div>
      </div>
    );
  }

  // Forgot password form
  if (showForgotPassword) {
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
            <p className="text-muted-foreground">
              Réinitialisation du mot de passe
            </p>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Mot de passe oublié ?</CardTitle>
              <CardDescription>
                Entrez votre email et nous vous enverrons un lien de réinitialisation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="votre@email.fr"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    "Envoyer le lien de réinitialisation"
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => setShowForgotPassword(false)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour à la connexion
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            START ACADEMY – 618 boulevard Jean Maurel inférieur 06140 Vence
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img src={logo} alt="Start Academy" className="h-16 w-auto" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Start Academy
          </h1>
          <p className="text-muted-foreground">
            Qualiopi Generator
          </p>
        </div>

        {/* Auth Card */}
        <Card className="shadow-card">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="votre@email.fr"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Mot de passe</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 h-auto text-sm text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setResetEmail(loginEmail);
                        }}
                      >
                        Mot de passe oublié ?
                      </Button>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      "Se connecter"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-prenom">Prénom</Label>
                      <Input
                        id="signup-prenom"
                        type="text"
                        placeholder="Jean"
                        value={signupPrenom}
                        onChange={(e) => setSignupPrenom(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-nom">Nom</Label>
                      <Input
                        id="signup-nom"
                        type="text"
                        placeholder="Dupont"
                        value={signupNom}
                        onChange={(e) => setSignupNom(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="votre@email.fr"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Mot de passe</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Inscription...
                      </>
                    ) : (
                      "S'inscrire"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          START ACADEMY – 618 boulevard Jean Maurel inférieur 06140 Vence
        </p>
      </div>
    </div>
  );
}