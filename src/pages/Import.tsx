import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Download, ArrowRight, ArrowLeft } from 'lucide-react';
import type { Formation } from '@/types/database';

interface ImportRow {
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  entreprise?: string;
  siret?: string;
  fonction?: string;
  adresse?: string;
  situation_handicap?: boolean;
  status: 'new' | 'update' | 'error';
  errorMessage?: string;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'result';

const REQUIRED_COLUMNS = ['prenom', 'nom', 'email'];
const OPTIONAL_COLUMNS = ['telephone', 'entreprise', 'siret', 'fonction', 'adresse', 'situation_handicap'];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

export default function Import() {
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<ImportStep>('upload');
  const [selectedFormation, setSelectedFormation] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: ImportRow[] }>({ created: 0, updated: 0, errors: [] });

  // Fetch formations
  const { data: formations } = useQuery({
    queryKey: ['formations-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formations')
        .select('*')
        .eq('archived', false)
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data as Formation[];
    },
  });

  // Fetch existing stagiaires emails
  const { data: existingEmails } = useQuery({
    queryKey: ['stagiaires-emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stagiaires')
        .select('id, email');
      if (error) throw error;
      return data.reduce((acc, s) => ({ ...acc, [s.email.toLowerCase()]: s.id }), {} as Record<string, string>);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const parsed = lines.map(line => {
        // Handle both comma and semicolon separators
        const separator = line.includes(';') ? ';' : ',';
        return line.split(separator).map(cell => cell.trim().replace(/^"|"$/g, ''));
      });
      
      if (parsed.length > 0) {
        setHeaders(parsed[0]);
        setRawData(parsed.slice(1));
        
        // Auto-map columns
        const autoMapping: Record<string, string> = {};
        parsed[0].forEach((header, index) => {
          const normalizedHeader = header.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const matchedColumn = ALL_COLUMNS.find(col => 
            normalizedHeader.includes(col) || col.includes(normalizedHeader)
          );
          if (matchedColumn) {
            autoMapping[matchedColumn] = index.toString();
          }
        });
        setColumnMapping(autoMapping);
        setStep('mapping');
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleMappingChange = (column: string, headerIndex: string) => {
    setColumnMapping(prev => ({ ...prev, [column]: headerIndex }));
  };

  const validateAndPreview = () => {
    const preview: ImportRow[] = rawData.map(row => {
      const prenom = columnMapping.prenom ? row[parseInt(columnMapping.prenom)] || '' : '';
      const nom = columnMapping.nom ? row[parseInt(columnMapping.nom)] || '' : '';
      const email = columnMapping.email ? row[parseInt(columnMapping.email)]?.toLowerCase() || '' : '';
      
      // Check for required fields
      if (!prenom || !nom || !email) {
        return {
          prenom,
          nom,
          email,
          status: 'error' as const,
          errorMessage: 'Champs obligatoires manquants (prénom, nom, email)',
        };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          prenom,
          nom,
          email,
          status: 'error' as const,
          errorMessage: 'Format email invalide',
        };
      }

      const isExisting = existingEmails?.[email];

      return {
        prenom,
        nom,
        email,
        telephone: columnMapping.telephone ? row[parseInt(columnMapping.telephone)] : undefined,
        entreprise: columnMapping.entreprise ? row[parseInt(columnMapping.entreprise)] : undefined,
        siret: columnMapping.siret ? row[parseInt(columnMapping.siret)] : undefined,
        fonction: columnMapping.fonction ? row[parseInt(columnMapping.fonction)] : undefined,
        adresse: columnMapping.adresse ? row[parseInt(columnMapping.adresse)] : undefined,
        situation_handicap: columnMapping.situation_handicap 
          ? ['oui', 'yes', '1', 'true'].includes((row[parseInt(columnMapping.situation_handicap)] || '').toLowerCase())
          : false,
        status: isExisting ? 'update' : 'new',
      };
    });

    setPreviewData(preview);
    setStep('preview');
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = previewData.filter(r => r.status !== 'error');
      let created = 0;
      let updated = 0;
      const errors: ImportRow[] = [...previewData.filter(r => r.status === 'error')];

      for (const row of validRows) {
        try {
          const stagiaireData = {
            prenom: row.prenom,
            nom: row.nom,
            email: row.email,
            telephone: row.telephone || null,
            entreprise: row.entreprise || null,
            siret: row.siret || null,
            fonction: row.fonction || null,
            adresse: row.adresse || null,
            situation_handicap: row.situation_handicap || false,
          };

          let stagiaireId: string;

          if (row.status === 'update') {
            // Update existing
            stagiaireId = existingEmails![row.email];
            const { error } = await supabase
              .from('stagiaires')
              .update(stagiaireData)
              .eq('id', stagiaireId);
            if (error) throw error;
            updated++;
          } else {
            // Create new
            const { data, error } = await supabase
              .from('stagiaires')
              .insert(stagiaireData)
              .select('id')
              .single();
            if (error) throw error;
            stagiaireId = data.id;
            created++;
          }

          // Create inscription if formation selected
          if (selectedFormation) {
            // Check if inscription already exists
            const { data: existingInscription } = await supabase
              .from('inscriptions')
              .select('id')
              .eq('stagiaire_id', stagiaireId)
              .eq('formation_id', selectedFormation)
              .maybeSingle();

            if (!existingInscription) {
              const { error: inscError } = await supabase
                .from('inscriptions')
                .insert({
                  stagiaire_id: stagiaireId,
                  formation_id: selectedFormation,
                });
              if (inscError) throw inscError;
            }
          }
        } catch (error: any) {
          errors.push({ ...row, status: 'error', errorMessage: error.message });
        }
      }

      return { created, updated, errors };
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['stagiaires'] });
      queryClient.invalidateQueries({ queryKey: ['stagiaires-emails'] });
      queryClient.invalidateQueries({ queryKey: ['inscriptions-counts'] });
      toast.success(`Import terminé: ${result.created} créés, ${result.updated} mis à jour`);
    },
    onError: (error) => {
      toast.error('Erreur lors de l\'import: ' + error.message);
    },
  });

  const reset = () => {
    setStep('upload');
    setFile(null);
    setRawData([]);
    setHeaders([]);
    setColumnMapping({});
    setPreviewData([]);
    setImportResult({ created: 0, updated: 0, errors: [] });
    setSelectedFormation('');
  };

  const downloadErrorReport = () => {
    const csv = [
      ['Prénom', 'Nom', 'Email', 'Erreur'],
      ...importResult.errors.map(e => [e.prenom, e.nom, e.email, e.errorMessage || '']),
    ].map(row => row.join(';')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'erreurs_import.csv';
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Import</h1>
        <p className="text-muted-foreground mt-1">
          Importez des stagiaires depuis un fichier CSV
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-center gap-2">
        {(['upload', 'mapping', 'preview', 'result'] as ImportStep[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step === s ? 'bg-primary text-primary-foreground' : 
              ['upload', 'mapping', 'preview', 'result'].indexOf(step) > i ? 'bg-primary/20 text-primary' : 
              'bg-muted text-muted-foreground'
            }`}>
              {i + 1}
            </div>
            {i < 3 && <div className={`w-12 h-0.5 ${
              ['upload', 'mapping', 'preview', 'result'].indexOf(step) > i ? 'bg-primary/50' : 'bg-muted'
            }`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Charger un fichier
            </CardTitle>
            <CardDescription>
              Sélectionnez un fichier CSV contenant les données des stagiaires
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Formation (optionnel)</Label>
              <Select value={selectedFormation} onValueChange={setSelectedFormation}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une formation pour l'inscription automatique" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucune formation</SelectItem>
                  {formations?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.titre} ({new Date(f.date_debut).toLocaleDateString('fr-FR')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Si une formation est sélectionnée, les stagiaires seront automatiquement inscrits
              </p>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div className="space-y-2">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-primary hover:underline">Cliquez pour sélectionner</span>
                  {' '}ou glissez-déposez votre fichier
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  Formats acceptés: CSV (séparateur: virgule ou point-virgule)
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">Colonnes attendues:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><span className="text-foreground">prenom, nom, email</span> (obligatoires)</li>
                <li>telephone, entreprise, siret, fonction, adresse (optionnels)</li>
                <li>situation_handicap (oui/non)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle>Correspondance des colonnes</CardTitle>
            <CardDescription>
              Vérifiez et ajustez la correspondance entre les colonnes de votre fichier et les champs attendus
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {ALL_COLUMNS.map((col) => (
                <div key={col} className="flex items-center gap-2">
                  <Label className="w-32 flex items-center gap-1">
                    {col}
                    {REQUIRED_COLUMNS.includes(col) && <span className="text-destructive">*</span>}
                  </Label>
                  <Select
                    value={columnMapping[col] || ''}
                    onValueChange={(v) => handleMappingChange(col, v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Non mappé" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Non mappé</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <Button 
                onClick={validateAndPreview}
                disabled={!REQUIRED_COLUMNS.every(col => columnMapping[col])}
              >
                Aperçu
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Aperçu de l'import</CardTitle>
            <CardDescription>
              Vérifiez les données avant de valider l'import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 text-sm">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {previewData.filter(r => r.status === 'new').length} nouveaux
              </Badge>
              <Badge variant="outline" className="gap-1">
                <AlertCircle className="h-3 w-3 text-blue-500" />
                {previewData.filter(r => r.status === 'update').length} mises à jour
              </Badge>
              <Badge variant="outline" className="gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                {previewData.filter(r => r.status === 'error').length} erreurs
              </Badge>
            </div>

            <div className="rounded-lg border max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statut</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Entreprise</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.slice(0, 50).map((row, i) => (
                    <TableRow key={i} className={row.status === 'error' ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {row.status === 'new' && <Badge variant="secondary" className="bg-green-100 text-green-800">Nouveau</Badge>}
                        {row.status === 'update' && <Badge variant="secondary" className="bg-blue-100 text-blue-800">Mise à jour</Badge>}
                        {row.status === 'error' && (
                          <Badge variant="destructive" title={row.errorMessage}>
                            Erreur
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{row.prenom}</TableCell>
                      <TableCell>{row.nom}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.entreprise || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {previewData.length > 50 && (
              <p className="text-sm text-muted-foreground text-center">
                Affichage limité à 50 lignes sur {previewData.length}
              </p>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <Button 
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || previewData.filter(r => r.status !== 'error').length === 0}
              >
                {importMutation.isPending ? 'Import en cours...' : 'Valider l\'import'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {step === 'result' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Import terminé
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{importResult.created}</p>
                <p className="text-sm text-muted-foreground">Créés</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{importResult.updated}</p>
                <p className="text-sm text-muted-foreground">Mis à jour</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{importResult.errors.length}</p>
                <p className="text-sm text-muted-foreground">Erreurs</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <Button variant="outline" onClick={downloadErrorReport}>
                <Download className="mr-2 h-4 w-4" />
                Télécharger le rapport d'erreurs
              </Button>
            )}

            <div className="flex justify-center pt-4">
              <Button onClick={reset}>
                Nouvel import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
