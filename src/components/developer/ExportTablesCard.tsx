import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

type ExportableTable = "leads" | "properties";

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(",")),
  ].join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportTablesCard() {
  const [loading, setLoading] = useState<ExportableTable | null>(null);

  const exportTable = async (table: ExportableTable) => {
    setLoading(table);
    try {
      const PAGE = 1000;
      let offset = 0;
      const all: Record<string, unknown>[] = [];
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        offset += PAGE;
      }

      if (all.length === 0) {
        toast({ title: "Sem dados", description: `Nenhum registro em ${table}.` });
        return;
      }

      const csv = toCSV(all);
      const filename = `${table}_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
      downloadCSV(csv, filename);
      toast({
        title: "Exportação concluída",
        description: `${all.length.toLocaleString("pt-BR")} registros exportados de ${table}.`,
      });
    } catch (err) {
      toast({
        title: "Erro na exportação",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Exportar Tabelas
        </CardTitle>
        <CardDescription>Baixar CSV completo de Leads e Imóveis</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => exportTable("leads")}
          disabled={loading !== null}
        >
          {loading === "leads" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar Leads
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => exportTable("properties")}
          disabled={loading !== null}
        >
          {loading === "properties" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar Imóveis
        </Button>
      </CardContent>
    </Card>
  );
}
