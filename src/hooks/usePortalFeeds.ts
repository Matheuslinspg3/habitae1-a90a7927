import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PortalFeed {
  id: string;
  organization_id: string;
  portal_name: string;
  portal_label: string;
  is_active: boolean;
  feed_url: string | null;
  property_filter: Record<string, any>;
  last_generated_at: string | null;
  total_properties_exported: number;
  created_at: string;
  updated_at: string;
}

export interface PortalFeedLog {
  id: string;
  feed_id: string;
  generated_at: string;
  properties_count: number;
  errors_count: number;
  duration_ms: number | null;
}

const PORTAL_DEFAULTS = [
  { portal_name: 'olx_zap', portal_label: 'OLX / ZAP / VivaReal' },
  { portal_name: 'chavesnamao', portal_label: 'Chaves na Mão' },
  { portal_name: 'imovelweb', portal_label: 'Imovelweb' },
];

export function usePortalFeeds() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: feeds = [], isLoading } = useQuery({
    queryKey: ['portal-feeds', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('portal_feeds')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as PortalFeed[];
    },
    enabled: !!profile?.organization_id,
  });

  const initializeFeeds = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('Sem organização');

      const feedUrl = `${window.location.origin.replace('preview--', '').replace(/:\d+$/, '')}`;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const feedsToCreate = PORTAL_DEFAULTS
        .filter(pd => !feeds.find(f => f.portal_name === pd.portal_name))
        .map(pd => ({
          organization_id: profile.organization_id!,
          portal_name: pd.portal_name,
          portal_label: pd.portal_label,
          is_active: false,
          feed_url: `${supabaseUrl}/functions/v1/portal-xml-feed?feed_id=PLACEHOLDER&portal=${pd.portal_name}`,
        }));

      if (feedsToCreate.length === 0) return;

      // Insert and get IDs to update feed_url
      const { data: created, error } = await supabase
        .from('portal_feeds')
        .insert(feedsToCreate)
        .select();

      if (error) throw error;

      // Update feed URLs with actual IDs
      if (created) {
        for (const feed of created) {
          await supabase
            .from('portal_feeds')
            .update({
              feed_url: `${supabaseUrl}/functions/v1/portal-xml-feed?feed_id=${feed.id}`,
            })
            .eq('id', feed.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-feeds'] });
    },
  });

  const toggleFeed = useMutation({
    mutationFn: async ({ feedId, isActive }: { feedId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('portal_feeds')
        .update({ is_active: isActive })
        .eq('id', feedId);
      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['portal-feeds'] });
      toast.success(isActive ? 'Feed ativado' : 'Feed desativado');
    },
    onError: (err) => {
      toast.error('Erro ao atualizar feed: ' + (err as Error).message);
    },
  });

  const updateFilter = useMutation({
    mutationFn: async ({ feedId, filter }: { feedId: string; filter: Record<string, any> }) => {
      const { error } = await supabase
        .from('portal_feeds')
        .update({ property_filter: filter })
        .eq('id', feedId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-feeds'] });
      toast.success('Filtros atualizados');
    },
  });

  const regenerateFeed = useMutation({
    mutationFn: async (feedId: string) => {
      const feed = feeds.find(f => f.id === feedId);
      if (!feed?.feed_url) throw new Error('Feed URL não encontrada');

      // Call the feed URL to trigger generation
      const resp = await fetch(feed.feed_url);
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Erro ao gerar feed: ${err}`);
      }
      return resp.text();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-feeds'] });
      toast.success('Feed regenerado com sucesso');
    },
    onError: (err) => {
      toast.error('Erro ao regenerar: ' + (err as Error).message);
    },
  });

  return {
    feeds,
    isLoading,
    initializeFeeds: initializeFeeds.mutate,
    isInitializing: initializeFeeds.isPending,
    toggleFeed: toggleFeed.mutate,
    updateFilter: updateFilter.mutate,
    regenerateFeed: regenerateFeed.mutate,
    isRegenerating: regenerateFeed.isPending,
  };
}
