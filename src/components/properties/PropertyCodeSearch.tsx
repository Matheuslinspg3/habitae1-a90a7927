import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Hash, MapPin, Home } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PropertyCodeResult {
  id: string;
  property_code: string;
  title: string;
  address_city: string | null;
  address_neighborhood: string | null;
  sale_price: number | null;
  rent_price: number | null;
  status: string;
}

interface PropertyCodeSearchProps {
  onSelect?: (property: PropertyCodeResult) => void;
  placeholder?: string;
  className?: string;
  showResults?: boolean;
}

export function PropertyCodeSearch({ 
  onSelect, 
  placeholder = "Buscar por código...",
  className,
  showResults = true
}: PropertyCodeSearchProps) {
  const { profile } = useAuth();
  const [searchCode, setSearchCode] = useState('');
  const [debouncedCode, setDebouncedCode] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCode(searchCode);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchCode]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['property-code-search', debouncedCode, profile?.organization_id],
    queryFn: async () => {
      if (!debouncedCode || !profile?.organization_id) return [];

      // Busca direta por property_code com LIKE prefix
      const { data, error } = await supabase
        .from('properties')
        .select('id, property_code, title, address_city, address_neighborhood, sale_price, rent_price, status')
        .eq('organization_id', profile.organization_id)
        .like('property_code', `${debouncedCode}%`)
        .order('property_code')
        .limit(10);

      if (error) {
        console.error('Error searching properties by code:', error);
        return [];
      }

      return data as PropertyCodeResult[];
    },
    enabled: !!debouncedCode && !!profile?.organization_id,
    staleTime: 30000,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setSearchCode(value);
    setIsOpen(true);
  };

  const handleSelect = (property: PropertyCodeResult) => {
    setSearchCode(property.property_code);
    setIsOpen(false);
    onSelect?.(property);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={searchCode}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-9 font-mono tracking-wider"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && isOpen && searchCode.length > 0 && (
        <Card className="absolute z-50 mt-2 w-full shadow-lg">
          <CardContent className="p-2">
            {isLoading ? (
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
            ) : results.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                Nenhum imóvel encontrado
              </p>
            ) : (
              <div className="space-y-1">
                {results.map((property) => (
                  <button
                    key={property.id}
                    onClick={() => handleSelect(property)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                      <Home className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-primary">
                          #{property.property_code}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {property.status}
                        </Badge>
                      </div>
                      <p className="truncate text-sm">{property.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{property.address_neighborhood}, {property.address_city}</span>
                        {(property.sale_price || property.rent_price) && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-foreground">
                              {property.sale_price 
                                ? formatCurrency(property.sale_price)
                                : `${formatCurrency(property.rent_price!)}/mês`
                              }
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// Display component for showing property code
export function PropertyCodeBadge({ code, className }: { code: string | null; className?: string }) {
  if (!code) return null;
  
  return (
    <Badge variant="secondary" className={cn("font-mono tracking-wider", className)}>
      <Hash className="mr-1 h-3 w-3" />
      {code}
    </Badge>
  );
}
