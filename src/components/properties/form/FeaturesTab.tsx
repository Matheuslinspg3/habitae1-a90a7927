import { UseFormReturn } from "react-hook-form";
import {
  FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AMENITIES_OPTIONS } from "./constants";

interface FeaturesTabProps {
  form: UseFormReturn<any>;
}

export function FeaturesTab({ form }: FeaturesTabProps) {
  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["bedrooms", "suites", "bathrooms", "parking_spots"] as const).map((name) => {
          const labels: Record<string, string> = { bedrooms: "Quartos", suites: "Suítes", bathrooms: "Banheiros", parking_spots: "Vagas" };
          return (
            <FormField key={name} control={form.control} name={name} render={({ field }) => (
              <FormItem>
                <FormLabel>{labels[name]}</FormLabel>
                <FormControl>
                  <Input type="number" min="0" {...field} value={field.value ?? 0} onChange={(e) => field.onChange(Number(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          );
        })}
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">MEDIDAS</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["area_useful", "area_total", "area_built"] as const).map((name) => {
            const labels: Record<string, string> = { area_useful: "Área Útil (m²)", area_total: "Área Total (m²)", area_built: "Área Construída (m²)" };
            return (
              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                <FormItem>
                  <FormLabel>{labels[name]}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField control={form.control} name="floor" render={({ field }) => (
          <FormItem>
            <FormLabel>Andar</FormLabel>
            <FormControl>
              <Input type="number" min="0" placeholder="0" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="beach_distance_meters" render={({ field }) => (
          <FormItem>
            <FormLabel>Distância da Praia (m)</FormLabel>
            <FormControl>
              <Input type="number" min="0" placeholder="0" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <FormField control={form.control} name="amenities" render={({ field }) => (
        <FormItem>
          <FormLabel>Características</FormLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {AMENITIES_OPTIONS.map((amenity) => (
              <label key={amenity} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={field.value?.includes(amenity) || false}
                  onChange={(e) => {
                    const current = field.value || [];
                    field.onChange(e.target.checked ? [...current, amenity] : current.filter((a: string) => a !== amenity));
                  }}
                  className="rounded border-input"
                />
                <span>{amenity}</span>
              </label>
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  );
}
