import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, RefreshCw, Loader2, CheckCircle, XCircle, Image, StopCircle, RotateCcw } from "lucide-react";
import { ApiKeyManager } from "./ApiKeyManager";
import { PropertyPreviewGrid } from "./PropertyPreviewGrid";
import { useImobziImport } from "@/hooks/useImobziImport";
import { useImportProgress } from "@/contexts/ImportProgressContext";

export function ImobziIntegrationCard() {
  const {
    apiKeys,
    isLoadingKeys,
    loadApiKeys,
    saveApiKey,
    deleteApiKey,
    properties,
    isFetchingProperties,
    fetchProperties,
    isProcessing,
    processingProgress,
    processSelectedProperties,
    cancelImport,
    retryFailedProperties,
    isRetrying,
    reset,
  } = useImobziImport();

  const { activeImport, isTracking, clearImport, cancelActiveImport } = useImportProgress();

  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [showPropertiesView, setShowPropertiesView] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  // Auto-select first key when keys are loaded
  useEffect(() => {
    if (apiKeys.length > 0 && !selectedKeyId) {
      setSelectedKeyId(apiKeys[0].id);
    }
  }, [apiKeys, selectedKeyId]);

  // Show progress view if there's an active import
  const hasActiveImport = isTracking || (activeImport && ['completed', 'failed'].includes(activeImport.status));

  const selectedKey = apiKeys.find((k) => k.id === selectedKeyId);

  const handleSync = async () => {
    if (!selectedKey) return;
    
    const result = await fetchProperties(selectedKey.api_key);
    if (result.length > 0) {
      setShowPropertiesView(true);
    }
  };

  const handleProcess = async (selectedIds: string[], marketplaceIds: string[]) => {
    if (!selectedKey) return;
    await processSelectedProperties(selectedIds, selectedKey.api_key, marketplaceIds);
  };

  const handleBackToSettings = () => {
    setShowPropertiesView(false);
    reset();
  };

  const handleCancelImport = async () => {
    if (!activeImport?.runId) return;
    setIsCancelling(true);
    await cancelActiveImport(activeImport.runId);
    setIsCancelling(false);
  };

  const handleRetryFailed = async () => {
    if (!activeImport?.runId) return;
    const selectedKey = apiKeys.find(k => k.id === selectedKeyId);
    if (!selectedKey) return;
    await retryFailedProperties(activeImport.runId, selectedKey.api_key);
  };

  // Calculate progress percentage
  const progressPercentage = processingProgress.total > 0
    ? Math.round((processingProgress.current / processingProgress.total) * 100)
    : 0;

  // Active import progress view (global import in progress)
  if (hasActiveImport && !showPropertiesView) {
    const progressPercentage = activeImport && activeImport.total > 0
      ? Math.round((activeImport.current / activeImport.total) * 100)
      : 0;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Sincronização em andamento</CardTitle>
                <CardDescription>
                  {isTracking 
                    ? 'Importando imóveis do Imobzi...'
                    : activeImport?.status === 'completed' 
                      ? 'Importação concluída'
                      : 'Importação finalizada com erros'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={isTracking ? "default" : activeImport?.status === 'completed' ? "default" : "destructive"}>
              {isTracking ? 'Processando' : activeImport?.status === 'completed' ? 'Concluído' : 'Falhou'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress Display */}
          {activeImport && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progresso da Importação</span>
                <span className="text-muted-foreground">
                  {activeImport.current}/{activeImport.total} ({progressPercentage}%)
                </span>
              </div>
              
              <Progress value={progressPercentage} className="h-2" />
              
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span>{activeImport.success} sucesso</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span>{activeImport.errors} erros</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Image className="h-4 w-4 text-blue-500" />
                  <span>{activeImport.imagesProcessed} imagens</span>
                </div>
              </div>
            </div>
          )}

          {/* Completed Status */}
          {activeImport?.status === 'completed' && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">
                  Importação concluída com sucesso!
                </span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                {activeImport.success} imóvel(is) importado(s), {activeImport.imagesProcessed} imagens processadas.
              </p>
            </div>
          )}

          {/* Failed Status */}
          {activeImport?.status === 'failed' && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="font-medium text-destructive">
                  Importação falhou
                </span>
              </div>
              <p className="text-sm text-destructive/80 mt-1">
                {activeImport.errors} erro(s). Verifique os logs para mais detalhes.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {/* Cancel button during processing */}
            {isTracking && (
              <Button 
                onClick={handleCancelImport}
                disabled={isCancelling}
                variant="destructive"
                className="w-full gap-2"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <StopCircle className="h-4 w-4" />
                    Cancelar Sincronização
                  </>
                )}
              </Button>
            )}

            {/* Retry failed button when there are errors */}
            {!isTracking && activeImport && activeImport.errors > 0 && (
              <Button 
                onClick={handleRetryFailed}
                disabled={isRetrying || !selectedKeyId}
                variant="default"
                className="w-full gap-2"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Tentando novamente...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Tentar novamente ({activeImport.errors} com erro)
                  </>
                )}
              </Button>
            )}

            {/* New sync button when complete */}
            {!isTracking && (
              <Button 
                onClick={() => clearImport()} 
                variant="outline" 
                className="w-full"
              >
                Nova Sincronização
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Properties selection view (after fetching properties list)
  if (showPropertiesView) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Imóveis do Imobzi</CardTitle>
                <CardDescription>
                  {isProcessing 
                    ? 'Processando imóveis...'
                    : 'Selecione os imóveis que deseja importar'}
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" onClick={handleBackToSettings} disabled={isProcessing}>
              Voltar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Enhanced Progress Display */}
          {isProcessing && processingProgress.status === 'processing' && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progresso da Importação</span>
                <span className="text-muted-foreground">
                  {processingProgress.current}/{processingProgress.total} ({progressPercentage}%)
                </span>
              </div>
              
              <Progress value={progressPercentage} className="h-2" />
              
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{processingProgress.success} sucesso</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span>{processingProgress.errors} erros</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Image className="h-4 w-4 text-blue-500" />
                  <span>{processingProgress.imagesProcessed} imagens</span>
                </div>
              </div>
            </div>
          )}

          {/* Completed Status */}
          {processingProgress.status === 'completed' && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">
                  Importação concluída com sucesso!
                </span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                {processingProgress.success} imóvel(is) importado(s), {processingProgress.imagesProcessed} imagens processadas.
              </p>
            </div>
          )}

          {/* Failed Status */}
          {processingProgress.status === 'failed' && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="font-medium text-destructive">
                  Importação falhou
                </span>
              </div>
              <p className="text-sm text-destructive/80 mt-1">
                {processingProgress.errors} erro(s). Verifique os logs para mais detalhes.
              </p>
            </div>
          )}

          <PropertyPreviewGrid
            properties={properties}
            isLoading={isFetchingProperties}
            isProcessing={isProcessing}
            processingProgress={{ current: processingProgress.current, total: processingProgress.total }}
            onProcess={handleProcess}
            onCancel={cancelImport}
          />
        </CardContent>
      </Card>
    );
  }

  // Settings view
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Imobzi</CardTitle>
              <CardDescription>
                Sincronize seus imóveis automaticamente com o Imobzi
              </CardDescription>
            </div>
          </div>
          <Badge variant={apiKeys.length > 0 ? "default" : "secondary"}>
            {apiKeys.length > 0 ? `${apiKeys.length} chave(s)` : "Sem chaves"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <ApiKeyManager
          apiKeys={apiKeys}
          isLoading={isLoadingKeys}
          onAdd={saveApiKey}
          onDelete={deleteApiKey}
        />

        {apiKeys.length > 0 && (
          <>
            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sincronizar com</label>
                <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma chave" />
                  </SelectTrigger>
                  <SelectContent>
                    {apiKeys.map((key) => (
                      <SelectItem key={key.id} value={key.id}>
                        {key.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSync}
                disabled={!selectedKeyId || isFetchingProperties}
                className="w-full gap-2"
                size="lg"
              >
                {isFetchingProperties ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando imóveis...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Sincronizar
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
