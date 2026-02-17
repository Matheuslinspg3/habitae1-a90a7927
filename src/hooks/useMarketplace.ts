import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useCallback, useMemo } from "react";
import { type MarketplaceFiltersState, defaultMarketplaceFilters } from "@/components/marketplace/MarketplaceFilters";

export interface MarketplaceProperty {
  id: string;
  external_code: string | null;
  title: string;
  description: string | null;
  property_type_id: string | null;
  transaction_type: 'venda' | 'aluguel' | 'ambos';
  sale_price: number | null;
  rent_price: number | null;
  commission_percentage: number | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zipcode: string | null;
  bedrooms: number;
  suites: number;
  bathrooms: number;
  parking_spots: number;
  area_total: number | null;
  area_built: number | null;
  amenities: string[] | null;
  images: string[] | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  status: 'disponivel' | 'reservado' | 'vendido' | 'alugado' | 'inativo';
  is_featured: boolean;
  created_at: string;
  organization_id: string | null;
}

const PAGE_SIZE = 12;

export function useMarketplace(filters: MarketplaceFiltersState) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;
  const [page, setPage] = useState(0);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["marketplace-properties", filters, page],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_properties_public" as any)
        .select("*", { count: "exact" })
        .eq("status", "disponivel")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .range(0, (page + 1) * PAGE_SIZE - 1);

      if (organizationId) {
        query = query.neq("organization_id", organizationId);
      }

      if (filters.transactionType && filters.transactionType !== "all") {
        query = query.eq("transaction_type", filters.transactionType);
      }

      if (filters.propertyTypeId && filters.propertyTypeId !== "all") {
        query = query.eq("property_type_id", filters.propertyTypeId);
      }

      if (filters.city) {
        query = query.ilike("address_city", `%${filters.city}%`);
      }

      if (filters.neighborhood) {
        query = query.ilike("address_neighborhood", `%${filters.neighborhood}%`);
      }

      if (filters.minPrice) {
        query = query.or(`sale_price.gte.${filters.minPrice},rent_price.gte.${filters.minPrice}`);
      }

      if (filters.maxPrice) {
        query = query.or(`sale_price.lte.${filters.maxPrice},rent_price.lte.${filters.maxPrice}`);
      }

      if (filters.minBedrooms) {
        query = query.gte("bedrooms", filters.minBedrooms);
      }

      if (filters.minSuites) {
        query = query.gte("suites", filters.minSuites);
      }

      if (filters.minBathrooms) {
        query = query.gte("bathrooms", filters.minBathrooms);
      }

      if (filters.minParking) {
        query = query.gte("parking_spots", filters.minParking);
      }

      if (filters.minArea) {
        query = query.gte("area_total", filters.minArea);
      }

      if (filters.maxArea) {
        query = query.lte("area_total", filters.maxArea);
      }

      if (filters.featured) {
        query = query.eq("is_featured", true);
      }

      if (filters.amenities.length > 0) {
        query = query.contains("amenities", filters.amenities);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return { properties: (data as unknown) as MarketplaceProperty[], totalCount: count ?? 0 };
    },
    enabled: !!organizationId,
  });

  const properties = data?.properties ?? [];
  const totalCount = data?.totalCount ?? 0;
  const hasMore = properties.length < totalCount;

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const resetPage = useCallback(() => {
    setPage(0);
  }, []);

  const logContactAccess = async (propertyId: string) => {
    if (!organizationId || !profile?.user_id) return;

    await supabase.from("marketplace_contact_access").insert({
      user_id: profile.user_id,
      organization_id: organizationId,
      marketplace_property_id: propertyId,
    });
  };

  return {
    properties,
    isLoading,
    isFetching,
    error,
    totalCount,
    hasMore,
    loadMore,
    resetPage,
    logContactAccess,
  };
}

// Hook to fetch marketplace filter data (cities, neighborhoods, property types, amenities)
export function useMarketplaceFilterData(cityFilter?: string) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  const { data: cities = [] } = useQuery({
    queryKey: ["marketplace-cities", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_properties_public" as any)
        .select("address_city")
        .eq("status", "disponivel")
        .not("address_city", "is", null);

      if (organizationId) {
        query = query.neq("organization_id", organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const cityMap = new Map<string, number>();
      (data as any[]).forEach((d: any) => {
        const city = d.address_city?.trim();
        if (city) cityMap.set(city, (cityMap.get(city) || 0) + 1);
      });

      return Array.from(cityMap.entries())
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => a.city.localeCompare(b.city));
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["marketplace-neighborhoods-filter", organizationId, cityFilter],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_properties_public" as any)
        .select("address_neighborhood")
        .eq("status", "disponivel")
        .not("address_neighborhood", "is", null);

      if (organizationId) {
        query = query.neq("organization_id", organizationId);
      }

      if (cityFilter) {
        query = query.ilike("address_city", `%${cityFilter}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const neighMap = new Map<string, number>();
      (data as any[]).forEach((d: any) => {
        const n = d.address_neighborhood?.trim();
        if (n) neighMap.set(n, (neighMap.get(n) || 0) + 1);
      });

      return Array.from(neighMap.entries())
        .map(([neighborhood, count]) => ({ neighborhood, count }))
        .sort((a, b) => a.neighborhood.localeCompare(b.neighborhood));
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });

  const { data: propertyTypes = [] } = useQuery({
    queryKey: ["marketplace-property-types", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_properties_public" as any)
        .select("property_type_id")
        .eq("status", "disponivel")
        .not("property_type_id", "is", null);

      if (organizationId) {
        query = query.neq("organization_id", organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const typeIds = [...new Set((data as any[]).map((d: any) => d.property_type_id).filter(Boolean))];
      if (typeIds.length === 0) return [];

      const { data: types, error: typesError } = await supabase
        .from("property_types")
        .select("id, name")
        .in("id", typeIds)
        .order("name");

      if (typesError) throw typesError;
      return types || [];
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });

  const { data: availableAmenities = [] } = useQuery({
    queryKey: ["marketplace-amenities", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_properties_public" as any)
        .select("amenities")
        .eq("status", "disponivel")
        .not("amenities", "is", null);

      if (organizationId) {
        query = query.neq("organization_id", organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const allAmenities = new Set<string>();
      (data as any[]).forEach((d: any) => {
        if (d.amenities) (d.amenities as string[]).forEach((a: string) => allAmenities.add(a));
      });

      return Array.from(allAmenities).sort();
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });

  return { cities, neighborhoods, propertyTypes, availableAmenities };
}
