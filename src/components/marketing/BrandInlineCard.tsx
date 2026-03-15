/**
 * Compact inline brand preview for the ad generator flow.
 * Shows a collapsible summary of brand settings (colors, font, logo, slogan).
 */
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Stamp, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

interface BrandData {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string | null;
  slogan: string | null;
  tagline: string | null;
  logo_url: string | null;
}

export function BrandInlineCard({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-org", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user!.id)
        .single();
      return data;
    },
  });

  const { data: brand } = useQuery({
    queryKey: ["brand-inline", profile?.organization_id],
    enabled: !!profile?.organization_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_settings")
        .select("primary_color, secondary_color, accent_color, font_family, slogan, tagline, logo_url")
        .eq("organization_id", profile!.organization_id)
        .maybeSingle();
      return data as BrandData | null;
    },
  });

  const hasConfig = !!brand;

  return (
    <Card className="border-dashed">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors rounded-lg">
            <div className="flex items-center gap-2.5">
              <Stamp className="h-4.5 w-4.5 text-primary" />
              <span className="text-sm font-medium">Identidade Visual / Marca</span>
              {hasConfig ? (
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Configurada</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Não configurada</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasConfig && !open && (
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: brand?.primary_color }} />
                  <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: brand?.secondary_color }} />
                  <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: brand?.accent_color }} />
                  {brand?.font_family && (
                    <span className="text-[10px] text-muted-foreground ml-1">{brand.font_family}</span>
                  )}
                </div>
              )}
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-3">
            {hasConfig ? (
              <>
                {/* Colors */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase">Cores</span>
                  <div className="flex flex-wrap items-center gap-3">
                    {[
                      { label: "Primária", color: brand!.primary_color },
                      { label: "Secundária", color: brand!.secondary_color },
                      { label: "Destaque", color: brand!.accent_color },
                    ].map(({ label, color }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded border flex-shrink-0" style={{ backgroundColor: color }} />
                        <div className="text-[10px]">
                          <div className="text-muted-foreground">{label}</div>
                          <div className="font-mono">{color}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Font & texts */}
                <div className="flex flex-wrap gap-4 text-xs">
                  {brand!.font_family && (
                    <div>
                      <span className="text-muted-foreground">Fonte:</span>{" "}
                      <span className="font-medium">{brand!.font_family}</span>
                    </div>
                  )}
                  {brand!.slogan && (
                    <div>
                      <span className="text-muted-foreground">Slogan:</span>{" "}
                      <span className="font-medium">"{brand!.slogan}"</span>
                    </div>
                  )}
                  {brand!.tagline && (
                    <div>
                      <span className="text-muted-foreground">Tagline:</span>{" "}
                      <span className="font-medium">"{brand!.tagline}"</span>
                    </div>
                  )}
                </div>

                {/* Logo preview */}
                {brand!.logo_url && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Logo</span>
                    <img src={brand!.logo_url} alt="Logo" className="h-10 object-contain rounded" />
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhuma identidade visual configurada. Configure cores, fontes e logo na aba Marca do Marketing.
              </p>
            )}

            {onNavigate && (
              <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={onNavigate}>
                <ExternalLink className="h-3 w-3" />
                {hasConfig ? "Editar Marca" : "Configurar Marca"}
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default BrandInlineCard;
