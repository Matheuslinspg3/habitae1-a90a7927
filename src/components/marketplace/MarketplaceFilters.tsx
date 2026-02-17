import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import {
  Filter, X, ChevronDown, Bed, DollarSign, MapPin, Ruler, Home, Car, Bath, Star,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface MarketplaceFiltersState {
  transactionType: string;
  city: string;
  neighborhood: string;
  propertyTypeId: string;
  minPrice: number | null;
  maxPrice: number | null;
  minBedrooms: number | null;
  minSuites: number | null;
  minBathrooms: number | null;
  minParking: number | null;
  minArea: number | null;
  maxArea: number | null;
  amenities: string[];
  featured: boolean;
}

export const defaultMarketplaceFilters: MarketplaceFiltersState = {
  transactionType: "all",
  city: "",
  neighborhood: "",
  propertyTypeId: "all",
  minPrice: null,
  maxPrice: null,
  minBedrooms: null,
  minSuites: null,
  minBathrooms: null,
  minParking: null,
  minArea: null,
  maxArea: null,
  amenities: [],
  featured: false,
};

interface MarketplaceFiltersProps {
  filters: MarketplaceFiltersState;
  onUpdateFilter: <K extends keyof MarketplaceFiltersState>(key: K, value: MarketplaceFiltersState[K]) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  cities: { city: string; count: number }[];
  neighborhoods: { neighborhood: string; count: number }[];
  propertyTypes: { id: string; name: string }[];
  availableAmenities: string[];
  className?: string;
}

export function MarketplaceFilters({
  filters, onUpdateFilter, onClearFilters, activeFilterCount,
  cities, neighborhoods, propertyTypes, availableAmenities, className,
}: MarketplaceFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNumericChange = (key: keyof MarketplaceFiltersState, value: string) => {
    const numValue = value ? Number(value.replace(/\D/g, "")) : null;
    onUpdateFilter(key, numValue as any);
  };

  const toggleAmenity = (amenity: string) => {
    const current = filters.amenities;
    const updated = current.includes(amenity)
      ? current.filter(a => a !== amenity)
      : [...current, amenity];
    onUpdateFilter("amenities", updated);
  };

  const numericOptions = [
    { value: null, label: "Todos" },
    { value: 1, label: "1+" },
    { value: 2, label: "2+" },
    { value: 3, label: "3+" },
    { value: 4, label: "4+" },
  ];

  const filteredNeighborhoods = neighborhoods.filter(
    n => !filters.city || true // neighborhoods are already filtered by city from query
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2 min-h-[44px]">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] sm:w-[420px] p-0" align="start" sideOffset={8}>
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Filtros Avançados</h4>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-8 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3 mr-1" /> Limpar ({activeFilterCount})
                </Button>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
            {/* Transaction Type */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Home className="h-4 w-4 text-muted-foreground" />
                Tipo de Transação
              </Label>
              <ToggleGroup type="single" value={filters.transactionType}
                onValueChange={(value) => value && onUpdateFilter("transactionType", value)} className="justify-start">
                <ToggleGroupItem value="all" className="flex-1">Todos</ToggleGroupItem>
                <ToggleGroupItem value="venda" className="flex-1">Venda</ToggleGroupItem>
                <ToggleGroupItem value="aluguel" className="flex-1">Aluguel</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Separator />

            {/* Property Type */}
            {propertyTypes.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tipo de Imóvel</Label>
                  <Select value={filters.propertyTypeId} onValueChange={(value) => onUpdateFilter("propertyTypeId", value)}>
                    <SelectTrigger><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {propertyTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
              </>
            )}

            {/* Price Range */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Faixa de Preço
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="text" placeholder="Mínimo"
                  value={filters.minPrice ? formatCurrency(filters.minPrice).replace("R$", "").trim() : ""}
                  onChange={(e) => handleNumericChange("minPrice", e.target.value)} className="text-sm" />
                <Input type="text" placeholder="Máximo"
                  value={filters.maxPrice ? formatCurrency(filters.maxPrice).replace("R$", "").trim() : ""}
                  onChange={(e) => handleNumericChange("maxPrice", e.target.value)} className="text-sm" />
              </div>
            </div>

            <Separator />

            {/* Bedrooms */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Bed className="h-4 w-4 text-muted-foreground" /> Quartos
              </Label>
              <ToggleGroup type="single" value={filters.minBedrooms?.toString() || "all"}
                onValueChange={(value) => onUpdateFilter("minBedrooms", value === "all" ? null : Number(value))} className="justify-start flex-wrap">
                {numericOptions.map((opt) => (
                  <ToggleGroupItem key={opt.value ?? "all"} value={opt.value?.toString() || "all"} className="min-w-[48px]">
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <Separator />

            {/* Suites */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Bath className="h-4 w-4 text-muted-foreground" /> Suítes
              </Label>
              <ToggleGroup type="single" value={filters.minSuites?.toString() || "all"}
                onValueChange={(value) => onUpdateFilter("minSuites", value === "all" ? null : Number(value))} className="justify-start flex-wrap">
                {numericOptions.map((opt) => (
                  <ToggleGroupItem key={opt.value ?? "all"} value={opt.value?.toString() || "all"} className="min-w-[48px]">
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <Separator />

            {/* Bathrooms */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Bath className="h-4 w-4 text-muted-foreground" /> Banheiros
              </Label>
              <ToggleGroup type="single" value={filters.minBathrooms?.toString() || "all"}
                onValueChange={(value) => onUpdateFilter("minBathrooms", value === "all" ? null : Number(value))} className="justify-start flex-wrap">
                {numericOptions.map((opt) => (
                  <ToggleGroupItem key={opt.value ?? "all"} value={opt.value?.toString() || "all"} className="min-w-[48px]">
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <Separator />

            {/* Parking */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Car className="h-4 w-4 text-muted-foreground" /> Vagas
              </Label>
              <ToggleGroup type="single" value={filters.minParking?.toString() || "all"}
                onValueChange={(value) => onUpdateFilter("minParking", value === "all" ? null : Number(value))} className="justify-start flex-wrap">
                {numericOptions.map((opt) => (
                  <ToggleGroupItem key={opt.value ?? "all"} value={opt.value?.toString() || "all"} className="min-w-[48px]">
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <Separator />

            {/* Location */}
            <Collapsible defaultOpen={!!filters.city || !!filters.neighborhood}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full">
                <MapPin className="h-4 w-4 text-muted-foreground" /> Localização
                <ChevronDown className="h-4 w-4 ml-auto" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                {cities.length > 0 && (
                  <Select value={filters.city || "all"} onValueChange={(value) => onUpdateFilter("city", value === "all" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as cidades</SelectItem>
                      {cities.map((c) => (
                        <SelectItem key={c.city} value={c.city}>
                          {c.city} ({c.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {filteredNeighborhoods.length > 0 && (
                  <Select value={filters.neighborhood || "all"} onValueChange={(value) => onUpdateFilter("neighborhood", value === "all" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Bairro" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os bairros</SelectItem>
                      {filteredNeighborhoods.map((n) => (
                        <SelectItem key={n.neighborhood} value={n.neighborhood}>
                          {n.neighborhood} ({n.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Area */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Ruler className="h-4 w-4 text-muted-foreground" /> Área (m²)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Mínima" value={filters.minArea || ""}
                  onChange={(e) => onUpdateFilter("minArea", e.target.value ? Number(e.target.value) : null)} className="text-sm" />
                <Input type="number" placeholder="Máxima" value={filters.maxArea || ""}
                  onChange={(e) => onUpdateFilter("maxArea", e.target.value ? Number(e.target.value) : null)} className="text-sm" />
              </div>
            </div>

            <Separator />

            {/* Amenities */}
            {availableAmenities.length > 0 && (
              <>
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full">
                    Amenidades
                    {filters.amenities.length > 0 && (
                      <Badge variant="secondary" className="text-xs ml-1">{filters.amenities.length}</Badge>
                    )}
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                      {availableAmenities.map((amenity) => (
                        <label key={amenity} className="flex items-center gap-2 text-sm cursor-pointer p-1 rounded hover:bg-muted">
                          <Checkbox
                            checked={filters.amenities.includes(amenity)}
                            onCheckedChange={() => toggleAmenity(amenity)}
                          />
                          <span className="truncate">{amenity}</span>
                        </label>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <Separator />
              </>
            )}

            {/* Featured */}
            <div className="space-y-2">
              <Button
                variant={filters.featured ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => onUpdateFilter("featured", !filters.featured)}
              >
                <Star className={cn("h-3.5 w-3.5", filters.featured && "fill-current")} />
                Somente destaques
              </Button>
            </div>
          </div>

          <div className="p-4 border-t bg-muted/30">
            <Button className="w-full" onClick={() => setIsOpen(false)}>
              Aplicar Filtros
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {activeFilterCount > 0 && (
        <div className="hidden md:flex items-center gap-1 flex-wrap">
          {filters.transactionType !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {filters.transactionType === "venda" ? "Venda" : "Aluguel"}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter("transactionType", "all")} />
            </Badge>
          )}
          {filters.minBedrooms && (
            <Badge variant="secondary" className="gap-1">
              {filters.minBedrooms}+ quartos
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter("minBedrooms", null)} />
            </Badge>
          )}
          {filters.minSuites && (
            <Badge variant="secondary" className="gap-1">
              {filters.minSuites}+ suítes
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter("minSuites", null)} />
            </Badge>
          )}
          {filters.minBathrooms && (
            <Badge variant="secondary" className="gap-1">
              {filters.minBathrooms}+ banheiros
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter("minBathrooms", null)} />
            </Badge>
          )}
          {filters.minParking && (
            <Badge variant="secondary" className="gap-1">
              {filters.minParking}+ vagas
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter("minParking", null)} />
            </Badge>
          )}
          {filters.city && (
            <Badge variant="secondary" className="gap-1">
              {filters.city}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter("city", "")} />
            </Badge>
          )}
          {filters.neighborhood && (
            <Badge variant="secondary" className="gap-1">
              {filters.neighborhood}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter("neighborhood", "")} />
            </Badge>
          )}
          {(filters.minPrice || filters.maxPrice) && (
            <Badge variant="secondary" className="gap-1">
              {filters.minPrice ? formatCurrency(filters.minPrice) : "R$ 0"} - {filters.maxPrice ? formatCurrency(filters.maxPrice) : "∞"}
              <X className="h-3 w-3 cursor-pointer" onClick={() => { onUpdateFilter("minPrice", null); onUpdateFilter("maxPrice", null); }} />
            </Badge>
          )}
          {filters.amenities.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              {filters.amenities.length} amenidades
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter("amenities", [])} />
            </Badge>
          )}
          {filters.featured && (
            <Badge variant="secondary" className="gap-1">
              Destaques
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter("featured", false)} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
