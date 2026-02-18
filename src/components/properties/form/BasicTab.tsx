import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { useBrokers } from "@/hooks/useBrokers";

interface BasicTabProps {
  form: UseFormReturn<any>;
}

export function BasicTab({ form }: BasicTabProps) {
  const { propertyTypes, createPropertyType, isCreating: isCreatingType } = usePropertyTypes();
  const { brokers } = useBrokers();
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const propertyCondition = form.watch("property_condition");

  const handleCreateNewType = () => {
    if (newTypeName.trim()) {
      createPropertyType(newTypeName.trim());
      setNewTypeName("");
      setShowNewTypeInput(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="property_type_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Imóvel *</FormLabel>
              {showNewTypeInput ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do novo tipo"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    disabled={isCreatingType}
                  />
                  <Button type="button" size="sm" onClick={handleCreateNewType} disabled={isCreatingType || !newTypeName.trim()}>
                    {isCreatingType ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setShowNewTypeInput(false); setNewTypeName(""); }}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Select
                  onValueChange={(value) => {
                    if (value === "new") setShowNewTypeInput(true);
                    else field.onChange(value);
                  }}
                  value={field.value || undefined}
                >
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {propertyTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                    <SelectItem value="new" className="text-primary font-medium">
                      <div className="flex items-center gap-2"><Plus className="h-4 w-4" />Criar novo tipo...</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="transaction_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Transação *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="aluguel">Aluguel</SelectItem>
                  <SelectItem value="ambos">Venda e Aluguel</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="com_proposta">Com Proposta</SelectItem>
                  <SelectItem value="reservado">Reservado</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                  <SelectItem value="alugado">Alugado</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="property_condition"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Condição do Imóvel</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="usado">Usado</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="captador_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Corretor Captador</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione o captador" /></SelectTrigger></FormControl>
                <SelectContent>
                  {brokers.map((broker) => (
                    <SelectItem key={broker.id} value={broker.user_id}>{broker.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="development_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome do Empreendimento</FormLabel>
            <FormControl>
              <Input placeholder="Ex: Residencial Mar Azul" {...field} value={field.value || ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {propertyCondition === "novo" && (
        <FormField
          control={form.control}
          name="launch_stage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Etapa de Lançamento</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "nenhum"}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  <SelectItem value="futuro">Futuro (Lançamento)</SelectItem>
                  <SelectItem value="em_construcao">Em Construção</SelectItem>
                  <SelectItem value="pronto">Pronto</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
