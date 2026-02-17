import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Locate, Loader2, Map } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { PropertyWithDetails } from '@/hooks/useProperties';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface PropertyMapViewProps {
  properties: PropertyWithDetails[];
  onPropertyClick?: (property: PropertyWithDetails) => void;
  onRefresh?: () => void;
}

export function PropertyMapView({ properties, onPropertyClick, onRefresh }: PropertyMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState('');

  const propertiesWithCoords = properties.filter(p => p.latitude && p.longitude);
  const propertiesWithoutCoords = properties.filter(p => !p.latitude || !p.longitude);

  // Initialize map when showMap becomes true
  useEffect(() => {
    if (!showMap || !mapRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = [-23.5505, -46.6333];
    const map = L.map(mapRef.current, {
      center: propertiesWithCoords.length > 0
        ? [propertiesWithCoords[0].latitude!, propertiesWithCoords[0].longitude!]
        : defaultCenter,
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [showMap]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();
    if (propertiesWithCoords.length === 0) return;

    const bounds = L.latLngBounds([]);

    propertiesWithCoords.forEach(property => {
      const lat = property.latitude!;
      const lng = property.longitude!;
      bounds.extend([lat, lng]);

      const price = property.sale_price
        ? formatCurrency(property.sale_price)
        : property.rent_price
          ? `${formatCurrency(property.rent_price)}/mês`
          : '';

      const coverImage = property.images?.find(i => i.is_cover)?.url || property.images?.[0]?.url;

      const popupContent = `
        <div style="min-width:200px;max-width:280px;">
          ${coverImage ? `<img src="${coverImage}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:8px;" />` : ''}
          <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${property.title}</div>
          ${property.property_code ? `<div style="font-family:monospace;font-size:12px;color:#6b7280;margin-bottom:4px;">Cód: ${property.property_code}</div>` : ''}
          ${property.address_neighborhood ? `<div style="font-size:12px;color:#6b7280;">${property.address_neighborhood}${property.address_city ? `, ${property.address_city}` : ''}</div>` : ''}
          ${price ? `<div style="font-weight:600;font-size:14px;color:#7c3aed;margin-top:6px;">${price}</div>` : ''}
          <div style="font-size:11px;color:#9ca3af;margin-top:4px;">${property.bedrooms || 0} quartos • ${property.area_total || 0}m²</div>
        </div>
      `;

      const marker = L.marker([lat, lng])
        .bindPopup(popupContent, { maxWidth: 300 });

      if (onPropertyClick) {
        marker.on('click', () => onPropertyClick(property));
      }

      markersRef.current!.addLayer(marker);
    });

    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [propertiesWithCoords, onPropertyClick, showMap]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(coords, 14);
          L.marker(coords, {
            icon: L.divIcon({
              className: 'user-location-marker',
              html: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
          }).addTo(mapInstanceRef.current).bindPopup('Sua localização');
        }
      },
      () => {},
      { enableHighAccuracy: true }
    );
  };

  const handleGeocode = async () => {
    setIsGeocoding(true);
    setGeocodeProgress('Iniciando geocodificação...');

    try {
      const { data, error } = await supabase.functions.invoke('geocode-properties', {
        body: { batch_size: 20 },
      });

      if (error) throw error;

      const result = data as { ok: boolean; processed: number; results: Array<{ id: string; status: string }> };
      
      if (result.ok) {
        const successful = result.results.filter(r => r.status === 'ok').length;
        const failed = result.results.filter(r => r.status === 'failed').length;
        
        toast.success(`Geocodificação concluída: ${successful} encontrados, ${failed} sem resultado`);
        setGeocodeProgress('');
        onRefresh?.();
      } else {
        throw new Error('Falha na geocodificação');
      }
    } catch (e) {
      console.error('Geocoding error:', e);
      toast.error('Erro ao geocodificar imóveis');
      setGeocodeProgress('');
    } finally {
      setIsGeocoding(false);
    }
  };

  // No properties at all
  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum imóvel encontrado</h3>
            <p className="text-muted-foreground">Cadastre imóveis para visualizá-los no mapa.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Has properties but none with coords - show geocode CTA
  if (propertiesWithCoords.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Preparando o Mapa</h3>
            <p className="text-muted-foreground max-w-md mb-4">
              {properties.length} imóveis encontrados, mas nenhum possui coordenadas geográficas.
              Clique abaixo para gerar as coordenadas automaticamente a partir dos endereços cadastrados.
            </p>
            {isGeocoding ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{geocodeProgress || 'Geocodificando...'}</p>
              </div>
            ) : (
              <Button onClick={handleGeocode} className="gap-2">
                <MapPin className="h-4 w-4" />
                Gerar coordenadas agora
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Has coords - show preview then map
  if (!showMap) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Map className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-1">
              {propertiesWithCoords.length} imóveis no mapa
            </h3>
            {propertiesWithoutCoords.length > 0 && (
              <p className="text-sm text-muted-foreground mb-3">
                {propertiesWithoutCoords.length} imóveis sem coordenadas
              </p>
            )}
            <div className="flex gap-2 flex-wrap justify-center">
              <Button onClick={() => setShowMap(true)} className="gap-2">
                <Map className="h-4 w-4" />
                Carregar mapa
              </Button>
              {propertiesWithoutCoords.length > 0 && (
                <Button variant="outline" onClick={handleGeocode} disabled={isGeocoding} className="gap-2">
                  {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  Geocodificar restantes
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0 relative">
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          <Button size="sm" variant="secondary" onClick={handleLocateMe} className="shadow-md gap-1">
            <Locate className="h-4 w-4" /> Minha localização
          </Button>
          {propertiesWithoutCoords.length > 0 && (
            <Button size="sm" variant="secondary" onClick={handleGeocode} disabled={isGeocoding} className="shadow-md gap-1">
              {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              Geocodificar ({propertiesWithoutCoords.length})
            </Button>
          )}
          <Badge variant="secondary" className="shadow-md justify-center">
            {propertiesWithCoords.length} imóveis no mapa
          </Badge>
        </div>
        <div ref={mapRef} className="h-[500px] sm:h-[600px] w-full" />
      </CardContent>
    </Card>
  );
}
