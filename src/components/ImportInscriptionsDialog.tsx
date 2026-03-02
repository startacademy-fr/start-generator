import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, Link2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedInscription {
  stagiaireNom: string;
  stagiairePrenom: string;
  stagiaireEmail: string;
  formationTitre: string;
  formationDate: string;
  status: 'ready' | 'no_stagiaire' | 'no_formation' | 'exists';
  stagiaireId?: string;
  formationId?: string;
  errorMessage?: string;
}

interface ImportInscriptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportInscriptionsDialog({ open, onOpenChange }: ImportInscriptionsDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parsedData, setParsedData] = useState<ParsedInscription[]>([]);
  const [importResult, setImportResult] = useState({ created: 0, skipped: 0, errors: 0 });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        // Fetch existing stagiaires and formations
        const [stagRes, formRes, inscRes] = await Promise.all([
          supabase.from('stagiaires').select('id, nom, prenom, email'),
          supabase.from('formations').select('id, titre, date_debut'),
          supabase.from('inscriptions').select('stagiaire_id, formation_id'),
        ]);

        const stagiaires = stagRes.data || [];
        const formations = formRes.data || [];
        const existingInscriptions = inscRes.data || [];

        const findStagiaire = (nom: string, prenom: string, email: string) => {
          const nEmail = email.toLowerCase().trim();
          const nPrenom = prenom.toLowerCase().trim();
          const nNom = nom.toLowerCase().trim();
          for (const s of stagiaires) {
            let matchCount = 0;
            if (s.email.toLowerCase().trim() === nEmail) matchCount++;
            if (s.prenom.toLowerCase().trim() === nPrenom) matchCount++;
            if (s.nom.toLowerCase().trim() === nNom) matchCount++;
            if (matchCount >= 2) return s.id;
          }
          return null;
        };

        const findFormation = (titre: string, dateStr: string) => {
          const nTitre = titre.toLowerCase().trim();
          for (const f of formations) {
            const fTitre = f.titre.toLowerCase().trim();
            // Match by title similarity (contains) + date if provided
            if (fTitre.includes(nTitre) || nTitre.includes(fTitre)) {
              if (dateStr) {
                if (f.date_debut === dateStr) return f.id;
              } else {
                return f.id;
              }
            }
          }
          // Fallback: try just title match without date
          if (dateStr) {
            for (const f of formations) {
              const fTitre = f.titre.toLowerCase().trim();
              if (fTitre.includes(nTitre) || nTitre.includes(fTitre)) return f.id;
            }
          }
          return null;
        };

        const inscriptionExists = (stagiaireId: string, formationId: string) => {
          return existingInscriptions.some(
            i => i.stagiaire_id === stagiaireId && i.formation_id === formationId
          );
        };

        const parseDateFR = (raw: string): string => {
          if (!raw) return '';
          const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
          return '';
        };

        const parsed: ParsedInscription[] = rows
          .filter(row => {
            const nom = String(row['Nom'] || '').trim();
            const prenom = String(row['Prénom'] || '').trim();
            const formation = String(row['Formation'] || row['Intitulé formation'] || row['Titre formation'] || '').trim();
            return nom && prenom && formation;
          })
          .map((row) => {
            const nom = String(row['Nom'] || '').trim();
            const prenom = String(row['Prénom'] || '').trim();
            const email = String(row['E-mail'] || row['Email'] || '').trim().toLowerCase();
            const formationTitre = String(row['Formation'] || row['Intitulé formation'] || row['Titre formation'] || '').trim();
            const dateRaw = String(row['Date début'] || row['Date de début'] || row['Date'] || '').trim();
            const formationDate = parseDateFR(dateRaw);

            const stagiaireId = findStagiaire(nom, prenom, email);
            const formationId = formationTitre ? findFormation(formationTitre, formationDate) : null;

            if (!stagiaireId) {
              return {
                stagiaireNom: nom, stagiairePrenom: prenom, stagiaireEmail: email,
                formationTitre, formationDate,
                status: 'no_stagiaire' as const,
                errorMessage: 'Stagiaire non trouvé',
              };
            }

            if (!formationId) {
              return {
                stagiaireNom: nom, stagiairePrenom: prenom, stagiaireEmail: email,
                formationTitre, formationDate,
                status: 'no_formation' as const,
                stagiaireId,
                errorMessage: 'Formation non trouvée',
              };
            }

            if (inscriptionExists(stagiaireId, formationId)) {
              return {
                stagiaireNom: nom, stagiairePrenom: prenom, stagiaireEmail: email,
                formationTitre, formationDate,
                status: 'exists' as const,
                stagiaireId, formationId,
                errorMessage: 'Déjà inscrit',
              };
            }

            return {
              stagiaireNom: nom, stagiairePrenom: prenom, stagiaireEmail: email,
              formationTitre, formationDate,
              status: 'ready' as const,
              stagiaireId, formationId,
            };
          });

        setParsedData(parsed);
        setStep('preview');
      } catch (err: any) {
        toast.error('Erreur de lecture: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const ready = parsedData.filter(r => r.status === 'ready' && r.stagiaireId && r.formationId);
      let created = 0, errors = 0;

      // Batch insert
      const toInsert = ready.map(r => ({
        stagiaire_id: r.stagiaireId!,
        formation_id: r.formationId!,
        statut: 'inscrit',
      }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('inscriptions').insert(toInsert);
        if (error) {
          // Fallback to one-by-one
          for (const row of toInsert) {
            const { error: rowError } = await supabase.from('inscriptions').insert(row);
            if (rowError) errors++;
            else created++;
          }
        } else {
          created = toInsert.length;
        }
      }

      const skipped = parsedData.filter(r => r.status === 'exists').length;
      return { created, skipped, errors };
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['inscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['stagiaires'] });
      queryClient.invalidateQueries({ queryKey: ['formations-inscriptions'] });
      toast.success(`${result.created} inscription(s) créée(s)`);
    },
    onError: (error) => toast.error('Erreur: ' + error.message),
  });

  const reset = () => {
    setStep('upload');
    setParsedData([]);
    setImportResult({ created: 0, skipped: 0, errors: 0 });
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const readyCount = parsedData.filter(r => r.status === 'ready').length;
  const existsCount = parsedData.filter(r => r.status === 'exists').length;
  const errorCount = parsedData.filter(r => r.status === 'no_stagiaire' || r.status === 'no_formation').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Importer des inscriptions
          </DialogTitle>
          <DialogDescription>
            Importez un fichier Excel pour lier automatiquement les stagiaires aux sessions de formation.
            Les colonnes attendues : Nom, Prénom, E-mail, Formation (ou Intitulé formation), Date début.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">Sélectionnez votre fichier d'inscriptions</p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="max-w-xs mx-auto cursor-pointer"
                onChange={handleFileChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Le système matche automatiquement les stagiaires (par nom + prénom ou email) et les formations (par titre).
              Les inscriptions déjà existantes sont ignorées.
            </p>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-4">
            <div className="flex gap-3 flex-wrap">
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {readyCount} à créer</Badge>
              {existsCount > 0 && <Badge variant="secondary" className="gap-1">{existsCount} déjà existantes</Badge>}
              {errorCount > 0 && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {errorCount} non matchées</Badge>}
            </div>

            <div className="rounded-md border max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statut</TableHead>
                    <TableHead>Stagiaire</TableHead>
                    <TableHead>Formation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, i) => (
                    <TableRow key={i} className={
                      row.status === 'ready' ? '' :
                      row.status === 'exists' ? 'bg-muted/50' :
                      'bg-destructive/5'
                    }>
                      <TableCell>
                        {row.status === 'ready' && <Badge variant="default" className="text-xs">Prêt</Badge>}
                        {row.status === 'exists' && <Badge variant="secondary" className="text-xs">Existe déjà</Badge>}
                        {row.status === 'no_stagiaire' && <Badge variant="destructive" className="text-xs">Stagiaire ?</Badge>}
                        {row.status === 'no_formation' && <Badge variant="destructive" className="text-xs">Formation ?</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{row.stagiairePrenom} {row.stagiaireNom}</div>
                        {row.stagiaireEmail && <div className="text-xs text-muted-foreground">{row.stagiaireEmail}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{row.formationTitre}</div>
                        {row.formationDate && <div className="text-xs text-muted-foreground">{row.formationDate}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset}>Retour</Button>
              <Button onClick={() => importMutation.mutate()} disabled={readyCount === 0 || importMutation.isPending}>
                {importMutation.isPending ? 'Import en cours...' : `Créer ${readyCount} inscription(s)`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-medium">{importResult.created} inscription(s) créée(s)</p>
              {importResult.skipped > 0 && <p className="text-sm text-muted-foreground">{importResult.skipped} déjà existante(s)</p>}
              {importResult.errors > 0 && <p className="text-sm text-destructive">{importResult.errors} erreur(s)</p>}
            </div>
            <DialogFooter className="justify-center">
              <Button onClick={() => handleClose(false)}>Fermer</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
