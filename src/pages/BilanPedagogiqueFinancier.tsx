import { useState, useEffect, useMemo } from 'react';
import { generateBPFPdf } from '@/lib/pdf-generator';
import { NSF_SPECIALITES, getNsfLabel } from '@/lib/nsf-specialites';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-helpers';
import { toast } from 'sonner';
import { FileText, Download, Calculator, Users, Clock, BookOpen, Building2, Loader2 } from 'lucide-react';

interface OrganismeSettings {
  nom_organisme: string;
  siret: string | null;
  nda: string | null;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
}

interface FormationRow {
  id: string;
  titre: string;
  nombre_heures: number;
  date_debut: string;
  date_fin: string | null;
  objectifs: string | null;
  montant_total: number | null;
  specialite_nsf: string | null;
}

interface InscriptionRow {
  id: string;
  formation_id: string;
  stagiaire_id: string;
  statut: string;
  organisme_prise_en_charge: string | null;
}

interface StagiaireRow {
  id: string;
  civilite: string | null;
  est_salarie: boolean | null;
  chef_entreprise: boolean | null;
  entreprise: string | null;
}

export default function BilanPedagogiqueFinancier() {
  const [loading, setLoading] = useState(true);
  const [organisme, setOrganisme] = useState<OrganismeSettings | null>(null);
  const [formations, setFormations] = useState<FormationRow[]>([]);
  const [inscriptions, setInscriptions] = useState<InscriptionRow[]>([]);
  const [stagiaires, setStagiaires] = useState<StagiaireRow[]>([]);

  // Financial fields (manual input)
  const [financials, setFinancials] = useState({
    ca_formation: '',
    subventions: '',
    autres_produits: '',
    charges_formateurs: '',
    charges_fonctionnement: '',
    charges_autres: '',
  });

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const availableYears = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2025 + i);

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [orgResult, formationsData, inscriptionsData, stagiairesData] = await Promise.all([
        supabase.from('organisme_settings').select('*').limit(1).single(),
        fetchAllRows<FormationRow>(() =>
          supabase.from('formations').select('id, titre, nombre_heures, date_debut, date_fin, objectifs, montant_total, specialite_nsf')
            .gte('date_debut', `${year}-01-01`)
            .lte('date_debut', `${year}-12-31`)
        ),
        fetchAllRows<InscriptionRow>(() =>
          supabase.from('inscriptions').select('id, formation_id, stagiaire_id, statut, organisme_prise_en_charge')
        ),
        fetchAllRows<StagiaireRow>(() =>
          supabase.from('stagiaires').select('id, civilite, est_salarie, chef_entreprise, entreprise')
        ),
      ]);

      if (orgResult.data) setOrganisme(orgResult.data as OrganismeSettings);
      setFormations(formationsData);
      setInscriptions(inscriptionsData);
      setStagiaires(stagiairesData);
    } catch (error) {
      console.error('Error loading BPF data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const formationIds = new Set(formations.map(f => f.id));
    const relevantInscriptions = inscriptions.filter(i => formationIds.has(i.formation_id));
    const stagiairesMap = new Map(stagiaires.map(s => [s.id, s]));

    // BPF: count per inscription (a trainee in 3 formations = 3)
    const inscriptionStagiaires = relevantInscriptions
      .map(i => stagiairesMap.get(i.stagiaire_id))
      .filter(Boolean);
    const nbStagiairesBPF = inscriptionStagiaires.length;

    // Unique trainees (for enterprises)
    const uniqueStagiaireIds = new Set(relevantInscriptions.map(i => i.stagiaire_id));
    const uniqueStagiaires = [...uniqueStagiaireIds].map(id => stagiairesMap.get(id)).filter(Boolean);

    // Gender breakdown (per inscription)
    const hommes = inscriptionStagiaires.filter(s => s?.civilite === 'M.').length;
    const femmes = inscriptionStagiaires.filter(s => s?.civilite === 'Mme').length;

    // Status breakdown (per inscription)
    const salaries = inscriptionStagiaires.filter(s => s?.est_salarie).length;
    const chefs = inscriptionStagiaires.filter(s => s?.chef_entreprise).length;
    const autres = nbStagiairesBPF - salaries - chefs;

    // Total training hours (sum of formation hours × number of inscriptions)
    const heuresFormation = relevantInscriptions.reduce((sum, insc) => {
      const formation = formations.find(f => f.id === insc.formation_id);
      return sum + (formation?.nombre_heures || 0);
    }, 0);

    // Completed trainings
    const completedInscriptions = relevantInscriptions.filter(i => i.statut === 'termine').length;

    // Unique enterprises
    const entreprises = new Set(uniqueStagiaires.map(s => s?.entreprise).filter(Boolean));

    // CA from montant_total
    const caFormation = formations.reduce((sum, f) => sum + (f.montant_total || 0), 0);

    // OPCO breakdown
    const opcoBreakdown: Record<string, { count: number; montant: number }> = {};
    relevantInscriptions.forEach(insc => {
      const opco = insc.organisme_prise_en_charge || 'Non renseigné';
      if (!opcoBreakdown[opco]) opcoBreakdown[opco] = { count: 0, montant: 0 };
      opcoBreakdown[opco].count += 1;
    });

    // Sessions with/without montant
    const sessionsWithMontant = formations.filter(f => f.montant_total !== null && f.montant_total > 0).length;

    // Objective categories
    const objectifCategories: Record<string, number> = {
      'Perfectionnement / compétences': 0,
      'Création d\'entreprise': 0,
      'Certification / qualification': 0,
      'Autre': 0,
    };
    formations.forEach(f => {
      const obj = f.objectifs?.toLowerCase() || '';
      const nbInsc = relevantInscriptions.filter(i => i.formation_id === f.id).length;
      if (obj.includes('certif') || obj.includes('qualif')) {
        objectifCategories['Certification / qualification'] += nbInsc;
      } else if (obj.includes('créa') || obj.includes('entrepren')) {
        objectifCategories['Création d\'entreprise'] += nbInsc;
      } else {
        objectifCategories['Perfectionnement / compétences'] += nbInsc;
      }
    });

    // Spécialités NSF breakdown
    const specialiteBreakdown: Record<string, { stagiaires: number; heures: number }> = {};
    formations.forEach(f => {
      const code = f.specialite_nsf || 'non_renseigne';
      if (!specialiteBreakdown[code]) specialiteBreakdown[code] = { stagiaires: 0, heures: 0 };
      const nbInsc = relevantInscriptions.filter(i => i.formation_id === f.id).length;
      specialiteBreakdown[code].stagiaires += nbInsc;
      specialiteBreakdown[code].heures += f.nombre_heures * nbInsc;
    });

    return {
      nbFormations: formations.length,
      nbStagiaires: nbStagiairesBPF,
      nbInscriptions: relevantInscriptions.length,
      heuresFormation,
      heuresStagiaires: heuresFormation,
      completedInscriptions,
      hommes,
      femmes,
      salaries,
      chefs,
      autres,
      nbEntreprises: entreprises.size,
      objectifCategories,
      caFormation,
      opcoBreakdown,
      sessionsWithMontant,
      specialiteBreakdown,
    };
  }, [formations, inscriptions, stagiaires]);

  const handleFinancialChange = (field: string, value: string) => {
    // Only allow numbers and dots
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    setFinancials(prev => ({ ...prev, [field]: value }));
  };

  const totalProduits = stats.caFormation + 
    (parseFloat(financials.subventions) || 0) + 
    (parseFloat(financials.autres_produits) || 0);
  
  const totalCharges = (parseFloat(financials.charges_formateurs) || 0) + 
    (parseFloat(financials.charges_fonctionnement) || 0) + 
    (parseFloat(financials.charges_autres) || 0);

  const formatNumber = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
  const formatCurrency = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

  const handleExportPdf = async () => {
    try {
      await generateBPFPdf({
        year,
        organisme: organisme,
        stats,
        financials,
        totalProduits,
        totalCharges,
      });
      toast.success('PDF exporté avec succès');
    } catch (error) {
      console.error('Error exporting BPF PDF:', error);
      toast.error("Erreur lors de l'export PDF");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Bilan Pédagogique et Financier {year}
          </h1>
          <p className="text-muted-foreground mt-1">
            Cerfa n°10443 — Période du 01/01/{year} au 31/12/{year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button onClick={handleExportPdf} className="gap-2">
            <Download className="h-4 w-4" />
            Exporter PDF
          </Button>
        </div>
      </div>

      {/* Organisme Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Partie A — Identification de l'organisme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Raison sociale</Label>
              <p className="font-medium">{organisme?.nom_organisme || '—'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">SIRET</Label>
              <p className="font-medium">{organisme?.siret || '—'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">N° de Déclaration d'Activité (NDA)</Label>
              <p className="font-medium">{organisme?.nda || '—'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Adresse</Label>
              <p className="font-medium">{organisme?.adresse || '—'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Téléphone</Label>
              <p className="font-medium">{organisme?.telephone || '—'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Email</Label>
              <p className="font-medium">{organisme?.email || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Partie B — Bilan financier
          </CardTitle>
          <CardDescription>
            CA formation calculé automatiquement depuis les montants des sessions ({stats.sessionsWithMontant}/{stats.nbFormations} sessions renseignées)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Produits */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground border-b pb-2">Produits</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Chiffre d'affaires formation (calculé)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-base px-3 py-1.5">
                      {formatCurrency(stats.caFormation)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({stats.sessionsWithMontant} sessions)
                    </span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="subventions">Subventions et aides (€)</Label>
                  <Input
                    id="subventions"
                    placeholder="0.00"
                    value={financials.subventions}
                    onChange={e => handleFinancialChange('subventions', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="autres_produits">Autres produits (€)</Label>
                  <Input
                    id="autres_produits"
                    placeholder="0.00"
                    value={financials.autres_produits}
                    onChange={e => handleFinancialChange('autres_produits', e.target.value)}
                  />
                </div>
                <Separator />
                <div className="flex justify-between items-center font-semibold">
                  <span>Total Produits</span>
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {formatCurrency(totalProduits)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Charges */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground border-b pb-2">Charges</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="charges_formateurs">Charges formateurs (€)</Label>
                  <Input
                    id="charges_formateurs"
                    placeholder="0.00"
                    value={financials.charges_formateurs}
                    onChange={e => handleFinancialChange('charges_formateurs', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="charges_fonctionnement">Charges de fonctionnement (€)</Label>
                  <Input
                    id="charges_fonctionnement"
                    placeholder="0.00"
                    value={financials.charges_fonctionnement}
                    onChange={e => handleFinancialChange('charges_fonctionnement', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="charges_autres">Autres charges (€)</Label>
                  <Input
                    id="charges_autres"
                    placeholder="0.00"
                    value={financials.charges_autres}
                    onChange={e => handleFinancialChange('charges_autres', e.target.value)}
                  />
                </div>
                <Separator />
                <div className="flex justify-between items-center font-semibold">
                  <span>Total Charges</span>
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {formatCurrency(totalCharges)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-6" />
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">Résultat net</span>
            <Badge 
              className={`text-lg px-4 py-1.5 ${totalProduits - totalCharges >= 0 ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}`}
            >
              {formatCurrency(totalProduits - totalCharges)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Pedagogical Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Partie C — Bilan pédagogique
          </CardTitle>
          <CardDescription>Données calculées automatiquement depuis vos sessions {year}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={BookOpen} label="Actions de formation" value={formatNumber(stats.nbFormations)} />
            <MetricCard icon={Users} label="Stagiaires" value={formatNumber(stats.nbStagiaires)} />
            <MetricCard icon={Clock} label="Heures-stagiaires" value={formatNumber(stats.heuresStagiaires)} />
            <MetricCard icon={Building2} label="Entreprises clientes" value={formatNumber(stats.nbEntreprises)} />
          </div>

          <Separator />

          {/* Breakdown tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Par sexe */}
            <div>
              <h3 className="font-semibold mb-3 text-foreground">Répartition par sexe</h3>
              <div className="space-y-2">
                <StatRow label="Hommes" value={stats.hommes} total={stats.nbStagiaires} />
                <StatRow label="Femmes" value={stats.femmes} total={stats.nbStagiaires} />
              </div>
            </div>

            {/* Par statut */}
            <div>
              <h3 className="font-semibold mb-3 text-foreground">Répartition par statut</h3>
              <div className="space-y-2">
                <StatRow label="Salariés" value={stats.salaries} total={stats.nbStagiaires} />
                <StatRow label="Chefs d'entreprise" value={stats.chefs} total={stats.nbStagiaires} />
                <StatRow label="Autres (demandeurs d'emploi, etc.)" value={stats.autres} total={stats.nbStagiaires} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Par objectif */}
          <div>
            <h3 className="font-semibold mb-3 text-foreground">Stagiaires par objectif de formation</h3>
            <div className="space-y-2">
              {Object.entries(stats.objectifCategories).map(([cat, count]) => (
                <StatRow key={cat} label={cat} value={count} total={stats.nbInscriptions} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Completion stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{formatNumber(stats.nbInscriptions)}</p>
              <p className="text-sm text-muted-foreground">Total inscriptions</p>
            </div>
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-success">{formatNumber(stats.completedInscriptions)}</p>
              <p className="text-sm text-muted-foreground">Formations terminées</p>
            </div>
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {stats.nbInscriptions > 0 ? Math.round((stats.completedInscriptions / stats.nbInscriptions) * 100) : 0}%
              </p>
              <p className="text-sm text-muted-foreground">Taux d'achèvement</p>
            </div>
          </div>

          <Separator />

          {/* Spécialités de formation (F-4) */}
          <div>
            <h3 className="font-semibold mb-3 text-foreground">F-4 — Spécialités de formation</h3>
            {Object.keys(stats.specialiteBreakdown).length > 0 ? (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Spécialités de formation</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground w-20">CODE</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground w-24">Stagiaires</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground w-24">Heures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.specialiteBreakdown)
                      .filter(([code]) => code !== 'non_renseigne')
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([code, data]) => (
                        <tr key={code} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3 text-foreground">{getNsfLabel(code)}</td>
                          <td className="py-2 px-3 text-right text-foreground">{code}</td>
                          <td className="py-2 px-3 text-right font-semibold text-foreground">{formatNumber(data.stagiaires)}</td>
                          <td className="py-2 px-3 text-right text-foreground">{formatNumber(data.heures)}</td>
                        </tr>
                      ))}
                    {stats.specialiteBreakdown['non_renseigne'] && (
                      <tr className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 text-muted-foreground italic">Non renseigné</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">—</td>
                        <td className="py-2 px-3 text-right font-semibold text-muted-foreground">{formatNumber(stats.specialiteBreakdown['non_renseigne'].stagiaires)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{formatNumber(stats.specialiteBreakdown['non_renseigne'].heures)}</td>
                      </tr>
                    )}
                    <tr className="bg-muted/50 font-semibold">
                      <td className="py-2 px-3 text-foreground">TOTAL</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">({Object.keys(stats.specialiteBreakdown).filter(c => c !== 'non_renseigne').length})</td>
                      <td className="py-2 px-3 text-right text-foreground">{formatNumber(stats.nbStagiaires)}</td>
                      <td className="py-2 px-3 text-right text-foreground">{formatNumber(stats.heuresStagiaires)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune donnée disponible. Renseignez les spécialités NSF dans les sessions.</p>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function StatRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-foreground">{value}</span>
        <Badge variant="outline" className="text-xs min-w-[45px] justify-center">
          {pct}%
        </Badge>
      </div>
    </div>
  );
}
