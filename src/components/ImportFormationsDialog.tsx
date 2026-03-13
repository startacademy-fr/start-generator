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
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedFormation {
  reference: string;
  titre: string;
  nombre_heures: number | null;
  objectifs: string | null;
  programme: string | null;
  status: 'new' | 'duplicate' | 'error';
  errorMessage?: string;
}

interface ImportFormationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingReferences: string[];
}

export function ImportFormationsDialog({ open, onOpenChange, existingReferences }: ImportFormationsDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parsedData, setParsedData] = useState<ParsedFormation[]>([]);
  const [importResult, setImportResult] = useState({ created: 0, skipped: 0, errors: 0 });

  const generateReference = () => {
    const year = new Date().getFullYear();
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `FORM-${year}-${rand}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const parsed: ParsedFormation[] = rows.map((row) => {
          // Map SmartOF columns
          const titre = row['Intitulé de la formation'] || row['Nom du produit'] || '';
          const customId = row['Custom ID'] || '';
          const heuresRaw = row['Durée de formation (en heures)'] || '';
          const programme = row['Contenu de la formation'] || '';
          const reference = customId || generateReference();

          if (!titre.trim()) {
            return { reference, titre, nombre_heures: null, programme: null, status: 'error' as const, errorMessage: 'Titre manquant' };
          }

          const isDuplicate = existingReferences.includes(reference);

          return {
            reference,
            titre: titre.trim(),
            nombre_heures: heuresRaw ? parseInt(String(heuresRaw)) || null : null,
            programme: programme?.trim() || null,
            status: isDuplicate ? 'duplicate' as const : 'new' as const,
          };
        }).filter(r => r.titre || r.status === 'error');

        setParsedData(parsed);
        setStep('preview');
      } catch (err: any) {
        toast.error('Erreur de lecture du fichier: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const toImport = parsedData.filter(r => r.status === 'new');
      let created = 0;
      let errors = 0;

      // Batch insert
      const batchSize = 50;
      for (let i = 0; i < toImport.length; i += batchSize) {
        const batch = toImport.slice(i, i + batchSize).map(f => ({
          reference: f.reference,
          titre: f.titre,
          nombre_heures: f.nombre_heures,
          programme: f.programme,
        }));
        const { error } = await supabase.from('formations_catalogue').insert(batch);
        if (error) {
          errors += batch.length;
          console.error('Batch insert error:', error);
        } else {
          created += batch.length;
        }
      }

      return { created, skipped: parsedData.filter(r => r.status === 'duplicate').length, errors };
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['formations-catalogue'] });
      toast.success(`Import terminé: ${result.created} formations créées`);
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

  const newCount = parsedData.filter(r => r.status === 'new').length;
  const dupCount = parsedData.filter(r => r.status === 'duplicate').length;
  const errCount = parsedData.filter(r => r.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importer des formations
          </DialogTitle>
          <DialogDescription>
            Importez des formations depuis un fichier CSV ou Excel (format SmartOF supporté)
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">Glissez votre fichier ou cliquez pour sélectionner</p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="max-w-xs mx-auto cursor-pointer"
                onChange={handleFileChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Colonnes reconnues : Custom ID (référence), Intitulé de la formation, Durée de formation (en heures), Contenu de la formation
            </p>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-4">
            <div className="flex gap-3">
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {newCount} nouvelles</Badge>
              {dupCount > 0 && <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> {dupCount} doublons</Badge>}
              {errCount > 0 && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {errCount} erreurs</Badge>}
            </div>

            <div className="rounded-md border max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statut</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Heures</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((f, i) => (
                    <TableRow key={i} className={f.status === 'error' ? 'bg-destructive/5' : f.status === 'duplicate' ? 'bg-muted/50' : ''}>
                      <TableCell>
                        {f.status === 'new' && <Badge variant="default" className="text-xs">Nouveau</Badge>}
                        {f.status === 'duplicate' && <Badge variant="secondary" className="text-xs">Doublon</Badge>}
                        {f.status === 'error' && <Badge variant="destructive" className="text-xs">{f.errorMessage}</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{f.reference}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{f.titre}</TableCell>
                      <TableCell>{f.nombre_heures || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset}>Retour</Button>
              <Button onClick={() => importMutation.mutate()} disabled={newCount === 0 || importMutation.isPending}>
                {importMutation.isPending ? 'Import en cours...' : `Importer ${newCount} formation(s)`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-medium">{importResult.created} formation(s) importée(s)</p>
              {importResult.skipped > 0 && <p className="text-sm text-muted-foreground">{importResult.skipped} doublon(s) ignoré(s)</p>}
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
