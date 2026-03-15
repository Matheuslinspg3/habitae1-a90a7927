import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import { useAiBillingPricing, useUpdatePricing } from "@/hooks/useAiBilling";
import { useToast } from "@/hooks/use-toast";
import type { PricingConfig } from "@/services/ai-billing/types";

export function BillingPricingTable() {
  const { data: pricing, isLoading } = useAiBillingPricing();
  const updatePricing = useUpdatePricing();
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, Partial<PricingConfig>>>({});

  if (isLoading) {
    return <Card><CardContent className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  const handleChange = (id: string, field: string, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: parseFloat(value) || 0 },
    }));
  };

  const handleSave = async (item: PricingConfig) => {
    const changes = edits[item.id!];
    if (!changes) return;
    try {
      await updatePricing.mutateAsync({ id: item.id!, ...changes });
      setEdits((prev) => { const n = { ...prev }; delete n[item.id!]; return n; });
      toast({ title: "Pricing atualizado", description: `${item.provider}/${item.model}` });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tabela de Precificação por Modelo</CardTitle>
        <p className="text-xs text-muted-foreground">Preço por 1k tokens (USD). Margem e custo final são calculados automaticamente.</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-2">Provider / Model</th>
                <th className="text-right p-2">$/1k Input</th>
                <th className="text-right p-2">$/1k Output</th>
                <th className="text-right p-2">Markup %</th>
                <th className="text-right p-2">Margem Fixa</th>
                <th className="text-center p-2">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {pricing?.map((item) => {
                const e = edits[item.id!] || {};
                const hasChanges = !!edits[item.id!];
                return (
                  <tr key={item.id} className="border-b hover:bg-muted/30">
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{item.provider}</Badge>
                        <span className="font-mono text-[11px]">{item.model}</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.0001"
                        className="h-7 w-24 text-xs text-right ml-auto"
                        defaultValue={item.price_per_1k_input_tokens}
                        onChange={(ev) => handleChange(item.id!, "price_per_1k_input_tokens", ev.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.0001"
                        className="h-7 w-24 text-xs text-right ml-auto"
                        defaultValue={item.price_per_1k_output_tokens}
                        onChange={(ev) => handleChange(item.id!, "price_per_1k_output_tokens", ev.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="1"
                        className="h-7 w-20 text-xs text-right ml-auto"
                        defaultValue={item.markup_percentage}
                        onChange={(ev) => handleChange(item.id!, "markup_percentage", ev.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.001"
                        className="h-7 w-20 text-xs text-right ml-auto"
                        defaultValue={item.fixed_margin}
                        onChange={(ev) => handleChange(item.id!, "fixed_margin", ev.target.value)}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant={item.is_active ? "default" : "secondary"} className="text-[9px]">
                        {item.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {hasChanges && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleSave(item)}>
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
