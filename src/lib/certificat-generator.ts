import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PRIMARY_COLOR: [number, number, number] = [0, 82, 122];
const HEADER_BG_COLOR: [number, number, number] = [0, 82, 122];
const TEXT_COLOR: [number, number, number] = [30, 41, 59];
const MUTED_COLOR: [number, number, number] = [100, 116, 139];

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface CertificatData {
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

export async function generateCertificatPDF(data: CertificatData): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // Load assets in parallel
  const [logoBase64, signatureBase64] = await Promise.all([
    loadImageAsBase64('/images/logo-white.png'),
    loadImageAsBase64('/images/tampon-signature-fusion.png'),
  ]);

  // === HEADER ===
  const headerHeight = 35;
  doc.setFillColor(...HEADER_BG_COLOR);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  if (logoBase64) {
    const logoHeight = 25;
    const logoWidth = logoHeight * (240 / 115);
    const logoX = (pageWidth - logoWidth) / 2;
    const logoY = (headerHeight - logoHeight) / 2;
    doc.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
  }

  // === TITLE ===
  let yPos = 50;
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICAT DE RÉALISATION', pageWidth / 2, yPos, { align: 'center' });

  // Subtitle
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED_COLOR);
  doc.text("En application des dispositions de l'article L.6353-1 du Code du travail", pageWidth / 2, yPos, { align: 'center' });

  // Decorative line
  yPos += 6;
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.8);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  // === BODY ===
  yPos += 16;
  const labelX = margin + 5;
  const valueX = margin + 5;
  const lineSpacing = 10;

  const drawField = (label: string, value: string) => {
    doc.setTextColor(...TEXT_COLOR);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(label, labelX, yPos);
    yPos += lineSpacing - 2;
    doc.setFont('helvetica', 'normal');
    doc.text(value, valueX + 5, yPos);
    yPos += lineSpacing + 2;
  };

  // Organisme attestation
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text("L'organisme de formation START ACADEMY atteste que :", labelX, yPos);
  yPos += lineSpacing + 4;

  // Stagiaire
  drawField('Stagiaire :', data.nomPrenom);

  // Formation
  drawField('A suivi la formation :', data.nomFormation);

  // Nature
  drawField("Nature de l'action de formation :", data.natureAction);

  // Dates
  const dateDebut = format(new Date(data.dateDebut), 'dd MMMM yyyy', { locale: fr });
  if (data.dateFin) {
    const dateFin = format(new Date(data.dateFin), 'dd MMMM yyyy', { locale: fr });
    drawField('Période de réalisation :', `Du ${dateDebut} au ${dateFin}`);
  } else {
    drawField('Date de réalisation :', `Le ${dateDebut}`);
  }

  // Durée - auto-append "h" if not already present
  const dureeDisplay = /h|heure/i.test(data.duree) ? data.duree : `${data.duree}h`;
  drawField('Durée :', dureeDisplay);

  // Conclusion text
  yPos += 4;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_COLOR);
  const conclusionLines = doc.splitTextToSize(
    "Sans préjuger des résultats des évaluations spécifiques réalisées en cours ou en fin de formation, le stagiaire a réalisé l'action de formation ci-dessus.",
    pageWidth - 2 * margin - 10
  );
  doc.text(conclusionLines, labelX, yPos);
  yPos += conclusionLines.length * 5 + 10;

  // === FAIT A / LE ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_COLOR);
  const faitLe = data.leDateDu ? format(new Date(data.leDateDu), 'dd MMMM yyyy', { locale: fr }) : '';
  doc.text(`Fait à ${data.faitA}, le ${faitLe}`, labelX, yPos);

  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Julien Lafitte – PDG de l\'organisme de formation', labelX, yPos);

  // Tampon+signature image (proportions originales, réduit 20%)
  const signatureY = yPos + 3;
  if (signatureBase64) {
    doc.addImage(signatureBase64, 'PNG', margin + 5, signatureY, 40, 40);
  }

  // === FOOTER ===
  addFooter(doc, pageWidth, pageHeight);

  return doc;
}

function addFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const footerY = pageHeight - 15;
  const margin = 15;

  doc.setDrawColor(...MUTED_COLOR);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFontSize(6);
  doc.setTextColor(...MUTED_COLOR);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'START ACADEMY – Siège social 618 boulevard Jean Maurel inférieur 06140 Vence – N° SIRET 95131909400011 - NDA 93 06 10481 06',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
  doc.text(
    'Coordonnées de contact : Angélique LAFITTE - E-mail : formation@start-academy.fr – 06 16 24 63 43 - Version 02 vérifié du 28/01/2026',
    pageWidth / 2,
    footerY + 4,
    { align: 'center' }
  );
}
