import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Eye, EyeOff, Copy, Check, ShieldAlert, Key, Download,
  Loader2, Code2, Database, AlertTriangle, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TableRaw {
  name: string;
  row_count: number;
  column_count: number;
  encrypted_columns: string | null;
  has_user_id: boolean;
}

interface CredentialsData {
  project_url: string | null;
  anon_key: string | null;
  service_role_key: string | null;
  secrets: Record<string, string>;
  edge_functions: string[];
  edge_functions_count: number;
  database_tables?: TableRaw[];
}

type TableCategory = "essential" | "history" | "ignore";

function classifyTable(t: TableRaw): { category: TableCategory; reason: string } {
  const n = t.name.toLowerCase();
  if (/_log|_history|migration|audit/.test(n) || t.encrypted_columns) {
    return { category: "ignore", reason: t.encrypted_columns ? "Contém colunas criptografadas" : "Tabela de logs/histórico/auditoria" };
  }
  if (/settings|config|role/.test(n) || (n === "profiles" && t.has_user_id) ||
      (t.has_user_id && t.row_count < 100 && /credit|subscription/.test(n))) {
    return { category: "essential", reason: /settings|config/.test(n) ? "Tabela de configuração" : /role/.test(n) ? "Tabela de permissões" : "Tabela de perfil de usuário" };
  }
  if (/payment|sale|transaction|order/.test(n)) {
    return { category: "history", reason: "Tabela de transações/pagamentos" };
  }
  return { category: "history", reason: "Tabela de dados" };
}

function maskValue(value: string): string {
  if (value.length <= 24) return "••••••••••••••••";
  return value.slice(0, 12) + "•••••" + value.slice(-8);
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} title={label || "Copiar"}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function SecretRow({ label, value, revealed }: { label: string; value: string; revealed: boolean }) {
  const [showThis, setShowThis] = useState(false);
  const isVisible = revealed || showThis;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
      <code className="text-xs font-medium text-muted-foreground shrink-0">{label}</code>
      <div className="flex items-center gap-1 min-w-0">
        <code className="text-xs truncate max-w-[300px]">{isVisible ? value : maskValue(value)}</code>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setShowThis(!showThis)}>
          {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

const categoryConfig: Record<TableCategory, { label: string; color: string; className: string }> = {
  essential: { label: "Essencial", color: "green", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  history: { label: "Histórico", color: "blue", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  ignore: { label: "Ignorar", color: "gray", className: "bg-muted text-muted-foreground" },
};

// Import edge function sources at build time
const edgeFunctionSources = import.meta.glob('/supabase/functions/*/index.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export default function AdminCredentials() {
  const { session } = useAuth();
  const [data, setData] = useState<CredentialsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const handleReveal = async () => {
    if (data) {
      setRevealed(!revealed);
      return;
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("admin-credentials", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      setData(result);
      setRevealed(true);
      toast({ title: "Credenciais carregadas", description: "Dados revelados com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Falha ao carregar credenciais", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const secretsCount = data ? Object.keys(data.secrets).length : 0;
  const credentialsCount = data ? [data.project_url, data.anon_key, data.service_role_key].filter(Boolean).length : 0;

  const allCredentialsText = useMemo(() => {
    if (!data) return "";
    const lines: string[] = [];
    lines.push("═══════════════════════════════════════");
    lines.push("  CREDENCIAIS DO PROJETO");
    lines.push("═══════════════════════════════════════");
    if (data.project_url) lines.push(`SUPABASE_URL=${data.project_url}`);
    if (data.anon_key) lines.push(`SUPABASE_ANON_KEY=${data.anon_key}`);
    if (data.service_role_key) lines.push(`SUPABASE_SERVICE_ROLE_KEY=${data.service_role_key}`);
    lines.push("");
    lines.push("═══════════════════════════════════════");
    lines.push("  SECRETS");
    lines.push("═══════════════════════════════════════");
    for (const [k, v] of Object.entries(data.secrets)) {
      lines.push(`${k}=${v}`);
    }
    lines.push("");
    lines.push("═══════════════════════════════════════");
    lines.push("  EDGE FUNCTIONS");
    lines.push("═══════════════════════════════════════");
    lines.push(data.edge_functions.join(", "));
    return lines.join("\n");
  }, [data]);

  const handleCopyAll = () => {
    navigator.clipboard.writeText(allCredentialsText);
    toast({ title: "Copiado!", description: "Todas as credenciais copiadas para a área de transferência." });
  };

  const handleDownloadSecrets = () => {
    if (!data) return;
    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
    const entries: string[] = [];
    if (data.project_url) entries.push(`  SUPABASE_URL: "${data.project_url}",`);
    if (data.anon_key) entries.push(`  SUPABASE_ANON_KEY: "${data.anon_key}",`);
    if (data.service_role_key) entries.push(`  SUPABASE_SERVICE_ROLE_KEY: "${data.service_role_key}",`);
    for (const [k, v] of Object.entries(data.secrets)) {
      entries.push(`  ${k}: "${v.replace(/"/g, '\\"')}",`);
    }
    const content = `// Secrets do projeto - Gerado em ${dateStr}\nexport const SECRETS = {\n${entries.join("\n")}\n} as const;\n\nexport type SecretKey = keyof typeof SECRETS;\n`;
    const blob = new Blob([content], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "secrets.ts";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Download iniciado", description: "Arquivo secrets.ts gerado." });
  };

  const handleDownloadEdgeFunctions = () => {
    const entries = Object.entries(edgeFunctionSources);
    if (entries.length === 0) {
      toast({ title: "Nenhuma função encontrada", description: "Não há edge functions no build.", variant: "destructive" });
      return;
    }
    const parts: string[] = [];
    parts.push(`// Edge Functions - Exportadas em ${new Date().toLocaleDateString("pt-BR")}`);
    parts.push(`// Total: ${entries.length} funções\n`);
    for (const [path, source] of entries) {
      const name = path.split("/").slice(-2, -1)[0];
      parts.push("═".repeat(60));
      parts.push(`// Function: ${name}`);
      parts.push(`// Path: ${path}`);
      parts.push("═".repeat(60));
      parts.push(source as string);
      parts.push("\n");
    }
    const blob = new Blob([parts.join("\n")], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edge-functions.ts";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Download iniciado", description: `${entries.length} edge functions exportadas.` });
  };

  const tables = data?.database_tables || [];
  const classifiedTables = useMemo(() => tables.map(t => ({ ...t, ...classifyTable(t) })), [tables]);
  const hasUserTables = classifiedTables.some(t => ["profiles", "user_roles"].includes(t.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credenciais do Projeto</h1>
          <p className="text-muted-foreground text-sm">Gerencie e exporte credenciais, secrets e configurações.</p>
        </div>
        <div className="flex gap-2">
          {data && revealed && (
            <>
              <Button variant="outline" size="sm" onClick={handleCopyAll}>
                <Copy className="h-4 w-4 mr-1" /> Copiar Tudo
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadSecrets}>
                <Download className="h-4 w-4 mr-1" /> Download .ts
              </Button>
            </>
          )}
          <Button onClick={handleReveal} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : revealed ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {loading ? "Carregando..." : revealed ? "Ocultar Tudo" : "Revelar Tudo"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <CardTitle className="text-sm">Credenciais</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data ? credentialsCount : "—"}</p>
            <p className="text-xs text-muted-foreground">Chaves principais</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm">Secrets</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data ? secretsCount : "—"}</p>
            <p className="text-xs text-muted-foreground">Variáveis de ambiente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm">Edge Functions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data ? data.edge_functions_count : "—"}</p>
            <p className="text-xs text-muted-foreground">Funções ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm">Tabelas do Banco</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data ? tables.length : "—"}</p>
            <p className="text-xs text-muted-foreground">Tabelas públicas</p>
          </CardContent>
        </Card>
      </div>

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Credentials Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <CardTitle className="text-base">Credenciais</CardTitle>
              </div>
              <CardDescription>Project URL, Anon Key, Service Role Key</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              {data.project_url && <SecretRow label="SUPABASE_URL" value={data.project_url} revealed={revealed} />}
              {data.anon_key && <SecretRow label="SUPABASE_ANON_KEY" value={data.anon_key} revealed={revealed} />}
              {data.service_role_key && <SecretRow label="SUPABASE_SERVICE_ROLE_KEY" value={data.service_role_key} revealed={revealed} />}
            </CardContent>
          </Card>

          {/* Secrets Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Secrets</CardTitle>
              </div>
              <CardDescription>{secretsCount} variáveis de ambiente extras</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 max-h-[400px] overflow-y-auto">
              {Object.entries(data.secrets).map(([k, v]) => (
                <SecretRow key={k} label={k} value={v} revealed={revealed} />
              ))}
              {secretsCount === 0 && <p className="text-sm text-muted-foreground">Nenhum secret adicional configurado.</p>}
            </CardContent>
          </Card>

          {/* Edge Functions Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Edge Functions</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadEdgeFunctions}>
                  <Download className="h-4 w-4 mr-1" /> Download .ts
                </Button>
              </div>
              <CardDescription>{data.edge_functions_count} funções descobertas via probe</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.edge_functions.map((fn) => (
                  <Badge key={fn} variant="secondary" className="font-mono text-xs">{fn}</Badge>
                ))}
                {data.edge_functions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma edge function encontrada.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Database Tables Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Tabelas do Banco</CardTitle>
              </div>
              <CardDescription>{tables.length} tabelas no schema public</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasUserTables && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Usuários migrados precisam redefinir a senha via "Esqueci minha senha". Emails e metadados são copiados, mas senhas são hashes irreversíveis.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[500px] overflow-y-auto">
                {classifiedTables.map((t) => {
                  const config = categoryConfig[t.category];
                  return (
                    <Tooltip key={t.name}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-between p-2 rounded border border-border/50 hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge className={`text-[10px] px-1.5 shrink-0 ${config.className}`}>{config.label}</Badge>
                            <code className="text-xs truncate">{t.name}</code>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{t.row_count}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px]">
                        <p className="text-xs font-medium">{t.reason}</p>
                        <p className="text-xs text-muted-foreground">{t.row_count} registros · {t.column_count} colunas</p>
                        {t.encrypted_columns && <p className="text-xs text-amber-500">Colunas criptografadas: {t.encrypted_columns}</p>}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
