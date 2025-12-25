import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Search, Users, Check } from 'lucide-react';
import type { Stagiaire } from '@/types/database';

interface AddStagiaireToFormationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formationId: string;
  formationTitre: string;
  stagiaires: Stagiaire[];
  existingInscriptionIds: string[];
}

export function AddStagiaireToFormationDialog({
  open,
  onOpenChange,
  formationId,
  formationTitre,
  stagiaires,
  existingInscriptionIds,
}: AddStagiaireToFormationDialogProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStagiaires, setSelectedStagiaires] = useState<string[]>([]);

  const availableStagiaires = stagiaires.filter(
    (s) => !existingInscriptionIds.includes(s.id)
  );

  const filteredStagiaires = availableStagiaires.filter(
    (s) =>
      s.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addMutation = useMutation({
    mutationFn: async (stagiaireIds: string[]) => {
      const inscriptions = stagiaireIds.map((stagiaireId) => ({
        stagiaire_id: stagiaireId,
        formation_id: formationId,
      }));

      const { error } = await supabase.from('inscriptions').insert(inscriptions);
      if (error) throw error;
      return stagiaireIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['inscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['inscriptions-counts'] });
      queryClient.invalidateQueries({ queryKey: ['formation-stagiaires'] });
      toast.success(`${count} stagiaire(s) inscrit(s) à la formation`);
      setSelectedStagiaires([]);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  const toggleStagiaire = (id: string) => {
    setSelectedStagiaires((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedStagiaires.length === filteredStagiaires.length) {
      setSelectedStagiaires([]);
    } else {
      setSelectedStagiaires(filteredStagiaires.map((s) => s.id));
    }
  };

  const handleSubmit = () => {
    if (selectedStagiaires.length === 0) {
      toast.error('Sélectionnez au moins un stagiaire');
      return;
    }
    addMutation.mutate(selectedStagiaires);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter des stagiaires</DialogTitle>
          <DialogDescription>
            Sélectionnez les stagiaires à inscrire à la formation "{formationTitre}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un stagiaire..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {availableStagiaires.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">Tous les stagiaires sont déjà inscrits</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAll}
                  className="text-muted-foreground"
                >
                  {selectedStagiaires.length === filteredStagiaires.length
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </Button>
                <span className="text-muted-foreground">
                  {selectedStagiaires.length} sélectionné(s)
                </span>
              </div>

              <ScrollArea className="h-[300px] rounded-md border p-2">
                <div className="space-y-1">
                  {filteredStagiaires.map((stagiaire) => (
                    <div
                      key={stagiaire.id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                        selectedStagiaires.includes(stagiaire.id)
                          ? 'bg-primary/10'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleStagiaire(stagiaire.id)}
                    >
                      <Checkbox
                        checked={selectedStagiaires.includes(stagiaire.id)}
                        onCheckedChange={() => toggleStagiaire(stagiaire.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {stagiaire.prenom} {stagiaire.nom}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {stagiaire.email}
                        </div>
                      </div>
                      {selectedStagiaires.includes(stagiaire.id) && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedStagiaires.length === 0 || addMutation.isPending}
          >
            {addMutation.isPending
              ? 'Inscription...'
              : `Inscrire ${selectedStagiaires.length} stagiaire(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
