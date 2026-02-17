import { useLocation } from 'react-router-dom';
import { useImportProgress } from '@/contexts/ImportProgressContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Loader2, CheckCircle, XCircle, Building2, ChevronUp, ChevronDown } from 'lucide-react';
import { useState, useContext } from 'react';
import { cn } from '@/lib/utils';

// Internal component that uses the hook
function FloatingImportProgressInner() {
  const { activeImport, stopTracking, isTracking } = useImportProgress();
  const location = useLocation();
  const [isMinimized, setIsMinimized] = useState(false);

  // Don't show if no active import
  if (!activeImport) return null;

  // Don't show floating if we're on integrations page (it shows inline there)
  const isOnIntegrationsPage = location.pathname === '/integracoes';
  if (isOnIntegrationsPage) return null;

  const progressPercentage = activeImport.total > 0
    ? Math.round((activeImport.current / activeImport.total) * 100)
    : 0;

  const isComplete = activeImport.status === 'completed' || activeImport.status === 'failed';

  return (
    <Card className={cn(
      "fixed bottom-4 right-4 z-50 shadow-lg border-primary/20 transition-all duration-300",
      isMinimized ? "w-auto" : "w-80"
    )}>
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-3 hover:bg-muted/50 transition-colors rounded-lg"
        >
          <div className="relative">
            <Building2 className="h-5 w-5 text-primary" />
            {isTracking && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <span className="text-sm font-medium">
            {isTracking ? `${progressPercentage}%` : (isComplete ? 'Concluído' : 'Importação')}
          </span>
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        </button>
      ) : (
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isTracking ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : activeImport.status === 'completed' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm font-medium">
                {isTracking ? 'Importando imóveis...' : 
                 activeImport.status === 'completed' ? 'Importação concluída' : 'Importação falhou'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsMinimized(true)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              {!isTracking && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={stopTracking}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{activeImport.current}/{activeImport.total} imóveis</span>
              <span>{progressPercentage}%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
              <span>{activeImport.success}</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-destructive" />
              <span>{activeImport.errors}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>{activeImport.imagesProcessed} imgs</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// Wrapper component that safely checks for provider
export function FloatingImportProgress() {
  // Try to safely render - if not in provider context, return null
  try {
    return <FloatingImportProgressInner />;
  } catch {
    return null;
  }
}
