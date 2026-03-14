import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShieldAlert, ShieldCheck, ChevronDown, ChevronRight, AlertTriangle,
  Bug, Server, Database, Globe, Lock, FileWarning, Eye
} from "lucide-react";

type Severity = "critical" | "high" | "medium" | "low" | "ok";

interface Finding {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  description: string;
  fix: string;
  effort: string;
  status: "pending" | "fixed";
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  phase: number;
}

const FINDINGS: Finding[] = [
  // Critical
  {
    id: "C1",
    title: "export-database sem autenticação efetiva",
    severity: "critical",
    category: "Edge Function",
    description: "Aceita qualquer Authorization header sem validar. Dump completo do banco (78 tabelas + auth.users) via service_role.",
    fix: "Validar JWT + verificar developer role + audit log obrigatório.",
    effort: "15 min",
    status: "pending",
  },
  {
    id: "C2",
    title: "PII de proprietários exposta cross-org (marketplace)",
    severity: "critical",
    category: "RLS Policy",
    description: "owner_name, owner_phone, owner_email acessíveis para qualquer autenticado de qualquer organização quando status = 'disponivel'.",
    fix: "Criar view segura sem PII para cross-org. Restringir policy original para same-org only.",
    effort: "30 min",
    status: "pending",
  },
  {
    id: "C3",
    title: "toggle-maintenance-mode deactivate sem auth",
    severity: "critical",
    category: "Edge Function",
    description: "Permite action 'deactivate' sem autenticação válida — atacante pode desativar manutenção a qualquer momento.",
    fix: "Exigir autenticação para AMBAS as ações (activate e deactivate).",
    effort: "5 min",
    status: "pending",
  },
  // High
  {
    id: "A1",
    title: "Vazamento de detalhes de erro em 6+ Edge Functions",
    severity: "high",
    category: "Edge Function",
    description: "send-reset-email, send-invite-email, manage-member e toggle-maintenance-mode retornam err.message e detalhes internos da Resend API ao client.",
    fix: "Substituir por mensagem genérica 'Erro interno'. Logar detalhes no server.",
    effort: "15 min",
    status: "pending",
  },
  {
    id: "A2",
    title: "CORS wildcard (*) em 90%+ das Edge Functions",
    severity: "high",
    category: "Edge Function",
    description: "Apenas admin-users implementa allowlist de origens. Todas as outras usam Access-Control-Allow-Origin: *.",
    fix: "Criar helper CORS compartilhado com allowlist de domínios permitidos.",
    effort: "45 min",
    status: "pending",
  },
  {
    id: "A3",
    title: "Ausência total de rate limiting",
    severity: "high",
    category: "Infraestrutura",
    description: "Nenhuma Edge Function tem rate limiting. send-reset-email, platform-signup e AI endpoints são alvos de abuso.",
    fix: "Implementar rate limiter via tabela no banco + função check_rate_limit().",
    effort: "2 horas",
    status: "pending",
  },
  {
    id: "A4",
    title: "send-push sem autenticação — phishing via push",
    severity: "high",
    category: "Edge Function",
    description: "Qualquer pessoa pode enviar push notifications para qualquer user_id via endpoint público.",
    fix: "Adicionar shared secret (INTERNAL_TRIGGER_SECRET) entre trigger SQL e function.",
    effort: "15 min",
    status: "pending",
  },
  {
    id: "A5",
    title: "Imobzi API Keys acessíveis por corretores",
    severity: "high",
    category: "RLS Policy",
    description: "RLS em imobzi_api_keys permite SELECT/INSERT/DELETE para qualquer membro da organização, incluindo corretores.",
    fix: "Restringir a gestores (admin, sub_admin, leader, developer).",
    effort: "10 min",
    status: "pending",
  },
  {
    id: "A6",
    title: "Hierarquia incompleta no UPDATE de user_roles",
    severity: "high",
    category: "RLS Policy",
    description: "Leader pode rebaixar admin para corretor. Sem verificação de que o caller tem hierarquia superior ao target.",
    fix: "Criar função can_manage_role() com verificação hierárquica.",
    effort: "20 min",
    status: "pending",
  },
  {
    id: "A7",
    title: "Profile UPDATE permite alterar organization_id",
    severity: "high",
    category: "RLS Policy",
    description: "Usuário pode migrar-se para outra organização via API direta, bypassing RLS de todas as tabelas.",
    fix: "Adicionar WITH CHECK que impede alteração de organization_id.",
    effort: "10 min",
    status: "pending",
  },
  {
    id: "A8",
    title: "manage-member vaza erros internos",
    severity: "high",
    category: "Edge Function",
    description: "Retorna msg diretamente ao client, expondo nomes de tabelas e constraint names.",
    fix: "Sanitizar erros com mapeamento seguro antes de retornar.",
    effort: "5 min",
    status: "pending",
  },
  // Medium
  {
    id: "M1",
    title: "ai_usage_logs INSERT sem restrição de user_id",
    severity: "medium",
    category: "RLS Policy",
    description: "Permite falsificação de métricas de custo de IA.",
    fix: "WITH CHECK user_id = auth.uid()",
    effort: "5 min",
    status: "pending",
  },
  {
    id: "M2",
    title: "verification_codes INSERT por anônimos",
    severity: "medium",
    category: "RLS Policy",
    description: "Enumeração de emails possível.",
    fix: "Restringir a authenticated.",
    effort: "5 min",
    status: "pending",
  },
  {
    id: "M3",
    title: "Corretor pode DELETE properties",
    severity: "medium",
    category: "RLS Policy",
    description: "Deleção indevida de imóveis.",
    fix: "Role check no DELETE (gestor+).",
    effort: "5 min",
    status: "pending",
  },
  {
    id: "M4",
    title: "Corretor pode DELETE appointments",
    severity: "medium",
    category: "RLS Policy",
    description: "Deleção indevida de agendamentos.",
    fix: "Role check ou created_by = auth.uid().",
    effort: "5 min",
    status: "pending",
  },
  {
    id: "M5",
    title: "imobzi_settings acessível por todos os membros",
    severity: "medium",
    category: "RLS Policy",
    description: "Exposição de configuração de integração.",
    fix: "Restringir a gestores.",
    effort: "5 min",
    status: "pending",
  },
  {
    id: "M6",
    title: "Storage bucket property-images público",
    severity: "medium",
    category: "Storage",
    description: "Enumeração de imagens possível.",
    fix: "Considerar signed URLs.",
    effort: "1 hora",
    status: "pending",
  },
  {
    id: "M7",
    title: "Leaked Password Protection desabilitado",
    severity: "medium",
    category: "Autenticação",
    description: "Senhas fracas ou vazadas aceitas.",
    fix: "Habilitar na configuração de auth.",
    effort: "2 min",
    status: "pending",
  },
  {
    id: "M8",
    title: "Falta de auditoria de auth events",
    severity: "medium",
    category: "Auditoria",
    description: "Sem detecção de brute force ou tentativas de login.",
    fix: "Implementar auth hooks.",
    effort: "2 horas",
    status: "pending",
  },
  {
    id: "M9",
    title: "Falta de MFA para admin/developer",
    severity: "medium",
    category: "Autenticação",
    description: "Risco de takeover de conta.",
    fix: "Implementar TOTP para roles admin/developer.",
    effort: "4 horas",
    status: "pending",
  },
];

const CHECKLIST: ChecklistItem[] = [
  // Phase 0
  { id: "ck-1", label: "Fix auth em export-database", checked: false, phase: 0 },
  { id: "ck-2", label: "Fix auth em toggle-maintenance-mode deactivate", checked: false, phase: 0 },
  { id: "ck-3", label: "Remover info leak de send-reset-email e send-invite-email", checked: false, phase: 0 },
  // Phase 1
  { id: "ck-4", label: "Fix marketplace PII exposure (view sem PII para cross-org)", checked: false, phase: 1 },
  { id: "ck-5", label: "Sanitizar erros em manage-member", checked: false, phase: 1 },
  { id: "ck-6", label: "Proteger send-push contra chamadas externas", checked: false, phase: 1 },
  { id: "ck-7", label: "Habilitar Leaked Password Protection", checked: false, phase: 1 },
  { id: "ck-8", label: "Fix ai_usage_logs INSERT policy", checked: false, phase: 1 },
  // Phase 2
  { id: "ck-9", label: "Restringir imobzi_api_keys a gestores", checked: false, phase: 2 },
  { id: "ck-10", label: "Proteger profile UPDATE contra organization_id change", checked: false, phase: 2 },
  { id: "ck-11", label: "Adicionar hierarquia no UPDATE de user_roles", checked: false, phase: 2 },
  { id: "ck-12", label: "Role check no DELETE de properties e appointments", checked: false, phase: 2 },
  { id: "ck-13", label: "Implementar CORS allowlist para todas as functions", checked: false, phase: 2 },
  { id: "ck-14", label: "Restringir imobzi_settings a gestores", checked: false, phase: 2 },
  // Phase 3
  { id: "ck-15", label: "Implementar rate limiting em Edge Functions críticas", checked: false, phase: 3 },
  { id: "ck-16", label: "Adicionar auditoria de auth events", checked: false, phase: 3 },
  { id: "ck-17", label: "Audit log no export-database", checked: false, phase: 3 },
  { id: "ck-18", label: "Review de todas 35+ functions com verify_jwt = false", checked: false, phase: 3 },
  // Phase 4
  { id: "ck-19", label: "MFA para admin/developer", checked: false, phase: 4 },
  { id: "ck-20", label: "Test suite de segurança automatizada", checked: false, phase: 4 },
  { id: "ck-21", label: "Penetration test externo profissional", checked: false, phase: 4 },
];

const PHASE_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Fase 0 — Emergência (Hoje)", color: "text-destructive" },
  1: { label: "Fase 1 — Crítico (Semana 1)", color: "text-orange-500" },
  2: { label: "Fase 2 — Alto (Semanas 2-3)", color: "text-amber-500" },
  3: { label: "Fase 3 — Infraestrutura (Semanas 4-6)", color: "text-blue-500" },
  4: { label: "Fase 4 — Maturidade (Meses 2-3)", color: "text-muted-foreground" },
};

function severityBadge(s: Severity) {
  const map: Record<Severity, { label: string; variant: "destructive" | "default" | "secondary" | "outline" }> = {
    critical: { label: "CRÍTICO", variant: "destructive" },
    high: { label: "ALTO", variant: "default" },
    medium: { label: "MÉDIO", variant: "secondary" },
    low: { label: "BAIXO", variant: "outline" },
    ok: { label: "OK", variant: "outline" },
  };
  const { label, variant } = map[s];
  return <Badge variant={variant} className="text-[10px] px-1.5 py-0">{label}</Badge>;
}

function categoryIcon(cat: string) {
  switch (cat) {
    case "Edge Function": return <Server className="h-3.5 w-3.5 text-muted-foreground" />;
    case "RLS Policy": return <Database className="h-3.5 w-3.5 text-muted-foreground" />;
    case "Infraestrutura": return <Globe className="h-3.5 w-3.5 text-muted-foreground" />;
    case "Autenticação": return <Lock className="h-3.5 w-3.5 text-muted-foreground" />;
    case "Storage": return <FileWarning className="h-3.5 w-3.5 text-muted-foreground" />;
    case "Auditoria": return <Eye className="h-3.5 w-3.5 text-muted-foreground" />;
    default: return <Bug className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

export function SecurityAuditCard() {
  const [checklist, setChecklist] = useState(CHECKLIST);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"findings" | "checklist" | "summary">("summary");

  const toggleCheck = (id: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const totalChecked = checklist.filter(i => i.checked).length;
  const totalItems = checklist.length;
  const progress = Math.round((totalChecked / totalItems) * 100);

  const criticalCount = FINDINGS.filter(f => f.severity === "critical").length;
  const highCount = FINDINGS.filter(f => f.severity === "high").length;
  const mediumCount = FINDINGS.filter(f => f.severity === "medium").length;

  const phases = [0, 1, 2, 3, 4];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Auditoria de Segurança
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Score: 6.8/10
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Red Team Defensivo — 14/03/2026 — 84 tabelas · 259 policies · 60+ Edge Functions
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg border p-2 text-center">
            <p className="text-xl font-bold text-destructive">{criticalCount}</p>
            <p className="text-[10px] text-muted-foreground">Críticos</p>
          </div>
          <div className="rounded-lg border p-2 text-center">
            <p className="text-xl font-bold text-orange-500">{highCount}</p>
            <p className="text-[10px] text-muted-foreground">Altos</p>
          </div>
          <div className="rounded-lg border p-2 text-center">
            <p className="text-xl font-bold text-amber-500">{mediumCount}</p>
            <p className="text-[10px] text-muted-foreground">Médios</p>
          </div>
          <div className="rounded-lg border p-2 text-center">
            <p className="text-xl font-bold text-primary">{progress}%</p>
            <p className="text-[10px] text-muted-foreground">Corrigido</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* View tabs */}
        <div className="flex gap-1">
          {([
            { key: "summary", label: "Resumo" },
            { key: "findings", label: "Vulnerabilidades" },
            { key: "checklist", label: "Checklist" },
          ] as const).map(tab => (
            <Button
              key={tab.key}
              variant={activeView === tab.key ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setActiveView(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <Separator />

        {/* Summary view */}
        {activeView === "summary" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">✅ O que está bom</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• RLS habilitado em todas as tabelas com organization_id</li>
                <li>• RBAC via user_roles separada de profiles</li>
                <li>• Anti-escalação de privilégio (bloqueia criação de developer)</li>
                <li>• Billing webhook com HMAC + idempotência</li>
                <li>• Auditoria avançada com 27 campos + triggers automáticos</li>
                <li>• LGPD compliance (consent-gated analytics)</li>
              </ul>
            </div>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider">🔴 Prioridade Máxima</h4>
              <ul className="space-y-1 text-xs">
                <li className="text-destructive font-medium">• export-database: dump completo sem auth</li>
                <li className="text-destructive font-medium">• Marketplace: PII de proprietários cross-org</li>
                <li className="text-destructive font-medium">• toggle-maintenance-mode: deactivate sem auth</li>
              </ul>
            </div>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-orange-500 uppercase tracking-wider">🟠 Ação Necessária</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• 6+ Edge Functions vazam detalhes de erro internos</li>
                <li>• CORS wildcard em 90%+ das functions</li>
                <li>• Sem rate limiting em nenhuma function</li>
                <li>• send-push acessível sem auth</li>
                <li>• Profile UPDATE permite alterar organization_id</li>
                <li>• Leader pode rebaixar admin (hierarquia incompleta)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Findings view */}
        {activeView === "findings" && (
          <ScrollArea className="h-[400px] pr-2">
            <div className="space-y-1.5">
              {FINDINGS.map(f => (
                <Collapsible
                  key={f.id}
                  open={expandedFinding === f.id}
                  onOpenChange={() => setExpandedFinding(expandedFinding === f.id ? null : f.id)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-left transition-colors">
                      {expandedFinding === f.id
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      }
                      {categoryIcon(f.category)}
                      <span className="text-xs font-medium flex-1 truncate">
                        <span className="text-muted-foreground mr-1">{f.id}:</span>
                        {f.title}
                      </span>
                      {severityBadge(f.severity)}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 mr-2 mb-2 space-y-2 text-xs border-l-2 border-muted pl-3">
                      <div>
                        <span className="font-semibold text-muted-foreground">Categoria:</span>{" "}
                        <Badge variant="outline" className="text-[10px]">{f.category}</Badge>
                        <span className="ml-2 font-semibold text-muted-foreground">Esforço:</span>{" "}
                        <span>{f.effort}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-muted-foreground">Descrição:</span>
                        <p className="text-muted-foreground mt-0.5">{f.description}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-primary">Como corrigir:</span>
                        <p className="mt-0.5">{f.fix}</p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Checklist view */}
        {activeView === "checklist" && (
          <ScrollArea className="h-[400px] pr-2">
            <div className="space-y-4">
              {phases.map(phase => {
                const items = checklist.filter(i => i.phase === phase);
                const phaseInfo = PHASE_LABELS[phase];
                const phaseChecked = items.filter(i => i.checked).length;
                return (
                  <div key={phase} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs font-semibold ${phaseInfo.color}`}>
                        {phaseInfo.label}
                      </h4>
                      <span className="text-[10px] text-muted-foreground">
                        {phaseChecked}/{items.length}
                      </span>
                    </div>
                    {items.map(item => (
                      <label
                        key={item.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={() => toggleCheck(item.id)}
                        />
                        <span className={`text-xs ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {totalChecked}/{totalItems} itens concluídos
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Relatórios: docs/SECURITY_AUDIT + RED_TEAM_AUDIT
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
