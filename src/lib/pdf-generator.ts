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
    anciennete?: string;
    diplomes?: string;
    taches_quotidiennes?: string;
  };
  formation: {
    titre: string;
    lieu: string;
    date_debut: string;
    date_fin?: string | null;
    nombre_heures: number;
    formateur?: string;
    programme?: string;
  };
  contenu: any;
  score?: number | null;
  date_soumission?: string | null;
}

const DOCUMENT_LABELS: Record<string, string> = {
  questionnaire_positionnement: 'Questionnaire de positionnement',
  positionnement: 'Questionnaire de positionnement',
  analyse_besoin: 'Analyse du besoin',
  qcm: "QCM d'évaluation",
  satisfaction_chaud: 'Évaluation de satisfaction à chaud',
  satisfaction_froid: 'Évaluation de satisfaction à froid',
  deroule_pedagogique: 'Déroulé pédagogique',
  grille_observation: "Grille d'observation et d'amélioration",
  fiche_emargement: "Fiche d'émargement",
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
  // Toujours afficher la date de fin de formation (ou date de début si pas de date de fin)
  const displayDate = data.formation.date_fin || data.formation.date_debut;
  const dateText = format(new Date(displayDate), 'dd MMMM yyyy', { locale: fr });
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
    case 'questionnaire_positionnement':
    case 'positionnement':
      yPos = renderPositionnement(doc, yPos, margin, pageWidth, data.contenu, data.stagiaire, data.formation);
      break;
    case 'analyse_besoin':
      yPos = renderAnalyseBesoin(doc, yPos, margin, pageWidth, data.contenu);
      break;
    case 'qcm':
      yPos = renderQCM(doc, yPos, margin, data.contenu, data.score);
      break;
    case 'satisfaction_chaud':
      yPos = renderSatisfactionChaud(doc, yPos, margin, pageWidth, data.contenu, data.stagiaire);
      break;
    case 'satisfaction_froid':
      yPos = renderSatisfactionFroid(doc, yPos, margin, pageWidth, data.contenu, data.stagiaire, data.formation);
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

  // Footer
  addFooter(doc, pageWidth, pageHeight);
  addFooter(doc, pageWidth, pageHeight);

  return doc;
}

function renderPositionnement(
  doc: jsPDF, 
  yPos: number, 
  margin: number, 
  pageWidth: number, 
  contenu: any,
  stagiaire: DocumentData['stagiaire'],
  formation: DocumentData['formation']
): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * margin;
  const PRIMARY_BLUE: [number, number, number] = [68, 114, 196];
  const HEADER_BG: [number, number, number] = [68, 114, 196];
  const LIGHT_BG: [number, number, number] = [248, 249, 250];
  const BORDER_COLOR: [number, number, number] = [221, 221, 221];
  
  const checkPageBreak = (neededSpace: number) => {
    if (yPos + neededSpace > pageHeight - 40) {
      doc.addPage();
      addFooter(doc, pageWidth, pageHeight);
      yPos = 30;
    }
  };

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text('Questionnaire de positionnement et auto-évaluation', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 12;

  // Section 1: Profil de l'apprenant
  doc.setFillColor(...HEADER_BG);
  doc.rect(margin, yPos, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PROFIL DE L\'APPRENANT', margin + 5, yPos + 6);
  
  yPos += 12;
  
  // Profile fields in a table-like layout
  const profileFields = [
    { label: 'Nom', value: stagiaire.nom },
    { label: 'Prénom', value: stagiaire.prenom },
    { label: 'Fonction / Ancienneté', value: `${stagiaire.fonction || 'Non renseigné'}${stagiaire.anciennete ? ` / ${stagiaire.anciennete}` : ''}` },
    { label: 'Diplômes', value: stagiaire.diplomes || 'Non renseigné' },
    { label: 'Tâches quotidiennes', value: stagiaire.taches_quotidiennes || 'Non renseigné' },
    { label: 'Date début de formation', value: format(new Date(formation.date_debut), 'dd/MM/yyyy', { locale: fr }) },
    { label: 'Date fin de formation', value: formation.date_fin ? format(new Date(formation.date_fin), 'dd/MM/yyyy', { locale: fr }) : format(new Date(formation.date_debut), 'dd/MM/yyyy', { locale: fr }) },
  ];
  
  const labelWidth = 55;
  const valueWidth = contentWidth - labelWidth;
  
  profileFields.forEach((field) => {
    checkPageBreak(10);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    
    // Label cell
    doc.setFillColor(...LIGHT_BG);
    doc.rect(margin, yPos, labelWidth, 7, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_COLOR);
    doc.text(field.label, margin + 2, yPos + 5);
    
    // Value cell
    doc.setFillColor(255, 255, 255);
    doc.rect(margin + labelWidth, yPos, valueWidth, 7, 'FD');
    doc.setFont('helvetica', 'normal');
    const valueLines = doc.splitTextToSize(field.value || '', valueWidth - 4);
    doc.text(valueLines[0] || '', margin + labelWidth + 2, yPos + 5);
    
    yPos += 7;
  });
  
  yPos += 8;

  // Section 2: Auto-positionnement des acquis
  checkPageBreak(60);
  doc.setFillColor(...HEADER_BG);
  doc.rect(margin, yPos, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTO-POSITIONNEMENT DES ACQUIS', margin + 5, yPos + 6);
  
  yPos += 12;
  
  // Legend
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_COLOR);
  const legend = [
    '1 = Je ne maîtrise pas',
    '2 = Je dois approfondir',
    '3 = Je maîtrise partiellement',
    '4 = Je maîtrise complètement'
  ];
  legend.forEach((item, idx) => {
    doc.text(item, margin + (idx * 45), yPos);
  });
  
  yPos += 8;
  
  // Competencies table header
  const colWidths = {
    competence: contentWidth - 60,
    avant: 30,
    apres: 30
  };
  
  // Header row
  doc.setFillColor(...HEADER_BG);
  doc.rect(margin, yPos, colWidths.competence, 10, 'F');
  doc.rect(margin + colWidths.competence, yPos, colWidths.avant, 10, 'F');
  doc.rect(margin + colWidths.competence + colWidths.avant, yPos, colWidths.apres, 10, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Compétences évaluées', margin + 3, yPos + 7);
  doc.text('Avant', margin + colWidths.competence + colWidths.avant / 2, yPos + 7, { align: 'center' });
  doc.text('Après', margin + colWidths.competence + colWidths.avant + colWidths.apres / 2, yPos + 7, { align: 'center' });
  
  yPos += 10;
  
  // Competencies rows
  const competencies = contenu?.competences || [];
  
  competencies.forEach((comp: { label: string; avant: number; apres: number }, idx: number) => {
    checkPageBreak(12);
    const bgColor: [number, number, number] = idx % 2 === 0 ? [255, 255, 255] : LIGHT_BG;
    
    // Calculate row height based on text
    doc.setFontSize(8);
    const compLines = doc.splitTextToSize(comp.label, colWidths.competence - 6);
    const rowHeight = Math.max(8, compLines.length * 4 + 4);
    
    doc.setFillColor(...bgColor);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, colWidths.competence, rowHeight, 'FD');
    doc.rect(margin + colWidths.competence, yPos, colWidths.avant, rowHeight, 'FD');
    doc.rect(margin + colWidths.competence + colWidths.avant, yPos, colWidths.apres, rowHeight, 'FD');
    
    doc.setTextColor(...TEXT_COLOR);
    doc.setFont('helvetica', 'normal');
    doc.text(compLines, margin + 3, yPos + 5);
    
    // Rating circles for Avant
    const avantX = margin + colWidths.competence + colWidths.avant / 2;
    doc.text(comp.avant.toString(), avantX, yPos + rowHeight / 2 + 2, { align: 'center' });
    
    // Rating circles for Après
    const apresX = margin + colWidths.competence + colWidths.avant + colWidths.apres / 2;
    doc.setTextColor(22, 163, 74); // Green for improvement
    doc.setFont('helvetica', 'bold');
    doc.text(comp.apres.toString(), apresX, yPos + rowHeight / 2 + 2, { align: 'center' });
    
    yPos += rowHeight;
  });
  
  yPos += 10;
  
  // Section 3: Commentaires et objectifs
  if (contenu?.commentaires || contenu?.objectifs_personnels) {
    checkPageBreak(40);
    doc.setFillColor(...HEADER_BG);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('COMMENTAIRES ET OBJECTIFS', margin + 5, yPos + 6);
    
    yPos += 12;
    
    if (contenu.objectifs_personnels) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY_BLUE);
      doc.text('Objectifs personnels :', margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_COLOR);
      const objLines = doc.splitTextToSize(contenu.objectifs_personnels, contentWidth);
      doc.text(objLines, margin, yPos);
      yPos += objLines.length * 4 + 5;
    }
    
    if (contenu.commentaires) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY_BLUE);
      doc.text('Commentaires :', margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_COLOR);
      const comLines = doc.splitTextToSize(contenu.commentaires, contentWidth);
      doc.text(comLines, margin, yPos);
      yPos += comLines.length * 4 + 5;
    }
  }
  
  // Signature section
  yPos += 10;
  checkPageBreak(25);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_COLOR);
  doc.text('Signature du stagiaire :', margin, yPos);
  doc.text('Date :', margin + 100, yPos);
  
  yPos += 5;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos, 80, 15);
  doc.rect(margin + 100, yPos, 50, 15);
  
  // Pre-fill date with formation end date
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const signatureDate = formation.date_fin 
    ? format(new Date(formation.date_fin), 'dd/MM/yyyy', { locale: fr })
    : format(new Date(formation.date_debut), 'dd/MM/yyyy', { locale: fr });
  doc.text(signatureDate, margin + 105, yPos + 10);

  return yPos + 25;
}

function renderAnalyseBesoin(doc: jsPDF, yPos: number, margin: number, pageWidth: number, contenu: any): number {
  const contentWidth = pageWidth - 2 * margin;
  const PRIMARY_BLUE: [number, number, number] = [68, 114, 196];
  
  // Objectifs de formation section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text('Objectifs de formation', margin, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(10);
  
  if (contenu?.objectifs && Array.isArray(contenu.objectifs)) {
    contenu.objectifs.forEach((obj: string) => {
      const lines = doc.splitTextToSize(`• ${obj}`, contentWidth - 10);
      doc.text(lines, margin + 5, yPos);
      yPos += lines.length * 5 + 2;
    });
  }
  
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text('Attentes exprimées', margin, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_COLOR);
  
  if (contenu?.attentes && Array.isArray(contenu.attentes)) {
    contenu.attentes.forEach((att: string) => {
      const lines = doc.splitTextToSize(`• ${att}`, contentWidth - 10);
      doc.text(lines, margin + 5, yPos);
      yPos += lines.length * 5 + 2;
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

function renderSatisfactionChaud(
  doc: jsPDF, 
  yPos: number, 
  margin: number, 
  pageWidth: number, 
  contenu: any,
  stagiaire: { prenom: string; nom: string; email: string; entreprise?: string; fonction?: string }
): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * margin;
  const PRIMARY_BLUE: [number, number, number] = [68, 114, 196];
  const SECTION_BG: [number, number, number] = [248, 249, 250];
  
  // Helper function to check and add page if needed
  const checkPageBreak = (neededSpace: number) => {
    if (yPos + neededSpace > pageHeight - 40) {
      doc.addPage();
      addFooter(doc, pageWidth, pageHeight);
      yPos = 30;
    }
  };

  // Helper to draw rating with selection
  const drawRatingRow = (label: string, selectedValue: string, y: number): number => {
    const ratings = ['Très bien', 'Bien', 'Moyen', 'Mauvais'];
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_COLOR);
    doc.text(label, margin + 5, y);
    
    let xPos = margin + contentWidth * 0.5;
    const optionWidth = contentWidth * 0.12;
    
    ratings.forEach((rating) => {
      const isSelected = selectedValue === rating;
      
      if (isSelected) {
        doc.setFillColor(...PRIMARY_BLUE);
        doc.circle(xPos, y - 2, 3, 'F');
      } else {
        doc.setDrawColor(...PRIMARY_BLUE);
        doc.setLineWidth(0.3);
        doc.circle(xPos, y - 2, 3);
      }
      
      doc.setFontSize(7);
      doc.setTextColor(...MUTED_COLOR);
      doc.text(rating, xPos + 5, y);
      xPos += optionWidth;
    });
    
    return y + 8;
  };

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text('Questionnaire de satisfaction formation', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_COLOR);
  doc.text('Ce questionnaire de satisfaction nous permet de nous améliorer.', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text('Merci pour votre contribution.', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 12;

  // Questions 1 & 2 (text responses)
  if (contenu?.questions_initiales) {
    checkPageBreak(30);
    doc.setFillColor(...SECTION_BG);
    doc.rect(margin, yPos, contentWidth, 12, 'F');
    doc.setDrawColor(...PRIMARY_BLUE);
    doc.setLineWidth(0.8);
    doc.line(margin, yPos, margin, yPos + 12);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY_BLUE);
    doc.text('1) Comment avez-vous connu cette formation ?', margin + 5, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_COLOR);
    doc.text(contenu.questions_initiales.connaissance || '', margin + 5, yPos + 10);
    yPos += 15;
    
    doc.setFillColor(...SECTION_BG);
    doc.rect(margin, yPos, contentWidth, 12, 'F');
    doc.setDrawColor(...PRIMARY_BLUE);
    doc.line(margin, yPos, margin, yPos + 12);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY_BLUE);
    doc.text("2) Qui a pris l'initiative de vous inscrire ?", margin + 5, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_COLOR);
    doc.text(contenu.questions_initiales.initiative || '', margin + 5, yPos + 10);
    yPos += 18;
  }

  // Section rendering helper with dynamic height calculation
  const renderSection = (title: string, items: { label: string; value: string }[], comment?: string) => {
    // Calculate dynamic height based on content
    const titleHeight = 12;
    const itemHeight = 8;
    const itemsHeight = items.length * itemHeight;
    
    // Calculate comment height with text wrapping
    let commentHeight = 0;
    let commentLines: string[] = [];
    if (comment) {
      doc.setFontSize(8);
      commentLines = doc.splitTextToSize(`"${comment}"`, contentWidth - 20);
      commentHeight = 10 + commentLines.length * 4;
    }
    
    const totalHeight = titleHeight + itemsHeight + commentHeight + 8;
    checkPageBreak(totalHeight);
    
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(221, 221, 221);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, contentWidth, totalHeight, 3, 3);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY_BLUE);
    doc.text(title, margin + 8, yPos + 8);
    
    yPos += titleHeight;
    items.forEach((item) => {
      yPos = drawRatingRow(item.label, item.value, yPos);
    });
    
    if (comment && commentLines.length > 0) {
      yPos += 2;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY_BLUE);
      doc.text('Commentaire :', margin + 8, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...TEXT_COLOR);
      doc.text(commentLines, margin + 8, yPos);
      yPos += commentLines.length * 4;
    }
    
    yPos += 8;
  };

  // a) Organisation
  if (contenu?.organisation) {
    renderSection('a) L\'organisation', [
      { label: 'Communication avant la formation', value: contenu.organisation.communication },
      { label: 'Délai de démarrage', value: contenu.organisation.delai },
      { label: 'Durée de la formation', value: contenu.organisation.duree },
      { label: 'Respect des engagements', value: contenu.organisation.engagements },
    ], contenu.organisation.commentaire);
  }

  // b) Les moyens
  if (contenu?.moyens) {
    renderSection('b) Les moyens', [
      { label: 'Cadre de travail général', value: contenu.moyens.cadre },
      { label: 'Les locaux', value: contenu.moyens.locaux },
      { label: 'Supports mis à disposition', value: contenu.moyens.supports },
      { label: 'Matériel, informatique, connexion', value: contenu.moyens.materiel },
    ], contenu.moyens.commentaire);
  }

  // c) La pédagogie
  if (contenu?.pedagogie) {
    checkPageBreak(100);
    renderSection('c) La pédagogie', [
      { label: 'Niveau de difficulté', value: contenu.pedagogie.difficulte },
      { label: 'Articulation des thèmes', value: contenu.pedagogie.articulation },
      { label: 'Qualité du contenu théorique', value: contenu.pedagogie.theorique },
      { label: 'Qualité du contenu pratique', value: contenu.pedagogie.pratique },
      { label: 'Rythme de progression', value: contenu.pedagogie.rythme },
      { label: 'Approche pédagogique du formateur', value: contenu.pedagogie.approche },
      { label: 'Écoute et disponibilité du formateur', value: contenu.pedagogie.ecoute },
      { label: "Qualité d'animation", value: contenu.pedagogie.animation },
    ], contenu.pedagogie.commentaire);
  }

  // d) Le groupe
  if (contenu?.groupe) {
    renderSection('d) Le groupe', [
      { label: 'Ambiance générale', value: contenu.groupe.ambiance },
      { label: 'Nombre, présence, motivation', value: contenu.groupe.nombre },
      { label: 'Hétérogénéité', value: contenu.groupe.heterogeneite },
      { label: 'Attention et participation', value: contenu.groupe.attention },
    ], contenu.groupe.commentaire);
  }

  // e) Bénéfice retiré
  if (contenu?.benefice) {
    // Calculate dynamic height
    let beneficeCommentLines: string[] = [];
    if (contenu.benefice.commentaire) {
      doc.setFontSize(8);
      beneficeCommentLines = doc.splitTextToSize(`"${contenu.benefice.commentaire}"`, contentWidth - 20);
    }
    const beneficeHeight = 22 + (beneficeCommentLines.length > 0 ? beneficeCommentLines.length * 4 + 6 : 0);
    
    checkPageBreak(beneficeHeight);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(221, 221, 221);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, contentWidth, beneficeHeight, 3, 3);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY_BLUE);
    doc.text('e) Le bénéfice retiré', margin + 8, yPos + 8);
    
    yPos += 12;
    yPos = drawRatingRow('Adéquation de la formation avec vos attentes', contenu.benefice.adequation, yPos);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Utilité de la formation :', margin + 8, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(contenu.benefice.utilite || '', margin + 55, yPos);
    yPos += 6;
    
    if (beneficeCommentLines.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...TEXT_COLOR);
      doc.text(beneficeCommentLines, margin + 8, yPos);
      yPos += beneficeCommentLines.length * 4;
    }
    yPos += 8;
  }

  // Questions finales
  checkPageBreak(40);
  
  if (contenu?.questions_finales) {
    doc.setFillColor(...SECTION_BG);
    doc.rect(margin, yPos, contentWidth, 10, 'F');
    doc.setDrawColor(...PRIMARY_BLUE);
    doc.line(margin, yPos, margin, yPos + 10);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY_BLUE);
    doc.text('4) Recommanderiez-vous cette formation ?', margin + 5, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_COLOR);
    doc.text(contenu.questions_finales.recommandation || 'Oui', margin + 100, yPos + 6);
    yPos += 14;
    
    if (contenu.questions_finales.remarques) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY_BLUE);
      doc.text('5) Autres remarques :', margin + 5, yPos);
      yPos += 4;
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...TEXT_COLOR);
      const lines = doc.splitTextToSize(contenu.questions_finales.remarques, contentWidth - 10);
      doc.text(lines, margin + 5, yPos);
      yPos += lines.length * 3.5 + 5;
    }
    
    if (contenu.questions_finales.autres_themes) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY_BLUE);
      doc.text('6) Autres thèmes souhaités :', margin + 5, yPos);
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_COLOR);
      doc.text(contenu.questions_finales.autres_themes, margin + 5, yPos);
      yPos += 8;
    }
  }

  // Données personnelles
  checkPageBreak(30);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(221, 221, 221);
  doc.roundedRect(margin, yPos, contentWidth, 22, 3, 3);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text('7) Vos données personnelles', margin + 5, yPos + 6);
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(8);
  doc.text(`Nom, Prénom : ${stagiaire.prenom} ${stagiaire.nom}`, margin + 5, yPos);
  doc.text(`Ville : ${contenu?.donnees_personnelles?.ville || 'Vence'}`, margin + 80, yPos);
  yPos += 5;
  doc.text(`E-mail : ${stagiaire.email}`, margin + 5, yPos);
  doc.text(`Date : ${contenu?.donnees_personnelles?.date || format(new Date(), 'dd/MM/yyyy', { locale: fr })}`, margin + 80, yPos);
  
  yPos += 12;

  // Note réclamations
  checkPageBreak(20);
  doc.setFillColor(255, 249, 230);
  doc.setDrawColor(255, 217, 102);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'FD');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_COLOR);
  doc.text('Pour toutes réclamations, envoyez-nous un mail à : info@start-academy.fr', margin + 5, yPos + 7);
  
  yPos += 18;

  // Remerciement
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text('Merci de votre confiance !', pageWidth / 2, yPos, { align: 'center' });

  return yPos + 10;
}

function renderSatisfactionFroid(
  doc: jsPDF, 
  yPos: number, 
  margin: number, 
  pageWidth: number, 
  contenu: any,
  stagiaire: { prenom: string; nom: string; email: string; entreprise?: string; fonction?: string },
  formation: { titre: string; lieu: string; date_debut: string; date_fin?: string | null; nombre_heures: number; formateur?: string }
): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * margin;
  const PRIMARY_BLUE: [number, number, number] = [68, 114, 196];
  const INTRO_BG: [number, number, number] = [240, 246, 255];
  const QUESTION_BORDER: [number, number, number] = [68, 114, 196];
  const SUCCESS_BG: [number, number, number] = [232, 245, 233];
  const SUCCESS_BORDER: [number, number, number] = [76, 175, 80];
  
  const checkPageBreak = (neededSpace: number) => {
    if (yPos + neededSpace > pageHeight - 40) {
      doc.addPage();
      addFooter(doc, pageWidth, pageHeight);
      yPos = 30;
    }
  };

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text('Questionnaire satisfaction à froid entreprise', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 8;
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text('Évaluation à froid', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Votre appréciation sur la formation réalisée', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;

  // Intro box with proper line breaks
  checkPageBreak(38);
  doc.setFillColor(...INTRO_BG);
  doc.setDrawColor(...PRIMARY_BLUE);
  doc.setLineWidth(0.8);
  doc.rect(margin, yPos, contentWidth, 34, 'FD');
  doc.line(margin, yPos, margin, yPos + 34);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_COLOR);
  
  let introY = yPos + 8;
  doc.text("À la fin de chaque formation, nous demandons au participant son évaluation à chaud.", margin + 8, introY);
  introY += 6;
  doc.text("Il nous apparaît tout aussi important de recueillir votre avis sur la mise en pratique après quelques mois.", margin + 8, introY);
  introY += 6;
  doc.text("Nous vous remercions de bien vouloir remplir ce questionnaire lors de l'entretien de suivi.", margin + 8, introY);
  introY += 8;
  doc.setFont('helvetica', 'bold');
  doc.text("Merci de votre aimable collaboration.", margin + 8, introY);
  
  yPos += 38;

  // Info section
  // Utiliser la date de fin de formation
  const displayDate = formation.date_fin || formation.date_debut;

  const infoFields = [
    { label: 'Nom et prénom du stagiaire', value: `${stagiaire.prenom} ${stagiaire.nom}` },
    { label: 'Nom et prénom du N+1', value: contenu?.info?.n_plus_1 || '' },
    { label: 'Intitulé de la formation', value: formation.titre },
    { label: 'Prestataire et formateur', value: `Start Academy - ${formation.formateur || 'Julien Lafitte'}` },
    { label: 'Date de réalisation', value: format(new Date(displayDate), 'dd/MM/yyyy', { locale: fr }) },
    { label: 'Action inscrite au plan de formation', value: contenu?.info?.plan_formation || 'Oui' },
  ];

  // Layout constants (mm)
  const boxPaddingX = 8;
  const boxPaddingY = 8;
  const labelX = margin + boxPaddingX;
  const labelWidth = 70;
  const valueX = labelX + labelWidth + 4;
  const valueWidth = margin + contentWidth - boxPaddingX - valueX;
  const lineHeight = 4.5;
  const rowGap = 2.5;

  // Measure required height (wrap values inside the box)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const measuredRows = infoFields.map((field) => {
    const lines = doc.splitTextToSize(field.value || '', valueWidth);
    const height = Math.max(lineHeight, lines.length * lineHeight);
    return { field, lines, height };
  });
  const infoBoxHeight =
    boxPaddingY +
    measuredRows.reduce((sum, r) => sum + r.height, 0) +
    rowGap * (measuredRows.length - 1) +
    boxPaddingY;

  checkPageBreak(infoBoxHeight + 6);
  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPos, contentWidth, infoBoxHeight, 3, 3, 'FD');

  // Render fields
  let infoY = yPos + boxPaddingY;
  measuredRows.forEach(({ field, lines, height }) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY_BLUE);
    doc.text(`${field.label} :`, labelX, infoY + 1, { maxWidth: labelWidth });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_COLOR);
    lines.forEach((line: string, idx: number) => {
      doc.text(line, valueX, infoY + 1 + idx * lineHeight, { maxWidth: valueWidth });
    });

    infoY += height + rowGap;
  });

  yPos += infoBoxHeight + 10;

  // Question blocks helper with proper height calculation
  const drawQuestionBlock = (question: string, options: string[], selectedOption: string, subQuestions?: { question: string; answer: string }[]) => {
    // Calculate proper height based on content
    const questionLines = doc.splitTextToSize(question, contentWidth - 15);
    const questionHeight = questionLines.length * 4;
    
    let subQuestionsHeight = 0;
    if (subQuestions) {
      subQuestions.forEach((sq) => {
        subQuestionsHeight += 8; // Question title
        const answerLines = doc.splitTextToSize(sq.answer || '', contentWidth - 20);
        subQuestionsHeight += answerLines.length * 4 + 6;
      });
    }
    
    const blockHeight = 12 + questionHeight + (options.length * 7) + subQuestionsHeight + 8;
    checkPageBreak(blockHeight);
    
    doc.setDrawColor(...QUESTION_BORDER);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, yPos, contentWidth, blockHeight, 4, 4);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY_BLUE);
    doc.text(questionLines, margin + 8, yPos + 8);
    
    let optY = yPos + 10 + questionHeight;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    options.forEach((opt) => {
      const isSelected = selectedOption === opt;
      if (isSelected) {
        doc.setFillColor(...PRIMARY_BLUE);
        doc.circle(margin + 12, optY, 2.5, 'F');
      } else {
        doc.setDrawColor(...PRIMARY_BLUE);
        doc.setLineWidth(0.5);
        doc.circle(margin + 12, optY, 2.5);
      }
      doc.setTextColor(...TEXT_COLOR);
      doc.text(opt, margin + 20, optY + 1);
      optY += 7;
    });
    
    if (subQuestions) {
      optY += 2;
      subQuestions.forEach((sq) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PRIMARY_BLUE);
        doc.setFontSize(8);
        doc.text(sq.question, margin + 8, optY);
        optY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...TEXT_COLOR);
        const lines = doc.splitTextToSize(sq.answer || '', contentWidth - 20);
        doc.text(lines, margin + 8, optY);
        optY += lines.length * 4 + 4;
      });
    }
    
    yPos += blockHeight + 6;
  };

  // Question 1: Formation a-t-elle répondu au besoin?
  drawQuestionBlock(
    'La formation choisie a-t-elle répondu à son besoin/ses attentes ?',
    ['Oui tout à fait', 'Oui partiellement', 'Non'],
    contenu?.q1?.reponse || 'Oui tout à fait',
    contenu?.q1?.pourquoi ? [{ question: 'Si oui partiellement ou non, pourquoi ?', answer: contenu.q1.pourquoi }] : undefined
  );

  // Question 2: Initiative (with checkboxes)
  const q2Height = 38;
  checkPageBreak(q2Height);
  doc.setDrawColor(...QUESTION_BORDER);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, yPos, contentWidth, q2Height, 4, 4);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text('Qui était à l\'initiative de cette formation ?', margin + 8, yPos + 8);
  
  const initiatives = ['Vous même', 'Votre collaborateur', 'Vous et votre collaborateur'];
  const selectedInitiatives = contenu?.q2?.initiative || ['Vous et votre collaborateur'];
  
  let initY = yPos + 16;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  initiatives.forEach((init) => {
    const isSelected = selectedInitiatives.includes(init);
    if (isSelected) {
      doc.setFillColor(...PRIMARY_BLUE);
      doc.rect(margin + 10, initY - 3, 4, 4, 'F');
    } else {
      doc.setDrawColor(...PRIMARY_BLUE);
      doc.setLineWidth(0.5);
      doc.rect(margin + 10, initY - 3, 4, 4);
    }
    doc.setTextColor(...TEXT_COLOR);
    doc.text(init, margin + 20, initY);
    initY += 7;
  });
  
  yPos += q2Height + 6;

  // Question 3: Mise en pratique
  const q3Height = 70;
  checkPageBreak(q3Height);
  doc.setDrawColor(...QUESTION_BORDER);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, yPos, contentWidth, q3Height, 4, 4);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text('Depuis la fin de sa formation, a-t-il pu mettre en pratique les connaissances acquises ?', margin + 8, yPos + 8, { maxWidth: contentWidth - 15 });
  
  const pratiqueOptions = ['Oui tout à fait', 'Oui partiellement', 'Non'];
  let pratiqueY = yPos + 16;
  doc.setFontSize(8);
  pratiqueOptions.forEach((opt) => {
    const isSelected = (contenu?.q3?.mise_pratique || 'Oui tout à fait') === opt;
    if (isSelected) {
      doc.setFillColor(...PRIMARY_BLUE);
      doc.circle(margin + 12, pratiqueY, 2.5, 'F');
    } else {
      doc.setDrawColor(...PRIMARY_BLUE);
      doc.setLineWidth(0.5);
      doc.circle(margin + 12, pratiqueY, 2.5);
    }
    doc.setTextColor(...TEXT_COLOR);
    doc.setFont('helvetica', 'normal');
    doc.text(opt, margin + 20, pratiqueY + 1);
    pratiqueY += 7;
  });
  
  pratiqueY += 2;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text('À quelle fréquence ?', margin + 8, pratiqueY);
  pratiqueY += 7;
  
  const frequences = ['Quotidiennement', 'Hebdomadairement', 'Occasionnellement', 'Rarement'];
  frequences.forEach((freq) => {
    const isSelected = (contenu?.q3?.frequence || 'Quotidiennement') === freq;
    if (isSelected) {
      doc.setFillColor(...PRIMARY_BLUE);
      doc.circle(margin + 12, pratiqueY, 2.5, 'F');
    } else {
      doc.setDrawColor(...PRIMARY_BLUE);
      doc.setLineWidth(0.5);
      doc.circle(margin + 12, pratiqueY, 2.5);
    }
    doc.setTextColor(...TEXT_COLOR);
    doc.setFont('helvetica', 'normal');
    doc.text(freq, margin + 20, pratiqueY + 1);
    pratiqueY += 7;
  });
  
  yPos += q3Height + 6;

  // Question 4: Entretien post-formation
  const q4Height = 28;
  checkPageBreak(q4Height);
  doc.setDrawColor(...QUESTION_BORDER);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, yPos, contentWidth, q4Height, 4, 4);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_BLUE);
  doc.text("À l'issue de sa formation, avez-vous eu un entretien avec votre collaborateur ?", margin + 8, yPos + 8, { maxWidth: contentWidth - 15 });
  
  const entretienOptions = ['Oui', 'Non'];
  let entretienY = yPos + 16;
  doc.setFontSize(8);
  entretienOptions.forEach((opt) => {
    const isSelected = (contenu?.q4?.entretien || 'Oui') === opt;
    if (isSelected) {
      doc.setFillColor(...PRIMARY_BLUE);
      doc.circle(margin + 12, entretienY, 2.5, 'F');
    } else {
      doc.setDrawColor(...PRIMARY_BLUE);
      doc.setLineWidth(0.5);
      doc.circle(margin + 12, entretienY, 2.5);
    }
    doc.setTextColor(...TEXT_COLOR);
    doc.setFont('helvetica', 'normal');
    doc.text(opt, margin + 20, entretienY + 1);
    entretienY += 7;
  });
  
  yPos += q4Height + 6;

  // Remarques
  if (contenu?.remarques) {
    const remarquesLines = doc.splitTextToSize(contenu.remarques, contentWidth - 16);
    const remarquesHeight = 16 + remarquesLines.length * 4;
    checkPageBreak(remarquesHeight);
    
    doc.setDrawColor(...QUESTION_BORDER);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, yPos, contentWidth, remarquesHeight, 4, 4);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY_BLUE);
    doc.text('Remarques/observations/libre expression du collaborateur :', margin + 8, yPos + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_COLOR);
    doc.setFontSize(8);
    doc.text(remarquesLines, margin + 8, yPos + 15);
    yPos += remarquesHeight + 6;
  }

  // Thank you box
  checkPageBreak(25);
  doc.setFillColor(...SUCCESS_BG);
  doc.setDrawColor(...SUCCESS_BORDER);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, yPos, contentWidth, 18, 4, 4, 'FD');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(46, 125, 50);
  doc.text('La formation est un investissement important pour votre entreprise.', pageWidth / 2, yPos + 7, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Nous vous remercions d\'avoir répondu à ce questionnaire et restons à votre écoute.', pageWidth / 2, yPos + 13, { align: 'center' });

  return yPos + 25;
}

function renderDeroulePedagogique(doc: jsPDF, yPos: number, margin: number, pageWidth: number, contenu: any): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * margin;
  
  const PRIMARY_BLUE: [number, number, number] = [68, 114, 196]; // #4472C4
  const HEADER_BG: [number, number, number] = [231, 230, 230]; // #E7E6E6
  const INFO_BOX: [number, number, number] = [255, 242, 204]; // #FFF2CC
  const OBS_BOX: [number, number, number] = [222, 235, 247]; // #DEEBF7
  
  const colWidths = [
    contentWidth * 0.10, // Durée
    contentWidth * 0.18, // Objectifs
    contentWidth * 0.22, // Contenu
    contentWidth * 0.18, // Outils
    contentWidth * 0.18, // Exercice
    contentWidth * 0.14, // Évaluation
  ];
  const headers = ['Durée', 'Objectifs', 'Contenu de la séance', 'Outils ou pédagogie', 'Exercice pratique', 'Évaluation'];

  const drawTableHeader = (y: number): number => {
    doc.setFillColor(...PRIMARY_BLUE);
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    let xPos = margin;
    headers.forEach((header, i) => {
      doc.text(header, xPos + 2, y + 7, { maxWidth: colWidths[i] - 4 });
      xPos += colWidths[i];
    });
    return y + 10;
  };

  const drawDayTitle = (y: number, dayTitle: string): number => {
    if (y + 20 > pageHeight - 40) {
      doc.addPage();
      addFooter(doc, pageWidth, pageHeight);
      y = 30;
    }
    doc.setFillColor(...HEADER_BG);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setDrawColor(...PRIMARY_BLUE);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin, y + 8);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(dayTitle, margin + 5, y + 6);
    return y + 12;
  };

  const drawSequenceRow = (y: number, seq: any, index: number): number => {
    const rowHeight = calculateRowHeight(doc, seq, colWidths);
    
    if (y + rowHeight > pageHeight - 40) {
      doc.addPage();
      addFooter(doc, pageWidth, pageHeight);
      y = 30;
      y = drawTableHeader(y);
    }
    
    if (index % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    
    doc.setDrawColor(208, 208, 208);
    doc.setLineWidth(0.2);
    let xPos = margin;
    colWidths.forEach((width) => {
      doc.rect(xPos, y, width, rowHeight);
      xPos += width;
    });
    
    doc.setTextColor(...TEXT_COLOR);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    xPos = margin;
    const cellData = [seq.duree || '', seq.objectifs || '', seq.contenu || '', seq.outils || '', seq.exercice || '', seq.evaluation || ''];
    cellData.forEach((text, i) => {
      if (text) {
        const lines = doc.splitTextToSize(String(text), colWidths[i] - 4);
        doc.text(lines, xPos + 2, y + 5);
      }
      xPos += colWidths[i];
    });
    
    return y + rowHeight;
  };

  // Render each day - check both contenu.jours and contenu.sequences.jours
  const joursData = contenu?.jours || contenu?.sequences?.jours;
  if (joursData && Array.isArray(joursData)) {
    joursData.forEach((jour: any) => {
      yPos = drawDayTitle(yPos, jour.titre || `Jour ${jour.numero}`);
      yPos = drawTableHeader(yPos);
      
      if (jour.sequences && Array.isArray(jour.sequences)) {
        jour.sequences.forEach((seq: any, index: number) => {
          yPos = drawSequenceRow(yPos, seq, index);
        });
      }
      yPos += 8;
    });
  }

  // Formateur info section - check both contenu.formateur_info and contenu.sequences.formateur_info
  const formateurInfo = contenu?.formateur_info || contenu?.sequences?.formateur_info;
  if (formateurInfo) {
    if (yPos + 50 > pageHeight - 40) {
      doc.addPage();
      addFooter(doc, pageWidth, pageHeight);
      yPos = 30;
    }
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Nom, Prénom du formateur : ${formateurInfo.nom || ''}`, margin, yPos);
    yPos += 6;
    doc.text(`Titre du Stage : ${formateurInfo.titre_stage || ''}`, margin, yPos);
    yPos += 6;
    doc.text(`Dates du stage : ${formateurInfo.dates || ''}`, margin, yPos);
    yPos += 10;
  }

  // Adaptations pédagogiques - check both paths
  const adaptations = contenu?.adaptations_pedagogiques || contenu?.sequences?.adaptations_pedagogiques;
  if (adaptations) {
    if (yPos + 40 > pageHeight - 40) {
      doc.addPage();
      addFooter(doc, pageWidth, pageHeight);
      yPos = 30;
    }
    
    doc.setFillColor(...OBS_BOX);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Adaptations pédagogiques/observations de la formation', margin + 3, yPos + 5.5);
    yPos += 8;
    
    doc.setFillColor(...OBS_BOX);
    const adaptLines = doc.splitTextToSize(adaptations, contentWidth - 10);
    const adaptHeight = Math.max(15, adaptLines.length * 4 + 10);
    doc.rect(margin, yPos, contentWidth, adaptHeight, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(adaptLines, margin + 5, yPos + 6);
    yPos += adaptHeight + 10;
  }

  // Questionnaire satisfaction formateur - check both paths
  const satisfactionFormateur = contenu?.satisfaction_formateur || contenu?.sequences?.satisfaction_formateur;
  if (satisfactionFormateur) {
    if (yPos + 30 > pageHeight - 40) {
      doc.addPage();
      addFooter(doc, pageWidth, pageHeight);
      yPos = 30;
    }
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Questionnaire de satisfaction formateur', margin, yPos);
    yPos += 10;
    
    const renderSatisfactionSection = (title: string, questions: any[], remarkKey?: string) => {
      if (yPos + 20 > pageHeight - 40) {
        doc.addPage();
        addFooter(doc, pageWidth, pageHeight);
        yPos = 30;
      }
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, yPos);
      yPos += 8;
      
      questions.forEach((q: any) => {
        if (yPos + 18 > pageHeight - 40) {
          doc.addPage();
          addFooter(doc, pageWidth, pageHeight);
          yPos = 30;
        }
        
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPos, contentWidth, 16, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${q.numero} – ${q.question}`, margin + 3, yPos + 5);
        
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(102, 102, 102);
        doc.text('1- pas du tout  2-Peu adapté  3-Moyennement adapté  4-Adapté  5-tout à fait adapté', margin + 3, yPos + 10);
        
        doc.setTextColor(...PRIMARY_BLUE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(String(q.score), margin + contentWidth - 15, yPos + 10);
        doc.setTextColor(0, 0, 0);
        
        yPos += 18;
      });
      
      if (remarkKey && satisfactionFormateur[remarkKey]) {
        if (yPos + 25 > pageHeight - 40) {
          doc.addPage();
          addFooter(doc, pageWidth, pageHeight);
          yPos = 30;
        }
        
        doc.setFillColor(...INFO_BOX);
        const remarkLines = doc.splitTextToSize(satisfactionFormateur[remarkKey], contentWidth - 10);
        const remarkHeight = Math.max(18, remarkLines.length * 4 + 12);
        doc.rect(margin, yPos, contentWidth, remarkHeight, 'F');
        doc.setDrawColor(214, 182, 86);
        doc.setLineWidth(0.5);
        doc.rect(margin, yPos, contentWidth, remarkHeight);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(remarkKey === 'remarques_groupe' ? 'Vos remarques particulières sur le groupe :' : 'Bilan de la formation :', margin + 3, yPos + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(remarkLines, margin + 3, yPos + 12);
        yPos += remarkHeight + 8;
      }
    };
    
    if (satisfactionFormateur.groupe) {
      renderSatisfactionSection('LE GROUPE DE STAGIAIRE', satisfactionFormateur.groupe, 'remarques_groupe');
    }
    
    if (satisfactionFormateur.organisation) {
      renderSatisfactionSection("L'ORGANISATION MATERIELLE", satisfactionFormateur.organisation, 'bilan_formation');
    }
  }

  return yPos + 5;
}

function calculateRowHeight(doc: jsPDF, seq: any, colWidths: number[]): number {
  doc.setFontSize(7);
  const cellData = [
    seq.duree || '',
    seq.objectifs || '',
    seq.contenu || '',
    seq.outils || '',
    seq.exercice || '',
    seq.evaluation || '',
  ];
  
  let maxLines = 1;
  cellData.forEach((text, i) => {
    if (text) {
      const lines = doc.splitTextToSize(String(text), colWidths[i] - 4);
      maxLines = Math.max(maxLines, lines.length);
    }
  });
  
  return Math.max(12, maxLines * 4 + 6);
}

function renderGrilleObservation(doc: jsPDF, yPos: number, margin: number, contenu: any): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * margin;
  
  // Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('GRILLE D\'AMÉLIORATION STAGIAIRE', margin, yPos);
  
  yPos += 10;
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  // Legend
  doc.setFillColor(240, 249, 255);
  doc.roundedRect(margin, yPos, contentWidth, 15, 2, 2, 'F');
  
  yPos += 5;
  doc.setFontSize(8);
  doc.text('Échelle de notation : A - Objectif atteint avec maîtrise parfaite (90-100%) | B - Objectif atteint (71-89%) | C - Objectif moyennement atteint (51-70%) | D - Objectif non atteint (-50%)', margin + 3, yPos + 5, { maxWidth: contentWidth - 6 });
  
  yPos += 18;
  
  // Competences section
  if (contenu?.competences && Array.isArray(contenu.competences)) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPÉTENCES ÉVALUÉES', margin, yPos);
    yPos += 8;
    
    // Table header
    const colWidths = [contentWidth * 0.55, contentWidth * 0.15, contentWidth * 0.30];
    const headers = ['Compétence', 'Niveau', 'Observations'];
    
    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    
    let xPos = margin;
    headers.forEach((header, i) => {
      doc.text(header, xPos + 2, yPos + 5.5);
      xPos += colWidths[i];
    });
    
    yPos += 8;
    doc.setTextColor(...TEXT_COLOR);
    doc.setFont('helvetica', 'normal');
    
    contenu.competences.forEach((comp: any, index: number) => {
      const rowHeight = 10;
      
      // Check for page break
      if (yPos + rowHeight > pageHeight - 50) {
        doc.addPage();
        yPos = 30;
        addFooter(doc, pageWidth, pageHeight);
      }
      
      // Alternate row colors
      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
      }
      
      // Cell borders
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      xPos = margin;
      colWidths.forEach((width) => {
        doc.rect(xPos, yPos, width, rowHeight);
        xPos += width;
      });
      
      // Cell content
      doc.setFontSize(8);
      doc.text(comp.nom || '', margin + 2, yPos + 6, { maxWidth: colWidths[0] - 4 });
      
      // Niveau with color coding
      const niveau = comp.niveau || 'N/A';
      const niveauColors: Record<string, [number, number, number]> = {
        'A': [22, 163, 74],   // green
        'B': [59, 130, 246],  // blue
        'C': [245, 158, 11],  // amber
        'D': [220, 38, 38],   // red
      };
      
      if (niveauColors[niveau]) {
        doc.setFillColor(...niveauColors[niveau]);
        doc.roundedRect(margin + colWidths[0] + 3, yPos + 2, 12, 6, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(niveau, margin + colWidths[0] + 6, yPos + 6);
        doc.setTextColor(...TEXT_COLOR);
        doc.setFont('helvetica', 'normal');
      } else {
        doc.text(niveau, margin + colWidths[0] + 3, yPos + 6);
      }
      
      doc.text(comp.observation || '', margin + colWidths[0] + colWidths[1] + 2, yPos + 6, { maxWidth: colWidths[2] - 4 });
      
      yPos += rowHeight;
    });
  }
  
  // Moyenne section
  if (contenu?.moyenne) {
    yPos += 10;
    doc.setFillColor(240, 249, 255);
    doc.roundedRect(margin, yPos, contentWidth * 0.5, 12, 2, 2, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`MOYENNE GÉNÉRALE : ${contenu.moyenne}`, margin + 5, yPos + 8);
    yPos += 15;
  }
  
  // Observations et axes de progression section
  yPos += 5;
  if (contenu?.observations_globales) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text('OBSERVATIONS ET AXES DE PROGRESSION', margin, yPos);
    yPos += 8;
    
    doc.setTextColor(...TEXT_COLOR);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Commentaire
    if (contenu.observations_globales.commentaire) {
      doc.setFont('helvetica', 'bold');
      doc.text('Commentaire :', margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      const commentLines = doc.splitTextToSize(contenu.observations_globales.commentaire, contentWidth - 5);
      doc.text(commentLines, margin + 3, yPos);
      yPos += commentLines.length * 4 + 5;
    }
    
    // Axe d'amélioration
    if (contenu.observations_globales.axe_amelioration) {
      doc.setFont('helvetica', 'bold');
      doc.text('Axe d\'amélioration :', margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      const axeLines = doc.splitTextToSize(contenu.observations_globales.axe_amelioration, contentWidth - 5);
      doc.text(axeLines, margin + 3, yPos);
      yPos += axeLines.length * 4 + 5;
    }
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

  // jsPDF.save() can be unreliable inside iframes; use a Blob + anchor download instead.
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getPDFBlob(data: DocumentData): Blob {
  const doc = generatePDF(data);
  return doc.output('blob');
}
