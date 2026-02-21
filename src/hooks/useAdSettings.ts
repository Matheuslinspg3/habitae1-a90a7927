import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface AdAccount {
  id: string;
  organization_id: string;
  provider: 'meta' | 'google';
  external_account_id: string | null;
  name: string | null;
  is_active: boolean;
  auth_payload: any;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AdSettings {
  id: string;
  organization_id: string;
  auto_send_to_crm: boolean;
  crm_stage_id: string | null;
}

export function useAdAccount() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: account, isLoading } = useQuery({
    queryKey: ['ad-account', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      const { data } = await supabase
        .from('ad_accounts')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('provider', 'meta' as any)
        .maybeSingle();
      return data as AdAccount | null;
    },
    enabled: !!profile?.organization_id,
  });

  const saveAccount = useMutation({
    mutationFn: async ({ accessToken, adAccountId }: { accessToken: string; adAccountId: string }) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      const { error } = await supabase
        .from('ad_accounts')
        .upsert({
          organization_id: profile.organization_id,
          provider: 'meta' as any,
          external_account_id: adAccountId,
          name: `Meta Ads - ${adAccountId}`,
          is_active: true,
          auth_payload: { access_token: accessToken },
          status: 'connected',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id,provider' } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-account'] });
      toast({ title: 'Conectado', description: 'Conta Meta Ads conectada com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const disconnectAccount = useMutation({
    mutationFn: async () => {
      if (!account?.id) throw new Error('Conta não encontrada');
      const { error } = await supabase
        .from('ad_accounts')
        .update({ status: 'disconnected', is_active: false, auth_payload: null, updated_at: new Date().toISOString() })
        .eq('id', account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-account'] });
      toast({ title: 'Desconectado', description: 'Conta Meta Ads desconectada.' });
    },
  });

  return {
    account,
    isLoading,
    isConnected: account?.status === 'connected' && account?.is_active,
    saveAccount: saveAccount.mutate,
    disconnectAccount: disconnectAccount.mutate,
    isSaving: saveAccount.isPending,
  };
}

export function useAdSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['ad-settings', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      const { data } = await supabase
        .from('ad_settings')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();
      return data as AdSettings | null;
    },
    enabled: !!profile?.organization_id,
  });

  const updateSettings = useMutation({
    mutationFn: async ({ autoSendToCrm, crmStageId }: { autoSendToCrm: boolean; crmStageId: string | null }) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      const { error } = await supabase
        .from('ad_settings')
        .upsert({
          organization_id: profile.organization_id,
          auto_send_to_crm: autoSendToCrm,
          crm_stage_id: crmStageId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id' } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-settings'] });
      toast({ title: 'Salvo', description: 'Configurações de automação atualizadas.' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateSettings.mutate,
    isSaving: updateSettings.isPending,
  };
}
