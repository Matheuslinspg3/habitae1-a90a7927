import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronRight, UserX, Image, Ruler } from 'lucide-react';

function parseWarnings(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.keys(raw as Record<string, unknown>).filter(k => (raw as Record<string, unknown>)[k]);
  }
  return [];
}

export function ImportReviewBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: pendencies } = useQuery({
    queryKey: ['import-pendencies-count', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('properties')
        .select('id, import_warnings')
        .eq('organization_id', profile.organization_id)
        .eq('source_provider', 'imobzi')
        .in('import_status', ['incomplete', 'needs_retry']);

      if (error) throw error;

      const items = (data || []).map(p => parseWarnings(p.import_warnings));
      const stats = {
        total: items.length,
        semProprietario: items.filter(w => w.includes('sem_proprietario')).length,
        semFotos: items.filter(w => w.includes('sem_fotos') || w.includes('fotos_ausentes')).length,
        semMetragem: items.filter(w => w.includes('sem_metragem') || w.includes('metragem_ausente')).length,
      };

      return stats;
    },
    enabled: !!profile?.organization_id,
    staleTime: 5 * 60 * 1000,
  });

  if (!pendencies || pendencies.total === 0) return null;

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4.5 w-4.5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">
                {pendencies.total} imóvel(is) importado(s) precisam de revisão
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {pendencies.semProprietario > 0 && (
                  <Badge variant="secondary" className="text-xs gap-1 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                    <UserX className="h-3 w-3" />
                    {pendencies.semProprietario} sem proprietário
                  </Badge>
                )}
                {pendencies.semFotos > 0 && (
                  <Badge variant="secondary" className="text-xs gap-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    <Image className="h-3 w-3" />
                    {pendencies.semFotos} sem fotos
                  </Badge>
                )}
                {pendencies.semMetragem > 0 && (
                  <Badge variant="secondary" className="text-xs gap-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    <Ruler className="h-3 w-3" />
                    {pendencies.semMetragem} sem metragem
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => navigate('/imoveis/pendencias')}
          >
            Revisar
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
