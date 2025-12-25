import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  GraduationCap, 
  Users, 
  FileCheck, 
  AlertCircle,
  ArrowRight,
  Calendar,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DashboardStats {
  totalFormations: number;
  totalStagiaires: number;
  dossiersComplets: number;
  dossiersIncomplets: number;
}

interface RecentFormation {
  id: string;
  titre: string;
  date_debut: string;
  date_fin: string | null;
  nombre_heures: number;
  inscriptions_count: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalFormations: 0,
    totalStagiaires: 0,
    dossiersComplets: 0,
    dossiersIncomplets: 0,
  });
  const [recentFormations, setRecentFormations] = useState<RecentFormation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch formations count
        const { count: formationsCount } = await supabase
          .from('formations')
          .select('*', { count: 'exact', head: true })
          .eq('archived', false);

        // Fetch stagiaires count
        const { count: stagiairesCount } = await supabase
          .from('stagiaires')
          .select('*', { count: 'exact', head: true });

        // Fetch recent formations with inscription count
        const { data: formations } = await supabase
          .from('formations')
          .select(`
            id,
            titre,
            date_debut,
            date_fin,
            nombre_heures,
            inscriptions(count)
          `)
          .eq('archived', false)
          .order('date_debut', { ascending: false })
          .limit(5);

        // Fetch documents stats
        const { data: docs } = await supabase
          .from('documents_stagiaires')
          .select('statut');

        const complets = docs?.filter(d => d.statut === 'complete' || d.statut === 'genere_auto').length || 0;
        const incomplets = docs?.filter(d => d.statut === 'en_attente' || d.statut === 'en_cours').length || 0;

        setStats({
          totalFormations: formationsCount || 0,
          totalStagiaires: stagiairesCount || 0,
          dossiersComplets: complets,
          dossiersIncomplets: incomplets,
        });

        setRecentFormations(
          formations?.map(f => ({
            id: f.id,
            titre: f.titre,
            date_debut: f.date_debut,
            date_fin: f.date_fin,
            nombre_heures: f.nombre_heures,
            inscriptions_count: (f.inscriptions as { count: number }[])?.[0]?.count || 0,
          })) || []
        );
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const statCards = [
    {
      title: "Formations",
      value: stats.totalFormations,
      description: "formations actives",
      icon: GraduationCap,
      color: "text-primary",
      bgColor: "bg-primary/10",
      href: "/formations",
    },
    {
      title: "Stagiaires",
      value: stats.totalStagiaires,
      description: "stagiaires inscrits",
      icon: Users,
      color: "text-accent",
      bgColor: "bg-accent/10",
      href: "/stagiaires",
    },
    {
      title: "Documents complets",
      value: stats.dossiersComplets,
      description: "documents validés",
      icon: FileCheck,
      color: "text-success",
      bgColor: "bg-success/10",
      href: "/documents",
    },
    {
      title: "Documents en attente",
      value: stats.dossiersIncomplets,
      description: "documents à compléter",
      icon: AlertCircle,
      color: "text-warning",
      bgColor: "bg-warning/10",
      href: "/documents",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-semibold text-foreground">
          Bonjour, {profile?.prenom} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Voici un aperçu de votre activité Qualiopi
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.title} to={stat.href}>
            <Card className="hover:shadow-card-hover transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Formations & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Formations */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Formations récentes</CardTitle>
                <CardDescription>
                  Les 5 dernières formations créées
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/formations">
                  Voir tout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : recentFormations.length === 0 ? (
              <div className="text-center py-8">
                <GraduationCap className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune formation créée</p>
                <Button className="mt-4" asChild>
                  <Link to="/formations/new">Créer une formation</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentFormations.map((formation) => (
                  <Link
                    key={formation.id}
                    to={`/formations/${formation.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{formation.titre}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(formation.date_debut), 'dd MMM yyyy', { locale: fr })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formation.nombre_heures}h
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {formation.inscriptions_count} stagiaire{formation.inscriptions_count !== 1 ? 's' : ''}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
            <CardDescription>
              Accédez rapidement aux fonctionnalités clés
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" asChild>
              <Link to="/formations/new">
                <GraduationCap className="mr-2 h-4 w-4" />
                Nouvelle formation
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/stagiaires/new">
                <Users className="mr-2 h-4 w-4" />
                Ajouter un stagiaire
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/import">
                <TrendingUp className="mr-2 h-4 w-4" />
                Importer des données
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
