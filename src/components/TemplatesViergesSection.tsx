import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, Download, CheckCircle2, AlertCircle } from 'lucide-react';

const TEMPLATE_TYPES = [
  { id: 'questionnaire_positionnement', label: 'Questionnaire de positionnement' },
  { id: 'analyse_besoin', label: 'Analyse du besoin' },
  { id: 'qcm', label: 'QCM' },
  { id: 'satisfaction_chaud', label: 'Satisfaction à chaud' },
  { id: 'satisfaction_froid', label: 'Satisfaction à froid' },
  { id: 'deroule_pedagogique', label: 'Déroulé pédagogique' },
  { id: 'grille_observation', label: "Grille d'observation" },
  { id: 'fiche_emargement', label: "Fiche d'émargement" },
];

interface TemplateVierge {
  id: string;
  type: string;
  nom_fichier: string;
  storage_path: string;
  taille: number | null;
  created_at: string;
}

export function TemplatesViergesSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ['templates-vierges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates_vierges' as any)
        .select('*')
        .order('type');
      if (error) throw error;
      return data as unknown as TemplateVierge[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ type, file }: { type: string; file: File }) => {
      const ext = file.name.split('.').pop();
      const storagePath = `${type}/template.${ext}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('templates-vierges')
        .upload(storagePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Check if a record already exists for this type
      const { data: existing } = await supabase
        .from('templates_vierges' as any)
        .select('id')
        .eq('type', type)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('templates_vierges' as any)
          .update({
            nom_fichier: file.name,
            storage_path: storagePath,
            taille: file.size,
          } as any)
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('templates_vierges' as any)
          .insert({
            type,
            nom_fichier: file.name,
            storage_path: storagePath,
            taille: file.size,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-vierges'] });
      toast.success('Template importé avec succès');
      setUploadingType(null);
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
      setUploadingType(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (template: TemplateVierge) => {
      await supabase.storage.from('templates-vierges').remove([template.storage_path]);
      const { error } = await supabase
        .from('templates_vierges' as any)
        .delete()
        .eq('id', template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-vierges'] });
      toast.success('Template supprimé');
    },
    onError: (error) => toast.error('Erreur: ' + error.message),
  });

  const handleUploadClick = (type: string) => {
    setUploadingType(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingType) return;
    if (file.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés');
      setUploadingType(null);
      return;
    }
    uploadMutation.mutate({ type: uploadingType, file });
    e.target.value = '';
  };

  const handleDownload = async (template: TemplateVierge) => {
    const { data } = await supabase.storage
      .from('templates-vierges')
      .getPublicUrl(template.storage_path);
    window.open(data.publicUrl, '_blank');
  };

  const getTemplate = (type: string) => templates?.find(t => t.type === type);
  const uploadedCount = templates?.length || 0;

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates vierges Qualiopi
          </CardTitle>
          <Badge variant="outline">
            {uploadedCount}/{TEMPLATE_TYPES.length} importés
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="grid gap-2">
          {TEMPLATE_TYPES.map(({ id, label }) => {
            const template = getTemplate(id);
            return (
              <div
                key={id}
                className="flex items-center justify-between py-2 px-3 rounded-md border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {template ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className="text-sm font-medium truncate">{label}</span>
                  {template && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {template.nom_fichier} {formatSize(template.taille)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {template && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Télécharger"
                        onClick={() => handleDownload(template)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Supprimer"
                          onClick={() => deleteMutation.mutate(template)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </>
                  )}
                  {canManage && (
                    <Button
                      variant={template ? 'ghost' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      disabled={uploadMutation.isPending && uploadingType === id}
                      onClick={() => handleUploadClick(id)}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      {template ? 'Remplacer' : 'Importer'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
