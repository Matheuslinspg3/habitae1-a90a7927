import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trackFormError, trackLeadCreated } from '@/components/ClarityProvider';
import { useTrackAction } from '@/hooks/useAnalytics';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Flame, Snowflake, Sun, Zap, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { LeadInteractionTimeline } from './LeadInteractionTimeline';
import { LEAD_SOURCES, TEMPERATURES, type Lead, type CreateLeadInput } from '@/hooks/useLeads';
import type { LeadStage } from '@/hooks/useLeadStages';
import { type Broker } from '@/hooks/useBrokers';
import { type PropertyType } from '@/hooks/usePropertyTypes';
import { usePropertyLocations } from '@/hooks/usePropertyLocations';

const formSchema = z.object({
  // Dados básicos
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().optional(),
  email: z.string().optional(),
  source: z.string().optional(),
  custom_source: z.string().optional(),
  broker_id: z.string().optional(),
  lead_stage_id: z.string().min(1, 'Estágio é obrigatório'),
  temperature: z.string().optional(),
  notes: z.string().optional(),
  
  // Critérios de interesse do imóvel
  interested_property_type_id: z.string().optional(),
  interested_property_type_ids: z.array(z.string()).optional(),
  property_id: z.string().optional(),
  estimated_value: z.coerce.number().optional(),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  parking: z.coerce.number().optional(),
  area: z.coerce.number().optional(),
  preferred_neighborhoods: z.array(z.string()).optional(),
  preferred_cities: z.array(z.string()).optional(),
  transaction_interest: z.enum(['venda', 'aluguel', 'ambos'], { required_error: 'Interesse é obrigatório' }),
  additional_requirements: z.string().optional(),
}).refine((data) => {
  // At least phone or email must be provided
  return (data.phone && data.phone.trim().length > 0) || (data.email && data.email.trim().length > 0);
}, {
  message: 'Informe pelo menos um telefone ou e-mail',
  path: ['phone'],
}).refine((data) => {
  // If email is provided, it must be valid
  if (data.email && data.email.trim().length > 0) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  }
  return true;
}, {
  message: 'E-mail inválido',
  path: ['email'],
});

type FormData = z.infer<typeof formSchema>;

// Fields belonging to each tab for error detection
const BASIC_FIELDS = ['name', 'phone', 'email', 'source', 'custom_source', 'broker_id', 'lead_stage_id', 'temperature', 'notes'];
const INTEREST_FIELDS = ['transaction_interest', 'interested_property_type_id', 'interested_property_type_ids', 'property_id', 'estimated_value', 'bedrooms', 'bathrooms', 'parking', 'area', 'preferred_neighborhoods', 'preferred_cities', 'additional_requirements'];

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  leadStages: LeadStage[];
  brokers: Broker[];
  properties: { id: string; title: string }[];
  propertyTypes?: PropertyType[];
  onSubmit: (data: CreateLeadInput) => Promise<void>;
  isLoading?: boolean;
}

export function LeadForm({
  open,
  onOpenChange,
  lead,
  leadStages,
  brokers,
  properties,
  propertyTypes = [],
  onSubmit,
  isLoading,
}: LeadFormProps) {
  const { neighborhoods: availableNeighborhoods, cities: availableCities } = usePropertyLocations();
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [showNeighborhoodDropdown, setShowNeighborhoodDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const isEditing = !!lead;
  const [showCustomSource, setShowCustomSource] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      source: '',
      custom_source: '',
      broker_id: '',
      lead_stage_id: leadStages[0]?.id || '',
      temperature: '',
      notes: '',
      interested_property_type_id: '',
      interested_property_type_ids: [],
      property_id: '',
      estimated_value: undefined,
      bedrooms: undefined,
      bathrooms: undefined,
      parking: undefined,
      area: undefined,
      preferred_neighborhoods: [],
      preferred_cities: [],
      transaction_interest: undefined,
      additional_requirements: '',
    },
  });

  const errors = form.formState.errors;
  const hasBasicErrors = BASIC_FIELDS.some((f) => f in errors);
  const hasInterestErrors = INTEREST_FIELDS.some((f) => f in errors);

  useEffect(() => {
    if (lead) {
      const isCustomSource = lead.source && !LEAD_SOURCES.some(s => s.id === lead.source);
      setShowCustomSource(isCustomSource || lead.source === 'outro');
      
      form.reset({
        name: lead.name,
        phone: lead.phone || '',
        email: lead.email || '',
        source: isCustomSource ? 'outro' : (lead.source || ''),
        custom_source: isCustomSource ? lead.source || '' : '',
        broker_id: lead.broker_id || '',
        lead_stage_id: lead.lead_stage_id || leadStages[0]?.id || '',
        temperature: lead.temperature || '',
        notes: lead.notes || '',
        interested_property_type_id: lead.interested_property_type_id || '',
        interested_property_type_ids: (lead as any).interested_property_type_ids || 
          (lead.interested_property_type_id ? [lead.interested_property_type_id] : []),
        property_id: lead.property_id || '',
        estimated_value: lead.estimated_value || undefined,
        bedrooms: (lead as any).min_bedrooms || undefined,
        bathrooms: (lead as any).min_bathrooms || undefined,
        parking: (lead as any).min_parking || undefined,
        area: (lead as any).min_area || undefined,
        preferred_neighborhoods: (lead as any).preferred_neighborhoods || [],
        preferred_cities: (lead as any).preferred_cities || [],
        transaction_interest: (lead as any).transaction_interest || undefined,
        additional_requirements: (lead as any).additional_requirements || '',
      });
    } else {
      setShowCustomSource(false);
      form.reset({
        name: '',
        phone: '',
        email: '',
        source: '',
        custom_source: '',
        broker_id: '',
        lead_stage_id: leadStages[0]?.id || '',
        temperature: '',
        notes: '',
        interested_property_type_id: '',
        interested_property_type_ids: [],
        property_id: '',
        estimated_value: undefined,
        bedrooms: undefined,
        bathrooms: undefined,
        parking: undefined,
        area: undefined,
        preferred_neighborhoods: [],
        preferred_cities: [],
        transaction_interest: undefined,
        additional_requirements: '',
      });
    }
    setActiveTab('basic');
  }, [lead, form, open]);

  const handleSourceChange = (value: string) => {
    form.setValue('source', value);
    setShowCustomSource(value === 'outro');
    if (value !== 'outro') {
      form.setValue('custom_source', '');
    }
  };

  const scrollToFirstError = useCallback((errs: typeof errors) => {
    // Determine which tab has the first error and switch to it
    const basicHasError = BASIC_FIELDS.some((f) => f in errs);
    const interestHasError = INTEREST_FIELDS.some((f) => f in errs);

    const targetTab = basicHasError ? 'basic' : interestHasError ? 'interest' : activeTab;

    if (targetTab !== activeTab) {
      setActiveTab(targetTab);
      // Wait for tab to render then scroll
      setTimeout(() => {
        const firstErrorEl = formRef.current?.querySelector('[aria-invalid="true"]');
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (firstErrorEl as HTMLElement).focus?.();
        }
      }, 150);
    } else {
      const firstErrorEl = formRef.current?.querySelector('[aria-invalid="true"]');
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (firstErrorEl as HTMLElement).focus?.();
      }
    }

    // Count errors
    const errorCount = Object.keys(errs).length;
    const errorMessages: string[] = [];
    if (basicHasError) errorMessages.push('Dados do Lead');
    if (interestHasError) errorMessages.push('Interesse em Imóvel');

    trackFormError('lead_form');

    toast.error(`${errorCount} campo(s) obrigatório(s) pendente(s)`, {
      description: errorMessages.length > 0
        ? `Verifique a(s) aba(s): ${errorMessages.join(', ')}`
        : 'Preencha os campos destacados em vermelho',
    });
  }, [activeTab]);

  const handleSubmit = async (data: FormData) => {
    const finalSource = data.source === 'outro' && data.custom_source 
      ? data.custom_source 
      : data.source;

    const cleanData: CreateLeadInput = {
      name: data.name,
      phone: data.phone || undefined,
      email: data.email || undefined,
      source: finalSource || undefined,
      interested_property_type_id: data.interested_property_type_ids?.[0] || data.interested_property_type_id || undefined,
      interested_property_type_ids: data.interested_property_type_ids?.length ? data.interested_property_type_ids : undefined,
      property_id: data.property_id || undefined,
      broker_id: data.broker_id || undefined,
      estimated_value: data.estimated_value || undefined,
      lead_stage_id: data.lead_stage_id || undefined,
      temperature: data.temperature || undefined,
      notes: data.notes || undefined,
      transaction_interest: data.transaction_interest || undefined,
      min_bedrooms: data.bedrooms || undefined,
      min_bathrooms: data.bathrooms || undefined,
      min_parking: data.parking || undefined,
      min_area: data.area || undefined,
      preferred_neighborhoods: data.preferred_neighborhoods?.length ? data.preferred_neighborhoods : undefined,
      preferred_cities: data.preferred_cities?.length ? data.preferred_cities : undefined,
      additional_requirements: data.additional_requirements || undefined,
    };
    await onSubmit(cleanData);
    if (!isEditing) trackLeadCreated();
    onOpenChange(false);
  };

  const phoneValue = form.watch('phone');
  const emailValue = form.watch('email');
  const hasPhone = phoneValue && phoneValue.trim().length > 0;
  const hasEmail = emailValue && emailValue.trim().length > 0;

  const trackAction = useTrackAction();
  const formStartRef = useRef(Date.now());

  // Reset form timer when dialog opens
  useEffect(() => {
    if (open) formStartRef.current = Date.now();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto mx-2 sm:mx-0 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            ref={formRef}
            onSubmit={form.handleSubmit(handleSubmit, scrollToFirstError)}
            className="space-y-4"
          >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
               <TabsList className={`grid w-full ${isEditing ? 'grid-cols-3' : 'grid-cols-2'} min-h-[44px]`}>
                <TabsTrigger value="basic" className="flex items-center gap-1.5 min-h-[44px] text-xs sm:text-sm">
                  Dados do Lead
                  {hasBasicErrors && (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="interest" className="flex items-center gap-1.5 min-h-[44px] text-xs sm:text-sm">
                  Interesse
                  {hasInterestErrors && (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                </TabsTrigger>
                {isEditing && <TabsTrigger value="interactions" className="min-h-[44px] text-xs sm:text-sm">Interações</TabsTrigger>}
              </TabsList>

              {/* Aba Dados Básicos */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do lead" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Telefone {!hasEmail ? '*' : ''}
                          {hasEmail && (
                            <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="(00) 00000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          E-mail {!hasPhone ? '*' : ''}
                          {hasPhone && (
                            <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@exemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {!hasPhone && !hasEmail && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Informe pelo menos um telefone ou e-mail para contato.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origem</FormLabel>
                        <Select onValueChange={handleSourceChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LEAD_SOURCES.map((source) => (
                              <SelectItem key={source.id} value={source.id}>
                                {source.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {showCustomSource && (
                  <FormField
                    control={form.control}
                    name="custom_source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origem Personalizada</FormLabel>
                        <FormControl>
                          <Input placeholder="Digite a origem..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="broker_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Corretor Responsável</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {brokers.map((broker) => (
                            <SelectItem key={broker.user_id} value={broker.user_id}>
                              {broker.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lead_stage_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estágio *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leadStages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                {stage.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperatura / Prioridade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a temperatura" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="frio">
                            <div className="flex items-center gap-2">
                              <Snowflake className="h-3.5 w-3.5 text-blue-500" />
                              <span>Frio</span>
                              <span className="text-xs text-muted-foreground">— sem urgência, acompanhamento futuro</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="morno">
                            <div className="flex items-center gap-2">
                              <Sun className="h-3.5 w-3.5 text-amber-500" />
                              <span>Morno</span>
                              <span className="text-xs text-muted-foreground">— interesse moderado</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="quente">
                            <div className="flex items-center gap-2">
                              <Flame className="h-3.5 w-3.5 text-orange-500" />
                              <span>Quente</span>
                              <span className="text-xs text-muted-foreground">— pronto para fechar</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="prioridade">
                            <div className="flex items-center gap-2">
                              <Zap className="h-3.5 w-3.5 text-red-500" />
                              <span>Prioridade Máxima</span>
                              <span className="text-xs text-muted-foreground">— ação imediata</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Observações sobre o lead..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Aba Interesse em Imóvel */}
              <TabsContent value="interest" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Informe os critérios do imóvel que o cliente procura. Essas informações ajudarão a filtrar e apresentar imóveis compatíveis.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="transaction_interest"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interesse *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Comprar ou Alugar?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="venda">Comprar</SelectItem>
                            <SelectItem value="aluguel">Alugar</SelectItem>
                            <SelectItem value="ambos">Ambos</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="interested_property_type_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipos de Imóvel</FormLabel>
                        <div className="grid grid-cols-2 gap-2 rounded-md border p-3 bg-background">
                          {propertyTypes.map((type) => {
                            const isChecked = (field.value || []).includes(type.id);
                            return (
                              <div key={type.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`ptype-${type.id}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, type.id]);
                                    } else {
                                      field.onChange(current.filter((id: string) => id !== type.id));
                                    }
                                  }}
                                />
                                <Label htmlFor={`ptype-${type.id}`} className="text-sm font-normal cursor-pointer">
                                  {type.name}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="estimated_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orçamento Máximo</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="R$ 0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quartos</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bathrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banheiros</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="parking"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vagas</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="area"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Área (m²)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Bairros de Preferência - Multi-select */}
                <FormField
                  control={form.control}
                  name="preferred_neighborhoods"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairros de Preferência</FormLabel>
                      <div className="space-y-2">
                        {(field.value || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {(field.value || []).map((n) => (
                              <Badge key={n} variant="secondary" className="gap-1 text-xs">
                                {n}
                                <button
                                  type="button"
                                  onClick={() => field.onChange((field.value || []).filter((v: string) => v !== n))}
                                  className="ml-0.5 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="relative">
                          <Input
                            placeholder="Buscar bairro..."
                            value={neighborhoodSearch}
                            onChange={(e) => {
                              setNeighborhoodSearch(e.target.value);
                              setShowNeighborhoodDropdown(true);
                            }}
                            onFocus={() => setShowNeighborhoodDropdown(true)}
                            onBlur={() => setTimeout(() => setShowNeighborhoodDropdown(false), 200)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && neighborhoodSearch.trim()) {
                                e.preventDefault();
                                const val = neighborhoodSearch.trim();
                                if (!(field.value || []).includes(val)) {
                                  field.onChange([...(field.value || []), val]);
                                }
                                setNeighborhoodSearch('');
                                setShowNeighborhoodDropdown(false);
                              }
                            }}
                          />
                          {showNeighborhoodDropdown && (
                            <div className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                              {availableNeighborhoods
                                .filter(n => 
                                  n.toLowerCase().includes(neighborhoodSearch.toLowerCase()) &&
                                  !(field.value || []).includes(n)
                                )
                                .slice(0, 20)
                                .map((n) => (
                                  <button
                                    key={n}
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      field.onChange([...(field.value || []), n]);
                                      setNeighborhoodSearch('');
                                      setShowNeighborhoodDropdown(false);
                                    }}
                                  >
                                    {n}
                                  </button>
                                ))}
                              {neighborhoodSearch.trim() && !availableNeighborhoods.some(n => 
                                n.toLowerCase() === neighborhoodSearch.toLowerCase()
                              ) && (
                                <button
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const val = neighborhoodSearch.trim();
                                    if (!(field.value || []).includes(val)) {
                                      field.onChange([...(field.value || []), val]);
                                    }
                                    setNeighborhoodSearch('');
                                    setShowNeighborhoodDropdown(false);
                                  }}
                                >
                                  + Adicionar "{neighborhoodSearch.trim()}"
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Cidades de Preferência - Multi-select */}
                <FormField
                  control={form.control}
                  name="preferred_cities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidades de Preferência</FormLabel>
                      <div className="space-y-2">
                        {(field.value || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {(field.value || []).map((c) => (
                              <Badge key={c} variant="secondary" className="gap-1 text-xs">
                                {c}
                                <button
                                  type="button"
                                  onClick={() => field.onChange((field.value || []).filter((v: string) => v !== c))}
                                  className="ml-0.5 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="relative">
                          <Input
                            placeholder="Buscar cidade..."
                            value={citySearch}
                            onChange={(e) => {
                              setCitySearch(e.target.value);
                              setShowCityDropdown(true);
                            }}
                            onFocus={() => setShowCityDropdown(true)}
                            onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && citySearch.trim()) {
                                e.preventDefault();
                                const val = citySearch.trim();
                                if (!(field.value || []).includes(val)) {
                                  field.onChange([...(field.value || []), val]);
                                }
                                setCitySearch('');
                                setShowCityDropdown(false);
                              }
                            }}
                          />
                          {showCityDropdown && (
                            <div className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                              {availableCities
                                .filter(c => 
                                  c.toLowerCase().includes(citySearch.toLowerCase()) &&
                                  !(field.value || []).includes(c)
                                )
                                .slice(0, 20)
                                .map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      field.onChange([...(field.value || []), c]);
                                      setCitySearch('');
                                      setShowCityDropdown(false);
                                    }}
                                  >
                                    {c}
                                  </button>
                                ))}
                              {citySearch.trim() && !availableCities.some(c => 
                                c.toLowerCase() === citySearch.toLowerCase()
                              ) && (
                                <button
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const val = citySearch.trim();
                                    if (!(field.value || []).includes(val)) {
                                      field.onChange([...(field.value || []), val]);
                                    }
                                    setCitySearch('');
                                    setShowCityDropdown(false);
                                  }}
                                >
                                  + Adicionar "{citySearch.trim()}"
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="property_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Imóvel Específico de Interesse</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um imóvel (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {properties.map((property) => (
                            <SelectItem key={property.id} value={property.id}>
                              {property.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="additional_requirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requisitos Adicionais</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ex: Precisa de vaga de garagem coberta, aceita financiamento, prefere andar alto..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {isEditing && lead && (
                <TabsContent value="interactions" className="mt-4">
                  <LeadInteractionTimeline leadId={lead.id} leadName={lead.name} />
                </TabsContent>
              )}
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background pb-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-h-[44px]"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading} className="min-h-[44px]">
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar Lead'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
