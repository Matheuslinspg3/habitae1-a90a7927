import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useMarketplace, useMarketplaceFilterData, type MarketplaceProperty } from "@/hooks/useMarketplace";
import { MarketplaceFilters, type MarketplaceFiltersState, defaultMarketplaceFilters } from "@/components/marketplace/MarketplaceFilters";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building, Loader2 } from "lucide-react";
import { MarketplacePropertyCard } from "@/components/marketplace/MarketplacePropertyCard";
import { ContactDialog } from "@/components/marketplace/ContactDialog";

export default function Marketplace() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<MarketplaceFiltersState>(defaultMarketplaceFilters);
  const [contactProperty, setContactProperty] = useState<MarketplaceProperty | null>(null);

  const { properties, isLoading, isFetching, totalCount, hasMore, loadMore, resetPage, logContactAccess } = useMarketplace(filters);
  const { cities, neighborhoods, propertyTypes, availableAmenities } = useMarketplaceFilterData(filters.city || undefined);

  // Reset page when filters change
  useEffect(() => {
    resetPage();
  }, [filters, resetPage]);

  const updateFilter = useCallback(<K extends keyof MarketplaceFiltersState>(key: K, value: MarketplaceFiltersState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultMarketplaceFilters);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.transactionType !== "all") count++;
    if (filters.propertyTypeId !== "all") count++;
    if (filters.minPrice !== null) count++;
    if (filters.maxPrice !== null) count++;
    if (filters.minBedrooms !== null) count++;
    if (filters.minSuites !== null) count++;
    if (filters.minBathrooms !== null) count++;
    if (filters.minParking !== null) count++;
    if (filters.city) count++;
    if (filters.neighborhood) count++;
    if (filters.minArea !== null) count++;
    if (filters.maxArea !== null) count++;
    if (filters.amenities.length > 0) count++;
    if (filters.featured) count++;
    return count;
  }, [filters]);

  const handleContactClick = async (property: MarketplaceProperty) => {
    await logContactAccess(property.id);
    setContactProperty(property);
  };

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader
        title="Marketplace"
        description="Explore imóveis exclusivos de parceiros"
      />

      <div className="flex-1 p-4 sm:p-6 space-y-4">
        <MarketplaceFilters
          filters={filters}
          onUpdateFilter={updateFilter}
          onClearFilters={clearFilters}
          activeFilterCount={activeFilterCount}
          cities={cities}
          neighborhoods={neighborhoods}
          propertyTypes={propertyTypes}
          availableAmenities={availableAmenities}
        />

        {!isLoading && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalCount === 0 ? "Nenhum imóvel encontrado" : (
                <><span className="font-medium text-foreground">{totalCount}</span> {totalCount === 1 ? "imóvel encontrado" : "imóveis encontrados"}</>
              )}
            </p>
            {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}

        {isLoading ? (
          // PERF: UX — structured card skeletons instead of generic rectangles
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border overflow-hidden">
                <Skeleton className="aspect-[16/10] w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-3">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <Skeleton className="h-6 w-28" />
                </div>
              </div>
            ))}
          </div>
          </div>
        ) : properties.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">Nenhum imóvel encontrado</CardTitle>
              <CardDescription className="mb-4 text-center">
                {activeFilterCount > 0
                  ? "Nenhum imóvel corresponde aos filtros aplicados. Tente ajustar sua busca."
                  : "Ainda não há imóveis de outras imobiliárias no marketplace."}
              </CardDescription>
              {activeFilterCount === 0 && (
                <Button variant="outline" onClick={() => navigate('/imoveis')}>
                  <Building className="h-4 w-4 mr-2" /> Ver meus imóveis
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => (
                <MarketplacePropertyCard key={property.id} property={property} onContactClick={handleContactClick} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={loadMore} disabled={isFetching} className="min-w-[200px]">
                  {isFetching ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Carregando...</>) : "Carregar mais"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ContactDialog property={contactProperty} open={!!contactProperty} onOpenChange={(open) => !open && setContactProperty(null)} />
    </div>
  );
}
