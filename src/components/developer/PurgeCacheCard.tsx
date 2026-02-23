import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PurgeCacheCard() {
  const [isPurging, setIsPurging] = useState(false);

  const handlePurge = async () => {
    setIsPurging(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloudflare-purge-cache");

      if (error) throw error;

      if (data?.success) {
        toast.success("Cache do Cloudflare limpo com sucesso!");
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (err: any) {
      toast.error("Falha ao limpar cache", {
        description: err.message || "Verifique as credenciais do Cloudflare",
      });
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Cloudflare Cache
        </CardTitle>
        <CardDescription>
          Limpar todo o cache do domínio no Cloudflare (Purge Everything)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePurge}
          disabled={isPurging}
          className="w-full"
        >
          {isPurging ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Limpando cache...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Purge Everything
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
