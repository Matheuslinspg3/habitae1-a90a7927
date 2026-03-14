import { useState, useEffect, useCallback, useRef } from "react";
import { trackFormError, trackPropertyCreated } from "@/components/ClarityProvider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PropertyWithDetails, PropertyFormData } from "@/hooks/useProperties";
import { TAB_FIELDS } from "./form/constants";
import { BasicTab } from "./form/BasicTab";
import { ValuesTab } from "./form/ValuesTab";
import { FeaturesTab } from "./form/FeaturesTab";
import { LocationTab } from "./form/LocationTab";
import { PhotosTab } from "./form/PhotosTab";
import { DescriptionTab } from "./form/DescriptionTab";
import { OwnerSection } from "./form/OwnerSection";

// Re-export constants for backward compatibility
export { AMENITIES_OPTIONS, PAYMENT_OPTIONS } from "./form/constants";

const propertySchema = z.object({
  title: z.string().optional().nullable(),
  property_type_id: z.string().min(1, 'Tipo de imóvel é obrigatório'),
  transaction_type: z.enum(["venda", "aluguel", "ambos"] as const),
  status: z.enum(["disponivel", "reservado", "vendido", "alugado", "inativo", "com_proposta", "suspenso"] as const),
  launch_stage: z.enum(["nenhum", "em_construcao", "pronto", "futuro"] as const).optional().nullable(),
  development_name: z.string().optional().nullable(),
  property_condition: z.enum(["novo", "usado"] as const).optional().nullable(),
  captador_id: z.string().optional().nullable(),
  sale_price: z.coerce.number().nullable().optional(),
  sale_price_financed: z.coerce.number().nullable().optional(),
  rent_price: z.coerce.number().nullable().optional(),
  condominium_fee: z.coerce.number().nullable().optional(),
  iptu: z.coerce.number().nullable().optional(),
  iptu_monthly: z.coerce.number().nullable().optional(),
  inspection_fee: z.coerce.number().nullable().optional(),
  commission_type: z.enum(["valor", "percentual"] as const).optional().nullable(),
  commission_value: z.coerce.number().nullable().optional(),
  bedrooms: z.coerce.number().int().min(0, 'Informe os quartos'),
  suites: z.coerce.number().int().min(0).nullable().optional(),
  bathrooms: z.coerce.number().int().min(0, 'Informe os banheiros'),
  parking_spots: z.coerce.number().int().min(0).nullable().optional(),
  area_useful: z.coerce.number().min(0.01, 'Informe a área útil'),
  area_total: z.coerce.number().nullable().optional(),
  area_built: z.coerce.number().nullable().optional(),
  floor: z.coerce.number().int().nullable().optional(),
  beach_distance_meters: z.coerce.number().int().nullable().optional(),
  address_zipcode: z.string().optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_number: z.string().optional().nullable(),
  address_complement: z.string().optional().nullable(),
  address_neighborhood: z.string().optional().nullable(),
  address_city: z.string().optional().nullable(),
  address_state: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  youtube_url: z.string().url().optional().nullable().or(z.literal("")),
  amenities: z.array(z.string()).optional().nullable(),
  payment_options: z.array(z.string()).optional().nullable(),
  owner_name: z.string().optional().nullable().or(z.literal("")),
  owner_phone: z.string().optional().nullable(),
  owner_email: z.string().email().optional().nullable().or(z.literal("")),
  owner_document: z.string().optional().nullable(),
  owner_notes: z.string().optional().nullable(),
}).refine((data) => {
  if (data.transaction_type === "venda" && !data.sale_price) return false;
  if (data.transaction_type === "aluguel" && !data.rent_price) return false;
  if (data.transaction_type === "ambos" && !data.sale_price && !data.rent_price) return false;
  return true;
}, {
  message: "Informe pelo menos um preço para o tipo de transação selecionado",
  path: ["sale_price"],
});

type FormData = z.infer<typeof propertySchema>;

interface PropertyImage {
  id?: string;
  url: string;
  path?: string;
  is_cover?: boolean;
  display_order?: number;
}

interface OwnerData {
  name?: string;
  phone?: string;
  email?: string;
  document?: string;
  notes?: string;
}

interface PropertyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: PropertyWithDetails | null;
  onSubmit: (data: PropertyFormData, images: PropertyImage[], ownerData?: OwnerData, publishToMarketplace?: boolean) => Promise<void>;
  isSubmitting: boolean;
  prefillData?: Record<string, any> | null;
}

const DEFAULT_VALUES: FormData = {
  title: "", property_type_id: null, transaction_type: "venda", status: "disponivel",
  launch_stage: "nenhum", development_name: null, property_condition: null, captador_id: null,
  sale_price: null, sale_price_financed: null, rent_price: null, condominium_fee: null,
  iptu: null, iptu_monthly: null, inspection_fee: null, commission_type: "percentual", commission_value: null,
  bedrooms: 0, suites: 0, bathrooms: 0, parking_spots: 0,
  area_useful: 0, area_total: null, area_built: null, floor: null, beach_distance_meters: null,
  address_zipcode: "", address_street: "", address_number: "", address_complement: "",
  address_neighborhood: "", address_city: "", address_state: "",
  description: "", youtube_url: "", amenities: [], payment_options: [],
  owner_name: "", owner_phone: "", owner_email: "", owner_document: "", owner_notes: "",
};

export function PropertyForm({ open, onOpenChange, property, onSubmit, isSubmitting, prefillData }: PropertyFormProps) {
  const { propertyTypes } = usePropertyTypes();
  const { toast } = useToast();
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [activeTab, setActiveTab] = useState("basic");
  const [publishToMarketplace, setPublishToMarketplace] = useState(false);
  const formStartRef = useRef(Date.now());

  useEffect(() => {
    if (open) formStartRef.current = Date.now();
  }, [open]);

  const form = useForm<FormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Watch for conditional logic
  const propertyCondition = form.watch("property_condition");

  useEffect(() => {
    if (propertyCondition !== "novo") {
      form.setValue("launch_stage", "nenhum");
    }
  }, [propertyCondition, form]);

  // Reset form when property changes
  useEffect(() => {
    if (property) {
      const loadPropertyData = async () => {
        let ownerName = "";
        let ownerPhone = "";
        let ownerEmail = "";
        let ownerDocument = "";
        let ownerNotes = "";

        // Pre-load owner data for editing
        try {
          const { data: owner } = await supabase
            .from("property_owners")
            .select("name, phone, email, document, notes")
            .eq("property_id", property.id)
            .eq("is_primary", true)
            .maybeSingle();
          if (owner) {
            ownerName = owner.name || "";
            ownerPhone = owner.phone || "";
            ownerEmail = owner.email || "";
            ownerDocument = owner.document || "";
            ownerNotes = owner.notes || "";
          }
        } catch (e) {
          // ignore – owner fields will remain empty
        }

        form.reset({
          title: property.title, property_type_id: property.property_type_id,
          transaction_type: property.transaction_type, status: property.status,
          launch_stage: (property as any).launch_stage || "nenhum",
          development_name: (property as any).development_name || null,
          property_condition: (property as any).property_condition || null,
          captador_id: (property as any).captador_id || null,
          sale_price: property.sale_price, sale_price_financed: (property as any).sale_price_financed || null,
          rent_price: property.rent_price, condominium_fee: property.condominium_fee,
          iptu: property.iptu, iptu_monthly: (property as any).iptu_monthly || null,
          inspection_fee: (property as any).inspection_fee || null,
          commission_type: (property as any).commission_type || "percentual",
          commission_value: (property as any).commission_value || null,
          bedrooms: property.bedrooms, suites: property.suites,
          bathrooms: property.bathrooms, parking_spots: property.parking_spots,
          area_useful: (property as any).area_useful ? Number((property as any).area_useful) : null,
          area_total: property.area_total ? Number(property.area_total) : null,
          area_built: property.area_built ? Number(property.area_built) : null,
          floor: property.floor, beach_distance_meters: (property as any).beach_distance_meters || null,
          address_zipcode: property.address_zipcode || "", address_street: property.address_street || "",
          address_number: property.address_number || "", address_complement: property.address_complement || "",
          address_neighborhood: property.address_neighborhood || "",
          address_city: property.address_city || "", address_state: property.address_state || "",
          description: property.description || "", youtube_url: (property as any).youtube_url || "",
          amenities: property.amenities || [], payment_options: (property as any).payment_options || [],
          owner_name: ownerName, owner_phone: ownerPhone, owner_email: ownerEmail,
          owner_document: ownerDocument, owner_notes: ownerNotes,
        });
        setImages(property.images?.map(img => ({
          id: img.id, url: img.url, is_cover: img.is_cover || false, display_order: img.display_order || 0,
        })) || []);
      };
      loadPropertyData();
    } else if (prefillData) {
      form.reset({ ...DEFAULT_VALUES, ...prefillData });
      setImages([]);
    } else {
      form.reset(DEFAULT_VALUES);
      setImages([]);
    }
    setActiveTab("basic");
    setPublishToMarketplace(false);
  }, [property, prefillData, form, open]);

  const getTabHasErrors = (tabKey: string): boolean => {
    const fields = TAB_FIELDS[tabKey];
    if (!fields) return false;
    return fields.some((field) => !!form.formState.errors[field as keyof FormData]);
  };

  const findFirstTabWithError = (): string | null => {
    for (const tab of ["basic", "values", "features", "location", "photos", "description"]) {
      if (getTabHasErrors(tab)) return tab;
    }
    return null;
  };

  const handleSubmit = async (data: FormData) => {
    const { owner_name, owner_phone, owner_email, owner_document, owner_notes, area_useful, sale_price_financed, ...restData } = data;
    const selectedType = propertyTypes.find(t => t.id === restData.property_type_id);
    const autoTitle = [selectedType?.name, restData.address_neighborhood, restData.address_city].filter(Boolean).join(' - ') || 'Imóvel sem título';
    const propertyData = { ...restData, title: autoTitle, area_useful: area_useful as any, sale_price_financed: sale_price_financed as any };
    const ownerData: OwnerData | undefined = owner_name ? {
      name: owner_name, phone: owner_phone || undefined, email: owner_email || undefined,
      document: owner_document || undefined, notes: owner_notes || undefined,
    } : undefined;
    await onSubmit(propertyData as PropertyFormData, images, ownerData, publishToMarketplace);
    if (!property) trackPropertyCreated();
    onOpenChange(false);
  };

  const handleInvalidSubmit = () => {
    const firstErrorTab = findFirstTabWithError();
    trackFormError('property_form');
    if (firstErrorTab) {
      setActiveTab(firstErrorTab);
      toast({ title: "Campos obrigatórios", description: "Preencha os campos obrigatórios destacados em vermelho.", variant: "destructive" });
    } else if (Object.keys(form.formState.errors).length > 0) {
      toast({ title: "Erro no formulário", description: "Verifique os dados do proprietário e tente novamente.", variant: "destructive" });
    }
  };

  const TabErrorIndicator = ({ tabKey }: { tabKey: string }) => {
    if (!getTabHasErrors(tabKey)) return null;
    return <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{property ? "Editar Imóvel" : "Novo Imóvel"}</DialogTitle>
          <DialogDescription>
            {property ? "Atualize as informações do imóvel" : "Preencha os dados do novo imóvel"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
                {[
                  { key: "basic", label: "Básico" },
                  { key: "values", label: "Valores" },
                  { key: "features", label: "Características" },
                  { key: "location", label: "Localização" },
                  { key: "photos", label: "Fotos" },
                  { key: "description", label: "Descrição" },
                ].map(({ key, label }) => (
                  <TabsTrigger key={key} value={key} className="relative text-xs sm:text-sm">
                    {label}
                    <TabErrorIndicator tabKey={key} />
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="basic"><BasicTab form={form} /></TabsContent>
              <TabsContent value="values"><ValuesTab form={form} /></TabsContent>
              <TabsContent value="features"><FeaturesTab form={form} /></TabsContent>
              <TabsContent value="location"><LocationTab form={form} /></TabsContent>
              <TabsContent value="photos"><PhotosTab form={form} images={images} onImagesChange={setImages} /></TabsContent>
              <TabsContent value="description"><DescriptionTab form={form} /></TabsContent>
            </Tabs>

            <OwnerSection form={form} isEditing={!!property} />

            <DialogFooter className="flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-3 mr-auto">
                <Switch id="publish-marketplace" checked={publishToMarketplace} onCheckedChange={setPublishToMarketplace} />
                <Label htmlFor="publish-marketplace" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <Store className="h-4 w-4" />
                  Publicar no Marketplace
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {property ? "Salvar Alterações" : "Cadastrar Imóvel"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
