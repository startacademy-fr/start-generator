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
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedStagiaire {
  civilite: string | null;
  nom: string;
  prenom: string;
  email: string;
  date_naissance: string | null;
  nom_jeune_fille: string | null;
  fonction: string | null;
  adresse: string | null;
  diplome_plus_eleve: string | null;
  anciennete: string | null;
  status: 'new' | 'update' | 'error';
  existingId?: string;
  errorMessage?: string;
}

interface ExistingStagiaire {
  id: string;
  email: string;
  prenom: string;
  nom: string;
}

interface ImportStagiairesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingStagiaires: ExistingStagiaire[];
}

function parseDateFR(raw: string): string | null {
  if (!raw) return null;
  // Handle DD/MM/YYYY
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function mapCivilite(raw: string): 'M.' | 'Mme' | null {
  const v = raw?.trim().toLowerCase();
  if (v === 'monsieur' || v === 'm.' || v === 'm') return 'M.';
  if (v === 'madame' || v === 'mme' || v === 'mme.') return 'Mme';
  return null;
}

export function ImportStagiairesDialog({ open, onOpenChange, existingStagiaires }: ImportStagiairesDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parsedData, setParsedData] = useState<ParsedStagiaire[]>([]);
  const [importResult, setImportResult] = useState({ created: 0, updated: 0, errors: 0 });

  const findExisting = (prenom: string, nom: string, email: string) => {
    const nEmail = email.toLowerCase().trim();
    const nPrenom = prenom.toLowerCase().trim();
    const nNom = nom.toLowerCase().trim();

    for (const s of existingStagiaires) {
      let matchCount = 0;
      if (s.email.toLowerCase().trim() === nEmail) matchCount++;
      if (s.prenom.toLowerCase().trim() === nPrenom) matchCount++;
      if (s.nom.toLowerCase().trim() === nNom) matchCount++;
      if (matchCount >= 2) return s.id;
    }
    return null;
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

        const parsed: ParsedStagiaire[] = rows
          .filter(row => {
            const archived = String(row['Archivé'] || '').toLowerCase();
            return archived !== 'oui' && archived !== 'yes';
          })
          .map((row) => {
            const nom = String(row['Nom'] || '').trim();
            const prenom = String(row['Prénom'] || '').trim();
            const email = String(row['E-mail'] || row['Email'] || '').trim().toLowerCase();

            if (!nom || !prenom || !email) {
              return {
                civilite: null, nom, prenom, email,
                date_naissance: null, nom_jeune_fille: null,
                fonction: null, adresse: null,
                diplome_plus_eleve: null, anciennete: null,
                status: 'error' as const,
                errorMessage: 'Nom, prénom ou email manquant',
              };
            }

            const rue = String(row['Rue'] || '').trim();
            const cp = String(row['Code postal'] || '').trim();
            const ville = String(row['Ville'] || '').trim();
            const adresseStr = [rue, cp, ville].filter(Boolean).join(', ') || null;

            const existingId = findExisting(prenom, nom, email);

            return {
              civilite: mapCivilite(String(row['Civilité'] || '')),
              nom,
              prenom,
              email,
              date_naissance: parseDateFR(String(row['Date de naissance'] || '')),
              nom_jeune_fille: String(row['Nom de naissance'] || '').trim() || null,
              fonction: String(row['Fonction'] || '').trim() || null,
              adresse: adresseStr,
              diplome_plus_eleve: String(row['Niveau d\'étude'] || row['Niveau d\'étude'] || '').trim() || null,
              anciennete: String(row['Dirigeant d\'entreprise depuis'] || '').trim() || null,
              status: existingId ? 'update' as const : 'new' as const,
              existingId: existingId || undefined,
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
      const valid = parsedData.filter(r => r.status !== 'error');
      let created = 0, updated = 0, errors = 0;

      for (const row of valid) {
        try {
          const data: any = {
            civilite: row.civilite,
            nom: row.nom,
            prenom: row.prenom,
            email: row.email,
            date_naissance: row.date_naissance,
            fonction: row.fonction,
            adresse: row.adresse,
            diplome_plus_eleve: row.diplome_plus_eleve,
            anciennete: row.anciennete,
          };

          // Only set nom_jeune_fille for Mme
          if (row.civilite === 'Mme') {
            data.nom_jeune_fille = row.nom_jeune_fille;
          }

          if (row.status === 'update' && row.existingId) {
            const { error } = await supabase.from('stagiaires').update(data).eq('id', row.existingId);
            if (error) throw error;
            updated++;
          } else {
            const { error } = await supabase.from('stagiaires').insert(data);
            if (error) throw error;
            created++;
          }
        } catch (err: any) {
          console.error('Import error:', err);
          errors++;
        }
      }

      return { created, updated, errors };
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['stagiaires'] });
      queryClient.invalidateQueries({ queryKey: ['stagiaires-all'] });
      toast.success(`Import terminé: ${result.created} créés, ${result.updated} mis à jour`);
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

  const newCount = parsedData.filter(r => r.status === 'new').length;
  const updCount = parsedData.filter(r => r.status === 'update').length;
  const errCount = parsedData.filter(r => r.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importer des stagiaires
          </DialogTitle>
          <DialogDescription>
            Importez depuis un fichier CSV ou Excel (format SmartOF supporté). Les doublons sont détectés et mis à jour.
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
              Colonnes reconnues : Civilité, Nom, Prénom, E-mail, Numéro de téléphone, Date de naissance, Nom de naissance, Fonction, Rue/Code postal/Ville, N° de sécurité sociale, Niveau d'étude, Dirigeant d'entreprise depuis
            </p>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-4">
            <div className="flex gap-3">
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {newCount} nouveaux</Badge>
              {updCount > 0 && <Badge variant="secondary" className="gap-1"><RefreshCw className="h-3 w-3" /> {updCount} mises à jour</Badge>}
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
                  {parsedData.map((s, i) => (
                    <TableRow key={i} className={s.status === 'error' ? 'bg-destructive/5' : s.status === 'update' ? 'bg-muted/50' : ''}>
                      <TableCell>
                        {s.status === 'new' && <Badge variant="default" className="text-xs">Nouveau</Badge>}
                        {s.status === 'update' && <Badge variant="secondary" className="text-xs">Mise à jour</Badge>}
                        {s.status === 'error' && <Badge variant="destructive" className="text-xs">{s.errorMessage}</Badge>}
                      </TableCell>
                      <TableCell className="font-medium">{s.nom}</TableCell>
                      <TableCell>{s.prenom}</TableCell>
                      <TableCell className="text-sm">{s.email}</TableCell>
                      <TableCell className="text-sm">{s.date_naissance || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset}>Retour</Button>
              <Button onClick={() => importMutation.mutate()} disabled={(newCount + updCount) === 0 || importMutation.isPending}>
                {importMutation.isPending ? 'Import en cours...' : `Importer ${newCount + updCount} stagiaire(s)`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-medium">{importResult.created} créé(s), {importResult.updated} mis à jour</p>
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
