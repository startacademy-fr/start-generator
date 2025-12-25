import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DocumentData {
  type: string;
  stagiaire: {
    prenom: string;
    nom: string;
    email: string;
    entreprise?: string;
    fonction?: string;
  };
  formation: {
    titre: string;
    lieu: string;
    date_debut: string;
    date_fin?: string | null;
    nombre_heures: number;
    formateur?: string;
  };
  contenu: any;
  score?: number | null;
  date_soumission?: string | null;
}

const DOCUMENT_LABELS: Record<string, string> = {
  positionnement: 'Questionnaire de positionnement',
  analyse_besoin: 'Analyse du besoin',
  qcm: 'QCM d\'évaluation',
  satisfaction_chaud: 'Évaluation de satisfaction à chaud',
  satisfaction_froid: 'Évaluation de satisfaction à froid',
  deroule_pedagogique: 'Déroulé pédagogique',
  grille_observation: 'Grille d\'observation et d\'amélioration',
};

const PRIMARY_COLOR: [number, number, number] = [14, 116, 144]; // teal-600
const TEXT_COLOR: [number, number, number] = [30, 41, 59]; // slate-800
const MUTED_COLOR: [number, number, number] = [100, 116, 139]; // slate-500

export function generatePDF(data: DocumentData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 30;

  // Header with logo placeholder
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('START ACADEMY', margin, 16);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Organisme de formation', pageWidth - margin, 16, { align: 'right' });

  // Document title
  yPos = 45;
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(DOCUMENT_LABELS[data.type] || data.type, margin, yPos);

  // Horizontal line
  yPos += 5;
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  // Formation info box
  yPos += 10;
  doc.setFillColor(240, 249, 255); // light blue
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 35, 3, 3, 'F');
  
  yPos += 8;
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Formation:', margin + 5, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.formation.titre, margin + 35, yPos);

  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Date(s):', margin + 5, yPos);
  doc.setFont('helvetica', 'normal');
  const dateText = data.formation.date_fin 
    ? `Du ${format(new Date(data.formation.date_debut), 'dd/MM/yyyy', { locale: fr })} au ${format(new Date(data.formation.date_fin), 'dd/MM/yyyy', { locale: fr })}`
    : format(new Date(data.formation.date_debut), 'dd MMMM yyyy', { locale: fr });
  doc.text(dateText, margin + 35, yPos);

  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Lieu:', margin + 5, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.formation.lieu, margin + 35, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Durée:', margin + 100, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.formation.nombre_heures} heures`, margin + 120, yPos);

  // Stagiaire info
  yPos += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Stagiaire', margin, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.stagiaire.prenom} ${data.stagiaire.nom}`, margin, yPos);
  
  if (data.stagiaire.entreprise) {
    yPos += 6;
    doc.setTextColor(...MUTED_COLOR);
    doc.text(`${data.stagiaire.entreprise}${data.stagiaire.fonction ? ' - ' + data.stagiaire.fonction : ''}`, margin, yPos);
  }

  // Document content based on type
  yPos += 15;
  doc.setTextColor(...TEXT_COLOR);
  
  switch (data.type) {
    case 'positionnement':
      yPos = renderPositionnement(doc, yPos, margin, data.contenu);
      break;
    case 'analyse_besoin':
      yPos = renderAnalyseBesoin(doc, yPos, margin, data.contenu);
      break;
    case 'qcm':
      yPos = renderQCM(doc, yPos, margin, data.contenu, data.score);
      break;
    case 'satisfaction_chaud':
    case 'satisfaction_froid':
      yPos = renderSatisfaction(doc, yPos, margin, data.contenu, data.type);
      break;
    case 'deroule_pedagogique':
      yPos = renderDeroulePedagogique(doc, yPos, margin, pageWidth, data.contenu);
      break;
    case 'grille_observation':
      yPos = renderGrilleObservation(doc, yPos, margin, data.contenu);
      break;
    default:
      doc.setFontSize(10);
      doc.text('Contenu du document', margin, yPos);
  }

  // Submission info
  if (data.date_soumission) {
    yPos += 15;
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(
      `Document soumis le ${format(new Date(data.date_soumission), 'dd/MM/yyyy à HH:mm', { locale: fr })}`,
      margin,
      yPos
    );
  }

  // Footer
  addFooter(doc, pageWidth, pageHeight);

  return doc;
}

function renderPositionnement(doc: jsPDF, yPos: number, margin: number, contenu: any): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Auto-évaluation initiale', margin, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  if (contenu?.reponses) {
    doc.text(`Niveau actuel déclaré: ${contenu.reponses.niveau_actuel || 'Non renseigné'}`, margin, yPos);
    yPos += 7;
    doc.text(`Expérience antérieure: ${contenu.reponses.experience_anterieure || 'Non renseigné'}`, margin, yPos);
    yPos += 7;
    doc.text(`Objectifs personnels: ${contenu.reponses.objectifs_personnels || 'Non renseigné'}`, margin, yPos);
  }
  
  return yPos;
}

function renderAnalyseBesoin(doc: jsPDF, yPos: number, margin: number, contenu: any): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Objectifs de formation', margin, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  if (contenu?.objectifs) {
    contenu.objectifs.forEach((obj: string) => {
      doc.text(`• ${obj}`, margin + 5, yPos);
      yPos += 6;
    });
  }
  
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Attentes exprimées', margin, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  
  if (contenu?.attentes) {
    contenu.attentes.forEach((att: string) => {
      doc.text(`• ${att}`, margin + 5, yPos);
      yPos += 6;
    });
  }
  
  return yPos;
}

function renderQCM(doc: jsPDF, yPos: number, margin: number, contenu: any, score?: number | null): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Résultats du QCM', margin, yPos);
  
  yPos += 10;
  
  // Score box
  if (score !== null && score !== undefined) {
    const scoreColor: [number, number, number] = score >= 80 ? [22, 163, 74] : [220, 38, 38]; // green or red
    doc.setFillColor(...scoreColor);
    doc.roundedRect(margin, yPos - 5, 60, 20, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`Score: ${score}%`, margin + 10, yPos + 7);
    doc.setTextColor(...TEXT_COLOR);
    yPos += 20;
  }
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (contenu?.questions) {
    contenu.questions.forEach((q: any) => {
      const icon = q.correct ? '✓' : '✗';
      doc.text(`${icon} Question ${q.numero}: Réponse ${q.reponse}`, margin, yPos);
      yPos += 6;
    });
  }
  
  return yPos;
}

function renderSatisfaction(doc: jsPDF, yPos: number, margin: number, contenu: any, type: string): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(type === 'satisfaction_chaud' ? 'Évaluation immédiate' : 'Évaluation différée (1-3 mois après)', margin, yPos);
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const labels: Record<string, string> = {
    organisation: 'Organisation générale',
    contenu: 'Contenu de la formation',
    formateur: 'Qualité du formateur',
    supports: 'Supports pédagogiques',
    global: 'Satisfaction globale',
  };
  
  if (contenu?.evaluations) {
    Object.entries(contenu.evaluations).forEach(([key, value]) => {
      const label = labels[key] || key;
      const stars = '★'.repeat(value as number) + '☆'.repeat(5 - (value as number));
      doc.text(`${label}: ${stars} (${value}/5)`, margin, yPos);
      yPos += 7;
    });
  }
  
  if (contenu?.commentaires) {
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Commentaires:', margin, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`"${contenu.commentaires}"`, margin, yPos);
  }
  
  return yPos;
}

function renderDeroulePedagogique(doc: jsPDF, yPos: number, margin: number, pageWidth: number, contenu: any): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Déroulé des séquences', margin, yPos);
  
  yPos += 10;
  doc.setFontSize(10);
  
  if (contenu?.sequences) {
    contenu.sequences.forEach((seq: any) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`Jour ${seq.jour} (${seq.duree}h)`, margin, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.text(`Contenu: ${seq.contenu}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`Objectifs: ${seq.objectifs}`, margin + 5, yPos);
      yPos += 10;
    });
  }
  
  return yPos;
}

function renderGrilleObservation(doc: jsPDF, yPos: number, margin: number, contenu: any): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Observations du formateur', margin, yPos);
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (contenu?.observations) {
    const obs = contenu.observations;
    doc.text(`Participation: ${obs.participation || 'Non évaluée'}`, margin, yPos);
    yPos += 7;
    doc.text(`Compréhension: ${obs.comprehension || 'Non évaluée'}`, margin, yPos);
    yPos += 7;
    doc.text(`Application: ${obs.application || 'Non évaluée'}`, margin, yPos);
    yPos += 7;
    doc.text(`Axes d'amélioration: ${obs.axes_amelioration || 'Aucun'}`, margin, yPos);
  }
  
  return yPos;
}

function addFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const footerY = pageHeight - 20;
  const margin = 20;
  
  // Separator line
  doc.setDrawColor(...MUTED_COLOR);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  // Footer text
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_COLOR);
  doc.setFont('helvetica', 'normal');
  
  doc.text(
    'START ACADEMY – siège social 618 boulevard Jean Maurel inférieur 06140 Vence',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
  doc.text(
    'N° SIRET 95131909400011 – NDA 93 06 10481 06',
    pageWidth / 2,
    footerY + 4,
    { align: 'center' }
  );
  doc.text(
    'Contact : Julien LAFITTE – info@start-academy.fr – 06 22 80 65 09',
    pageWidth / 2,
    footerY + 8,
    { align: 'center' }
  );
  doc.text(
    'Version 01 – vérifié le 02/01/2026',
    pageWidth / 2,
    footerY + 12,
    { align: 'center' }
  );
}

export function downloadPDF(data: DocumentData, filename?: string) {
  const doc = generatePDF(data);
  const name = filename || `${data.type}_${data.stagiaire.nom}_${data.stagiaire.prenom}.pdf`;
  doc.save(name);
}

export function getPDFBlob(data: DocumentData): Blob {
  const doc = generatePDF(data);
  return doc.output('blob');
}
