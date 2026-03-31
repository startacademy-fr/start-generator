import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Loader2, UserSearch, PenLine, Users, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateCertificatPDF } from '@/lib/certificat-generator';
import { supabase } from '@/integrations/supabase/client';
import { StagiaireMultiSelect } from '@/components/StagiaireMultiSelect';
import type { Stagiaire } from '@/types/database';
import JSZip from 'jszip';

interface CertificatFormData {
  nomPrenom: string;
  civilite: string;
  nomFormation: string;
  natureAction: string;
  dateDebut: string;
  dateFin: string;
  duree: string;
  faitA: string;
  leDateDu: string;
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
  civilite: '',
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
  const [stagiaires, setStagiaires] = useState<Stagiaire[]>([]);
  const [formations, setFormations] = useState<FormationOption[]>([]);
  const [stagiaireFormationIds, setStagiaireFormationIds] = useState<Set<string>>(new Set());
  const [selectedStagiaireId, setSelectedStagiaireId] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'manual'>('list');
  const [formationMode, setFormationMode] = useState<'list' | 'manual'>('list');
  // Multi-select
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('single');
  const [selectedStagiaireIds, setSelectedStagiaireIds] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: stagData }, { data: formData }] = await Promise.all([
        supabase.from('stagiaires').select('*').order('nom').limit(10000),
        supabase.from('formations').select('id, titre, nombre_heures, date_debut, date_fin').order('date_debut', { ascending: false }).limit(10000),
      ]);
      if (stagData) setStagiaires(stagData as Stagiaire[]);
      if (formData) setFormations(formData);
    };
    fetchData();
  }, []);

  const handleChange = (field: keyof CertificatFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStagiaireSelect = async (stagiaireId: string) => {
    const s = stagiaires.find((st) => st.id === stagiaireId);
    if (s) {
      handleChange('nomPrenom', `${s.nom} ${s.prenom}`);
      handleChange('civilite', s.civilite || '');
      setSelectedStagiaireId(stagiaireId);
      const { data: inscriptions } = await supabase
        .from('inscriptions')
        .select('formation_id')
        .eq('stagiaire_id', stagiaireId);
      if (inscriptions) {
        setStagiaireFormationIds(new Set(inscriptions.map((i) => i.formation_id)));
      }
    }
  };

  const handleFormationSelect = (formationId: string) => {
    const f = formations.find((fo) => fo.id === formationId);
    if (f) {
      handleChange('nomFormation', f.titre);
      handleChange('duree', String(f.nombre_heures));
      handleChange('dateDebut', f.date_debut);
      handleChange('dateFin', f.date_fin || '');
    }
  };

  const handleGenerate = async () => {
    if (selectionMode === 'multi') {
      await handleGenerateMulti();
    } else {
      await handleGenerateSingle();
    }
  };

  const handleGenerateSingle = async () => {
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

  const handleGenerateMulti = async () => {
    if (selectedStagiaireIds.length === 0) {
      toast({ title: 'Aucun stagiaire sélectionné', description: 'Veuillez sélectionner au moins un stagiaire.', variant: 'destructive' });
      return;
    }
    if (!formData.nomFormation || !formData.dateDebut || !formData.duree) {
      toast({ title: 'Champs requis manquants', description: 'Veuillez renseigner la formation, les dates et la durée.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const selectedStagiaires = stagiaires.filter(s => selectedStagiaireIds.includes(s.id));

      if (selectedStagiaires.length === 1) {
        // Single PDF download
        const s = selectedStagiaires[0];
        const doc = await generateCertificatPDF({
          ...formData,
          nomPrenom: `${s.nom} ${s.prenom}`,
          civilite: s.civilite || '',
        });
        doc.save(`Certificat_Realisation_${s.nom}_${s.prenom}.pdf`);
        toast({ title: 'Certificat généré', description: 'Le PDF a été téléchargé.' });
      } else {
        // ZIP download
        const zip = new JSZip();
        for (const s of selectedStagiaires) {
          const doc = await generateCertificatPDF({
            ...formData,
            nomPrenom: `${s.nom} ${s.prenom}`,
            civilite: s.civilite || '',
          });
          const pdfBlob = doc.output('blob');
          zip.file(`Certificat_${s.nom}_${s.prenom}.pdf`, pdfBlob);
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificats_Realisation_${selectedStagiaires.length}_stagiaires.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Certificats générés', description: `${selectedStagiaires.length} certificats téléchargés en ZIP.` });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Erreur', description: 'Impossible de générer les certificats.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setFormData(defaultFormData);
    setMode('list');
    setFormationMode('list');
    setSelectedStagiaireId(null);
    setStagiaireFormationIds(new Set());
    setSelectedStagiaireIds([]);
  };

  const canGenerate = selectionMode === 'multi'
    ? selectedStagiaireIds.length > 0 && formData.nomFormation && formData.dateDebut && formData.duree
    : true;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Certificat de réalisation</h1>
        <p className="text-muted-foreground mt-1">Générez un certificat de réalisation pour un ou plusieurs stagiaires.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Informations du certificat</CardTitle>
              <CardDescription>Renseignez les informations puis cliquez sur Générer.</CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg border p-0.5">
              <Button
                type="button"
                variant={selectionMode === 'single' ? 'default' : 'ghost'}
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => {
                  setSelectionMode('single');
                  setSelectedStagiaireIds([]);
                }}
              >
                <User className="h-3.5 w-3.5" />
                Un stagiaire
              </Button>
              <Button
                type="button"
                variant={selectionMode === 'multi' ? 'default' : 'ghost'}
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => {
                  setSelectionMode('multi');
                  handleChange('nomPrenom', '');
                  setSelectedStagiaireId(null);
                }}
              >
                <Users className="h-3.5 w-3.5" />
                Plusieurs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Stagiaire selection */}
          {selectionMode === 'single' ? (
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
          ) : (
            <div className="space-y-2">
              <Label>Stagiaires sélectionnés * ({selectedStagiaireIds.length})</Label>
              <StagiaireMultiSelect
                stagiaires={stagiaires}
                selectedIds={selectedStagiaireIds}
                onChange={setSelectedStagiaireIds}
              />
            </div>
          )}

          {/* Formation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Nom de la formation *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => {
                  setFormationMode(formationMode === 'list' ? 'manual' : 'list');
                  handleChange('nomFormation', '');
                }}
              >
                {formationMode === 'list' ? <PenLine className="h-3.5 w-3.5" /> : <UserSearch className="h-3.5 w-3.5" />}
                {formationMode === 'list' ? 'Saisie libre' : 'Choisir dans la liste'}
              </Button>
            </div>
            {formationMode === 'list' ? (
              <Select onValueChange={handleFormationSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une formation..." />
                </SelectTrigger>
                <SelectContent>
                  {selectionMode === 'single' && selectedStagiaireId && stagiaireFormationIds.size > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Formations du stagiaire</div>
                      {formations.filter((f) => stagiaireFormationIds.has(f.id)).map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.titre}
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1">Autres formations</div>
                    </>
                  )}
                  {formations.filter((f) => !(selectionMode === 'single' && selectedStagiaireId && stagiaireFormationIds.has(f.id))).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.titre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Ex : Loi ALUR - Immobilier"
                value={formData.nomFormation}
                onChange={(e) => handleChange('nomFormation', e.target.value)}
              />
            )}
            {formationMode === 'list' && formData.nomFormation && (
              <p className="text-sm text-muted-foreground">Sélectionnée : <span className="font-medium text-foreground">{formData.nomFormation}</span></p>
            )}
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
            <Button onClick={handleGenerate} disabled={generating || !canGenerate} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {selectionMode === 'multi' && selectedStagiaireIds.length > 1
                ? `Générer ${selectedStagiaireIds.length} certificats (ZIP)`
                : 'Générer le PDF'}
            </Button>
            <Button variant="outline" onClick={handleReset}>Réinitialiser</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
