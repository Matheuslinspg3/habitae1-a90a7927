import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Hash, MapPin, Home, Building2, Navigation } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PropertyResult {
  id: string;
  property_code: string | null;
  title: string;
  address_city: string | null;
  address_neighborhood: string | null;
  sale_price: number | null;
  rent_price: number | null;
  status: string;
  cover_image_url?: string | null;
}

interface AutocompleteSuggestion {
  suggestion_type: string;
  suggestion_value: string;
  suggestion_detail: string | null;
  match_count: number;
}

interface UnifiedPropertySearchProps {
  onSelect?: (property: PropertyResult) => void;
  onTextSearch?: (text: string) => void;
  onNeighborhoodFilter?: (neighborhood: string) => void;
  onCityFilter?: (city: string) => void;
  placeholder?: string;
  className?: string;
}

export function UnifiedPropertySearch({ 
  onSelect, onTextSearch, onNeighborhoodFilter, onCityFilter,
  placeholder = "Buscar por código, título, bairro...",
  className
}: UnifiedPropertySearchProps) {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCodeSearch = /^\d+$/.test(search);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Emit text search for grid filtering
  useEffect(() => {
    if (!isCodeSearch && onTextSearch) onTextSearch(search);
  }, [search, isCodeSearch, onTextSearch]);

  // Code-based search using RPC
  const { data: codeResults = [], isLoading: isLoadingCode } = useQuery({
    queryKey: ['property-code-search', debouncedSearch, profile?.organization_id],
    queryFn: async () => {
      if (!debouncedSearch || !isCodeSearch || !profile?.organization_id) return [];
      const { data, error } = await supabase.rpc('search_properties_by_code', {
        p_code_prefix: debouncedSearch,
        p_organization_id: profile.organization_id,
        p_limit: 10
      });
      if (error) { console.error('Error searching properties by code:', error); return []; }
      return data as PropertyResult[];
    },
    enabled: isCodeSearch && debouncedSearch.length >= 1 && !!profile?.organization_id,
    staleTime: 30000,
  });

  // Autocomplete suggestions for text search (Phase 2)
  const { data: suggestions = [], isLoading: isLoadingSuggestions } = useQuery({
    queryKey: ['property-autocomplete', debouncedSearch, profile?.organization_id],
    queryFn: async () => {
      if (!debouncedSearch || isCodeSearch || !profile?.organization_id) return [];
      const { data, error } = await (supabase.rpc as any)('search_properties_autocomplete', {
        p_organization_id: profile.organization_id,
        p_query: debouncedSearch,
        p_limit: 8,
      });
      if (error) { console.error('Error fetching autocomplete:', error); return []; }
      return (data || []) as AutocompleteSuggestion[];
    },
    enabled: !isCodeSearch && debouncedSearch.length >= 2 && !!profile?.organization_id,
    staleTime: 15000,
  });

  // Fuzzy search fallback (Phase 2) 
  const { data: fuzzyResults = [] } = useQuery({
    queryKey: ['property-fuzzy', debouncedSearch, profile?.organization_id],
    queryFn: async () => {
      if (!debouncedSearch || isCodeSearch || !profile?.organization_id || suggestions.length > 0) return [];
      const { data, error } = await (supabase.rpc as any)('search_properties_fuzzy', {
        p_organization_id: profile.organization_id,
        p_query: debouncedSearch,
        p_limit: 5,
      });
      if (error) { console.error('Error fuzzy search:', error); return []; }
      return data || [];
    },
    enabled: !isCodeSearch && debouncedSearch.length >= 3 && !!profile?.organization_id && suggestions.length === 0,
    staleTime: 15000,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d+$/.test(value)) {
      setSearch(value.slice(0, 10));
    } else {
      setSearch(value);
    }
    setIsOpen(true);
  };

  const handleSelect = (property: PropertyResult) => {
    setSearch('');
    setIsOpen(false);
    onSelect?.(property);
  };

  const handleSuggestionClick = (suggestion: AutocompleteSuggestion) => {
    if (suggestion.suggestion_type === 'neighborhood' && onNeighborhoodFilter) {
      onNeighborhoodFilter(suggestion.suggestion_value);
      setSearch('');
      setIsOpen(false);
    } else if (suggestion.suggestion_type === 'city' && onCityFilter) {
      onCityFilter(suggestion.suggestion_value);
      setSearch('');
      setIsOpen(false);
    } else {
      // For property type, set as text search
      setSearch(suggestion.suggestion_value);
      setIsOpen(false);
      onTextSearch?.(suggestion.suggestion_value);
    }
  };

  const showDropdown = isOpen && search.length > 0 && (
    isCodeSearch || suggestions.length > 0 || fuzzyResults.length > 0
  );

  const isLoading = isLoadingCode || isLoadingSuggestions;

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        {isCodeSearch ? (
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        <Input
          ref={inputRef}
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsOpen(false);
          }}
          placeholder={placeholder}
          className={cn("pl-9", isCodeSearch && "font-mono tracking-wider")}
          aria-label="Buscar imóveis"
          aria-expanded={showDropdown}
          role="combobox"
          aria-autocomplete="list"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {showDropdown && (
        <Card className="absolute z-50 mt-2 w-full shadow-lg">
          <CardContent className="p-2" role="listbox">
            {/* Code search results */}
            {isCodeSearch && (
              <>
                {isLoadingCode ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="h-12 w-12 rounded" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : codeResults.length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    Nenhum imóvel encontrado
                  </p>
                ) : (
                  <div className="space-y-1">
                    {codeResults.map((property) => (
                      <button key={property.id} onClick={() => handleSelect(property)}
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                        role="option">
                        {property.cover_image_url ? (
                          <img src={property.cover_image_url} alt="" className="h-12 w-12 rounded object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                            <Home className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-primary">{property.property_code}</span>
                            <Badge variant="outline" className="text-xs">{property.status}</Badge>
                          </div>
                          <p className="truncate text-sm">{property.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{property.address_neighborhood}, {property.address_city}</span>
                            {(property.sale_price || property.rent_price) && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-foreground">
                                  {property.sale_price ? formatCurrency(property.sale_price) : `${formatCurrency(property.rent_price!)}/mês`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Autocomplete suggestions */}
            {!isCodeSearch && suggestions.length > 0 && (
              <div className="space-y-1">
                <p className="px-2 py-1 text-xs text-muted-foreground">Sugestões</p>
                {suggestions.map((suggestion, i) => (
                  <button key={`${suggestion.suggestion_type}-${i}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                    role="option">
                    {suggestion.suggestion_type === 'property' && <Home className="h-4 w-4 text-muted-foreground shrink-0" />}
                    {suggestion.suggestion_type === 'neighborhood' && <Navigation className="h-4 w-4 text-muted-foreground shrink-0" />}
                    {suggestion.suggestion_type === 'city' && <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{suggestion.suggestion_value}</p>
                      {suggestion.suggestion_detail && (
                        <p className="text-xs text-muted-foreground truncate">{suggestion.suggestion_detail}</p>
                      )}
                    </div>
                    {suggestion.suggestion_type !== 'property' && suggestion.match_count > 0 && (
                      <Badge variant="secondary" className="text-xs shrink-0">{suggestion.match_count}</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Fuzzy results fallback */}
            {!isCodeSearch && suggestions.length === 0 && fuzzyResults.length > 0 && (
              <div className="space-y-1">
                <p className="px-2 py-1 text-xs text-muted-foreground">Você quis dizer?</p>
                {fuzzyResults.map((result: any) => (
                  <button key={result.id}
                    onClick={() => { setSearch(result.title); setIsOpen(false); onTextSearch?.(result.title); }}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                    role="option">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {result.address_neighborhood}{result.address_city ? `, ${result.address_city}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
