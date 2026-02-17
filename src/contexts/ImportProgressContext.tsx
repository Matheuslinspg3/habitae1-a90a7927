import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const POLLING_INTERVAL_MS = 3000;
const STALE_THRESHOLD_MS = 90_000; // 90 seconds without progress = stale
const MAX_AUTO_RETRIES = 3;

export interface ImportProgress {
  runId: string;
  current: number;
  total: number;
  success: number;
  errors: number;
  imagesProcessed: number;
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
  sourceProvider: string;
}

export interface RetryParams {
  apiKey: string;
  organizationId: string;
  userId: string;
}

interface ImportProgressContextType {
  activeImport: ImportProgress | null;
  startTracking: (runId: string, total: number, sourceProvider?: string, retryParams?: RetryParams) => void;
  stopTracking: () => void;
  clearImport: () => void;
  cancelActiveImport: (runId: string) => Promise<void>;
  isTracking: boolean;
}

const ImportProgressContext = createContext<ImportProgressContextType | undefined>(undefined);

export function ImportProgressProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeImport, setActiveImport] = useState<ImportProgress | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Auto-retry state
  const retryParamsRef = useRef<RetryParams | null>(null);
  const lastProgressRef = useRef<{ current: number; timestamp: number }>({ current: 0, timestamp: Date.now() });
  const autoRetryCountRef = useRef(0);

  const stopTracking = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    retryParamsRef.current = null;
    autoRetryCountRef.current = 0;
    setActiveImport(null);
  }, []);

  const clearImport = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    retryParamsRef.current = null;
    autoRetryCountRef.current = 0;
    setActiveImport(null);
  }, []);

  const cancelActiveImport = useCallback(async (runId: string) => {
    try {
      await supabase
        .from('import_runs')
        .update({ status: 'cancelled', finished_at: new Date().toISOString() })
        .eq('id', runId);

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      setActiveImport(prev => prev ? { ...prev, status: 'failed' } : null);
      retryParamsRef.current = null;
      autoRetryCountRef.current = 0;

      toast({ title: 'Sincronização cancelada', description: 'A importação foi interrompida.' });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
    } catch (err) {
      console.error('[ImportProgress] Error cancelling import:', err);
      toast({ title: 'Erro ao cancelar', description: 'Não foi possível cancelar a sincronização.', variant: 'destructive' });
    }
  }, [queryClient, toast]);

  // Auto-retry: re-invoke edge function when stale
  const attemptAutoRetry = useCallback(async (runId: string) => {
    const params = retryParamsRef.current;
    if (!params || autoRetryCountRef.current >= MAX_AUTO_RETRIES) {
      if (autoRetryCountRef.current >= MAX_AUTO_RETRIES) {
        console.warn('[ImportProgress] Max auto-retries reached');
      }
      return;
    }

    autoRetryCountRef.current++;
    console.log(`[ImportProgress] Auto-retry #${autoRetryCountRef.current} for run ${runId}`);

    try {
      const { error } = await supabase.functions.invoke('imobzi-process', {
        body: {
          api_key: params.apiKey,
          run_id: runId,
          organization_id: params.organizationId,
          user_id: params.userId,
        },
      });

      if (error) {
        console.error('[ImportProgress] Auto-retry invoke failed:', error);
      } else {
        console.log('[ImportProgress] Auto-retry invoked successfully');
        // Reset stale timer
        lastProgressRef.current = { current: lastProgressRef.current.current, timestamp: Date.now() };
      }
    } catch (err) {
      console.error('[ImportProgress] Auto-retry exception:', err);
    }
  }, []);

  const poll = useCallback(async (runId: string) => {
    try {
      const { data: run, error } = await supabase
        .from('import_runs')
        .select('status, total_properties, imported, errors, images_processed, source_provider')
        .eq('id', runId)
        .single();

      if (error) {
        console.error('[ImportProgress] Polling error:', error);
        return;
      }

      const currentProgress = (run.imported || 0) + (run.errors || 0);

      const progress: ImportProgress = {
        runId,
        current: currentProgress,
        total: run.total_properties || 0,
        success: run.imported || 0,
        errors: run.errors || 0,
        imagesProcessed: run.images_processed || 0,
        status: run.status as ImportProgress['status'],
        sourceProvider: run.source_provider || 'imobzi',
      };

      setActiveImport(progress);

      // ===== STALE DETECTION & AUTO-RETRY =====
      if (run.status === 'processing' || run.status === 'pending' || run.status === 'running' || run.status === 'starting') {
        if (currentProgress !== lastProgressRef.current.current) {
          // Progress changed - reset stale timer and retry counter
          lastProgressRef.current = { current: currentProgress, timestamp: Date.now() };
          autoRetryCountRef.current = 0;
        } else {
          // No progress - check if stale
          const staleDuration = Date.now() - lastProgressRef.current.timestamp;
          if (staleDuration > STALE_THRESHOLD_MS && retryParamsRef.current) {
            console.warn(`[ImportProgress] Stale for ${Math.round(staleDuration / 1000)}s, attempting auto-retry`);
            attemptAutoRetry(runId);
          }
        }
      }

      // Check if completed
      if (run.status === 'completed' || run.status === 'failed') {
        console.log(`[ImportProgress] Import ${run.status}`);

        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        retryParamsRef.current = null;
        autoRetryCountRef.current = 0;

        await queryClient.invalidateQueries({ queryKey: ['properties'] });

        toast({
          title: run.status === 'completed' ? 'Importação concluída' : 'Importação com erros',
          description: progress.errors > 0
            ? `${progress.success} importado(s), ${progress.errors} erro(s). ${progress.imagesProcessed} imagens.`
            : `${progress.success} importado(s). ${progress.imagesProcessed} imagens.`,
          variant: progress.errors > 0 && progress.success === 0 ? 'destructive' : 'default',
        });

        setTimeout(() => setActiveImport(null), 5000);
      }
    } catch (err) {
      console.error('[ImportProgress] Polling exception:', err);
    }
  }, [queryClient, toast, attemptAutoRetry]);

  const startTracking = useCallback((runId: string, total: number, sourceProvider = 'imobzi', retryParams?: RetryParams) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    // Store retry params for auto-retry
    if (retryParams) {
      retryParamsRef.current = retryParams;
    }
    lastProgressRef.current = { current: 0, timestamp: Date.now() };
    autoRetryCountRef.current = 0;

    setActiveImport({
      runId,
      current: 0,
      total,
      success: 0,
      errors: 0,
      imagesProcessed: 0,
      status: 'processing',
      sourceProvider,
    });

    poll(runId);
    pollingRef.current = setInterval(() => poll(runId), POLLING_INTERVAL_MS);
  }, [poll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Resume tracking on mount
  useEffect(() => {
    const checkRunningImports = async () => {
      try {
        const { data: run } = await supabase
          .from('import_runs')
          .select('id, status, total_properties, imported, errors, images_processed, source_provider')
          .in('status', ['pending', 'processing', 'running', 'starting'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (run) {
          console.log('[ImportProgress] Resuming tracking for:', run.id);
          startTracking(run.id, run.total_properties || 0, run.source_provider || 'imobzi');
          // Note: no retryParams on resume - user needs to be on integrations page for auto-retry
        }
      } catch (err) {
        console.error('[ImportProgress] Error checking running imports:', err);
      }
    };

    checkRunningImports();
  }, [startTracking]);

  return (
    <ImportProgressContext.Provider value={{
      activeImport,
      startTracking,
      stopTracking,
      clearImport,
      cancelActiveImport,
      isTracking: activeImport !== null && ['pending', 'processing'].includes(activeImport.status),
    }}>
      {children}
    </ImportProgressContext.Provider>
  );
}

export function useImportProgress() {
  const context = useContext(ImportProgressContext);
  if (!context) {
    throw new Error('useImportProgress must be used within an ImportProgressProvider');
  }
  return context;
}
