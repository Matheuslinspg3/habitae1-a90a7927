import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PropertyFilters {
  searchText: string;
  transactionType: string;
  status: string;
  propertyTypeId: string;
  minPrice: number | null;
  maxPrice: number | null;
  minBedrooms: number | null;
  neighborhood: string;
  city: string;
  minArea: number | null;
  minSuites: number | null;
  minParking: number | null;
  maxArea: number | null;
  minCondominium: number | null;
  maxCondominium: number | null;
  amenities: string[];
  propertyCondition: string;
  maxBeachDistance: number | null;
  launchStage: string;
  ownerId: string;
}

const defaultFilters: PropertyFilters = {
  searchText: '',
  transactionType: 'all',
  status: 'all',
  propertyTypeId: 'all',
  minPrice: null,
  maxPrice: null,
  minBedrooms: null,
  neighborhood: '',
  city: '',
  minArea: null,
  minSuites: null,
  minParking: null,
  maxArea: null,
  minCondominium: null,
  maxCondominium: null,
  amenities: [],
  propertyCondition: 'all',
  maxBeachDistance: null,
  launchStage: 'all',
  ownerId: '',
};

export function usePropertyFilters() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [filters, setFilters] = useState<PropertyFilters>(() => ({
    searchText: searchParams.get('q') || '',
    transactionType: searchParams.get('tipo') || 'all',
    status: searchParams.get('status') || 'all',
    propertyTypeId: searchParams.get('tipo_imovel') || 'all',
    minPrice: searchParams.get('min_preco') ? Number(searchParams.get('min_preco')) : null,
    maxPrice: searchParams.get('max_preco') ? Number(searchParams.get('max_preco')) : null,
    minBedrooms: searchParams.get('quartos') ? Number(searchParams.get('quartos')) : null,
    neighborhood: searchParams.get('bairro') || '',
    city: searchParams.get('cidade') || '',
    minArea: searchParams.get('area') ? Number(searchParams.get('area')) : null,
    minSuites: searchParams.get('suites') ? Number(searchParams.get('suites')) : null,
    minParking: searchParams.get('vagas') ? Number(searchParams.get('vagas')) : null,
    maxArea: searchParams.get('area_max') ? Number(searchParams.get('area_max')) : null,
    minCondominium: searchParams.get('cond_min') ? Number(searchParams.get('cond_min')) : null,
    maxCondominium: searchParams.get('cond_max') ? Number(searchParams.get('cond_max')) : null,
    amenities: searchParams.get('amenidades') ? searchParams.get('amenidades')!.split(',') : [],
    propertyCondition: searchParams.get('condicao') || 'all',
    maxBeachDistance: searchParams.get('praia_max') ? Number(searchParams.get('praia_max')) : null,
    launchStage: searchParams.get('fase') || 'all',
    ownerId: searchParams.get('proprietario') || '',
  }));

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (filters.searchText) params.set('q', filters.searchText);
    if (filters.transactionType !== 'all') params.set('tipo', filters.transactionType);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.propertyTypeId !== 'all') params.set('tipo_imovel', filters.propertyTypeId);
    if (filters.minPrice) params.set('min_preco', String(filters.minPrice));
    if (filters.maxPrice) params.set('max_preco', String(filters.maxPrice));
    if (filters.minBedrooms) params.set('quartos', String(filters.minBedrooms));
    if (filters.neighborhood) params.set('bairro', filters.neighborhood);
    if (filters.city) params.set('cidade', filters.city);
    if (filters.minArea) params.set('area', String(filters.minArea));
    if (filters.minSuites) params.set('suites', String(filters.minSuites));
    if (filters.minParking) params.set('vagas', String(filters.minParking));
    if (filters.maxArea) params.set('area_max', String(filters.maxArea));
    if (filters.minCondominium) params.set('cond_min', String(filters.minCondominium));
    if (filters.maxCondominium) params.set('cond_max', String(filters.maxCondominium));
    if (filters.amenities.length > 0) params.set('amenidades', filters.amenities.join(','));
    if (filters.propertyCondition !== 'all') params.set('condicao', filters.propertyCondition);
    if (filters.maxBeachDistance) params.set('praia_max', String(filters.maxBeachDistance));
    if (filters.launchStage !== 'all') params.set('fase', filters.launchStage);
    if (filters.ownerId) params.set('proprietario', filters.ownerId);

    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // Fetch neighborhoods for dropdown
  const { data: neighborhoods = [] } = useQuery({
    queryKey: ['property-neighborhoods', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase.rpc('get_property_neighborhoods', {
        p_organization_id: profile.organization_id,
      });
      if (error) { console.error('Error fetching neighborhoods:', error); return []; }
      return data as { neighborhood: string; city: string; count: number }[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 60000,
  });

  // Fetch cities for dropdown
  const { data: cities = [] } = useQuery({
    queryKey: ['property-cities', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase.rpc('get_property_cities', {
        p_organization_id: profile.organization_id,
      });
      if (error) { console.error('Error fetching cities:', error); return []; }
      return data as { city: string; state: string; count: number }[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 60000,
  });

  // Fetch available amenities
  const { data: availableAmenities = [] } = useQuery({
    queryKey: ['property-amenities', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from('properties')
        .select('amenities')
        .eq('organization_id', profile.organization_id)
        .not('amenities', 'is', null);
      if (error) { console.error('Error fetching amenities:', error); return []; }
      const allAmenities = new Set<string>();
      data.forEach(p => {
        if (p.amenities) p.amenities.forEach((a: string) => allAmenities.add(a));
      });
      return Array.from(allAmenities).sort();
    },
    enabled: !!profile?.organization_id,
    staleTime: 60000,
  });

  const updateFilter = useCallback(<K extends keyof PropertyFilters>(key: K, value: PropertyFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateFilters = useCallback((updates: Partial<PropertyFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.searchText !== '' ||
      filters.transactionType !== 'all' ||
      filters.status !== 'all' ||
      filters.propertyTypeId !== 'all' ||
      filters.minPrice !== null ||
      filters.maxPrice !== null ||
      filters.minBedrooms !== null ||
      filters.neighborhood !== '' ||
      filters.city !== '' ||
      filters.minArea !== null ||
      filters.minSuites !== null ||
      filters.minParking !== null ||
      filters.maxArea !== null ||
      filters.minCondominium !== null ||
      filters.maxCondominium !== null ||
      filters.amenities.length > 0 ||
      filters.propertyCondition !== 'all' ||
      filters.maxBeachDistance !== null ||
      filters.launchStage !== 'all' ||
      filters.ownerId !== ''
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.transactionType !== 'all') count++;
    if (filters.status !== 'all') count++;
    if (filters.propertyTypeId !== 'all') count++;
    if (filters.minPrice !== null) count++;
    if (filters.maxPrice !== null) count++;
    if (filters.minBedrooms !== null) count++;
    if (filters.neighborhood !== '') count++;
    if (filters.city !== '') count++;
    if (filters.minArea !== null) count++;
    if (filters.minSuites !== null) count++;
    if (filters.minParking !== null) count++;
    if (filters.maxArea !== null) count++;
    if (filters.minCondominium !== null || filters.maxCondominium !== null) count++;
    if (filters.amenities.length > 0) count++;
    if (filters.propertyCondition !== 'all') count++;
    if (filters.maxBeachDistance !== null) count++;
    if (filters.launchStage !== 'all') count++;
    if (filters.ownerId !== '') count++;
    return count;
  }, [filters]);

  return {
    filters,
    updateFilter,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    neighborhoods,
    cities,
    availableAmenities,
    defaultFilters,
  };
}
