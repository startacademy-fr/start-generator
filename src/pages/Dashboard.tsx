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
  TrendingUp,
  Award,
  ThumbsUp,
  UserCheck,
  BookOpen
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DashboardStats {
  totalFormations: number;
  totalStagiaires: number;
  dossiersComplets: number;
  dossiersIncomplets: number;
  stagiairesN1: number;
  formationsN1: number;
  totalHeures: number;
  heuresParFormateur: { nom: string; heures: number }[];
  tauxReussiteQCM: number | null;
  tauxSatisfaction: number | null;
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
    stagiairesN1: 0,
    formationsN1: 0,
    totalHeures: 0,
    heuresParFormateur: [],
    tauxReussiteQCM: null,
    tauxSatisfaction: null,
  });
  const [recentFormations, setRecentFormations] = useState<RecentFormation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const currentYear = new Date().getFullYear();
        const n1Start = `${currentYear - 1}-01-01`;
        const n1End = `${currentYear - 1}-12-31`;

        // Fetch formations count (active)
        const { count: formationsCount } = await supabase
          .from('formations')
          .select('*', { count: 'exact', head: true })
          .eq('archived', false);

        // Fetch stagiaires count
        const { count: stagiairesCount } = await supabase
          .from('stagiaires')
          .select('*', { count: 'exact', head: true });

        // Fetch all formations for N-1 stats
        const { data: allFormations } = await supabase
          .from('formations')
          .select('id, titre, date_debut, date_fin, nombre_heures, formateur_id')
          .gte('date_debut', n1Start)
          .lte('date_debut', n1End);

        const formationsN1 = allFormations || [];
        const formationIdsN1 = formationsN1.map(f => f.id);

        // Stagiaires formés en N-1 (distinct)
        let stagiairesN1 = 0;
        if (formationIdsN1.length > 0) {
          const { data: inscN1 } = await supabase
            .from('inscriptions')
            .select('stagiaire_id')
            .in('formation_id', formationIdsN1);
          const uniqueStagiaires = new Set(inscN1?.map(i => i.stagiaire_id) || []);
          stagiairesN1 = uniqueStagiaires.size;
        }

        // Total heures de formation (toutes)
        const { data: allFormationsHeures } = await supabase
          .from('formations')
          .select('nombre_heures');
        const totalHeures = allFormationsHeures?.reduce((sum, f) => sum + (f.nombre_heures || 0), 0) || 0;

        // Heures par formateur
        const { data: formateurs } = await supabase
          .from('profiles')
          .select('id, prenom, nom');

        const formateurMap = new Map<string, { nom: string; heures: number }>();
        formationsN1.forEach(f => {
          if (f.formateur_id) {
            const existing = formateurMap.get(f.formateur_id);
            if (existing) {
              existing.heures += f.nombre_heures || 0;
            } else {
              const prof = formateurs?.find(p => p.id === f.formateur_id);
              formateurMap.set(f.formateur_id, {
                nom: prof ? `${prof.prenom} ${prof.nom}` : 'Inconnu',
                heures: f.nombre_heures || 0,
              });
            }
          }
        });
        const heuresParFormateur = Array.from(formateurMap.values()).sort((a, b) => b.heures - a.heures);

        // QCM scores & satisfaction from documents
        const { data: docs } = await supabase
          .from('documents_stagiaires')
          .select('type, score, statut, inscription_id');

        const complets = docs?.filter(d => d.statut === 'complete' || d.statut === 'genere_auto').length || 0;
        const incomplets = docs?.filter(d => d.statut === 'en_attente' || d.statut === 'en_cours').length || 0;

        // Get inscription IDs for N-1 formations to filter docs
        let inscriptionIdsN1: string[] = [];
        if (formationIdsN1.length > 0) {
          const { data: inscsN1 } = await supabase
            .from('inscriptions')
            .select('id')
            .in('formation_id', formationIdsN1);
          inscriptionIdsN1 = inscsN1?.map(i => i.id) || [];
        }

        const n1InscSet = new Set(inscriptionIdsN1);

        // Taux de réussite QCM (score moyen des QCM N-1)
        const qcmDocs = docs?.filter(d => d.type === 'qcm' && d.score != null && n1InscSet.has(d.inscription_id)) || [];
        const tauxReussiteQCM = qcmDocs.length > 0
          ? Math.round(qcmDocs.reduce((sum, d) => sum + (d.score || 0), 0) / qcmDocs.length)
          : null;

        // Taux satisfaction (score moyen satisfaction_froid N-1)
        const satDocs = docs?.filter(d => d.type === 'satisfaction_froid' && d.score != null && n1InscSet.has(d.inscription_id)) || [];
        const tauxSatisfaction = satDocs.length > 0
          ? Math.round(satDocs.reduce((sum, d) => sum + (d.score || 0), 0) / satDocs.length)
          : null;

        // Recent formations
        const { data: recentData } = await supabase
          .from('formations')
          .select(`id, titre, date_debut, date_fin, nombre_heures, inscriptions(count)`)
          .eq('archived', false)
          .order('date_debut', { ascending: false })
          .limit(5);

        setStats({
          totalFormations: formationsCount || 0,
          totalStagiaires: stagiairesCount || 0,
          dossiersComplets: complets,
          dossiersIncomplets: incomplets,
          stagiairesN1,
          formationsN1: formationsN1.length,
          totalHeures,
          heuresParFormateur,
          tauxReussiteQCM,
          tauxSatisfaction,
        });

        setRecentFormations(
          recentData?.map(f => ({
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

  const currentYear = new Date().getFullYear();
  const n1Year = currentYear - 1;

  const statCards = [
    {
      title: "Sessions actives",
      value: stats.totalFormations,
      description: "sessions de formation",
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

  const n1Cards = [
    {
      title: `Stagiaires formés (${n1Year})`,
      value: stats.stagiairesN1,
      icon: UserCheck,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: `Formations (${n1Year})`,
      value: stats.formationsN1,
      icon: BookOpen,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Total heures de formation",
      value: `${stats.totalHeures}h`,
      icon: Clock,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: `Taux réussite QCM (${n1Year})`,
      value: stats.tauxReussiteQCM != null ? `${stats.tauxReussiteQCM}%` : '—',
      icon: Award,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: `Satisfaction moyenne (${n1Year})`,
      value: stats.tauxSatisfaction != null ? `${stats.tauxSatisfaction}%` : '—',
      icon: ThumbsUp,
      color: "text-warning",
      bgColor: "bg-warning/10",
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
          Voici un aperçu de votre activité de formation
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

      {/* N-1 Stats */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Indicateurs clés ({n1Year})
        </h2>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {n1Cards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">
                  {stat.title}
                </CardTitle>
                <div className={`p-1.5 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Heures par formateur */}
      {stats.heuresParFormateur.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Heures par formateur ({n1Year})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.heuresParFormateur.map((f) => (
                <div key={f.nom} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{f.nom}</span>
                  <Badge variant="secondary">{f.heures}h</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Formations & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Formations */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sessions récentes</CardTitle>
                <CardDescription>
                  Les 5 dernières sessions de formation
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
                <p className="text-muted-foreground">Aucune session créée</p>
                <Button className="mt-4" asChild>
                  <Link to="/formations">Créer une session</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentFormations.map((formation) => (
                  <div
                    key={formation.id}
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
                  </div>
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
              <Link to="/formations">
                <GraduationCap className="mr-2 h-4 w-4" />
                Nouvelle session
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/stagiaires">
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
