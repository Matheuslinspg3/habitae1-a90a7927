import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * This page handles routing by property code.
 * If the param is a UUID, redirect to PropertyDetails.
 * If it's numeric (property code), find the property and redirect to its details page.
 */
export default function PropertyByCode() {
  const { codeOrId } = useParams<{ codeOrId: string }>();
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveProperty() {
      if (!codeOrId) {
        navigate('/imoveis', { replace: true });
        return;
      }

      // Check if it's a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(codeOrId)) {
        // It's a UUID, redirect directly to property details
        navigate(`/imoveis/${codeOrId}`, { replace: true });
        return;
      }

      // It's a code - wait for auth
      if (authLoading || !profile?.organization_id) {
        return;
      }

      // Check if it's numeric (property code)
      if (/^\d+$/.test(codeOrId)) {
        const { data, error: fetchError } = await supabase
          .from('properties')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('property_code', codeOrId)
          .single();

        if (fetchError || !data) {
          setError(`Imóvel com código ${codeOrId} não encontrado`);
          setTimeout(() => navigate('/imoveis', { replace: true }), 2000);
          return;
        }

        navigate(`/imoveis/${data.id}`, { replace: true });
      } else {
        // Invalid format
        setError('Formato de código inválido');
        setTimeout(() => navigate('/imoveis', { replace: true }), 2000);
      }
    }

    resolveProperty();
  }, [codeOrId, profile?.organization_id, authLoading, navigate]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-destructive">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Buscando imóvel...</span>
      </div>
    </div>
  );
}
