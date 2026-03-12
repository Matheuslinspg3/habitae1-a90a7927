import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { Button } from "@/components/ui/button";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { Construction, RefreshCw, Wifi, Download, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Maintenance() {
  const { isMaintenanceMode, maintenanceMessage, refetch, isLoading } = useMaintenanceMode();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  // If maintenance is no longer active, redirect to dashboard (works via realtime too)
  useEffect(() => {
    if (!isLoading && !isMaintenanceMode) {
      navigate("/dashboard", { replace: true });
    }
  }, [isMaintenanceMode, isLoading, navigate]);

  // More aggressive polling on the maintenance page itself (every 10s)
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10_000);
    return () => clearInterval(interval);
  }, [refetch]);

  const handleRetry = async () => {
    setChecking(true);
    await refetch();
    setTimeout(() => setChecking(false), 1000);
  };

  const handleExportDatabase = async () => {
    setExporting(true);
    setExportProgress("Verificando permissões...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
        return;
      }

      setExportProgress("Exportando todas as tabelas...");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/export-database`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setExportProgress("Gerando arquivos CSV...");

      // Create a zip-like bundle: download each table as individual CSV
      const tables = result.tables as Record<string, { count: number; csv: string }>;
      const tableNames = Object.keys(tables).filter((t) => tables[t].count > 0);

      if (tableNames.length === 0) {
        toast({ title: "Aviso", description: "Nenhum dado encontrado para exportar." });
        return;
      }

      // Create a single combined file with separators
      let combinedContent = `# Exportação Lovable Cloud - ${new Date().toISOString()}\n`;
      combinedContent += `# Total de tabelas: ${tableNames.length}\n\n`;

      for (const tableName of tableNames) {
        const table = tables[tableName];
        combinedContent += `\n${"=".repeat(60)}\n`;
        combinedContent += `# TABELA: ${tableName} (${table.count} registros)\n`;
        combinedContent += `${"=".repeat(60)}\n\n`;
        combinedContent += table.csv + "\n";
      }

      // Download combined file
      const blob = new Blob([combinedContent], { type: "text/plain; charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `porta-export-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Also offer individual CSVs
      for (const tableName of tableNames) {
        const table = tables[tableName];
        if (table.csv) {
          const csvBlob = new Blob([table.csv], { type: "text/csv; charset=utf-8" });
          const csvUrl = URL.createObjectURL(csvBlob);
          const csvLink = document.createElement("a");
          csvLink.href = csvUrl;
          csvLink.download = `${tableName}.csv`;
          document.body.appendChild(csvLink);
          csvLink.click();
          document.body.removeChild(csvLink);
          URL.revokeObjectURL(csvUrl);
          // Small delay between downloads
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      const totalRecords = tableNames.reduce((sum, t) => sum + tables[t].count, 0);
      toast({
        title: "Exportação concluída!",
        description: `${tableNames.length} tabelas exportadas com ${totalRecords.toLocaleString()} registros.`,
      });

      if (result.errors?.length > 0) {
        console.warn("Erros durante exportação:", result.errors);
        toast({
          title: "Algumas tabelas falharam",
          description: result.errors.join(", "),
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Export error:", err);
      toast({
        title: "Erro na exportação",
        description: err.message || "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <HabitaeLogo variant="icon" size="lg" />
        </div>

        {/* Maintenance icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Construction className="h-10 w-10 text-amber-500" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground">
            Sistema em Manutenção
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            {maintenanceMessage}
          </p>
        </div>

        {/* Retry button */}
        <Button
          onClick={handleRetry}
          variant="outline"
          size="lg"
          disabled={checking}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Verificando..." : "Tentar novamente"}
        </Button>

        {/* Auto-check indicator — "Verificação" is clickable for admin export */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
          <Wifi className="h-3 w-3" />
          <span>
            <button
              onClick={handleExportDatabase}
              disabled={exporting}
              className="hover:text-muted-foreground transition-colors cursor-default bg-transparent border-none p-0 text-inherit text-xs"
            >
              {exporting ? "Exportando..." : "Verificação"}
            </button>
            {" automática ativa — você será redirecionado assim que a manutenção terminar"}
          </span>
        </div>

        {/* Export progress */}
        {exporting && (
          <div className="flex items-center justify-center gap-2 text-xs text-primary animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{exportProgress}</span>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-muted-foreground/50 tracking-widest uppercase">
          Porta do Corretor
        </p>
      </div>
    </div>
  );
}
