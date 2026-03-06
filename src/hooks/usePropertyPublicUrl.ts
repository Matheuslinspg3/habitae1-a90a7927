import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Caches the org slug for the current session and builds /i/:orgSlug/:code URLs */
export function usePropertyPublicUrl() {
  const { profile } = useAuth();
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.organization_id) return;
    supabase
      .from("organizations")
      .select("slug")
      .eq("id", profile.organization_id)
      .single()
      .then(({ data }) => {
        if (data?.slug) setOrgSlug(data.slug);
      });
  }, [profile?.organization_id]);

  /** Returns the short public URL or falls back to /imovel/:id */
  const buildPublicUrl = (propertyId: string, propertyCode?: string | null): string => {
    if (orgSlug && propertyCode) {
      return `${window.location.origin}/i/${orgSlug}/${propertyCode}`;
    }
    // Fallback for properties without code
    return `${window.location.origin}/imovel/${propertyId}`;
  };

  return { buildPublicUrl, orgSlug };
}
