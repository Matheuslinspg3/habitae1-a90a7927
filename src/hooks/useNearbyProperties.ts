import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useCallback } from 'react';

interface NearbyProperty {
  id: string;
  property_code: string | null;
  title: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  sale_price: number | null;
  rent_price: number | null;
  cover_image_url: string | null;
}

export function useNearbyProperties(radiusKm: number = 5) {
  const { profile } = useAuth();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não suportada neste navegador');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(null);
      },
      (err) => {
        setLocationError(
          err.code === 1 ? 'Permissão de localização negada' :
          err.code === 2 ? 'Localização indisponível' :
          'Tempo esgotado ao obter localização'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const { data: nearbyProperties = [], isLoading } = useQuery({
    queryKey: ['nearby-properties', profile?.organization_id, userLocation, radiusKm],
    queryFn: async () => {
      if (!profile?.organization_id || !userLocation) return [];
      const { data, error } = await (supabase.rpc as any)('search_properties_nearby', {
        p_organization_id: profile.organization_id,
        p_latitude: userLocation.lat,
        p_longitude: userLocation.lng,
        p_radius_km: radiusKm,
        p_limit: 50,
      });
      if (error) { console.error('Error searching nearby:', error); return []; }
      return (data || []) as NearbyProperty[];
    },
    enabled: !!profile?.organization_id && !!userLocation,
    staleTime: 30000,
  });

  return {
    nearbyProperties,
    isLoading,
    userLocation,
    locationError,
    requestLocation,
    setUserLocation,
  };
}
