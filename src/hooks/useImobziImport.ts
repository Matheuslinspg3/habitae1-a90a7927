import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useImportProgress, type RetryParams } from '@/contexts/ImportProgressContext';

export interface ImobziPropertyPreview {
  property_id: string;
  title: string;
  code?: string;
  property_type?: string;
  cover_photo?: string;
  site_url?: string;
  address_city?: string;
  address_neighborhood?: string;
  address_street?: string;
  sale_price?: number;
  rent_price?: number;
  bedrooms?: number;
  bathrooms?: number;
  suites?: number;
  parking_spots?: number;
  area_total?: number;
  building_name?: string;
}

export interface ApiKeyEntry {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
}

export interface ImportProgress {
  current: number;
  total: number;
  success: number;
  errors: number;
  imagesProcessed: number;
  status: 'idle' | 'processing' | 'completed' | 'failed';
}

export function useImobziImport() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeImport, startTracking, stopTracking, isTracking, queuedImport } = useImportProgress();
  
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isFetchingProperties, setIsFetchingProperties] = useState(false);
  const [properties, setProperties] = useState<ImobziPropertyPreview[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const cancelledRef = useRef(false);

  // Derive processing state from global context
  const isProcessing = isTracking;
  const processingProgress: ImportProgress = activeImport ? {
    current: activeImport.current,
    total: activeImport.total,
    success: activeImport.success,
    errors: activeImport.errors,
    imagesProcessed: activeImport.imagesProcessed,
    status: activeImport.status as ImportProgress['status'],
  } : {
    current: 0,
    total: 0,
    success: 0,
    errors: 0,
    imagesProcessed: 0,
    status: 'idle',
  };

  // Load API keys from database
  const loadApiKeys = useCallback(async () => {
    if (!profile?.organization_id) return;
    
    setIsLoadingKeys(true);
    try {
      const { data, error } = await supabase
        .from('imobzi_api_keys' as 'profiles')
        .select('id, name, api_key, created_at')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const typedData = (data || []) as unknown as ApiKeyEntry[];
      setApiKeys(typedData);
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as chaves de API.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingKeys(false);
    }
  }, [profile?.organization_id, toast]);

  // Save a new API key
  const saveApiKey = useCallback(async (name: string, apiKey: string) => {
    if (!profile?.organization_id) {
      toast({
        title: 'Erro',
        description: 'Usuário não vinculado a uma organização.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('imobzi_api_keys' as 'profiles')
        .insert({
          organization_id: profile.organization_id,
          name,
          api_key: apiKey,
        } as never);

      if (error) throw error;
      
      toast({
        title: 'Chave adicionada',
        description: 'A chave de API foi salva com sucesso.',
      });
      
      await loadApiKeys();
      return true;
    } catch (error) {
      const err = error as Error;
      console.error('Error saving API key:', error);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível salvar a chave.',
        variant: 'destructive',
      });
      return false;
    }
  }, [profile?.organization_id, toast, loadApiKeys]);

  // Delete an API key
  const deleteApiKey = useCallback(async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('imobzi_api_keys' as 'profiles')
        .delete()
        .eq('id', keyId);

      if (error) throw error;
      
      toast({
        title: 'Chave removida',
        description: 'A chave de API foi removida com sucesso.',
      });
      
      await loadApiKeys();
      return true;
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a chave.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, loadApiKeys]);

  // Fetch properties from Imobzi via Edge Function
  const fetchProperties = useCallback(async (apiKey: string): Promise<ImobziPropertyPreview[]> => {
    if (!user?.id) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado.',
        variant: 'destructive',
      });
      return [];
    }

    setIsFetchingProperties(true);
    setProperties([]);

    try {
      console.log('[IMPORT] Fetching properties from Imobzi...');
      
      const { data, error } = await supabase.functions.invoke('imobzi-list', {
        body: { api_key: apiKey },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar imóveis');
      }

      const fetchedProperties = data.properties as ImobziPropertyPreview[];
      setProperties(fetchedProperties);

      toast({
        title: 'Imóveis carregados',
        description: `${fetchedProperties.length} imóveis encontrados.`,
      });

      console.log(`[IMPORT] Fetched ${fetchedProperties.length} properties`);
      return fetchedProperties;

    } catch (error) {
      const err = error as Error;
      console.error('[IMPORT] Error fetching properties:', error);
      toast({
        title: 'Erro ao buscar imóveis',
        description: err.message || 'Falha na comunicação com a API.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsFetchingProperties(false);
    }
  }, [user?.id, toast]);

  // Process selected properties
  const processSelectedProperties = useCallback(async (
    selectedPropertyIds: string[],
    apiKey: string,
    marketplacePropertyIds: string[] = []
  ): Promise<{ imported: number; errors: number }> => {
    if (selectedPropertyIds.length === 0) {
      toast({
        title: 'Nenhum imóvel selecionado',
        description: 'Selecione ao menos um imóvel para processar.',
        variant: 'destructive',
      });
      return { imported: 0, errors: 0 };
    }

    if (!profile?.organization_id || !user?.id) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado ou sem organização.',
        variant: 'destructive',
      });
      return { imported: 0, errors: 0 };
    }

    cancelledRef.current = false;

    try {
      // Validate queue rules before proceeding
      const { data: queueResult, error: queueError } = await supabase
        .rpc('validate_sync_queue', {
          p_organization_id: profile.organization_id,
          p_source_provider: 'imobzi',
        });

      if (queueError) {
        console.error('[IMPORT] Queue validation error:', queueError);
      } else if (queueResult) {
        const result = queueResult as { action: string; message: string; cancelled_id?: string };
        if (result.action === 'blocked') {
          toast({
            title: 'Fila cheia',
            description: 'Já existe uma sincronização em andamento e outra na fila. Aguarde ou cancele uma delas.',
            variant: 'destructive',
          });
          return { imported: 0, errors: 0 };
        }
        if (result.action === 'cancelled_pending') {
          toast({
            title: 'Sincronização anterior cancelada',
            description: 'A sincronização pendente do mesmo tipo foi cancelada para dar lugar à nova.',
          });
        }
      }

      // Create import run record with pending_property_ids
      const { data: runData, error: runError } = await supabase
        .from('import_runs')
        .insert({
          organization_id: profile.organization_id,
          source_provider: 'imobzi',
          status: 'pending',
          total_properties: selectedPropertyIds.length,
          pending_property_ids: selectedPropertyIds,
          marketplace_property_ids: marketplacePropertyIds.length > 0 ? marketplacePropertyIds : undefined,
        } as any)
        .select('id')
        .single();

      if (runError || !runData?.id) {
        throw new Error('Não foi possível criar registro de importação');
      }

      const runId = runData.id;
      console.log(`[IMPORT] Created import run: ${runId}`);

      // Create import run items
      const items = selectedPropertyIds.map(propertyId => ({
        run_id: runId,
        source_property_id: propertyId,
        status: 'pending',
        source_title: properties.find(p => p.property_id === propertyId)?.title,
      }));

      const { error: itemsError } = await supabase
        .from('import_run_items')
        .insert(items);

      if (itemsError) {
        console.error('[IMPORT] Error creating run items:', itemsError);
      }

      // Start global progress tracking with retry params
      const retryParams: RetryParams = { apiKey: apiKey, organizationId: profile.organization_id, userId: user.id };
      startTracking(runId, selectedPropertyIds.length, 'imobzi', retryParams);

      // AH-01: Only send api_key and run_id — org/user resolved server-side from JWT
      console.log(`[IMPORT] Starting processing for ${selectedPropertyIds.length} properties...`);
      
      const { data, error } = await supabase.functions.invoke('imobzi-process', {
        body: {
          api_key: apiKey,
          run_id: runId,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao iniciar processamento');
      }

      console.log(`[IMPORT] Processing started: ${data.message}`);

      toast({
        title: 'Processamento iniciado',
        description: `Importando ${selectedPropertyIds.length} imóveis. O progresso é exibido em segundo plano.`,
      });

      // Return immediately - progress is tracked globally
      return { imported: 0, errors: 0 };

    } catch (error) {
      const err = error as Error;
      console.error('[IMPORT] Error starting processing:', error);

      toast({
        title: 'Erro ao iniciar importação',
        description: err.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      });

      return { imported: 0, errors: 0 };
    }
  }, [user?.id, profile?.organization_id, properties, toast, startTracking]);

  // Cancel import tracking
  const cancelImport = useCallback(() => {
    cancelledRef.current = true;
    stopTracking();
    toast({
      title: 'Acompanhamento cancelado',
      description: 'O processamento pode continuar em segundo plano.',
    });
  }, [toast, stopTracking]);

  // Reset state
  const reset = useCallback(() => {
    setProperties([]);
    cancelledRef.current = false;
  }, []);

  // Retry failed properties from a previous run
  const retryFailedProperties = useCallback(async (runId: string, apiKey: string) => {
    if (!profile?.organization_id || !user?.id) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado ou sem organização.',
        variant: 'destructive',
      });
      return;
    }

    setIsRetrying(true);

    try {
      // Get failed property IDs from the run
      const { data: failedItems, error: itemsError } = await supabase
        .from('import_run_items')
        .select('source_property_id')
        .eq('run_id', runId)
        .eq('status', 'error');

      if (itemsError) throw itemsError;

      if (!failedItems || failedItems.length === 0) {
        toast({
          title: 'Nenhum erro encontrado',
          description: 'Não há imóveis com erro para tentar novamente.',
        });
        setIsRetrying(false);
        return;
      }

      const failedPropertyIds = failedItems.map(item => item.source_property_id);
      console.log(`[IMPORT] Retrying ${failedPropertyIds.length} failed properties`);

      // Create a new import run for the retry
      const { data: newRun, error: runError } = await supabase
        .from('import_runs')
        .insert({
          organization_id: profile.organization_id,
          source_provider: 'imobzi',
          status: 'pending',
          total_properties: failedPropertyIds.length,
          pending_property_ids: failedPropertyIds,
        })
        .select('id')
        .single();

      if (runError || !newRun?.id) {
        throw new Error('Não foi possível criar registro de importação');
      }

      // Create import run items
      const items = failedPropertyIds.map(propertyId => ({
        run_id: newRun.id,
        source_property_id: propertyId,
        status: 'pending',
      }));

      await supabase
        .from('import_run_items')
        .insert(items);

      // Start tracking with retry params
      const retryParams: RetryParams = { apiKey: apiKey, organizationId: profile.organization_id, userId: user.id };
      startTracking(newRun.id, failedPropertyIds.length, 'imobzi', retryParams);

      // AH-01: Only send api_key and run_id
      const { data, error } = await supabase.functions.invoke('imobzi-process', {
        body: {
          api_key: apiKey,
          run_id: newRun.id,
        },
      });

      if (error) throw error;

      toast({
        title: 'Tentando novamente',
        description: `Reprocessando ${failedPropertyIds.length} imóveis com erro.`,
      });

    } catch (error) {
      const err = error as Error;
      console.error('[IMPORT] Error retrying failed properties:', error);
      toast({
        title: 'Erro ao tentar novamente',
        description: err.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      });
    } finally {
      setIsRetrying(false);
    }
  }, [user?.id, profile?.organization_id, toast, startTracking]);

  return {
    // API Keys
    apiKeys,
    isLoadingKeys,
    loadApiKeys,
    saveApiKey,
    deleteApiKey,
    
    // Properties fetching
    properties,
    isFetchingProperties,
    fetchProperties,
    
    // Property processing
    isProcessing,
    processingProgress,
    processSelectedProperties,
    cancelImport,
    retryFailedProperties,
    isRetrying,
    
    // Utils
    reset,
  };
}
