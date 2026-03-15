import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, CheckCircle2, XCircle, RefreshCw, QrCode, Trash2, Smartphone } from "lucide-react";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function WhatsAppIntegrationCard() {
  const {
    instance,
    isLoading,
    createInstance,
    connectInstance,
    checkStatus,
    disconnectInstance,
    deleteInstance,
    isCreating,
    isConnecting,
    isCheckingStatus,
    isDisconnecting,
    isDeleting,
  } = useWhatsAppInstance();

  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleCreate = async () => {
    await createInstance();
    // Auto-connect after creation to show QR code immediately
    try {
      const result = await connectInstance();
      if (result?.qr_code) {
        setQrCode(result.qr_code);
      }
    } catch (e) {
      // Instance created but connect may need a moment
      console.warn("Auto-connect after create:", e);
    }
  };

  const handleConnect = async () => {
    const result = await connectInstance();
    if (result?.qr_code) {
      setQrCode(result.qr_code);
    }
  };

  const handleCheckStatus = async () => {
    const result = await checkStatus();
    if (result?.status === "connected") {
      setQrCode(null);
      return;
    }

    if (result?.qr_code) {
      setQrCode(result.qr_code);
    }
  };

  const displayedQrCode = qrCode || instance?.qr_code || null;

  const statusBadge = () => {
    if (!instance) return null;
    switch (instance.status) {
      case "connected":
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Conectado</Badge>;
      case "connecting":
        return <Badge variant="secondary" className="gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Conectando</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Desconectado</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">WhatsApp</CardTitle>
            <CardDescription>
              Integração via Uazapi — envie mensagens automáticas pelo CRM
            </CardDescription>
          </div>
          {statusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : !instance ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ative o WhatsApp para enviar mensagens automáticas diretamente do CRM.
              Este é um add-on cobrado separadamente.
            </p>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
              Ativar WhatsApp
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Instance info */}
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Instância:</span>
                <span className="font-medium">{instance.instance_name}</span>
              </div>
              {instance.phone_number && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Número:</span>
                  <span className="font-medium">{instance.phone_number}</span>
                </div>
              )}
            </div>

            {/* QR Code */}
            {qrCode && instance.status !== "connected" && (
              <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-background">
                <p className="text-sm font-medium">Escaneie o QR Code no WhatsApp</p>
                <img src={qrCode} alt="QR Code WhatsApp" className="w-48 h-48" />
                <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={isCheckingStatus}>
                  {isCheckingStatus ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Verificar conexão
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {instance.status !== "connected" && (
                <Button variant="outline" size="sm" onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
                  {qrCode ? "Novo QR Code" : "Conectar"}
                </Button>
              )}

              {instance.status === "connected" && (
                <Button variant="outline" size="sm" onClick={() => disconnectInstance()} disabled={isDisconnecting}>
                  {isDisconnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={isCheckingStatus}>
                {isCheckingStatus ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Verificar status
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" /> Remover
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover instância WhatsApp?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá desconectar e remover permanentemente a instância WhatsApp desta organização. Você poderá criar uma nova depois.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { deleteInstance(); setQrCode(null); }} disabled={isDeleting}>
                      {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
