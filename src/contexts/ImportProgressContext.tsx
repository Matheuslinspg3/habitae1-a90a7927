import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const POLLING_INTERVAL_MS = 3000;
const STALE_THRESHOLD_MS = 90_000;
const MAX_AUTO_RETRIES = 3;

export interface ImportProgress {
  runId: string;
  current: number;
  total: number;
  success: number;
  errors: number;
  imagesProcessed: number;
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'paused' | 'cancelled';
  sourceProvider: string;
}

export interface RetryParams {
  apiKey: string;
  organizationId: string;
  userId: string;
}

interface ImportProgressContextType {
  activeImport: ImportProgress | null;
  queuedImport: ImportProgress | null;
  startTracking: (runId: string, total: number, sourceProvider?: string, retryParams?: RetryParams) => void;
  stopTracking: () => void;
  clearImport: () => void;
  cancelActiveImport: (runId: string) => Promise<void>;
  pauseImport: (runId: string) => Promise<void>;
  resumeImport: (runId: string) => Promise<void>;
  deleteImport: (runId: string) => Promise<void>;
  cancelQueuedImport: (runId: string) => Promise<void>;
  isTracking: boolean;
}

const ImportProgressContext = createContext<ImportProgressContextType | undefined>(undefined);

export function ImportProgressProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeImport, setActiveImport] = useState<ImportProgress | null>(null);
  const [queuedImport, setQueuedImport] = useState<ImportProgress | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const retryParamsRef = useRef<RetryParams | null>(null);
  const lastProgressRef = useRef<{ current: number; timestamp: number }>({ current: 0, timestamp: Date.now() });
  const autoRetryCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const stopTracking = useCallback(() => {
    stopPolling();
    retryParamsRef.current = null;
    autoRetryCountRef.current = 0;
    setActiveImport(null);
    setQueuedImport(null);
  }, [stopPolling]);

  const clearImport = useCallback(() => {
    stopPolling();
    retryParamsRef.current = null;
    autoRetryCountRef.current = 0;
    setActiveImport(null);
    setQueuedImport(null);
  }, [stopPolling]);

  const cancelActiveImport = useCallback(async (runId: string) => {
    try {
      await supabase
        .from('import_runs')
        .update({ status: 'cancelled', finished_at: new Date().toISOString() })
        .eq('id', runId);

      setActiveImport(prev => prev?.runId === runId ? { ...prev, status: 'cancelled' } : prev);
      
      toast({ title: 'Sincronização cancelada', description: 'A importação foi interrompida.' });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['import-runs'] });
    } catch (err) {
      console.error('[ImportProgress] Error cancelling import:', err);
      toast({ title: 'Erro ao cancelar', description: 'Não foi possível cancelar a sincronização.', variant: 'destructive' });
    }
  }, [queryClient, toast]);

  const pauseImport = useCallback(async (runId: string) => {
    try {
      await supabase
        .from('import_runs')
        .update({ status: 'paused' })
        .eq('id', runId);

      setActiveImport(prev => prev?.runId === runId ? { ...prev, status: 'paused' } : prev);
      
      toast({ title: 'Sincronização pausada', description: 'A importação foi pausada.' });
      await queryClient.invalidateQueries({ queryKey: ['import-runs'] });
    } catch (err) {
      console.error('[ImportProgress] Error pausing import:', err);
      toast({ title: 'Erro ao pausar', description: 'Não foi possível pausar a sincronização.', variant: 'destructive' });
    }
  }, [queryClient, toast]);

  const resumeImport = useCallback(async (runId: string) => {
    try {
      await supabase
        .from('import_runs')
        .update({ status: 'processing' })
        .eq('id', runId);

      setActiveImport(prev => prev?.runId === runId ? { ...prev, status: 'processing' } : prev);

      // Re-invoke the edge function to continue processing
      const params = retryParamsRef.current;
      if (params) {
        await supabase.functions.invoke('imobzi-process', {
          body: {
            api_key: params.apiKey,
            run_id: runId,
          },
        });
      }
      
      toast({ title: 'Sincronização retomada', description: 'A importação foi retomada.' });
      await queryClient.invalidateQueries({ queryKey: ['import-runs'] });
    } catch (err) {
      console.error('[ImportProgress] Error resuming import:', err);
      toast({ title: 'Erro ao retomar', description: 'Não foi possível retomar a sincronização.', variant: 'destructive' });
    }
  }, [queryClient, toast]);

  const deleteImport = useCallback(async (runId: string) => {
    try {
      // First delete items, then the run
      await supabase
        .from('import_run_items')
        .delete()
        .eq('run_id', runId);

      await supabase
        .from('import_runs')
        .update({ status: 'cancelled', finished_at: new Date().toISOString() })
        .eq('id', runId);

      setActiveImport(prev => prev?.runId === runId ? null : prev);
      setQueuedImport(prev => prev?.runId === runId ? null : prev);

      toast({ title: 'Sincronização removida', description: 'A importação foi removida.' });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['import-runs'] });
    } catch (err) {
      console.error('[ImportProgress] Error deleting import:', err);
      toast({ title: 'Erro ao remover', description: 'Não foi possível remover a sincronização.', variant: 'destructive' });
    }
  }, [queryClient, toast]);

  const cancelQueuedImport = useCallback(async (runId: string) => {
    try {
      await supabase
        .from('import_runs')
        .update({ status: 'cancelled', finished_at: new Date().toISOString() })
        .eq('id', runId);

      setQueuedImport(prev => prev?.runId === runId ? null : prev);
      
      toast({ title: 'Sincronização pendente cancelada', description: 'A importação em fila foi cancelada.' });
      await queryClient.invalidateQueries({ queryKey: ['import-runs'] });
    } catch (err) {
      console.error('[ImportProgress] Error cancelling queued import:', err);
      toast({ title: 'Erro ao cancelar', description: 'Não foi possível cancelar a sincronização pendente.', variant: 'destructive' });
    }
  }, [queryClient, toast]);

  const attemptAutoRetry = useCallback(async (runId: string) => {
    const params = retryParamsRef.current;
    if (!params || autoRetryCountRef.current >= MAX_AUTO_RETRIES) return;

    autoRetryCountRef.current++;
    console.log(`[ImportProgress] Auto-retry #${autoRetryCountRef.current} for run ${runId}`);

    try {
      await supabase.functions.invoke('imobzi-process', {
        body: {
          api_key: params.apiKey,
          run_id: runId,
        },
      });
      lastProgressRef.current = { current: lastProgressRef.current.current, timestamp: Date.now() };
    } catch (err) {
      console.error('[ImportProgress] Auto-retry exception:', err);
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      // Fetch up to 2 active/pending runs
      const { data: runs, error } = await supabase
        .from('import_runs')
        .select('id, status, total_properties, imported, errors, images_processed, source_provider')
        .in('status', ['pending', 'processing', 'running', 'starting', 'paused'])
        .order('created_at', { ascending: true })
        .limit(2);

      if (error) {
        console.error('[ImportProgress] Polling error:', error);
        return;
      }

      if (!runs || runs.length === 0) {
        // Check if there's a recently completed one
        const { data: recentRun } = await supabase
          .from('import_runs')
          .select('id, status, total_properties, imported, errors, images_processed, source_provider')
          .in('status', ['completed', 'failed'])
          .order('finished_at', { ascending: false })
          .limit(1);

        if (recentRun && recentRun.length > 0) {
          const run = recentRun[0];
          const currentProgress = (run.imported || 0) + (run.errors || 0);
          const progress: ImportProgress = {
            runId: run.id,
            current: currentProgress,
            total: run.total_properties || 0,
            success: run.imported || 0,
            errors: run.errors || 0,
            imagesProcessed: run.images_processed || 0,
            status: run.status as ImportProgress['status'],
            sourceProvider: run.source_provider || 'imobzi',
          };

          setActiveImport(prev => {
            // Only update if it's the same run we're tracking
            if (prev && prev.runId === run.id) return progress;
            return prev;
          });
        }

        setQueuedImport(null);
        return;
      }

      // Classify runs: active (processing/running/starting/paused) vs pending
      const activeRun = runs.find(r => ['processing', 'running', 'starting', 'paused'].includes(r.status));
      const pendingRun = runs.find(r => r.status === 'pending');

      const mapRun = (run: typeof runs[0]): ImportProgress => {
        const currentProgress = (run.imported || 0) + (run.errors || 0);
        return {
          runId: run.id,
          current: currentProgress,
          total: run.total_properties || 0,
          success: run.imported || 0,
          errors: run.errors || 0,
          imagesProcessed: run.images_processed || 0,
          status: run.status as ImportProgress['status'],
          sourceProvider: run.source_provider || 'imobzi',
        };
      };

      if (activeRun) {
        const progress = mapRun(activeRun);
        setActiveImport(progress);

        // Stale detection for active processing
        if (['processing', 'running', 'starting'].includes(activeRun.status)) {
          const currentProgress = (activeRun.imported || 0) + (activeRun.errors || 0);
          if (currentProgress !== lastProgressRef.current.current) {
            lastProgressRef.current = { current: currentProgress, timestamp: Date.now() };
            autoRetryCountRef.current = 0;
          } else {
            const staleDuration = Date.now() - lastProgressRef.current.timestamp;
            if (staleDuration > STALE_THRESHOLD_MS && retryParamsRef.current) {
              attemptAutoRetry(activeRun.id);
            }
          }
        }

        // Check if completed
        if (['completed', 'failed'].includes(activeRun.status)) {
          retryParamsRef.current = null;
          autoRetryCountRef.current = 0;
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
          toast({
            title: activeRun.status === 'completed' ? 'Importação concluída' : 'Importação com erros',
            description: progress.errors > 0
              ? `${progress.success} importado(s), ${progress.errors} erro(s). ${progress.imagesProcessed} imagens.`
              : `${progress.success} importado(s). ${progress.imagesProcessed} imagens.`,
            variant: progress.errors > 0 && progress.success === 0 ? 'destructive' : 'default',
          });
          setTimeout(() => setActiveImport(null), 5000);
        }
      } else {
        setActiveImport(null);
      }

      if (pendingRun) {
        setQueuedImport(mapRun(pendingRun));
      } else {
        setQueuedImport(null);
      }

    } catch (err) {
      console.error('[ImportProgress] Polling exception:', err);
    }
  }, [queryClient, toast, attemptAutoRetry]);

  const startTracking = useCallback((runId: string, total: number, sourceProvider = 'imobzi', retryParams?: RetryParams) => {
    stopPolling();

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

    poll();
    pollingRef.current = setInterval(poll, POLLING_INTERVAL_MS);
  }, [poll, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Resume tracking on mount
  useEffect(() => {
    const checkRunningImports = async () => {
      try {
        const { data: runs } = await supabase
          .from('import_runs')
          .select('id, status, total_properties, imported, errors, images_processed, source_provider')
          .in('status', ['pending', 'processing', 'running', 'starting', 'paused'])
          .order('created_at', { ascending: true })
          .limit(2);

        if (runs && runs.length > 0) {
          const activeRun = runs.find(r => ['processing', 'running', 'starting', 'paused'].includes(r.status));
          if (activeRun) {
            console.log('[ImportProgress] Resuming tracking for:', activeRun.id);
            startTracking(activeRun.id, activeRun.total_properties || 0, activeRun.source_provider || 'imobzi');
          } else if (runs[0]) {
            // Only pending runs
            startTracking(runs[0].id, runs[0].total_properties || 0, runs[0].source_provider || 'imobzi');
          }
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
      queuedImport,
      startTracking,
      stopTracking,
      clearImport,
      cancelActiveImport,
      pauseImport,
      resumeImport,
      deleteImport,
      cancelQueuedImport,
      isTracking: (activeImport !== null && ['pending', 'processing', 'running', 'starting'].includes(activeImport.status)) ||
                  (queuedImport !== null && queuedImport.status === 'pending'),
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
