import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

function generateSlug(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

export function useShareLink() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateShareLink = async (propertyId: string): Promise<string | null> => {
    if (!profile?.user_id) {
      toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
      return null;
    }

    setIsGenerating(true);
    try {
      // Check if an active link already exists for this broker+property
      const { data: existing } = await (supabase
        .from("property_share_links" as any)
        .select("slug")
        .eq("property_id", propertyId)
        .eq("broker_id", profile.user_id)
        .eq("active", true)
        .maybeSingle() as any);

      if ((existing as any)?.slug) {
        return `${window.location.origin}/i/${(existing as any).slug}`;
      }

      // Create new link
      const slug = generateSlug();
      const { error } = await supabase
        .from("property_share_links" as any)
        .insert({
          property_id: propertyId,
          broker_id: profile.user_id,
          slug,
          active: true,
        });

      if (error) {
        console.error("Error creating share link:", error);
        toast({ title: "Erro ao gerar link", description: error.message, variant: "destructive" });
        return null;
      }

      return `${window.location.origin}/i/${slug}`;
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
