import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { User, ChevronsUpDown, Check, Plus } from "lucide-react";
import { usePropertyOwners, type PropertyOwner } from "@/hooks/usePropertyOwners";
import { cn } from "@/lib/utils";

interface OwnerSectionProps {
  form: UseFormReturn<any>;
}

export function OwnerSection({ form }: OwnerSectionProps) {
  const { owners: existingOwners } = usePropertyOwners();
  const [showOwnerSection, setShowOwnerSection] = useState(false);
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);

  const handleSelectOwner = (owner: PropertyOwner) => {
    form.setValue("owner_name", owner.name);
    form.setValue("owner_phone", owner.phone || "");
    form.setValue("owner_email", owner.email || "");
    form.setValue("owner_document", owner.document || "");
    setOwnerPopoverOpen(false);
  };

  return (
    <div className="border rounded-lg mt-4">
      <button
        type="button"
        className="flex items-center justify-between w-full p-4 text-sm font-medium hover:bg-accent/10 transition-colors rounded-lg"
        onClick={() => setShowOwnerSection((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span>Dados do Proprietário</span>
        </div>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </button>

      {showOwnerSection && (
        <div className="px-4 pb-4 space-y-4">
          <FormField control={form.control} name="owner_name" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Nome do Proprietário</FormLabel>
              <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")}>
                      {field.value || "Selecionar ou digitar proprietário"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar ou criar proprietário..." value={field.value || ""} onValueChange={(value) => field.onChange(value)} />
                    <CommandList>
                      <CommandEmpty>
                        <div className="py-2 px-4">
                          <p className="text-sm text-muted-foreground mb-2">Nenhum proprietário encontrado</p>
                          {field.value && (
                            <Button size="sm" className="w-full" onClick={() => setOwnerPopoverOpen(false)}>
                              <Plus className="h-4 w-4 mr-2" />Criar "{field.value}"
                            </Button>
                          )}
                        </div>
                      </CommandEmpty>
                      <CommandGroup heading="Proprietários existentes">
                        {existingOwners.map((owner) => (
                          <CommandItem key={owner.id} value={owner.name} onSelect={() => handleSelectOwner(owner)}>
                            <Check className={cn("mr-2 h-4 w-4", field.value === owner.name ? "opacity-100" : "opacity-0")} />
                            <div>
                              <p className="font-medium">{owner.name}</p>
                              {owner.phone && <p className="text-xs text-muted-foreground">{owner.phone}</p>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="owner_phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl><Input placeholder="(00) 00000-0000" {...field} value={field.value || ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="owner_email" render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl><Input type="email" placeholder="email@exemplo.com" {...field} value={field.value || ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="owner_document" render={({ field }) => (
            <FormItem>
              <FormLabel>CPF/CNPJ</FormLabel>
              <FormControl><Input placeholder="000.000.000-00" {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="owner_notes" render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea placeholder="Informações adicionais sobre o proprietário..." className="min-h-[100px]" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      )}
    </div>
  );
}
