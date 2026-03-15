import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useAiUsageEvents } from "@/hooks/useAiBilling";
import { formatCost } from "@/services/ai-billing/pricing-calculator";

export function BillingUsageLogs() {
  const [period, setPeriod] = useState(30);
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const { data: events, isLoading } = useAiUsageEvents({
    period,
    provider: provider || undefined,
    status: status || undefined,
  });

  const filtered = events?.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.model.toLowerCase().includes(q) ||
      e.provider.toLowerCase().includes(q) ||
      e.user_id.toLowerCase().includes(q) ||
      e.request_id?.toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Logs de Uso de Tokens</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Provider" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="groq">Groq</SelectItem>
              <SelectItem value="stability">Stability</SelectItem>
              <SelectItem value="leonardo">Leonardo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar por modelo, user, request..."
            className="h-8 text-xs flex-1 min-w-[200px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Provider</th>
                  <th className="text-left p-2">Model</th>
                  <th className="text-right p-2">In Tok</th>
                  <th className="text-right p-2">Out Tok</th>
                  <th className="text-right p-2">Custo</th>
                  <th className="text-right p-2">Cobrado</th>
                  <th className="text-center p-2">Status</th>
                  <th className="text-center p-2">Stripe</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.slice(0, 100).map((e) => (
                  <tr key={e.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-2"><Badge variant="secondary" className="text-[10px]">{e.provider}</Badge></td>
                    <td className="p-2 font-mono text-[11px]">{e.model}</td>
                    <td className="p-2 text-right">{e.input_tokens?.toLocaleString()}</td>
                    <td className="p-2 text-right">{e.output_tokens?.toLocaleString()}</td>
                    <td className="p-2 text-right text-muted-foreground">{formatCost(Number(e.estimated_provider_cost))}</td>
                    <td className="p-2 text-right font-medium">{formatCost(Number(e.simulated_bill_amount))}</td>
                    <td className="p-2 text-center">
                      <Badge variant={e.request_status === "success" ? "default" : "destructive"} className="text-[9px]">
                        {e.request_status}
                      </Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="outline" className={`text-[9px] ${
                        e.stripe_sync_status === "synced" ? "text-green-600" :
                        e.stripe_sync_status === "mock_synced" ? "text-yellow-600" :
                        e.stripe_sync_status === "failed" ? "text-red-600" : "text-muted-foreground"
                      }`}>
                        {e.stripe_sync_status || "pending"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(filtered?.length || 0) === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum log encontrado.</p>
            )}
            {(filtered?.length || 0) > 100 && (
              <p className="text-xs text-muted-foreground text-center py-2">Exibindo 100 de {filtered?.length} resultados.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
