import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, X, Users } from 'lucide-react';
import type { Stagiaire } from '@/types/database';

interface StagiaireMultiSelectProps {
  stagiaires: Stagiaire[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function StagiaireMultiSelect({
  stagiaires,
  selectedIds,
  onChange,
}: StagiaireMultiSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStagiaires = stagiaires.filter(
    (s) =>
      s.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleStagiaire = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredStagiaires.length) {
      onChange([]);
    } else {
      onChange(filteredStagiaires.map((s) => s.id));
    }
  };

  const removeStagiaire = (id: string) => {
    onChange(selectedIds.filter((s) => s !== id));
  };

  const selectedStagiaires = stagiaires.filter((s) => selectedIds.includes(s.id));

  return (
    <div className="space-y-3">
      {/* Selected badges */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedStagiaires.slice(0, 5).map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
              {s.prenom} {s.nom}
              <button
                type="button"
                onClick={() => removeStagiaire(s.id)}
                className="ml-1 rounded-full hover:bg-background/50 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedIds.length > 5 && (
            <Badge variant="outline">+{selectedIds.length - 5} autres</Badge>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un stagiaire..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* List */}
      {stagiaires.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm">
          <Users className="h-8 w-8 mb-2 opacity-50" />
          <p>Aucun stagiaire disponible</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <button
              type="button"
              onClick={toggleAll}
              className="hover:text-foreground transition-colors"
            >
              {selectedIds.length === filteredStagiaires.length && filteredStagiaires.length > 0
                ? 'Tout désélectionner'
                : 'Tout sélectionner'}
            </button>
            <span>{selectedIds.length} sélectionné(s)</span>
          </div>

          <ScrollArea className="h-[180px] rounded-md border">
            <div className="p-2 space-y-1">
              {filteredStagiaires.map((stagiaire) => {
                const isSelected = selectedIds.includes(stagiaire.id);
                return (
                  <div
                    key={stagiaire.id}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleStagiaire(stagiaire.id)}
                  >
                    <div
                      className={`h-4 w-4 shrink-0 rounded-sm border ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input'
                      } flex items-center justify-center`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isSelected && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3 w-3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {stagiaire.prenom} {stagiaire.nom}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {stagiaire.email}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
