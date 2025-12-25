import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useEffect } from 'react';

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

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPrenom, setSignupPrenom] = useState('');
  const [signupNom, setSignupNom] = useState('');

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

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

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-lg">
              <GraduationCap className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-semibold text-foreground">
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
                    <Label htmlFor="login-password">Mot de passe</Label>
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
