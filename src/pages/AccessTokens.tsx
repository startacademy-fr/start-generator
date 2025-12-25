import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Link2, 
  Plus, 
  Copy, 
  Trash2, 
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Formation, Stagiaire } from '@/types/database';

interface InscriptionWithDetails {
  id: string;
  stagiaire: Stagiaire;
  formation: Formation;
}

export default function AccessTokens() {
  const { isAdmin, isAssistante } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin() || isAssistante();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormation, setSelectedFormation] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createFormation, setCreateFormation] = useState<string>('');
  const [generatedLinks, setGeneratedLinks] = useState<{ stagiaire: string; link: string }[]>([]);

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

  // Fetch inscriptions with details
  const { data: inscriptions } = useQuery({
    queryKey: ['inscriptions-with-details'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inscriptions')
        .select(`
          id,
          stagiaire:stagiaires(*),
          formation:formations(*)
        `);
      if (error) throw error;
      return data as unknown as InscriptionWithDetails[];
    },
  });

  // Fetch access tokens
  const { data: tokens, isLoading } = useQuery({
    queryKey: ['access-tokens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_tokens')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Generate tokens mutation
  const generateMutation = useMutation({
    mutationFn: async (formationId: string) => {
      const formationInscriptions = inscriptions?.filter(i => i.formation.id === formationId) || [];
      const links: { stagiaire: string; link: string }[] = [];
      const expiresAt = addDays(new Date(), 30).toISOString();

      for (const inscription of formationInscriptions) {
        // Check if token already exists for this inscription
        const existingToken = tokens?.find(t => t.inscription_id === inscription.id && !t.revoked);
        
        if (!existingToken) {
          // Generate a simple token (in production, use crypto.randomBytes)
          const tokenValue = btoa(`${inscription.id}:${Date.now()}:${Math.random().toString(36)}`);
          
          // Store hashed token (simplified for demo)
          const { error } = await supabase
            .from('access_tokens')
            .insert({
              inscription_id: inscription.id,
              token_hash: tokenValue, // In production: hash this
              expires_at: expiresAt,
            });

          if (error) throw error;

          const link = `${window.location.origin}/portail?token=${tokenValue}`;
          links.push({
            stagiaire: `${inscription.stagiaire.prenom} ${inscription.stagiaire.nom}`,
            link,
          });
        }
      }

      return links;
    },
    onSuccess: (links) => {
      queryClient.invalidateQueries({ queryKey: ['access-tokens'] });
      setGeneratedLinks(links);
      if (links.length === 0) {
        toast.info('Tous les stagiaires ont déjà un lien actif');
      } else {
        toast.success(`${links.length} lien(s) généré(s)`);
      }
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  // Revoke token mutation
  const revokeMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from('access_tokens')
        .update({ revoked: true })
        .eq('id', tokenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-tokens'] });
      toast.success('Lien révoqué');
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  const copyToClipboard = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Lien copié !');
  };

  const getInscriptionDetails = (inscriptionId: string) => {
    return inscriptions?.find(i => i.id === inscriptionId);
  };

  const filteredTokens = tokens?.filter(token => {
    const inscription = getInscriptionDetails(token.inscription_id);
    if (!inscription) return false;

    const matchesSearch = 
      inscription.stagiaire.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inscription.stagiaire.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inscription.formation.titre.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFormation = selectedFormation === 'all' || inscription.formation.id === selectedFormation;

    return matchesSearch && matchesFormation;
  });

  const getTokenStatus = (token: { expires_at: string; revoked: boolean }) => {
    if (token.revoked) return 'revoked';
    if (new Date(token.expires_at) < new Date()) return 'expired';
    return 'active';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Liens d'accès</h1>
          <p className="text-muted-foreground mt-1">
            Gérez les liens sécurisés pour le portail stagiaire
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Générer des liens
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedFormation} onValueChange={setSelectedFormation}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Formation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les formations</SelectItem>
            {formations?.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.titre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tokens table */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredTokens?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Link2 className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucun lien d'accès</p>
            {canManage && (
              <Button 
                variant="link" 
                className="mt-2"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                Générer des liens
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stagiaire</TableHead>
                <TableHead>Formation</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Dernière utilisation</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTokens?.map(token => {
                const inscription = getInscriptionDetails(token.inscription_id);
                if (!inscription) return null;
                const status = getTokenStatus(token);
                
                return (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">
                      {inscription.stagiaire.prenom} {inscription.stagiaire.nom}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {inscription.formation.titre}
                    </TableCell>
                    <TableCell>
                      {status === 'active' && (
                        <Badge variant="default" className="gap-1 bg-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Actif
                        </Badge>
                      )}
                      {status === 'expired' && (
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          Expiré
                        </Badge>
                      )}
                      {status === 'revoked' && (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Révoqué
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(token.expires_at), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {token.last_used_at 
                        ? format(new Date(token.last_used_at), 'dd/MM/yyyy HH:mm', { locale: fr })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {status === 'active' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => copyToClipboard(`${window.location.origin}/portail?token=${token.token_hash}`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => window.open(`${window.location.origin}/portail?token=${token.token_hash}`, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            {canManage && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => revokeMutation.mutate(token.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Generate dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Générer des liens d'accès
            </DialogTitle>
            <DialogDescription>
              Créez des liens sécurisés pour les stagiaires d'une formation
            </DialogDescription>
          </DialogHeader>

          {generatedLinks.length > 0 ? (
            <div className="space-y-4 py-4">
              <p className="text-sm font-medium text-green-600">
                ✅ {generatedLinks.length} lien(s) généré(s)
              </p>
              <div className="max-h-60 overflow-auto space-y-2">
                {generatedLinks.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <span className="text-sm font-medium truncate">{item.stagiaire}</span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => copyToClipboard(item.link)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copier
                    </Button>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => {
                  setIsCreateDialogOpen(false);
                  setGeneratedLinks([]);
                  setCreateFormation('');
                }}>
                  Fermer
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Formation</label>
                  <Select value={createFormation} onValueChange={setCreateFormation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une formation" />
                    </SelectTrigger>
                    <SelectContent>
                      {formations?.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.titre} ({format(new Date(f.date_debut), 'dd/MM/yyyy', { locale: fr })})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {createFormation && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="font-medium mb-1">Stagiaires concernés</p>
                    <p className="text-muted-foreground">
                      {inscriptions?.filter(i => i.formation.id === createFormation).length || 0} stagiaire(s)
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Annuler
                </Button>
                <Button 
                  onClick={() => generateMutation.mutate(createFormation)}
                  disabled={!createFormation || generateMutation.isPending}
                >
                  {generateMutation.isPending ? 'Génération...' : 'Générer les liens'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
