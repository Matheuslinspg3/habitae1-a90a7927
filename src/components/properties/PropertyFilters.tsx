import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { 
  Filter, X, ChevronDown, Bed, DollarSign, MapPin, Ruler, Home, Car, Bath, Building2, Waves, Rocket, User,
} from 'lucide-react';
import { PropertyFilters as FiltersType } from '@/hooks/usePropertyFilters';
import { usePropertyTypes } from '@/hooks/usePropertyTypes';
import { usePropertyOwners } from '@/hooks/usePropertyOwners';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PropertyFiltersProps {
  filters: FiltersType;
  onUpdateFilter: <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => void;
  onUpdateFilters: (updates: Partial<FiltersType>) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  neighborhoods: { neighborhood: string; city: string; count: number }[];
  cities: { city: string; state: string; count: number }[];
  availableAmenities?: string[];
  className?: string;
}

export function PropertyFilters({
  filters, onUpdateFilter, onUpdateFilters, onClearFilters, activeFilterCount,
  neighborhoods, cities, availableAmenities = [], className,
}: PropertyFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { propertyTypes } = usePropertyTypes();
  const { owners } = usePropertyOwners();

  const handleNumericChange = (key: keyof FiltersType, value: string) => {
    const numValue = value ? Number(value.replace(/\D/g, '')) : null;
    onUpdateFilter(key, numValue as any);
  };

  const toggleAmenity = (amenity: string) => {
    const current = filters.amenities;
    const updated = current.includes(amenity)
      ? current.filter(a => a !== amenity)
      : [...current, amenity];
    onUpdateFilter('amenities', updated);
  };

  const numericOptions = [
    { value: null, label: 'Todos' },
    { value: 1, label: '1+' },
    { value: 2, label: '2+' },
    { value: 3, label: '3+' },
    { value: 4, label: '4+' },
  ];

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
                onValueChange={(value) => value && onUpdateFilter('transactionType', value)} className="justify-start">
                <ToggleGroupItem value="all" className="flex-1">Todos</ToggleGroupItem>
                <ToggleGroupItem value="venda" className="flex-1">Venda</ToggleGroupItem>
                <ToggleGroupItem value="aluguel" className="flex-1">Aluguel</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Separator />

            {/* Property Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de Imóvel</Label>
              <Select value={filters.propertyTypeId} onValueChange={(value) => onUpdateFilter('propertyTypeId', value)}>
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

            {/* Owner */}
            {owners.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-muted-foreground" /> Proprietário
                </Label>
                <Select value={filters.ownerId || 'all'} onValueChange={(value) => onUpdateFilter('ownerId', value === 'all' ? '' : value)}>
                  <SelectTrigger><SelectValue placeholder="Todos os proprietários" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os proprietários</SelectItem>
                    {owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {/* Property Condition */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Condição
              </Label>
              <ToggleGroup type="single" value={filters.propertyCondition}
                onValueChange={(value) => value && onUpdateFilter('propertyCondition', value)} className="justify-start flex-wrap">
                <ToggleGroupItem value="all">Todos</ToggleGroupItem>
                <ToggleGroupItem value="novo">Novo</ToggleGroupItem>
                <ToggleGroupItem value="usado">Usado</ToggleGroupItem>
                <ToggleGroupItem value="na_planta">Na Planta</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Separator />

            {/* Price Range */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Faixa de Preço
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="text" placeholder="Mínimo"
                  value={filters.minPrice ? formatCurrency(filters.minPrice).replace('R$', '').trim() : ''}
                  onChange={(e) => handleNumericChange('minPrice', e.target.value)} className="text-sm" />
                <Input type="text" placeholder="Máximo"
                  value={filters.maxPrice ? formatCurrency(filters.maxPrice).replace('R$', '').trim() : ''}
                  onChange={(e) => handleNumericChange('maxPrice', e.target.value)} className="text-sm" />
              </div>
            </div>

            <Separator />

            {/* Bedrooms */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Bed className="h-4 w-4 text-muted-foreground" /> Quartos
              </Label>
              <ToggleGroup type="single" value={filters.minBedrooms?.toString() || 'all'}
                onValueChange={(value) => onUpdateFilter('minBedrooms', value === 'all' ? null : Number(value))} className="justify-start flex-wrap">
                {numericOptions.map((opt) => (
                  <ToggleGroupItem key={opt.value ?? 'all'} value={opt.value?.toString() || 'all'} className="min-w-[48px]">
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
              <ToggleGroup type="single" value={filters.minSuites?.toString() || 'all'}
                onValueChange={(value) => onUpdateFilter('minSuites', value === 'all' ? null : Number(value))} className="justify-start flex-wrap">
                {numericOptions.map((opt) => (
                  <ToggleGroupItem key={opt.value ?? 'all'} value={opt.value?.toString() || 'all'} className="min-w-[48px]">
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
              <ToggleGroup type="single" value={filters.minParking?.toString() || 'all'}
                onValueChange={(value) => onUpdateFilter('minParking', value === 'all' ? null : Number(value))} className="justify-start flex-wrap">
                {numericOptions.map((opt) => (
                  <ToggleGroupItem key={opt.value ?? 'all'} value={opt.value?.toString() || 'all'} className="min-w-[48px]">
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
                  <Select value={filters.city || 'all'} onValueChange={(value) => onUpdateFilter('city', value === 'all' ? '' : value)}>
                    <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as cidades</SelectItem>
                      {cities.map((c) => (
                        <SelectItem key={c.city} value={c.city}>
                          {c.city}{c.state ? ` - ${c.state}` : ''} ({c.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {neighborhoods.length > 0 && (
                  <Select value={filters.neighborhood || 'all'} onValueChange={(value) => onUpdateFilter('neighborhood', value === 'all' ? '' : value)}>
                    <SelectTrigger><SelectValue placeholder="Bairro" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os bairros</SelectItem>
                      {neighborhoods.filter(n => !filters.city || n.city === filters.city).map((n) => (
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
                <Input type="number" placeholder="Mínima" value={filters.minArea || ''}
                  onChange={(e) => handleNumericChange('minArea', e.target.value)} className="text-sm" />
                <Input type="number" placeholder="Máxima" value={filters.maxArea || ''}
                  onChange={(e) => handleNumericChange('maxArea', e.target.value)} className="text-sm" />
              </div>
            </div>

            <Separator />

            {/* Condominium */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full">
                <DollarSign className="h-4 w-4 text-muted-foreground" /> Condomínio
                <ChevronDown className="h-4 w-4 ml-auto" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="text" placeholder="Mínimo"
                    value={filters.minCondominium ? formatCurrency(filters.minCondominium).replace('R$', '').trim() : ''}
                    onChange={(e) => handleNumericChange('minCondominium', e.target.value)} className="text-sm" />
                  <Input type="text" placeholder="Máximo"
                    value={filters.maxCondominium ? formatCurrency(filters.maxCondominium).replace('R$', '').trim() : ''}
                    onChange={(e) => handleNumericChange('maxCondominium', e.target.value)} className="text-sm" />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Beach Distance */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full">
                <Waves className="h-4 w-4 text-muted-foreground" /> Proximidade da Praia
                {filters.maxBeachDistance && (
                  <Badge variant="secondary" className="text-xs ml-1">≤{filters.maxBeachDistance}m</Badge>
                )}
                <ChevronDown className="h-4 w-4 ml-auto" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                <div className="px-1">
                  <Slider
                    min={0}
                    max={5000}
                    step={100}
                    value={[filters.maxBeachDistance || 5000]}
                    onValueChange={([value]) => onUpdateFilter('maxBeachDistance', value >= 5000 ? null : value)}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0m</span>
                    <span className="font-medium text-foreground">
                      {filters.maxBeachDistance ? `≤ ${filters.maxBeachDistance}m` : 'Qualquer'}
                    </span>
                    <span>5km+</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Launch Stage */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Rocket className="h-4 w-4 text-muted-foreground" />
                Fase do Lançamento
              </Label>
              <ToggleGroup type="single" value={filters.launchStage}
                onValueChange={(value) => value && onUpdateFilter('launchStage', value)} className="justify-start flex-wrap">
                <ToggleGroupItem value="all">Todos</ToggleGroupItem>
                <ToggleGroupItem value="pre_lancamento">Pré-Lanç.</ToggleGroupItem>
                <ToggleGroupItem value="lancamento">Lançamento</ToggleGroupItem>
                <ToggleGroupItem value="em_construcao">Construção</ToggleGroupItem>
                <ToggleGroupItem value="pronto">Pronto</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Separator />
            {availableAmenities.length > 0 && (
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
            )}

            {/* Availability Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Disponibilidade</Label>
              <Select value={filters.availabilityStatus} onValueChange={(value) => onUpdateFilter('availabilityStatus', value)}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="available">🟢 Disponível</SelectItem>
                  <SelectItem value="reserved">🟡 Reservado</SelectItem>
                  <SelectItem value="sold">🔴 Vendido</SelectItem>
                  <SelectItem value="rented">🔵 Alugado</SelectItem>
                  <SelectItem value="unavailable">⚫ Indisponível</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <Select value={filters.status} onValueChange={(value) => onUpdateFilter('status', value)}>
                <SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="com_proposta">Com Proposta</SelectItem>
                  <SelectItem value="reservado">Reservado</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                  <SelectItem value="alugado">Alugado</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
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
          {filters.transactionType !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {filters.transactionType === 'venda' ? 'Venda' : 'Aluguel'}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter('transactionType', 'all')} />
            </Badge>
          )}
          {filters.minBedrooms && (
            <Badge variant="secondary" className="gap-1">
              {filters.minBedrooms}+ quartos
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter('minBedrooms', null)} />
            </Badge>
          )}
          {filters.minSuites && (
            <Badge variant="secondary" className="gap-1">
              {filters.minSuites}+ suítes
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter('minSuites', null)} />
            </Badge>
          )}
          {filters.minParking && (
            <Badge variant="secondary" className="gap-1">
              {filters.minParking}+ vagas
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter('minParking', null)} />
            </Badge>
          )}
          {filters.city && (
            <Badge variant="secondary" className="gap-1">
              {filters.city}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter('city', '')} />
            </Badge>
          )}
          {filters.neighborhood && (
            <Badge variant="secondary" className="gap-1">
              {filters.neighborhood}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter('neighborhood', '')} />
            </Badge>
          )}
          {(filters.minPrice || filters.maxPrice) && (
            <Badge variant="secondary" className="gap-1">
              {filters.minPrice ? formatCurrency(filters.minPrice) : 'R$ 0'} - {filters.maxPrice ? formatCurrency(filters.maxPrice) : '∞'}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilters({ minPrice: null, maxPrice: null })} />
            </Badge>
          )}
          {filters.propertyCondition !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {filters.propertyCondition === 'novo' ? 'Novo' : filters.propertyCondition === 'usado' ? 'Usado' : 'Na Planta'}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter('propertyCondition', 'all')} />
            </Badge>
          )}
          {filters.amenities.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              {filters.amenities.length} amenidades
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter('amenities', [])} />
            </Badge>
          )}
          {filters.maxBeachDistance && (
            <Badge variant="secondary" className="gap-1">
              ≤{filters.maxBeachDistance}m da praia
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter('maxBeachDistance', null)} />
            </Badge>
          )}
          {filters.launchStage !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {filters.launchStage === 'pre_lancamento' ? 'Pré-Lançamento' : 
               filters.launchStage === 'lancamento' ? 'Lançamento' :
               filters.launchStage === 'em_construcao' ? 'Em Construção' : 'Pronto'}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter('launchStage', 'all')} />
            </Badge>
          )}
          {filters.ownerId && (
            <Badge variant="secondary" className="gap-1">
              {owners.find(o => o.id === filters.ownerId)?.name || 'Proprietário'}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onUpdateFilter('ownerId', '')} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
