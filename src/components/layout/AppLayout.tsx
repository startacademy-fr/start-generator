import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppLayout() {
  const { user, loading, roles, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check if user has at least one internal role
  if (roles.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <h1 className="text-2xl font-display font-semibold text-foreground">Accès non autorisé</h1>
          <p className="text-muted-foreground">
            Votre compte n'a pas les permissions nécessaires pour accéder à cette application.
          </p>
          <p className="text-sm text-muted-foreground">
            Contactez un administrateur pour obtenir les droits d'accès.
          </p>
          <Button 
            variant="outline" 
            onClick={() => signOut()}
            className="mt-4"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64 transition-all duration-300">
        <div className="container py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
