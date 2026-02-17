import { useState, useEffect, useRef, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, MapPin } from "lucide-react";
import { fetchAddressByCep, formatCep, searchAddressByStreet, ViaCepResponse } from "@/lib/viaCep";
import { cn } from "@/lib/utils";

interface LocationTabProps {
  form: UseFormReturn<any>;
}

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export function LocationTab({ form }: LocationTabProps) {
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [streetSuggestions, setStreetSuggestions] = useState<ViaCepResponse[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingStreet, setIsSearchingStreet] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCepSearch = async () => {
    const cep = form.getValues("address_zipcode");
    if (!cep) return;
    setIsSearchingCep(true);
    const address = await fetchAddressByCep(cep);
    setIsSearchingCep(false);
    if (address) {
      form.setValue("address_street", address.logradouro);
      form.setValue("address_neighborhood", address.bairro);
      form.setValue("address_city", address.localidade);
      form.setValue("address_state", address.uf);
    }
  };

  const handleStreetSearch = useCallback(async (query: string) => {
    const uf = form.getValues("address_state");
    const city = form.getValues("address_city");

    if (!uf || !city || query.trim().length < 3) {
      setStreetSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearchingStreet(true);
    const results = await searchAddressByStreet(uf, city, query);
    setStreetSuggestions(results);
    setShowSuggestions(results.length > 0);
    setIsSearchingStreet(false);
  }, [form]);

  const handleStreetChange = useCallback((value: string, fieldOnChange: (v: string) => void) => {
    fieldOnChange(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleStreetSearch(value), 400);
  }, [handleStreetSearch]);

  const selectSuggestion = useCallback((suggestion: ViaCepResponse) => {
    form.setValue("address_street", suggestion.logradouro);
    form.setValue("address_neighborhood", suggestion.bairro);
    form.setValue("address_city", suggestion.localidade);
    form.setValue("address_state", suggestion.uf);
    if (suggestion.cep) {
      form.setValue("address_zipcode", formatCep(suggestion.cep));
    }
    setShowSuggestions(false);
    setStreetSuggestions([]);
  }, [form]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getFullAddress = () => {
    const street = form.watch("address_street");
    const number = form.watch("address_number");
    const neighborhood = form.watch("address_neighborhood");
    const city = form.watch("address_city");
    const state = form.watch("address_state");
    if (city && state) {
      return [street, number, neighborhood, city, state].filter(Boolean).join(", ") + ", Brasil";
    }
    return null;
  };

  const fullAddress = getFullAddress();
  const hasStateAndCity = !!form.watch("address_state") && !!form.watch("address_city");

  return (
    <div className="space-y-4 mt-4">
      <FormField control={form.control} name="address_zipcode" render={({ field }) => (
        <FormItem>
          <FormLabel>CEP</FormLabel>
          <div className="flex gap-2">
            <FormControl>
              <Input placeholder="00000-000" {...field} value={field.value || ""} onChange={(e) => field.onChange(formatCep(e.target.value))} maxLength={9} />
            </FormControl>
            <Button type="button" variant="outline" onClick={handleCepSearch} disabled={isSearchingCep}>
              {isSearchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <FormMessage />
        </FormItem>
      )} />

      {/* Street with autocomplete */}
      <FormField control={form.control} name="address_street" render={({ field }) => (
        <FormItem className="relative">
          <FormLabel>Rua</FormLabel>
          <FormControl>
            <div className="relative" ref={suggestionsRef}>
              <Input
                placeholder={hasStateAndCity ? "Digite para buscar endereços..." : "Nome da rua"}
                value={field.value || ""}
                onChange={(e) => handleStreetChange(e.target.value, field.onChange)}
                onFocus={() => { if (streetSuggestions.length > 0) setShowSuggestions(true); }}
                autoComplete="off"
              />
              {isSearchingStreet && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && streetSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {streetSuggestions.map((s, i) => (
                    <button
                      key={`${s.cep}-${i}`}
                      type="button"
                      className={cn(
                        "w-full text-left px-3 py-2.5 hover:bg-accent/10 transition-colors flex flex-col gap-0.5",
                        i > 0 && "border-t border-border/50"
                      )}
                      onClick={() => selectSuggestion(s)}
                    >
                      <span className="text-sm font-medium text-foreground">{s.logradouro}</span>
                      <span className="text-xs text-muted-foreground">
                        {[s.bairro, s.localidade, s.uf].filter(Boolean).join(", ")}
                        {s.cep ? ` — CEP: ${s.cep}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FormControl>
          {hasStateAndCity && (
            <p className="text-xs text-muted-foreground mt-1">
              Digite ao menos 3 letras para buscar endereços em {form.watch("address_city")}/{form.watch("address_state")}
            </p>
          )}
          <FormMessage />
        </FormItem>
      )} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField control={form.control} name="address_number" render={({ field }) => (
          <FormItem>
            <FormLabel>Número</FormLabel>
            <FormControl><Input placeholder="123" {...field} value={field.value || ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="address_complement" render={({ field }) => (
          <FormItem>
            <FormLabel>Complemento</FormLabel>
            <FormControl><Input placeholder="Apto 101, Bloco B" {...field} value={field.value || ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <FormField control={form.control} name="address_neighborhood" render={({ field }) => (
        <FormItem>
          <FormLabel>Bairro</FormLabel>
          <FormControl><Input placeholder="Nome do bairro" {...field} value={field.value || ""} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField control={form.control} name="address_city" render={({ field }) => (
          <FormItem>
            <FormLabel>Cidade</FormLabel>
            <FormControl><Input placeholder="Nome da cidade" {...field} value={field.value || ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="address_state" render={({ field }) => (
          <FormItem>
            <FormLabel>Estado</FormLabel>
            <FormControl>
              <Input
                placeholder="UF"
                maxLength={2}
                {...field}
                value={field.value || ""}
                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      {fullAddress && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>Preview da Localização</span>
          </div>
          <div className="rounded-lg overflow-hidden border h-[200px]">
            <iframe
              width="100%" height="100%" style={{ border: 0 }}
              loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
