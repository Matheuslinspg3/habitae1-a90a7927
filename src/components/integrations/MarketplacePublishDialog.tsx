import { useState } from "react";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Store, Home, MapPin } from "lucide-react";
import type { ImobziPropertyPreview } from "@/hooks/useImobziImport";

type Step = "ask" | "select";

interface MarketplacePublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProperties: ImobziPropertyPreview[];
  onConfirm: (marketplaceIds: string[]) => void;
}

export function MarketplacePublishDialog({
  open,
  onOpenChange,
  selectedProperties,
  onConfirm,
}: MarketplacePublishDialogProps) {
  const [step, setStep] = useState<Step>("ask");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    new Set(selectedProperties.map((p) => p.property_id))
  );

  const handleReset = () => {
    setStep("ask");
    setCheckedIds(new Set(selectedProperties.map((p) => p.property_id)));
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) handleReset();
    onOpenChange(val);
  };

  const toggleId = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNo = () => {
    onConfirm([]);
    handleOpenChange(false);
  };

  const handleYesAll = () => {
    onConfirm(selectedProperties.map((p) => p.property_id));
    handleOpenChange(false);
  };

  const handleChoose = () => {
    setStep("select");
  };

  const handleConfirmSelection = () => {
    onConfirm(Array.from(checkedIds));
    handleOpenChange(false);
  };

  if (step === "select") {
    return (
      <ResponsiveModal
        open={open}
        onOpenChange={handleOpenChange}
        title="Escolher imóveis para o Marketplace"
        description={`${checkedIds.size} de ${selectedProperties.length} selecionado(s)`}
        className="sm:max-w-lg"
      >
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2 pr-2">
            {selectedProperties.map((p) => (
              <label
                key={p.property_id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={checkedIds.has(p.property_id)}
                  onCheckedChange={() => toggleId(p.property_id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  {(p.address_city || p.address_neighborhood) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      {[p.address_neighborhood, p.address_city].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                {p.code && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {p.code}
                  </Badge>
                )}
              </label>
            ))}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => setStep("ask")}>
            Voltar
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleConfirmSelection}
            disabled={checkedIds.size === 0}
          >
            <Store className="h-4 w-4" />
            Confirmar ({checkedIds.size})
          </Button>
        </div>
      </ResponsiveModal>
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={handleOpenChange}
      title="Publicar no Marketplace?"
      description="Deseja publicar os imóveis importados no Marketplace para que outros corretores possam visualizá-los?"
    >
      <div className="flex items-center justify-center py-4">
        <div className="p-4 rounded-full bg-primary/10">
          <Store className="h-10 w-10 text-primary" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button className="w-full gap-2" onClick={handleYesAll}>
          <Home className="h-4 w-4" />
          Sim, todos os {selectedProperties.length} imóveis
        </Button>
        <Button variant="secondary" className="w-full" onClick={handleChoose}>
          Sim, escolher quais
        </Button>
        <Button variant="outline" className="w-full" onClick={handleNo}>
          Não, apenas importar
        </Button>
      </div>
    </ResponsiveModal>
  );
}
