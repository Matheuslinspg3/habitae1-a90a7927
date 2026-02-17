import { useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CurrencyInput, PercentageInput } from "@/components/ui/currency-input";
import { Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_OPTIONS } from "./constants";

interface ValuesTabProps {
  form: UseFormReturn<any>;
}

export function ValuesTab({ form }: ValuesTabProps) {
  const transactionType = form.watch("transaction_type");
  const commissionType = form.watch("commission_type");
  const salePrice = form.watch("sale_price");
  const rentPrice = form.watch("rent_price");
  const commissionValue = form.watch("commission_value");

  const estimatedCommission = useMemo(() => {
    if (commissionType !== "percentual" || !commissionValue) return null;
    let basePrice: number | null = null;
    if (transactionType === "venda" || transactionType === "ambos") basePrice = salePrice;
    if (!basePrice && (transactionType === "aluguel" || transactionType === "ambos")) basePrice = rentPrice;
    if (!basePrice) return null;
    return (basePrice * commissionValue) / 100;
  }, [salePrice, rentPrice, commissionType, commissionValue, transactionType]);

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">PREÇOS</h4>
        {(transactionType === "venda" || transactionType === "ambos") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="sale_price" render={({ field }) => (
              <FormItem>
                <FormLabel>Valor à Vista {transactionType === "venda" && "*"}</FormLabel>
                <FormControl><CurrencyInput value={field.value} onChange={field.onChange} placeholder="R$ 0,00" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="sale_price_financed" render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Financiado</FormLabel>
                <FormControl><CurrencyInput value={field.value} onChange={field.onChange} placeholder="R$ 0,00" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        )}
        {(transactionType === "aluguel" || transactionType === "ambos") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="rent_price" render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Locação {transactionType === "aluguel" && "*"}</FormLabel>
                <FormControl><CurrencyInput value={field.value} onChange={field.onChange} placeholder="R$ 0,00" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField control={form.control} name="condominium_fee" render={({ field }) => (
          <FormItem>
            <FormLabel>Condomínio</FormLabel>
            <FormControl><CurrencyInput value={field.value} onChange={field.onChange} placeholder="R$ 0,00" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="iptu_monthly" render={({ field }) => (
          <FormItem>
            <FormLabel>IPTU Mensal</FormLabel>
            <FormControl><CurrencyInput value={field.value} onChange={field.onChange} placeholder="R$ 0,00" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="inspection_fee" render={({ field }) => (
          <FormItem>
            <FormLabel>Valor Vistoria</FormLabel>
            <FormControl><CurrencyInput value={field.value} onChange={field.onChange} placeholder="R$ 0,00" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">COMISSÃO</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="commission_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Comissão</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "percentual"}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="valor">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="commission_value" render={({ field }) => (
            <FormItem>
              <FormLabel>{commissionType === "percentual" ? "Percentual (%)" : "Valor (R$)"}</FormLabel>
              <FormControl>
                {commissionType === "percentual" ? (
                  <PercentageInput value={field.value} onChange={field.onChange} placeholder="0,00%" />
                ) : (
                  <CurrencyInput value={field.value} onChange={field.onChange} placeholder="R$ 0,00" />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {estimatedCommission !== null && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-3">
            <Calculator className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Comissão Estimada</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(estimatedCommission)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">FORMAS DE PAGAMENTO</h4>
        <FormField control={form.control} name="payment_options" render={({ field }) => (
          <FormItem>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {PAYMENT_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={field.value?.includes(option) || false}
                    onChange={(e) => {
                      const current = field.value || [];
                      field.onChange(e.target.checked ? [...current, option] : current.filter((a: string) => a !== option));
                    }}
                    className="rounded border-input"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )} />
      </div>
    </div>
  );
}
