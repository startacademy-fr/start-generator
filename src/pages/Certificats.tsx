import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateCertificatPDF } from '@/lib/certificat-generator';

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
  const { toast } = useToast();

  const handleChange = (field: keyof CertificatFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.nomPrenom || !formData.nomFormation || !formData.dateDebut || !formData.dateFin || !formData.duree) {
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

  const handleReset = () => setFormData(defaultFormData);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Certificat de réalisation</h1>
        <p className="text-muted-foreground mt-1">Générez un certificat de réalisation à partir de champs libres.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Informations du certificat</CardTitle>
          <CardDescription>Renseignez les informations puis cliquez sur Générer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Nom & Prénom */}
          <div className="space-y-2">
            <Label htmlFor="nomPrenom">Nom et Prénom du stagiaire *</Label>
            <Input id="nomPrenom" placeholder="Ex : Dupont Marie" value={formData.nomPrenom} onChange={(e) => handleChange('nomPrenom', e.target.value)} />
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
              <Label htmlFor="dateFin">Date de fin *</Label>
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
