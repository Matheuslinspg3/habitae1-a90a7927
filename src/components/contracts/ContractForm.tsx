import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Sparkles, ChevronDown } from "lucide-react";
import { useProperties } from "@/hooks/useProperties";
import { useLeads } from "@/hooks/useLeads";
import { useBrokers } from "@/hooks/useBrokers";
import { ContractAIFillDialog } from "./ContractAIFillDialog";
import { trackFormError } from "@/components/ClarityProvider";
import { clarityEvent } from "@/lib/clarity";
import { getStoredConsent } from "@/components/CookieConsentBanner";
import type { ContractWithDetails, ContractFormData, ContractStatus, ContractType } from "@/hooks/useContracts";

const contractSchema = z.object({
  type: z.enum(["venda", "locacao"] as const),
  property_id: z.string().nullable(),
  lead_id: z.string().nullable(),
  broker_id: z.string().nullable(),
  value: z.coerce.number().min(1, "Valor é obrigatório"),
  commission_percentage: z.coerce.number().nullable().optional(),
  start_date: z.string().min(1, "Data de início é obrigatória"),
  end_date: z.string().nullable().optional(),
  payment_day: z.coerce.number().min(1).max(31).nullable().optional(),
  readjustment_index: z.string().nullable().optional(),
  status: z.enum(["rascunho", "ativo", "encerrado", "cancelado"] as const),
  notes: z.string().nullable().optional(),
});

type FormData = z.infer<typeof contractSchema>;

interface ContractFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: ContractWithDetails | null;
  onSubmit: (data: ContractFormData) => void;
  isSubmitting: boolean;
}

export function ContractForm({ open, onOpenChange, contract, onSubmit, isSubmitting }: ContractFormProps) {
  const { properties } = useProperties();
  const { leads } = useLeads();
  const { brokers } = useBrokers();
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const formStartRef = useRef(Date.now());

  const form = useForm<FormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      type: "venda", property_id: null, lead_id: null, broker_id: null,
      value: 0, commission_percentage: null,
      start_date: new Date().toISOString().split('T')[0],
      end_date: null, payment_day: null, readjustment_index: null,
      status: "rascunho", notes: null,
    },
  });

  useEffect(() => {
    if (open) formStartRef.current = Date.now();
  }, [open]);

  useEffect(() => {
    if (contract) {
      form.reset({
        type: contract.type, property_id: contract.property_id,
        lead_id: contract.lead_id, broker_id: contract.broker_id,
        value: Number(contract.value),
        commission_percentage: contract.commission_percentage ? Number(contract.commission_percentage) : null,
        start_date: contract.start_date || "",
        end_date: contract.end_date || null,
        payment_day: contract.payment_day,
        readjustment_index: contract.readjustment_index,
        status: contract.status, notes: contract.notes,
      });
      // Show extras if rental fields are filled
      setShowExtras(!!(contract.end_date || contract.payment_day || contract.readjustment_index || contract.notes));
    } else {
      form.reset({
        type: "venda", property_id: null, lead_id: null, broker_id: null,
        value: 0, commission_percentage: null,
        start_date: new Date().toISOString().split('T')[0],
        end_date: null, payment_day: null, readjustment_index: null,
        status: "rascunho", notes: null,
      });
      setShowExtras(false);
    }
  }, [contract, form, open]);

  const handleSubmit = (data: FormData) => {
    onSubmit(data as ContractFormData);
    if (getStoredConsent() === "granted") {
      clarityEvent(contract ? "contract_updated" : "contract_created");
    }
    onOpenChange(false);
  };

  const handleInvalid = () => {
    trackFormError("contract_form");
  };

  const contractType = form.watch("type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle>{contract ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
              <DialogDescription>
                {contract ? "Atualize as informações" : "Preencha os dados essenciais"}
              </DialogDescription>
            </div>
            {!contract && (
              <Button
                type="button" variant="outline" size="sm"
                className="gap-1.5 shrink-0 min-h-[40px]"
                onClick={() => setIsAIOpen(true)}
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Preencher com</span> IA
              </Button>
            )}
          </div>
        </DialogHeader>

        <ContractAIFillDialog
          open={isAIOpen}
          onOpenChange={setIsAIOpen}
          onFill={(data) => {
            if (data.type) form.setValue("type", data.type);
            if (data.property_id) form.setValue("property_id", data.property_id);
            if (data.lead_id) form.setValue("lead_id", data.lead_id);
            if (data.broker_id) form.setValue("broker_id", data.broker_id);
            if (data.value) form.setValue("value", data.value);
            if (data.commission_percentage !== undefined) form.setValue("commission_percentage", data.commission_percentage);
            if (data.start_date) form.setValue("start_date", data.start_date);
            if (data.end_date !== undefined) form.setValue("end_date", data.end_date);
            if (data.payment_day !== undefined) form.setValue("payment_day", data.payment_day);
            if (data.readjustment_index !== undefined) form.setValue("readjustment_index", data.readjustment_index);
            if (data.notes) form.setValue("notes", data.notes);
          }}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit, handleInvalid)} className="space-y-4">
            {/* Essential fields — always visible */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="venda">Venda</SelectItem>
                        <SelectItem value="locacao">Locação</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$) *</FormLabel>
                    <FormControl><Input type="number" placeholder="0" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="property_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imóvel</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.title} - {p.address_city || '—'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lead_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {leads.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="broker_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Corretor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {brokers.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início *</FormLabel>
                    <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="commission_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comissão (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number" step="0.1" placeholder="0" className="min-h-[44px]"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Collapsible extras — less friction for quick contracts */}
            <Collapsible open={showExtras} onOpenChange={setShowExtras}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="w-full justify-between text-muted-foreground min-h-[40px]">
                  {showExtras ? "Menos opções" : "Mais opções (status, datas, observações)"}
                  <ChevronDown className={`h-4 w-4 transition-transform ${showExtras ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="rascunho">Rascunho</SelectItem>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="encerrado">Encerrado</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {contractType === "locacao" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Fim</FormLabel>
                          <FormControl><Input type="date" className="min-h-[44px]" {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payment_day"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dia Pgto</FormLabel>
                          <FormControl>
                            <Input
                              type="number" min="1" max="31" placeholder="10" className="min-h-[44px]"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="readjustment_index"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reajuste</FormLabel>
                          <FormControl><Input placeholder="IGPM, IPCA..." className="min-h-[44px]" {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Observações adicionais..."
                          className="min-h-[80px] resize-none"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter className="flex-col sm:flex-row gap-2 sticky bottom-0 bg-background pt-3 pb-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px] w-full sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-h-[44px] w-full sm:w-auto">
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {contract ? "Salvar" : "Criar Contrato"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
