import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-md space-y-6">
        <div className="text-8xl">🗺️</div>
        <h1 className="text-5xl font-bold text-foreground">Oups !</h1>
        <p className="text-lg text-muted-foreground">
          On dirait que cette page s'est perdue en chemin… Pas de panique, ça arrive aux meilleurs !
        </p>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          <MapPin className="h-4 w-4" />
          <code className="bg-muted px-2 py-0.5 rounded text-xs">{location.pathname}</code>
        </p>
        <Button asChild size="lg" className="mt-4">
          <Link to="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            Retour à l'accueil
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
