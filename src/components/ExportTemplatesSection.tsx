import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadPDF } from '@/lib/pdf-generator';

const TEMPLATE_TYPES = [
  { id: 'questionnaire_positionnement', label: 'Questionnaire de positionnement' },
  { id: 'analyse_besoin', label: 'Analyse du besoin' },
  { id: 'qcm', label: 'QCM d\'évaluation' },
  { id: 'satisfaction_chaud', label: 'Satisfaction à chaud' },
  { id: 'satisfaction_froid', label: 'Satisfaction à froid' },
  { id: 'deroule_pedagogique', label: 'Déroulé pédagogique' },
  { id: 'grille_observation', label: 'Grille d\'observation' },
];

const BLANK_DATA = {
  stagiaire: { prenom: '_______________', nom: '_______________', email: '', entreprise: '_______________', fonction: '_______________' },
  formation: { titre: '_______________________________________________', lieu: '_______________', date_debut: new Date().toISOString().slice(0, 10), nombre_heures: 0 },
};

const BLANK_CONTENTS: Record<string, any> = {
  questionnaire_positionnement: {
    competences: [
      { label: 'Compétence 1', avant: 0, apres: 0 },
      { label: 'Compétence 2', avant: 0, apres: 0 },
      { label: 'Compétence 3', avant: 0, apres: 0 },
      { label: 'Compétence 4', avant: 0, apres: 0 },
      { label: 'Compétence 5', avant: 0, apres: 0 },
    ],
    objectifs_formation: '',
    demande_specifique: '',
    prerequis: '',
  },
  analyse_besoin: {
    contexte_professionnel: '',
    objectifs: ['', '', ''],
    attentes: ['', '', ''],
    competences_visees: ['', '', ''],
    freins_identifies: [],
    motivation: '',
  },
  qcm: {
    questions: [
      { question: 'Question 1', options: ['A)', 'B)', 'C)', 'D)'], correct: 0, selected: -1 },
      { question: 'Question 2', options: ['A)', 'B)', 'C)', 'D)'], correct: 0, selected: -1 },
      { question: 'Question 3', options: ['A)', 'B)', 'C)', 'D)'], correct: 0, selected: -1 },
    ],
  },
  satisfaction_chaud: { questions: [], commentaires: '' },
  satisfaction_froid: { questions: [], commentaires: '' },
  deroule_pedagogique: { sequences: [] },
  grille_observation: {
    competences: [
      { label: 'Compétence 1', note: '', commentaire: '', amelioration: '' },
      { label: 'Compétence 2', note: '', commentaire: '', amelioration: '' },
      { label: 'Compétence 3', note: '', commentaire: '', amelioration: '' },
    ],
  },
};

export function ExportTemplatesSection() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = async (typeId: string, label: string) => {
    setDownloading(typeId);
    try {
      await downloadPDF(
        {
          type: typeId,
          ...BLANK_DATA,
          formation: { ...BLANK_DATA.formation, nombre_heures: 0 },
          contenu: BLANK_CONTENTS[typeId] || {},
        },
        `template_vierge_${typeId}.pdf`
      );
      toast.success(`Template "${label}" téléchargé`);
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Exporter les templates vierges
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TEMPLATE_TYPES.map(({ id, label }) => (
            <Button
              key={id}
              variant="outline"
              size="sm"
              className="justify-start h-auto py-2 text-left"
              disabled={downloading === id}
              onClick={() => handleExport(id, label)}
            >
              {downloading === id ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin shrink-0" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-2 shrink-0" />
              )}
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
