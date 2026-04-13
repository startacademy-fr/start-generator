import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  BookOpen,
  LogOut,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Bell,
  UserX,
  FileWarning
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const PIE_COLORS = ['hsl(199, 89%, 32%)', 'hsl(174, 72%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(142, 76%, 36%)', 'hsl(0, 72%, 51%)', 'hsl(215, 20%, 55%)', 'hsl(270, 60%, 50%)'];

interface DashboardStats {
  totalFormations: number;
  totalStagiaires: number;
  dossiersComplets: number;
  dossiersIncomplets: number;
  stagiairesN1: number;
  inscriptionsN1: number;
  formationsN1: number;
  totalHeures: number;
  heuresParFormateur: { nom: string; heures: number }[];
  formationsParType: { nom: string; count: number }[];
  tauxReussiteQCM: number | null;
  tauxSatisfaction: number | null;
  tauxRecommandation: number | null;
  tauxAbandon: number | null;
  reclamationsN1: number;
  tauxCompletionDossiers: number | null;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  link: string;
  icon: typeof AlertTriangle;
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
    inscriptionsN1: 0,
    formationsN1: 0,
    totalHeures: 0,
    heuresParFormateur: [],
    formationsParType: [],
    tauxReussiteQCM: null,
    tauxSatisfaction: null,
    tauxRecommandation: null,
    tauxAbandon: null,
    reclamationsN1: 0,
    tauxCompletionDossiers: null,
  });
  const [recentFormations, setRecentFormations] = useState<RecentFormation[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [satisfactionFilter, setSatisfactionFilter] = useState<string>('all');
  const [satisfactionDocs, setSatisfactionDocs] = useState<{ score: number; formation_id: string; recommande: boolean }[]>([]);
  const [allFormationsList, setAllFormationsList] = useState<{ id: string; titre: string }[]>([]);
  const [stagiairesParAnFormationRaw, setStagiairesParAnFormationRaw] = useState<{ formation: string; year: number; stagiaires: number; satisfaction: number | null; recommandation: number | null }[]>([]);
  const [stagiairesYears, setStagiairesYears] = useState<number[]>([]);
  const [selectedTableYear, setSelectedTableYear] = useState<number>(new Date().getFullYear());
  const [selectedDashboardYear, setSelectedDashboardYear] = useState<number>(new Date().getFullYear() - 1);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const currentYear = new Date().getFullYear();
        const targetYear = selectedDashboardYear;
        const n1Start = `${targetYear}-01-01`;
        const n1End = `${targetYear}-12-31`;

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
        let inscriptionsN1Total = 0;
        if (formationIdsN1.length > 0) {
          const { data: inscN1 } = await supabase
            .from('inscriptions')
            .select('stagiaire_id')
            .in('formation_id', formationIdsN1);
          inscriptionsN1Total = inscN1?.length || 0;
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

        // Formations par type (group by titre, truncated)
        const typeMap = new Map<string, number>();
        formationsN1.forEach(f => {
          const shortTitle = f.titre.length > 30 ? f.titre.substring(0, 30) + '…' : f.titre;
          typeMap.set(shortTitle, (typeMap.get(shortTitle) || 0) + 1);
        });
        const formationsParType = Array.from(typeMap.entries())
          .map(([nom, count]) => ({ nom, count }))
          .sort((a, b) => b.count - a.count);

        // QCM scores & satisfaction from documents
        const { data: docs } = await supabase
          .from('documents_stagiaires')
          .select('type, score, statut, inscription_id, contenu');

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

        // Helper: convert rating text to score /5
        const ratingToScore = (rating: string): number | null => {
          const r = (rating || '').toLowerCase().trim();
          if (r === 'très bien') return 5;
          if (r === 'bien') return 4;
          if (r === 'moyen') return 2.5;
          if (r === 'mauvais') return 1;
          return null;
        };

        // Extract all ratings from a satisfaction_chaud contenu
        const extractSatScores = (contenu: any): number[] => {
          const scores: number[] = [];
          const sections = ['organisation', 'moyens', 'pedagogie', 'groupe'];
          for (const section of sections) {
            if (contenu[section] && typeof contenu[section] === 'object') {
              for (const [key, value] of Object.entries(contenu[section])) {
                if (key === 'commentaire') continue;
                const s = ratingToScore(value as string);
                if (s !== null) scores.push(s);
              }
            }
          }
          // benefice.adequation
          if (contenu.benefice?.adequation) {
            const s = ratingToScore(contenu.benefice.adequation);
            if (s !== null) scores.push(s);
          }
          return scores;
        };

        // Check if recommandation is "oui"
        const isRecommandation = (contenu: any): boolean => {
          const rec = (contenu?.questions_finales?.recommandation || '').toLowerCase();
          return rec.includes('oui');
        };

        // Satisfaction à chaud docs for N-1
        const satChaudDocs = docs?.filter(d => d.type === 'satisfaction_chaud' && n1InscSet.has(d.inscription_id)) || [];
        
        // Calculate average satisfaction score /5
        let allSatScores: number[] = [];
        let recommandationCount = 0;
        const satDocsProcessed: { score: number; formation_id: string; recommande: boolean }[] = [];

        // Build inscription -> formation mapping
        const { data: allInscsForSat } = await supabase
          .from('inscriptions')
          .select('id, formation_id');
        const inscToFormation = new Map<string, string>();
        allInscsForSat?.forEach(i => inscToFormation.set(i.id, i.formation_id));

        satChaudDocs.forEach(d => {
          const contenu = d.contenu as any;
          const scores = extractSatScores(contenu);
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          const recommande = isRecommandation(contenu);
          if (recommande) recommandationCount++;
          if (scores.length > 0) {
            allSatScores.push(avgScore);
          }
          if (inscToFormation.has(d.inscription_id)) {
            satDocsProcessed.push({
              score: avgScore,
              formation_id: inscToFormation.get(d.inscription_id)!,
              recommande,
            });
          }
        });

        const tauxSatisfaction = allSatScores.length > 0
          ? Math.round((allSatScores.reduce((a, b) => a + b, 0) / allSatScores.length) * 10) / 10
          : null;

        const tauxRecommandation = satChaudDocs.length > 0
          ? Math.round((recommandationCount / satChaudDocs.length) * 100)
          : null;

        setSatisfactionDocs(satDocsProcessed);

        // Taux d'abandon N-1 (inscriptions avec statut 'abandon')
        let tauxAbandon: number | null = null;
        if (formationIdsN1.length > 0) {
          const { data: allInscsN1 } = await supabase
            .from('inscriptions')
            .select('statut')
            .in('formation_id', formationIdsN1);
          const totalInscs = allInscsN1?.length || 0;
          const abandons = allInscsN1?.filter(i => i.statut === 'abandon').length || 0;
          tauxAbandon = totalInscs > 0 ? Math.round((abandons / totalInscs) * 100) : null;
        }

        // Réclamations N-1
        const { count: reclamationsCount } = await supabase
          .from('reclamations')
          .select('*', { count: 'exact', head: true })
          .gte('date_reclamation', n1Start)
          .lte('date_reclamation', n1End);

        // Taux de complétion des dossiers (% inscriptions ayant tous les 7 types de docs)
        const { data: allInscs } = await supabase
          .from('inscriptions')
          .select('id');
        const totalInscriptions = allInscs?.length || 0;
        let tauxCompletionDossiers: number | null = null;
        if (totalInscriptions > 0 && docs) {
          const docCountByInsc = new Map<string, number>();
          docs.forEach(d => {
            docCountByInsc.set(d.inscription_id, (docCountByInsc.get(d.inscription_id) || 0) + 1);
          });
          const completDossiers = Array.from(docCountByInsc.values()).filter(c => c >= 7).length;
          tauxCompletionDossiers = Math.round((completDossiers / totalInscriptions) * 100);
        }

        // Fetch all formations for satisfaction filter dropdown
        const { data: formationsListData } = await supabase
          .from('formations')
          .select('id, titre')
          .order('date_debut', { ascending: false });
        setAllFormationsList(formationsListData || []);

        // Stagiaires formés par an et par formation catalogue (toutes sessions confondues)
        // Group by formation_catalogue_id to merge sessions of the same catalogue formation
        const { data: allFormationsForStats } = await supabase
          .from('formations')
          .select('id, titre, date_debut, formation_catalogue_id');
        const { data: catalogueFormations } = await supabase
          .from('formations_catalogue')
          .select('id, titre');
        const { data: allInscriptionsForStats } = await supabase
          .from('inscriptions')
          .select('id, formation_id, stagiaire_id');
        
        // All satisfaction_chaud docs (not just N-1)
        const allSatChaudDocs = docs?.filter(d => d.type === 'satisfaction_chaud') || [];
        
        if (allFormationsForStats && allInscriptionsForStats) {
          // Build catalogue title map
          const catalogueTitleMap = new Map<string, string>();
          catalogueFormations?.forEach(c => catalogueTitleMap.set(c.id, c.titre));

          // For each formation, determine the display title:
          // If it has a formation_catalogue_id, use the catalogue title to group sessions together
          const formationInfo = new Map<string, { titre: string; year: number }>();
          allFormationsForStats.forEach(f => {
            const displayTitle = f.formation_catalogue_id && catalogueTitleMap.has(f.formation_catalogue_id)
              ? catalogueTitleMap.get(f.formation_catalogue_id)!
              : f.titre;
            formationInfo.set(f.id, { titre: displayTitle, year: new Date(f.date_debut).getFullYear() });
          });

          // Map inscription_id -> { titre, year }
          const inscriptionInfo = new Map<string, { titre: string; year: number }>();
          allInscriptionsForStats.forEach(insc => {
            const info = formationInfo.get(insc.formation_id);
            if (info) inscriptionInfo.set(insc.id, info);
          });

          // Group by titre -> year -> Set<stagiaire_id>
          const titreYearMap = new Map<string, Map<number, Set<string>>>();
          const yearsSet = new Set<number>();

          allInscriptionsForStats.forEach(insc => {
            const info = formationInfo.get(insc.formation_id);
            if (!info) return;
            yearsSet.add(info.year);
            if (!titreYearMap.has(info.titre)) {
              titreYearMap.set(info.titre, new Map());
            }
            const yearMap = titreYearMap.get(info.titre)!;
            if (!yearMap.has(info.year)) {
              yearMap.set(info.year, new Set());
            }
            yearMap.get(info.year)!.add(insc.stagiaire_id);
          });

          // Group satisfaction_chaud by titre -> year -> scores & recommandations
          const satByTitreYear = new Map<string, Map<number, { scores: number[]; recommandes: number; total: number }>>();
          allSatChaudDocs.forEach(d => {
            const info = inscriptionInfo.get(d.inscription_id);
            if (!info) return;
            const contenu = d.contenu as any;
            const docScores = extractSatScores(contenu);
            const avgScore = docScores.length > 0 ? docScores.reduce((a, b) => a + b, 0) / docScores.length : null;
            const recommande = isRecommandation(contenu);

            if (!satByTitreYear.has(info.titre)) satByTitreYear.set(info.titre, new Map());
            const yearMap = satByTitreYear.get(info.titre)!;
            if (!yearMap.has(info.year)) yearMap.set(info.year, { scores: [], recommandes: 0, total: 0 });
            const entry = yearMap.get(info.year)!;
            if (avgScore !== null) entry.scores.push(avgScore);
            if (recommande) entry.recommandes++;
            entry.total++;
          });

          const years = Array.from(yearsSet).sort((a, b) => b - a);
          setStagiairesYears(years);
          setAvailableYears(years);

          const allData = Array.from(titreYearMap.entries()).flatMap(([titre, yearMap]) => {
            return Array.from(yearMap.entries()).map(([year, stagiaireSet]) => {
              const satData = satByTitreYear.get(titre)?.get(year);
              const satisfaction = satData && satData.scores.length > 0
                ? Math.round((satData.scores.reduce((a, b) => a + b, 0) / satData.scores.length) * 10) / 10
                : null;
              const recommandation = satData && satData.total > 0
                ? Math.round((satData.recommandes / satData.total) * 100)
                : null;
              return { formation: titre, year, stagiaires: stagiaireSet.size, satisfaction, recommandation };
            });
          });

          setStagiairesParAnFormationRaw(allData);
        }

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
          inscriptionsN1: inscriptionsN1Total,
          formationsN1: formationsN1.length,
          totalHeures,
          heuresParFormateur,
          formationsParType,
          tauxReussiteQCM,
          tauxSatisfaction,
          tauxRecommandation,
          tauxAbandon,
          reclamationsN1: reclamationsCount || 0,
          tauxCompletionDossiers,
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

        // Build alerts
        const alertItems: AlertItem[] = [];

        // Formations without formateur
        const { data: noFormateurData } = await supabase
          .from('formations')
          .select('id')
          .is('formateur_id', null)
          .eq('archived', false);
        if (noFormateurData && noFormateurData.length > 0) {
          alertItems.push({
            id: 'no-formateur',
            type: 'warning',
            message: `${noFormateurData.length} session(s) sans formateur assigné`,
            link: '/formations',
            icon: UserX,
          });
        }

        // Unresolved reclamations
        const { data: openReclamations } = await supabase
          .from('reclamations')
          .select('id')
          .eq('statut', 'en_cours');
        if (openReclamations && openReclamations.length > 0) {
          alertItems.push({
            id: 'open-reclamations',
            type: 'error',
            message: `${openReclamations.length} réclamation(s) non traitée(s)`,
            link: '/audit',
            icon: MessageSquare,
          });
        }

        // Incomplete catalogue entries (no objectives or no PDF)
        const { data: incompleteCatalogue } = await supabase
          .from('formations_catalogue')
          .select('id')
          .or('objectifs.is.null,programme_pdf_url.is.null');
        if (incompleteCatalogue && incompleteCatalogue.length > 0) {
          alertItems.push({
            id: 'incomplete-catalogue',
            type: 'info',
            message: `${incompleteCatalogue.length} formation(s) catalogue incomplète(s)`,
            link: '/catalogue',
            icon: FileWarning,
          });
        }

        // Low document completion rate
        if (tauxCompletionDossiers !== null && tauxCompletionDossiers < 50) {
          alertItems.push({
            id: 'low-completion',
            type: 'warning',
            message: `Taux de complétion des dossiers faible (${tauxCompletionDossiers}%)`,
            link: '/documents',
            icon: AlertTriangle,
          });
        }

        setAlerts(alertItems);
      } catch (error) {
        if (import.meta.env.DEV) console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [selectedDashboardYear]);

  const currentYear = new Date().getFullYear();
  const n1Year = selectedDashboardYear;

  const filteredSatisfaction = useMemo(() => {
    if (satisfactionDocs.length === 0) return null;
    const filtered = satisfactionFilter === 'all' 
      ? satisfactionDocs 
      : satisfactionDocs.filter(d => d.formation_id === satisfactionFilter);
    if (filtered.length === 0) return null;
    return Math.round((filtered.reduce((sum, d) => sum + d.score, 0) / filtered.length) * 10) / 10;
  }, [satisfactionDocs, satisfactionFilter]);

  const filteredRecommandation = useMemo(() => {
    if (satisfactionDocs.length === 0) return null;
    const filtered = satisfactionFilter === 'all' 
      ? satisfactionDocs 
      : satisfactionDocs.filter(d => d.formation_id === satisfactionFilter);
    if (filtered.length === 0) return null;
    const recommandes = filtered.filter(d => d.recommande).length;
    return Math.round((recommandes / filtered.length) * 100);
  }, [satisfactionDocs, satisfactionFilter]);

  const stagiairesParAnFormation = useMemo(() => {
    return stagiairesParAnFormationRaw
      .filter(r => r.year === selectedTableYear)
      .sort((a, b) => b.stagiaires - a.stagiaires);
  }, [stagiairesParAnFormationRaw, selectedTableYear]);

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
      title: `Total inscriptions (${n1Year})`,
      value: stats.inscriptionsN1,
      icon: Users,
      color: "text-accent",
      bgColor: "bg-accent/10",
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
      value: stats.tauxSatisfaction != null ? `${stats.tauxSatisfaction}/5` : '—',
      icon: ThumbsUp,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: `Taux recommandation (${n1Year})`,
      value: stats.tauxRecommandation != null ? `${stats.tauxRecommandation}%` : '—',
      icon: Award,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: `Taux d'abandon (${n1Year})`,
      value: stats.tauxAbandon != null ? `${stats.tauxAbandon}%` : '0%',
      icon: LogOut,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: `Réclamations (${n1Year})`,
      value: stats.reclamationsN1,
      icon: MessageSquare,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    {
      title: "Complétion dossiers",
      value: stats.tauxCompletionDossiers != null ? `${stats.tauxCompletionDossiers}%` : '—',
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10",
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Indicateurs clés ({n1Year})
          </h2>
          <Select value={String(selectedDashboardYear)} onValueChange={(v) => setSelectedDashboardYear(Number(v))}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              {(availableYears.length > 0 ? availableYears : [currentYear - 1, currentYear - 2]).map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      {/* Alerts & Notifications */}
      {alerts.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-warning" />
              <CardTitle className="text-base">Alertes & Notifications</CardTitle>
              <Badge variant="secondary" className="ml-auto">{alerts.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => (
              <Link key={alert.id} to={alert.link}>
                <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                  alert.type === 'error' ? 'border-destructive/30 bg-destructive/5' :
                  alert.type === 'warning' ? 'border-warning/30 bg-warning/5' :
                  'border-border bg-card'
                }`}>
                  <alert.icon className={`h-4 w-4 shrink-0 ${
                    alert.type === 'error' ? 'text-destructive' :
                    alert.type === 'warning' ? 'text-warning' :
                    'text-muted-foreground'
                  }`} />
                  <span className="text-sm font-medium flex-1">{alert.message}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Progress Bars */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Complétion des dossiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{stats.tauxCompletionDossiers ?? 0}%</div>
            <Progress value={stats.tauxCompletionDossiers ?? 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">Inscriptions avec 7+ documents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux de réussite QCM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{stats.tauxReussiteQCM ?? '—'}{stats.tauxReussiteQCM != null ? '%' : ''}</div>
            <Progress value={stats.tauxReussiteQCM ?? 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">Score moyen {n1Year}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Satisfaction stagiaires</CardTitle>
            <Select value={satisfactionFilter} onValueChange={setSatisfactionFilter}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue placeholder="Toutes les formations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les formations</SelectItem>
                {allFormationsList.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.titre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{filteredSatisfaction ?? '—'}{filteredSatisfaction != null ? '/5' : ''}</div>
            <Progress value={filteredSatisfaction != null ? (filteredSatisfaction / 5) * 100 : 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Satisfaction à chaud {satisfactionFilter === 'all' ? n1Year : ''}
              {satisfactionFilter !== 'all' && satisfactionDocs.filter(d => d.formation_id === satisfactionFilter).length > 0 
                ? ` — ${satisfactionDocs.filter(d => d.formation_id === satisfactionFilter).length} réponse(s)` 
                : satisfactionFilter === 'all' ? '' : ' — Aucune donnée'}
            </p>
            {filteredSatisfaction != null && (
              <p className={`text-xs mt-1 font-medium ${filteredSatisfaction >= 4.5 ? 'text-success' : 'text-warning'}`}>
                {filteredSatisfaction >= 4.5 ? '✅ Objectif atteint (≥ 4.5/5)' : '⚠️ Objectif non atteint (< 4.5/5)'}
              </p>
            )}
            {filteredRecommandation != null && (
              <p className="text-xs text-muted-foreground mt-1">
                📣 Taux de recommandation : <span className="font-semibold text-foreground">{filteredRecommandation}%</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {(stats.heuresParFormateur.length > 0 || stats.formationsParType.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pie chart - Heures par formateur */}
          {stats.heuresParFormateur.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Heures par formateur ({n1Year}) — Total : {stats.heuresParFormateur.reduce((s, f) => s + f.heures, 0)}h</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.heuresParFormateur}
                        dataKey="heures"
                        nameKey="nom"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={45}
                        paddingAngle={3}
                        label={({ nom, heures }) => `${nom.split(' ')[0]} (${heures}h)`}
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {stats.heuresParFormateur.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value}h`, 'Heures']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bar chart - Formations par type */}
          {stats.formationsParType.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Formations par type ({n1Year})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.formationsParType}
                      layout="vertical"
                      margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="nom"
                        width={180}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value} session(s)`, 'Nombre']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      />
                      <Bar dataKey="count" fill="hsl(199, 89%, 32%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Stagiaires formés par an et par formation */}
      {stagiairesParAnFormationRaw.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Stagiaires formés par formation</CardTitle>
                <CardDescription>Nombre de stagiaires uniques, satisfaction et recommandation par formation</CardDescription>
              </div>
              <Select value={String(selectedTableYear)} onValueChange={(v) => setSelectedTableYear(Number(v))}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stagiairesYears.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Formation</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Stagiaires</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Satisfaction</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Recommandation</th>
                  </tr>
                </thead>
                <tbody>
                  {stagiairesParAnFormation.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-muted-foreground">Aucune donnée pour {selectedTableYear}</td>
                    </tr>
                  ) : (
                    stagiairesParAnFormation.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-2 pr-4 font-medium max-w-[350px] truncate">{row.formation}</td>
                        <td className="text-center py-2 px-3">
                          <Badge variant="secondary" className="min-w-[2rem]">{row.stagiaires}</Badge>
                        </td>
                        <td className="text-center py-2 px-3">
                          {row.satisfaction != null ? (
                            <span className={`font-semibold ${row.satisfaction >= 4.5 ? 'text-success' : row.satisfaction >= 3.5 ? 'text-warning' : 'text-destructive'}`}>
                              {row.satisfaction}/5
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="text-center py-2 px-3">
                          {row.recommandation != null ? (
                            <Badge className="min-w-[2rem]">{row.recommandation}%</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {stagiairesParAnFormation.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 font-semibold bg-muted/30">
                      <td className="py-2 pr-4">Total</td>
                      <td className="text-center py-2 px-3">
                        <Badge variant="secondary" className="min-w-[2rem]">
                          {stagiairesParAnFormation.reduce((sum, r) => sum + r.stagiaires, 0)}
                        </Badge>
                      </td>
                      <td className="text-center py-2 px-3">
                        {(() => {
                          const withSat = stagiairesParAnFormation.filter(r => r.satisfaction != null);
                          if (withSat.length === 0) return <span className="text-muted-foreground">—</span>;
                          const avg = Math.round((withSat.reduce((s, r) => s + r.satisfaction!, 0) / withSat.length) * 10) / 10;
                          return <span className={`font-semibold ${avg >= 4.5 ? 'text-success' : avg >= 3.5 ? 'text-warning' : 'text-destructive'}`}>{avg}/5</span>;
                        })()}
                      </td>
                      <td className="text-center py-2 px-3">
                        {(() => {
                          const withRec = stagiairesParAnFormation.filter(r => r.recommandation != null);
                          if (withRec.length === 0) return <span className="text-muted-foreground">—</span>;
                          const avg = Math.round(withRec.reduce((s, r) => s + r.recommandation!, 0) / withRec.length);
                          return <Badge className="min-w-[2rem]">{avg}%</Badge>;
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
