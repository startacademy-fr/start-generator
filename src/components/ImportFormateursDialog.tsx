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
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedFormateur {
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  status: 'update' | 'no_account' | 'error';
  existingId?: string;
  errorMessage?: string;
}

interface ExistingProfile {
  id: string;
  email: string;
  prenom: string;
  nom: string;
}

interface ImportFormateursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProfiles: ExistingProfile[];
}

function mapCivilite(raw: string): string | null {
  const v = raw?.trim().toLowerCase();
  if (v === 'monsieur' || v === 'm.' || v === 'm') return 'M.';
  if (v === 'madame' || v === 'mme' || v === 'mme.') return 'Mme';
  return null;
}

export function ImportFormateursDialog({ open, onOpenChange, existingProfiles }: ImportFormateursDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parsedData, setParsedData] = useState<ParsedFormateur[]>([]);
  const [importResult, setImportResult] = useState({ updated: 0, skipped: 0, errors: 0 });

  const findExisting = (email: string) => {
    const nEmail = email.toLowerCase().trim();
    return existingProfiles.find(p => p.email.toLowerCase().trim() === nEmail);
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

        const parsed: ParsedFormateur[] = rows
          .filter(row => {
            const archived = String(row['Archivé'] || '').toLowerCase();
            return archived !== 'oui' && archived !== 'yes';
          })
          .map((row) => {
            const nom = String(row['Nom'] || '').trim();
            const prenom = String(row['Prénom'] || '').trim();
            const email = String(row['E-mail'] || row['Email'] || '').trim().toLowerCase();
            const telephone = String(row['Numéro de téléphone'] || '').trim() || null;

            if (!nom || !prenom || !email) {
              return { nom, prenom, email, telephone, status: 'error' as const, errorMessage: 'Données manquantes' };
            }

            const existing = findExisting(email);
            if (existing) {
              return { nom, prenom, email, telephone, status: 'update' as const, existingId: existing.id };
            }

            return { nom, prenom, email, telephone, status: 'no_account' as const };
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
      const toUpdate = parsedData.filter(r => r.status === 'update');
      let updated = 0, errors = 0;

      for (const row of toUpdate) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ prenom: row.prenom, nom: row.nom, telephone: row.telephone } as any)
            .eq('id', row.existingId!);
          if (error) throw error;
          updated++;
        } catch {
          errors++;
        }
      }

      return { updated, skipped: parsedData.filter(r => r.status === 'no_account').length, errors };
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['formateurs-list'] });
      toast.success(`Import terminé: ${result.updated} formateur(s) mis à jour`);
    },
    onError: (error) => toast.error('Erreur: ' + error.message),
  });

  const reset = () => {
    setStep('upload');
    setParsedData([]);
    setImportResult({ updated: 0, skipped: 0, errors: 0 });
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const updCount = parsedData.filter(r => r.status === 'update').length;
  const noAccCount = parsedData.filter(r => r.status === 'no_account').length;
  const errCount = parsedData.filter(r => r.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importer des formateurs
          </DialogTitle>
          <DialogDescription>
            Importez depuis un fichier CSV ou Excel (format SmartOF). Seuls les formateurs avec un compte existant seront mis à jour.
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
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-4">
            <div className="flex gap-3 flex-wrap">
              {updCount > 0 && <Badge variant="default" className="gap-1"><RefreshCw className="h-3 w-3" /> {updCount} mises à jour</Badge>}
              {noAccCount > 0 && <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> {noAccCount} sans compte</Badge>}
              {errCount > 0 && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {errCount} erreurs</Badge>}
            </div>

            <div className="rounded-md border max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statut</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((f, i) => (
                    <TableRow key={i} className={f.status === 'error' ? 'bg-destructive/5' : f.status === 'no_account' ? 'bg-muted/50' : ''}>
                      <TableCell>
                        {f.status === 'update' && <Badge variant="default" className="text-xs">Mise à jour</Badge>}
                        {f.status === 'no_account' && <Badge variant="secondary" className="text-xs">Sans compte</Badge>}
                        {f.status === 'error' && <Badge variant="destructive" className="text-xs">{f.errorMessage}</Badge>}
                      </TableCell>
                      <TableCell className="font-medium">{f.nom}</TableCell>
                      <TableCell>{f.prenom}</TableCell>
                      <TableCell className="text-sm">{f.email}</TableCell>
                      <TableCell className="text-sm">{f.telephone || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {noAccCount > 0 && (
              <p className="text-xs text-muted-foreground">
                ⚠️ Les formateurs « sans compte » n'ont pas de profil utilisateur. Ils devront d'abord créer un compte.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={reset}>Retour</Button>
              <Button onClick={() => importMutation.mutate()} disabled={updCount === 0 || importMutation.isPending}>
                {importMutation.isPending ? 'Import en cours...' : `Mettre à jour ${updCount} formateur(s)`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-medium">{importResult.updated} formateur(s) mis à jour</p>
              {importResult.skipped > 0 && <p className="text-sm text-muted-foreground">{importResult.skipped} sans compte (ignorés)</p>}
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
