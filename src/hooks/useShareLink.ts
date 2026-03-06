import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function useShareLink() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateShareLink = async (propertyId: string): Promise<string | null> => {
    if (!profile?.user_id || !profile?.organization_id) {
      toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
      return null;
    }

    setIsGenerating(true);
    try {
      // Get org slug and property code to build the short URL
      const [{ data: orgData }, { data: propData }] = await Promise.all([
        supabase
          .from("organizations")
          .select("slug")
          .eq("id", profile.organization_id)
          .single(),
        supabase
          .from("properties")
          .select("property_code")
          .eq("id", propertyId)
          .single(),
      ]);

      if (!orgData?.slug || !propData?.property_code) {
        toast({ title: "Erro", description: "Não foi possível gerar o link.", variant: "destructive" });
        return null;
      }

      // Ensure a share link record exists for tracking (broker attribution)
      const { data: existing } = await (supabase
        .from("property_share_links" as any)
        .select("id")
        .eq("property_id", propertyId)
        .eq("broker_id", profile.user_id)
        .eq("active", true)
        .maybeSingle() as any);

      if (!existing) {
        // Create share link record for broker tracking
        const slug = `${orgData.slug}-${propData.property_code}`;
        await supabase
          .from("property_share_links" as any)
          .insert({
            property_id: propertyId,
            broker_id: profile.user_id,
            slug,
            active: true,
          });
      }

      return `${window.location.origin}/i/${orgData.slug}/${propData.property_code}`;
    } catch (err) {
      console.error("Error generating share link:", err);
      toast({ title: "Erro", description: "Não foi possível gerar o link.", variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const revokeShareLink = async (propertyId: string) => {
    if (!profile?.user_id) return;

    const { error } = await supabase
      .from("property_share_links" as any)
      .update({ active: false })
      .eq("property_id", propertyId)
      .eq("broker_id", profile.user_id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível revogar o link.", variant: "destructive" });
    } else {
      toast({ title: "Link revogado", description: "O link público foi desativado." });
    }
  };

  return { generateShareLink, revokeShareLink, isGenerating };
}
