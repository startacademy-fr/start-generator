import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Loader2, UserSearch, PenLine } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateCertificatPDF } from '@/lib/certificat-generator';
import { supabase } from '@/integrations/supabase/client';

interface CertificatFormData {
  nomPrenom: string;
  nomFormation: string;
  natureAction: string;
  dateDebut: string;
  dateFin: string;
  duree: string;
  faitA: string;
  leDateDu: string;
}

interface StagiaireOption {
  id: string;
  nom: string;
  prenom: string;
}

interface FormationOption {
  id: string;
  titre: string;
  nombre_heures: number;
  date_debut: string;
  date_fin: string | null;
}

const defaultFormData: CertificatFormData = {
  nomPrenom: '',
  nomFormation: '',
  natureAction: 'Plan de développement des compétences',
  dateDebut: '',
  dateFin: '',
  duree: '',
  faitA: 'Vence',
  leDateDu: new Date().toISOString().split('T')[0],
};

export default function Certificats() {
  const [formData, setFormData] = useState<CertificatFormData>(defaultFormData);
  const [generating, setGenerating] = useState(false);
  const [stagiaires, setStagiaires] = useState<StagiaireOption[]>([]);
  const [formations, setFormations] = useState<FormationOption[]>([]);
  const [mode, setMode] = useState<'list' | 'manual'>('list');
  const [formationMode, setFormationMode] = useState<'list' | 'manual'>('list');
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: stagData }, { data: formData }] = await Promise.all([
        supabase.from('stagiaires').select('id, nom, prenom').order('nom'),
        supabase.from('formations').select('id, titre, nombre_heures, date_debut, date_fin').order('date_debut', { ascending: false }),
      ]);
      if (stagData) setStagiaires(stagData);
      if (formData) setFormations(formData);
    };
    fetchData();
  }, []);

  const handleChange = (field: keyof CertificatFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStagiaireSelect = (stagiaireId: string) => {
    const s = stagiaires.find((st) => st.id === stagiaireId);
    if (s) {
      handleChange('nomPrenom', `${s.nom} ${s.prenom}`);
    }
  };

  const handleGenerate = async () => {
    if (!formData.nomPrenom || !formData.nomFormation || !formData.dateDebut || !formData.duree) {
      toast({ title: 'Champs requis manquants', description: 'Veuillez remplir tous les champs obligatoires.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const doc = await generateCertificatPDF(formData);
      const safeName = formData.nomPrenom.replace(/\s+/g, '_');
      doc.save(`Certificat_Realisation_${safeName}.pdf`);
      toast({ title: 'Certificat généré', description: 'Le PDF a été téléchargé avec succès.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erreur', description: 'Impossible de générer le certificat.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setFormData(defaultFormData);
    setMode('list');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Certificat de réalisation</h1>
        <p className="text-muted-foreground mt-1">Générez un certificat de réalisation pour un stagiaire.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Informations du certificat</CardTitle>
          <CardDescription>Renseignez les informations puis cliquez sur Générer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Stagiaire - mode toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Nom et Prénom du stagiaire *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => {
                  setMode(mode === 'list' ? 'manual' : 'list');
                  handleChange('nomPrenom', '');
                }}
              >
                {mode === 'list' ? <PenLine className="h-3.5 w-3.5" /> : <UserSearch className="h-3.5 w-3.5" />}
                {mode === 'list' ? 'Saisie libre' : 'Choisir dans la liste'}
              </Button>
            </div>
            {mode === 'list' ? (
              <Select onValueChange={handleStagiaireSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un stagiaire..." />
                </SelectTrigger>
                <SelectContent>
                  {stagiaires.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nom} {s.prenom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Ex : Dupont Marie"
                value={formData.nomPrenom}
                onChange={(e) => handleChange('nomPrenom', e.target.value)}
              />
            )}
            {mode === 'list' && formData.nomPrenom && (
              <p className="text-sm text-muted-foreground">Sélectionné : <span className="font-medium text-foreground">{formData.nomPrenom}</span></p>
            )}
          </div>

          {/* Formation */}
          <div className="space-y-2">
            <Label htmlFor="nomFormation">Nom de la formation *</Label>
            <Input id="nomFormation" placeholder="Ex : Loi ALUR - Immobilier" value={formData.nomFormation} onChange={(e) => handleChange('nomFormation', e.target.value)} />
          </div>

          {/* Nature */}
          <div className="space-y-2">
            <Label htmlFor="natureAction">Nature de l'action de formation</Label>
            <Input id="natureAction" value={formData.natureAction} onChange={(e) => handleChange('natureAction', e.target.value)} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateDebut">Date de début *</Label>
              <Input id="dateDebut" type="date" value={formData.dateDebut} onChange={(e) => handleChange('dateDebut', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFin">Date de fin <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input id="dateFin" type="date" value={formData.dateFin} onChange={(e) => handleChange('dateFin', e.target.value)} />
            </div>
          </div>

          {/* Durée */}
          <div className="space-y-2">
            <Label htmlFor="duree">Durée *</Label>
            <Input id="duree" placeholder="Ex : 14 heures" value={formData.duree} onChange={(e) => handleChange('duree', e.target.value)} />
          </div>

          {/* Fait à / Le */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="faitA">Fait à</Label>
              <Input id="faitA" value={formData.faitA} onChange={(e) => handleChange('faitA', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leDateDu">Le</Label>
              <Input id="leDateDu" type="date" value={formData.leDateDu} onChange={(e) => handleChange('leDateDu', e.target.value)} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Générer le PDF
            </Button>
            <Button variant="outline" onClick={handleReset}>Réinitialiser</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
