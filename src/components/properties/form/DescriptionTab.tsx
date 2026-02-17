import { UseFormReturn } from "react-hook-form";
import {
  FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

interface DescriptionTabProps {
  form: UseFormReturn<any>;
}

export function DescriptionTab({ form }: DescriptionTabProps) {
  return (
    <div className="space-y-4 mt-4">
      <FormField control={form.control} name="description" render={({ field }) => (
        <FormItem>
          <FormLabel>Descrição do Imóvel</FormLabel>
          <FormControl>
            <Textarea placeholder="Descreva o imóvel com detalhes..." className="min-h-[200px]" {...field} value={field.value || ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  );
}
