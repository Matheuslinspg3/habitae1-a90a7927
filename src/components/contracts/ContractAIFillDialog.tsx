import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIFillResult {
  type?: "venda" | "locacao";
  property_id?: string | null;
  lead_id?: string | null;
  broker_id?: string | null;
  value?: number;
  commission_percentage?: number | null;
  start_date?: string;
  end_date?: string | null;
  payment_day?: number | null;
  readjustment_index?: string | null;
  notes?: string | null;
  summary?: string;
}

interface ContractAIFillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFill: (data: AIFillResult) => void;
}

export function ContractAIFillDialog({
  open,
  onOpenChange,
  onFill,
}: ContractAIFillDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setSummary(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "contract-ai-fill",
        { body: { prompt: prompt.trim() } }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSummary(data.summary || "Dados preenchidos com sucesso.");
      onFill(data);

      toast({
        title: "Contrato preenchido pela IA",
        description: data.summary || "Campos preenchidos automaticamente.",
      });

      setTimeout(() => {
        onOpenChange(false);
        setPrompt("");
        setSummary(null);
      }, 1500);
    } catch (err: any) {
      console.error("AI fill error:", err);
      toast({
        title: "Erro ao preencher com IA",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Preencher com IA
          </DialogTitle>
          <DialogDescription>
            Descreva o contrato de forma livre. Ex: "Contrato de venda para João
            Silva, imóvel código 42, corretor Maria"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Ex: Locação para Maria Santos, imóvel 15, início em março..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px]"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />

          {summary && (
            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">✅ Resumo:</p>
              <p>{summary}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Preencher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
