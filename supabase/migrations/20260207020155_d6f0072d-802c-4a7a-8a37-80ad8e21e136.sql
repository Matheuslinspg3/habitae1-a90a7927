-- Limpeza: marcar runs travadas como failed
UPDATE public.import_runs
SET status = 'failed',
    finished_at = now(),
    error_message = 'Auto-cleanup: run travada detectada'
WHERE status IN ('pending', 'processing', 'running', 'starting')
  AND created_at < now() - interval '1 hour';

-- Limpar items presos em processing
UPDATE public.import_run_items
SET status = 'error',
    error_message = 'Auto-cleanup: item travado em processing',
    updated_at = now()
WHERE status = 'processing'
  AND updated_at < now() - interval '1 hour';
