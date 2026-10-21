import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Ruler,
  Sparkles,
  Target,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";

export type PropertyAiValuationData = Record<string, unknown> & {
  transaction_type?: "venda" | "aluguel" | "ambos";
};

export interface MissingValuationField {
  key: string;
  label: string;
  tab: string;
}

export interface PropertyAiEvaluation {
  estimated_sale_price_min?: number | null;
  estimated_sale_price_max?: number | null;
  recommended_sale_price?: number | null;
  estimated_rent_price_min?: number | null;
  estimated_rent_price_max?: number | null;
  recommended_rent_price?: number | null;
  price_per_m2?: number | null;
  confidence?: "alta" | "media" | "baixa" | string;
  rationale?: string;
  factors?: string[];
  next_steps?: string[];
  missing_data?: string[];
  disclaimer?: string;
}

interface PropertyAiValuationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyData: PropertyAiValuationData;
  source: "values" | "review";
  onInsertMissing: (field: MissingValuationField) => void;
  onSkip?: () => void;
  onRegisterAfterEvaluation?: () => void | Promise<void>;
  onEvaluationSuccess?: (data: PropertyAiValuationData) => void;
  isSubmitting?: boolean;
}

function isBlank(value: unknown) {
  return value === null || value === undefined || value === "" || value === 0;
}

function getMissingValuationFields(data: PropertyAiValuationData): MissingValuationField[] {
  const fields: MissingValuationField[] = [];
  const transactionType = data.transaction_type;

  if (isBlank(data.property_type)) fields.push({ key: "property_type_id", label: "Tipo de imóvel", tab: "basic" });
  if (isBlank(data.address_city)) fields.push({ key: "address_city", label: "Cidade", tab: "location" });
  if (isBlank(data.address_neighborhood)) fields.push({ key: "address_neighborhood", label: "Bairro", tab: "location" });
  if (isBlank(data.area_useful)) fields.push({ key: "area_useful", label: "Área útil", tab: "features" });
  if (isBlank(data.bedrooms)) fields.push({ key: "bedrooms", label: "Quartos", tab: "features" });
  if (isBlank(data.bathrooms)) fields.push({ key: "bathrooms", label: "Banheiros", tab: "features" });

  if ((transactionType === "venda" || transactionType === "ambos") && isBlank(data.sale_price)) {
    fields.push({ key: "sale_price", label: "Valor de venda", tab: "values" });
  }
  if ((transactionType === "aluguel" || transactionType === "ambos") && isBlank(data.rent_price)) {
    fields.push({ key: "rent_price", label: "Valor de locação", tab: "values" });
  }

  return fields;
}

function confidenceLabel(confidence?: string) {
  if (confidence === "alta") return "Confiança alta";
  if (confidence === "baixa") return "Confiança baixa";
  return "Confiança média";
}

function formatRange(min?: number | null, max?: number | null) {
  if (min && max) return `${formatCurrency(min)} a ${formatCurrency(max)}`;
  if (min) return `a partir de ${formatCurrency(min)}`;
  if (max) return `até ${formatCurrency(max)}`;
  return "Não calculado";
}

export function PropertyAiValuationDialog({
  open,
  onOpenChange,
  propertyData,
  source,
  onInsertMissing,
  onSkip,
  onRegisterAfterEvaluation,
  onEvaluationSuccess,
  isSubmitting = false,
}: PropertyAiValuationDialogProps) {
  const { toast } = useToast();
  const [evaluation, setEvaluation] = useState<PropertyAiEvaluation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const missingFields = useMemo(() => getMissingValuationFields(propertyData), [propertyData]);
  const transactionType = propertyData.transaction_type;
  const showSale = transactionType === "venda" || transactionType === "ambos";
  const showRent = transactionType === "aluguel" || transactionType === "ambos";

  useEffect(() => {
    if (!open) {
      setEvaluation(null);
      setIsLoading(false);
      setErrorMessage(null);
    }
  }, [open]);

  const runEvaluation = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke("evaluate-property", {
        body: {
          property: propertyData,
          excludedFields: missingFields.map((field) => field.label),
        },
      });

      if (error || data?.error) {
        const message = data?.error || error?.message || "Não foi possível concluir a avaliação agora.";
        setErrorMessage(message);
        toast({
          title: "Avaliação indisponível",
          description: message,
          variant: "destructive",
        });
        return;
      }

      const nextEvaluation = (data?.evaluation || data) as PropertyAiEvaluation;
      setEvaluation(nextEvaluation);
      onEvaluationSuccess?.(propertyData);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir a avaliação agora.";
      setErrorMessage(message);
      toast({
        title: "Avaliação indisponível",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const locationLabel = [propertyData.address_neighborhood, propertyData.address_city, propertyData.address_state]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </span>
            {evaluation
              ? "Avaliação orientativa do imóvel"
              : source === "review"
                ? "Revisão final do imóvel"
                : "Avaliar preço com IA"}
          </DialogTitle>
          <DialogDescription>
            {source === "review" && !evaluation
              ? "Antes de cadastrar, escolha se deseja fazer uma avaliação com IA usando os dados deste imóvel."
              : "A IA usa os dados preenchidos para sugerir uma faixa de preço e explicar os principais fatores da análise."}
          </DialogDescription>
        </DialogHeader>

        {!evaluation && (
          <div className="space-y-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">Análise feita com o que já está no cadastro</p>
                    <p className="text-sm text-muted-foreground">
                      {locationLabel || "Localização ainda não informada"}
                      {propertyData.area_useful ? ` · ${propertyData.area_useful} m² úteis` : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {missingFields.length > 0 && (
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle>Alguns dados podem melhorar a precisão</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>Faltam estes detalhes no cadastro:</p>
                  <div className="flex flex-wrap gap-2">
                    {missingFields.map((field) => (
                      <Badge key={field.key} variant="outline" className="border-amber-500/30 bg-background">
                        {field.label}
                      </Badge>
                    ))}
                  </div>
                  <p>
                    Você pode inseri-los no imóvel agora ou deixar esses detalhes fora do cálculo. A avaliação continuará sendo uma estimativa.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {errorMessage && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Não foi possível avaliar</AlertTitle>
                <AlertDescription>Tente novamente. Se o problema persistir, continue o cadastro sem a avaliação.</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {evaluation && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {showSale && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Faixa de venda</p>
                    <p className="mt-1 text-xl font-bold text-primary">
                      {formatRange(evaluation.estimated_sale_price_min, evaluation.estimated_sale_price_max)}
                    </p>
                    {evaluation.recommended_sale_price && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Sugestão central: <span className="font-semibold text-foreground">{formatCurrency(evaluation.recommended_sale_price)}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {showRent && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Faixa de locação</p>
                    <p className="mt-1 text-xl font-bold text-primary">
                      {formatRange(evaluation.estimated_rent_price_min, evaluation.estimated_rent_price_max)}
                    </p>
                    {evaluation.recommended_rent_price && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Sugestão central: <span className="font-semibold text-foreground">{formatCurrency(evaluation.recommended_rent_price)}/mês</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{confidenceLabel(evaluation.confidence)}</Badge>
              {evaluation.price_per_m2 && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Ruler className="h-4 w-4" />
                  {formatCurrency(evaluation.price_per_m2)}/m²
                </span>
              )}
              {locationLabel && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {locationLabel}
                </span>
              )}
            </div>

            {evaluation.rationale && (
              <Card>
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">Como a estimativa foi formada</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{evaluation.rationale}</p>
                </CardContent>
              </Card>
            )}

            {(evaluation.factors?.length || evaluation.next_steps?.length) ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {!!evaluation.factors?.length && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Fatores considerados</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {evaluation.factors.slice(0, 5).map((factor) => (
                        <li key={factor} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!evaluation.next_steps?.length && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Próximos passos sugeridos</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {evaluation.next_steps.slice(0, 4).map((step) => (
                        <li key={step} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            <p className="text-xs leading-relaxed text-muted-foreground">
              {evaluation.disclaimer || "Esta é uma estimativa orientativa com IA, não substitui um laudo técnico ou uma avaliação profissional presencial."}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {evaluation ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {source === "review" ? "Voltar à revisão" : "Continuar preenchendo"}
              </Button>
              {source === "review" && onRegisterAfterEvaluation && (
                <Button type="button" onClick={onRegisterAfterEvaluation} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar imóvel
                </Button>
              )}
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancelar
              </Button>
              {onSkip && (
                <Button type="button" variant="ghost" onClick={onSkip} disabled={isLoading}>
                  Cadastrar sem avaliar
                </Button>
              )}
              {missingFields.length > 0 && (
                <Button type="button" variant="outline" onClick={() => onInsertMissing(missingFields[0])} disabled={isLoading}>
                  Preencher no imóvel
                </Button>
              )}
              <Button type="button" onClick={runEvaluation} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {missingFields.length > 0 ? "Continuar sem esses dados" : "Fazer avaliação com IA"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
