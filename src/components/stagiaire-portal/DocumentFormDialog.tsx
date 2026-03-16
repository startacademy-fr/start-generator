import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: { id: string; label: string; icon: string };
  token: string;
  stagiaire: { prenom: string; nom: string };
  formation: { titre: string };
  onSubmitted: () => void;
}

const SATISFACTION_QUESTIONS = [
  "Comment évaluez-vous la qualité globale de la formation ?",
  "Le contenu était-il adapté à vos besoins ?",
  "Comment évaluez-vous la pédagogie du formateur ?",
  "Les supports de formation étaient-ils de qualité ?",
  "Recommanderiez-vous cette formation ?",
];

const POSITIONNEMENT_QUESTIONS = [
  "Quel est votre niveau actuel dans le domaine de cette formation ?",
  "Avez-vous déjà suivi une formation similaire ?",
  "Quelles sont vos attentes principales pour cette formation ?",
  "Quels outils ou méthodes utilisez-vous actuellement ?",
  "Quels sont vos objectifs professionnels à court terme ?",
];

export function DocumentFormDialog({
  open,
  onOpenChange,
  docType,
  token,
  stagiaire,
  formation,
  onSubmitted,
}: DocumentFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: Record<string, any>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: 'submit-document',
            token,
            type: docType.id,
            contenu: {
              ...formData,
              stagiaire: { prenom: stagiaire.prenom, nom: stagiaire.nom },
              formation: { titre: formation.titre },
              submitted_at: new Date().toISOString(),
            },
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la soumission');
      }

      toast.success('Document soumis avec succès !');
      onSubmitted();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la soumission');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{docType.icon}</span>
            {docType.label}
          </DialogTitle>
          <DialogDescription>
            {formation.titre} — {stagiaire.prenom} {stagiaire.nom}
          </DialogDescription>
        </DialogHeader>
        {docType.id === 'questionnaire_positionnement' && (
          <PositionnementForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        )}
        {docType.id === 'analyse_besoin' && (
          <AnalyseBesoinForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        )}
        {docType.id === 'qcm' && (
          <QCMFormSimple onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        )}
        {(docType.id === 'satisfaction_chaud' || docType.id === 'satisfaction_froid') && (
          <SatisfactionForm 
            onSubmit={handleSubmit} 
            isSubmitting={isSubmitting}
            isFroid={docType.id === 'satisfaction_froid'}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PositionnementForm({ onSubmit, isSubmitting }: { onSubmit: (data: any) => void; isSubmitting: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ type: 'questionnaire_positionnement', reponses: answers }); }} className="space-y-4">
      {POSITIONNEMENT_QUESTIONS.map((q, i) => (
        <div key={i} className="space-y-2">
          <Label className="text-sm font-medium">{i + 1}. {q}</Label>
          <Textarea
            required
            value={answers[`q${i}`] || ''}
            onChange={(e) => setAnswers(prev => ({ ...prev, [`q${i}`]: e.target.value }))}
            placeholder="Votre réponse..."
            rows={2}
          />
        </div>
      ))}
      <SubmitButton isSubmitting={isSubmitting} />
    </form>
  );
}

function AnalyseBesoinForm({ onSubmit, isSubmitting }: { onSubmit: (data: any) => void; isSubmitting: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = [
    "Décrivez votre poste actuel et vos missions principales",
    "Quelles difficultés rencontrez-vous dans votre activité ?",
    "Quelles compétences souhaitez-vous développer ?",
    "Comment pensez-vous appliquer ces nouvelles compétences ?",
    "Avez-vous des contraintes ou besoins spécifiques ?",
  ];

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ type: 'analyse_besoin', reponses: answers }); }} className="space-y-4">
      {questions.map((q, i) => (
        <div key={i} className="space-y-2">
          <Label className="text-sm font-medium">{i + 1}. {q}</Label>
          <Textarea
            required
            value={answers[`q${i}`] || ''}
            onChange={(e) => setAnswers(prev => ({ ...prev, [`q${i}`]: e.target.value }))}
            placeholder="Votre réponse..."
            rows={2}
          />
        </div>
      ))}
      <SubmitButton isSubmitting={isSubmitting} />
    </form>
  );
}

function QCMFormSimple({ onSubmit, isSubmitting }: { onSubmit: (data: any) => void; isSubmitting: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = [
    { q: "Comment évaluez-vous votre niveau de compréhension des concepts abordés ?", options: ["Très bien", "Bien", "Moyen", "Insuffisant"] },
    { q: "Êtes-vous en mesure d'appliquer les méthodes présentées ?", options: ["Oui, totalement", "Oui, partiellement", "Pas encore", "Non"] },
    { q: "Les exercices pratiques vous ont-ils aidé à mieux comprendre ?", options: ["Beaucoup", "Un peu", "Pas vraiment", "Pas du tout"] },
    { q: "Quel aspect de la formation vous a le plus apporté ?", options: ["La théorie", "La pratique", "Les échanges", "Les supports"] },
    { q: "Vous sentez-vous capable d'utiliser ces connaissances au quotidien ?", options: ["Oui, immédiatement", "Oui, avec de la pratique", "Pas sûr", "Non"] },
  ];

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ type: 'qcm', reponses: answers }); }} className="space-y-5">
      {questions.map((item, i) => (
        <div key={i} className="space-y-2">
          <Label className="text-sm font-medium">{i + 1}. {item.q}</Label>
          <RadioGroup
            value={answers[`q${i}`] || ''}
            onValueChange={(val) => setAnswers(prev => ({ ...prev, [`q${i}`]: val }))}
            required
          >
            {item.options.map((opt, j) => (
              <div key={j} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`q${i}_${j}`} />
                <Label htmlFor={`q${i}_${j}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      ))}
      <SubmitButton isSubmitting={isSubmitting} />
    </form>
  );
}

function SatisfactionForm({ onSubmit, isSubmitting, isFroid }: { onSubmit: (data: any) => void; isSubmitting: boolean; isFroid: boolean }) {
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const scaleOptions = ["1 - Pas du tout satisfait", "2 - Peu satisfait", "3 - Moyennement satisfait", "4 - Satisfait", "5 - Très satisfait"];

  return (
    <form onSubmit={(e) => { 
      e.preventDefault(); 
      onSubmit({ 
        type: isFroid ? 'satisfaction_froid' : 'satisfaction_chaud', 
        notes: ratings, 
        commentaire: comment,
        score: Math.round(Object.values(ratings).reduce((sum, v) => sum + parseInt(v.charAt(0)), 0) / Object.keys(ratings).length * 20),
      }); 
    }} className="space-y-5">
      {SATISFACTION_QUESTIONS.map((q, i) => (
        <div key={i} className="space-y-2">
          <Label className="text-sm font-medium">{i + 1}. {q}</Label>
          <RadioGroup
            value={ratings[`q${i}`] || ''}
            onValueChange={(val) => setRatings(prev => ({ ...prev, [`q${i}`]: val }))}
            required
          >
            {scaleOptions.map((opt, j) => (
              <div key={j} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`sat_${i}_${j}`} />
                <Label htmlFor={`sat_${i}_${j}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      ))}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Commentaire libre</Label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={isFroid ? "Avec le recul, qu'avez-vous retenu de cette formation ?" : "Vos remarques et suggestions..."}
          rows={3}
        />
      </div>
      <SubmitButton isSubmitting={isSubmitting} />
    </form>
  );
}

function SubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={isSubmitting}>
      {isSubmitting ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi en cours...</>
      ) : (
        <><Send className="mr-2 h-4 w-4" /> Soumettre</>
      )}
    </Button>
  );
}
