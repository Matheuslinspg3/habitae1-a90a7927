import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PropertyFilters } from './usePropertyFilters';

interface SearchResult {
  id: string;
  property_code: string | null;
  title: string;
  description: string | null;
  address_city: string | null;
  address_neighborhood: string | null;
  address_state: string | null;
  sale_price: number | null;
  rent_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  area_total: number | null;
  area_built: number | null;
  status: string;
  transaction_type: string;
  property_type_id: string | null;
  cover_image_url: string | null;
  beach_distance_meters: number | null;
  created_at: string;
  updated_at: string;
}

export function useAdvancedPropertySearch(
  filters: PropertyFilters,
  enabled: boolean = true
) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['properties-advanced-search', profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await (supabase.rpc as any)('search_properties_advanced', {
        p_organization_id: profile.organization_id,
        p_search_text: filters.searchText || null,
        p_transaction_type: filters.transactionType === 'all' ? null : filters.transactionType,
        p_status: filters.status === 'all' ? null : filters.status,
        p_property_type_id: filters.propertyTypeId === 'all' ? null : filters.propertyTypeId,
        p_min_price: filters.minPrice,
        p_max_price: filters.maxPrice,
        p_min_bedrooms: filters.minBedrooms,
        p_neighborhood: filters.neighborhood || null,
        p_city: filters.city || null,
        p_min_area: filters.minArea,
        p_limit: 2000,
        p_offset: 0,
        p_min_suites: filters.minSuites,
        p_min_parking: filters.minParking,
        p_max_area: filters.maxArea,
        p_min_condominium: filters.minCondominium,
        p_max_condominium: filters.maxCondominium,
        p_amenities: filters.amenities.length > 0 ? filters.amenities : null,
        p_property_condition: filters.propertyCondition === 'all' ? null : filters.propertyCondition,
        p_max_beach_distance: filters.maxBeachDistance,
        p_launch_stage: filters.launchStage === 'all' ? null : filters.launchStage,
      });

      if (error) {
        console.error('Error searching properties:', error);
        throw error;
      }

      return (data || []) as SearchResult[];
    },
    enabled: enabled && !!profile?.organization_id,
    staleTime: 30000,
  });
}
