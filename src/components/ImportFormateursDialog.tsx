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
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, RefreshCw, UserPlus } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedFormateur {
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  status: 'update' | 'new' | 'error';
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

export function ImportFormateursDialog({ open, onOpenChange, existingProfiles }: ImportFormateursDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parsedData, setParsedData] = useState<ParsedFormateur[]>([]);
  const [importResult, setImportResult] = useState({ created: 0, updated: 0, errors: 0 });

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

            return { nom, prenom, email, telephone, status: 'new' as const };
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
      let created = 0, updated = 0, errors = 0;

      // Update existing profiles
      const toUpdate = parsedData.filter(r => r.status === 'update');
      for (const row of toUpdate) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ prenom: row.prenom, nom: row.nom, telephone: row.telephone })
            .eq('id', row.existingId!);
          if (error) throw error;
          updated++;
        } catch {
          errors++;
        }
      }

      // Create new formateurs via edge function (creates account + sends invitation)
      const toCreate = parsedData.filter(r => r.status === 'new');
      for (const row of toCreate) {
        try {
          const { data, error } = await supabase.functions.invoke('invite-formateur', {
            body: { email: row.email, prenom: row.prenom, nom: row.nom, telephone: row.telephone },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          created++;
        } catch {
          errors++;
        }
      }

      return { created, updated, errors };
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['formateurs-list'] });
      const parts = [];
      if (result.created > 0) parts.push(`${result.created} créé(s)`);
      if (result.updated > 0) parts.push(`${result.updated} mis à jour`);
      toast.success(`Import terminé: ${parts.join(', ')}`);
    },
    onError: (error) => toast.error('Erreur: ' + error.message),
  });

  const reset = () => {
    setStep('upload');
    setParsedData([]);
    setImportResult({ created: 0, updated: 0, errors: 0 });
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const updCount = parsedData.filter(r => r.status === 'update').length;
  const newCount = parsedData.filter(r => r.status === 'new').length;
  const errCount = parsedData.filter(r => r.status === 'error').length;
  const actionableCount = updCount + newCount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importer des formateurs
          </DialogTitle>
          <DialogDescription>
            Importez depuis un fichier CSV ou Excel (format SmartOF). Les nouveaux formateurs recevront une invitation par email.
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
              {newCount > 0 && <Badge className="gap-1 bg-green-600"><UserPlus className="h-3 w-3" /> {newCount} nouveau(x)</Badge>}
              {updCount > 0 && <Badge variant="default" className="gap-1"><RefreshCw className="h-3 w-3" /> {updCount} mises à jour</Badge>}
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
                    <TableRow key={i} className={f.status === 'error' ? 'bg-destructive/5' : f.status === 'new' ? 'bg-green-500/5' : ''}>
                      <TableCell>
                        {f.status === 'update' && <Badge variant="default" className="text-xs">Mise à jour</Badge>}
                        {f.status === 'new' && <Badge className="text-xs bg-green-600">Nouveau</Badge>}
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

            {newCount > 0 && (
              <p className="text-xs text-muted-foreground">
                ✉️ Les {newCount} nouveau(x) formateur(s) recevront un email d'invitation pour créer leur mot de passe.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={reset}>Retour</Button>
              <Button onClick={() => importMutation.mutate()} disabled={actionableCount === 0 || importMutation.isPending}>
                {importMutation.isPending ? 'Import en cours...' : `Importer ${actionableCount} formateur(s)`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
            <div className="space-y-1">
              {importResult.created > 0 && <p className="text-lg font-medium">{importResult.created} formateur(s) créé(s) et invité(s)</p>}
              {importResult.updated > 0 && <p className="text-lg font-medium">{importResult.updated} formateur(s) mis à jour</p>}
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
