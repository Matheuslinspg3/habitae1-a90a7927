import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLandingOverrides, type LandingOverrides } from "@/hooks/useLandingOverrides";
import { usePropertyPublicUrl } from "@/hooks/usePropertyPublicUrl";
import { useLandingContent } from "@/hooks/useLandingContent";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, Eye, Sparkles, MapPin, Type, MessageSquare, Loader2, Star, Plus, Trash2, Smartphone } from "lucide-react";

interface KeyFeature {
  icon: string;
  title: string;
  description: string;
}

const ICON_OPTIONS = [
  "Star", "Heart", "Shield", "Sun", "Leaf", "Home", "Key", "Award", "Zap",
  "Wifi", "Waves", "Mountain", "TreePine", "MapPin", "Coffee", "Dumbbell",
  "Eye", "Sunset", "Wind", "Droplets", "Lock", "Sparkles",
];

interface LandingPageEditorProps {
  propertyId: string;
  propertyCode?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LandingPageEditor({ propertyId, propertyCode, open, onOpenChange }: LandingPageEditorProps) {
  const { toast } = useToast();
  const { overrides, saveOverrides, isSaving } = useLandingOverrides(propertyId);
  const { content: aiContent } = useLandingContent(propertyId);

  const [form, setForm] = useState({
    custom_headline: "",
    custom_subheadline: "",
    custom_description: "",
    custom_cta_primary: "",
    custom_cta_secondary: "",
    hide_exact_address: true,
    show_nearby_pois: true,
    map_radius_meters: 100,
  });

  const [keyFeatures, setKeyFeatures] = useState<KeyFeature[]>([]);

  useEffect(() => {
    if (overrides) {
      setForm({
        custom_headline: overrides.custom_headline || "",
        custom_subheadline: overrides.custom_subheadline || "",
        custom_description: overrides.custom_description || "",
        custom_cta_primary: overrides.custom_cta_primary || "",
        custom_cta_secondary: overrides.custom_cta_secondary || "",
        hide_exact_address: overrides.hide_exact_address,
        show_nearby_pois: overrides.show_nearby_pois,
        map_radius_meters: overrides.map_radius_meters,
      });
      setKeyFeatures(
        Array.isArray(overrides.custom_key_features) && overrides.custom_key_features.length > 0
          ? overrides.custom_key_features
          : []
      );
    }
  }, [overrides]);

  const addFeature = () => {
    setKeyFeatures([...keyFeatures, { icon: "Star", title: "", description: "" }]);
  };

  const removeFeature = (index: number) => {
    setKeyFeatures(keyFeatures.filter((_, i) => i !== index));
  };

  const updateFeature = (index: number, field: keyof KeyFeature, value: string) => {
    const updated = [...keyFeatures];
    updated[index] = { ...updated[index], [field]: value };
    setKeyFeatures(updated);
  };

  // Auto-save with debounce
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const initialLoadDone = useRef(false);

  const buildUpdates = useCallback(() => {
    const updates: Partial<LandingOverrides> = {};
    if (form.custom_headline) updates.custom_headline = form.custom_headline;
    if (form.custom_subheadline) updates.custom_subheadline = form.custom_subheadline;
    if (form.custom_description) updates.custom_description = form.custom_description;
    if (form.custom_cta_primary) updates.custom_cta_primary = form.custom_cta_primary;
    if (form.custom_cta_secondary) updates.custom_cta_secondary = form.custom_cta_secondary;
    updates.hide_exact_address = form.hide_exact_address;
    updates.show_nearby_pois = form.show_nearby_pois;
    updates.map_radius_meters = form.map_radius_meters;
    const validFeatures = keyFeatures.filter(f => f.title.trim());
    updates.custom_key_features = validFeatures.length > 0 ? validFeatures : null;
    return updates;
  }, [form, keyFeatures]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      // Skip auto-save on initial load
      if (overrides !== undefined) initialLoadDone.current = true;
      return;
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      setAutoSaveStatus("saving");
      saveOverrides(buildUpdates(), {
        onSuccess: () => {
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus("idle"), 2000);
        },
        onError: () => setAutoSaveStatus("idle"),
      });
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [form, keyFeatures]);

  const handleSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    saveOverrides(buildUpdates(), {
      onSuccess: () => {
        toast({ title: "Salvo!", description: "Personalizações da landing page atualizadas." });
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
      },
    });
  };

  const [mobilePreview, setMobilePreview] = useState(false);

  const { buildPublicUrl } = usePropertyPublicUrl();

  const handlePreview = () => {
    window.open(buildPublicUrl(propertyId, propertyCode), "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Editor da Landing Page
          </DialogTitle>
          <DialogDescription>
            Personalize o conteúdo da página de divulgação. Campos vazios usarão o conteúdo gerado por IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Textos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Type className="h-4 w-4" />
                Textos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título principal</Label>
                <Input
                  value={form.custom_headline}
                  onChange={(e) => setForm({ ...form, custom_headline: e.target.value })}
                  placeholder={aiContent?.headline || "Gerado por IA automaticamente"}
                />
              </div>
              <div>
                <Label>Subtítulo</Label>
                <Input
                  value={form.custom_subheadline}
                  onChange={(e) => setForm({ ...form, custom_subheadline: e.target.value })}
                  placeholder={aiContent?.subheadline || "Gerado por IA automaticamente"}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={form.custom_description}
                  onChange={(e) => setForm({ ...form, custom_description: e.target.value })}
                  placeholder={aiContent?.description_persuasive || "Gerado por IA automaticamente"}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Diferenciais Exclusivos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4" />
                Diferenciais Exclusivos
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Adicione diferenciais personalizados. Se vazio, os gerados por IA serão usados.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {keyFeatures.map((feature, index) => (
                <div key={index} className="flex gap-2 items-start p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-2 flex-1">
                    <div className="flex gap-2">
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={feature.icon}
                        onChange={(e) => updateFeature(index, "icon", e.target.value)}
                      >
                        {ICON_OPTIONS.map(icon => (
                          <option key={icon} value={icon}>{icon}</option>
                        ))}
                      </select>
                      <Input
                        placeholder="Título do diferencial"
                        value={feature.title}
                        onChange={(e) => updateFeature(index, "title", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    <Input
                      placeholder="Descrição breve"
                      value={feature.description}
                      onChange={(e) => updateFeature(index, "description", e.target.value)}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFeature(index)} className="shrink-0 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addFeature} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar diferencial
              </Button>
            </CardContent>
          </Card>

          {/* CTAs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Botões de Ação (CTA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>CTA Principal</Label>
                <Input
                  value={form.custom_cta_primary}
                  onChange={(e) => setForm({ ...form, custom_cta_primary: e.target.value })}
                  placeholder={aiContent?.cta_primary || "Agendar visita"}
                />
              </div>
              <div>
                <Label>CTA Secundário</Label>
                <Input
                  value={form.custom_cta_secondary}
                  onChange={(e) => setForm({ ...form, custom_cta_secondary: e.target.value })}
                  placeholder={aiContent?.cta_secondary || "Falar no WhatsApp"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Mapa / Localização */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Localização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Ocultar endereço exato</Label>
                  <p className="text-xs text-muted-foreground">Mostra apenas o bairro e um raio aproximado no mapa</p>
                </div>
                <Switch
                  checked={form.hide_exact_address}
                  onCheckedChange={(v) => setForm({ ...form, hide_exact_address: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Mostrar pontos de interesse próximos</Label>
                  <p className="text-xs text-muted-foreground">Escolas, mercados, hospitais num raio de 500m</p>
                </div>
                <Switch
                  checked={form.show_nearby_pois}
                  onCheckedChange={(v) => setForm({ ...form, show_nearby_pois: v })}
                />
              </div>
              {form.hide_exact_address && (
                <div>
                  <Label>Raio do mapa (metros)</Label>
                  <Input
                    type="number"
                    value={form.map_radius_meters}
                    onChange={(e) => setForm({ ...form, map_radius_meters: parseInt(e.target.value) || 100 })}
                    min={50}
                    max={500}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mobile Preview */}
          {mobilePreview && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Preview Mobile
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div className="border-2 border-muted rounded-2xl overflow-hidden shadow-lg" style={{ width: 375, height: 667 }}>
                  <iframe
                    src={buildPublicUrl(propertyId, propertyCode).replace(window.location.origin, '')}
                    className="w-full h-full border-0"
                    title="Preview mobile"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="h-4 w-4 mr-2" />
                Desktop
              </Button>
              <Button variant="outline" onClick={() => setMobilePreview(!mobilePreview)}>
                <Smartphone className="h-4 w-4 mr-2" />
                {mobilePreview ? "Ocultar mobile" : "Mobile"}
              </Button>
              {autoSaveStatus === "saving" && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                </span>
              )}
              {autoSaveStatus === "saved" && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Save className="h-3 w-3" /> Salvo
                </span>
              )}
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
