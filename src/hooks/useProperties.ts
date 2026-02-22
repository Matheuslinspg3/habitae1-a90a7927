import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDemo } from '@/contexts/DemoContext';
import type { Database, Json, Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Property = Tables<'properties'>;
export type PropertyType = Tables<'property_types'>;
export type PropertyImage = Tables<'property_images'>;

export interface PropertyWithDetails extends Property {
  property_type: PropertyType | null;
  images: PropertyImage[];
}

export type PropertyFormData = Omit<TablesInsert<'properties'>, 'id' | 'created_at' | 'updated_at' | 'organization_id' | 'created_by'>;

interface ImageData {
  url: string;
  path?: string;
  is_cover?: boolean;
  display_order?: number;
  phash?: string;
  r2_key_full?: string;
  r2_key_thumb?: string;
  storage_provider?: string;
}

interface OwnerData {
  name?: string;
  phone?: string;
  email?: string;
  document?: string;
  notes?: string;
}

export function useProperties() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const queryClient = useQueryClient();

  // Demo mode: return mock data
  if (isDemoMode) {
    const demoProperties = demoData.properties as unknown as PropertyWithDetails[];
    
    const demoMutate = () => {
      toast({
        title: 'Modo Demonstração',
        description: 'Os dados não serão salvos neste modo.',
      });
    };

    return {
      properties: demoProperties,
      isLoading: false,
      error: null,
      refetch: () => Promise.resolve({ data: demoProperties, error: null }),
      createProperty: async () => { demoMutate(); return demoProperties[0]; },
      updateProperty: async () => { demoMutate(); return demoProperties[0]; },
      deleteProperty: async () => { demoMutate(); },
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    };
  }

  const { data: properties = [], isLoading, error, refetch } = useQuery({
    queryKey: ['properties', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) {
        return [];
      }
      
      // Fetch all properties using pagination (Supabase default limit is 1000)
      const allData: PropertyWithDetails[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            *,
            property_type:property_types(*),
            images:property_images(*)
          `)
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        
        allData.push(...(data as PropertyWithDetails[]));
        
        if (!data || data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      return allData;
    },
    enabled: !!user && !!profile?.organization_id,
  });

  const createProperty = useMutation({
    mutationFn: async ({ propertyData, images, ownerData }: { propertyData: PropertyFormData; images: ImageData[]; ownerData?: OwnerData }) => {
      if (!profile?.organization_id) {
        throw new Error('Usuário não está vinculado a uma organização');
      }

      const { data, error } = await supabase
        .from('properties')
        .insert({
          ...propertyData,
          organization_id: profile.organization_id,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Salvar imagens
      if (images.length > 0) {
        const imagesToInsert = images.map((img, index) => ({
          property_id: data.id,
          url: img.url,
          is_cover: img.is_cover || index === 0,
          display_order: img.display_order ?? index,
          ...(img.phash ? { phash: img.phash } : {}),
          ...(img.r2_key_full ? { r2_key_full: img.r2_key_full } : {}),
          ...(img.r2_key_thumb ? { r2_key_thumb: img.r2_key_thumb } : {}),
          ...(img.storage_provider ? { storage_provider: img.storage_provider } : {}),
        }));

        const { error: imagesError } = await supabase
          .from('property_images')
          .insert(imagesToInsert);

        if (imagesError) {
          console.error('Erro ao salvar imagens:', imagesError);
        }
      }

      // Salvar proprietário se fornecido (com deduplicação)
      if (ownerData?.name && ownerData?.phone) {
        try {
          // Import dynamically to avoid circular deps
          const normPhone = ownerData.phone.replace(/[^0-9]/g, '');
          
          // Find or create centralized owner
          let ownerId: string | null = null;
          
          // Check if owner with this phone already exists
          const { data: existingOwner } = await supabase
            .from('owners')
            .select('id')
            .eq('organization_id', profile.organization_id)
            .eq('phone', normPhone)
            .maybeSingle();

          if (existingOwner) {
            ownerId = existingOwner.id;
            
            // Update alias occurrence or create new alias
            const { data: existingAlias } = await supabase
              .from('owner_aliases')
              .select('id, occurrence_count')
              .eq('owner_id', ownerId)
              .eq('name', ownerData.name)
              .maybeSingle();

            if (existingAlias) {
              await supabase
                .from('owner_aliases')
                .update({ occurrence_count: (existingAlias.occurrence_count || 0) + 1 })
                .eq('id', existingAlias.id);
            } else {
              await supabase.from('owner_aliases').insert({
                owner_id: ownerId,
                name: ownerData.name,
                occurrence_count: 1,
              });
            }

            // Recalculate primary_name
            const { data: topAlias } = await supabase
              .from('owner_aliases')
              .select('name')
              .eq('owner_id', ownerId)
              .order('occurrence_count', { ascending: false })
              .limit(1);

            if (topAlias?.[0]) {
              await supabase.from('owners').update({ primary_name: topAlias[0].name }).eq('id', ownerId);
            }
          } else {
            // Create new owner
            const { data: newOwner } = await supabase
              .from('owners')
              .insert({
                organization_id: profile.organization_id,
                primary_name: ownerData.name,
                phone: normPhone,
                email: ownerData.email || null,
                document: ownerData.document || null,
                notes: ownerData.notes || null,
              })
              .select('id')
              .single();

            if (newOwner) {
              ownerId = newOwner.id;
              await supabase.from('owner_aliases').insert({
                owner_id: newOwner.id,
                name: ownerData.name,
                occurrence_count: 1,
              });
            }
          }

          // Insert property_owner with owner_id link
          await supabase.from('property_owners').insert({
            property_id: data.id,
            organization_id: profile.organization_id,
            name: ownerData.name,
            phone: ownerData.phone || null,
            email: ownerData.email || null,
            document: ownerData.document || null,
            notes: ownerData.notes || null,
            is_primary: true,
            owner_id: ownerId,
          });
        } catch (ownerError) {
          console.error('Erro ao salvar proprietário:', ownerError);
        }
      } else if (ownerData?.name) {
        // Owner without phone - just create property_owner without centralized owner
        const { error: ownerError } = await supabase
          .from('property_owners')
          .insert({
            property_id: data.id,
            organization_id: profile.organization_id,
            name: ownerData.name,
            phone: ownerData.phone || null,
            email: ownerData.email || null,
            document: ownerData.document || null,
            notes: ownerData.notes || null,
            is_primary: true,
          });

        if (ownerError) {
          console.error('Erro ao salvar proprietário:', ownerError);
        }
      }

      // Buscar com relacionamentos
      const { data: fullData } = await supabase
        .from('properties')
        .select(`
          *,
          property_type:property_types(*),
          images:property_images(*)
        `)
        .eq('id', data.id)
        .single();

      return fullData as PropertyWithDetails;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      toast({
        title: 'Imóvel cadastrado',
        description: 'O imóvel foi cadastrado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao cadastrar imóvel',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateProperty = useMutation({
    mutationFn: async ({ id, data, images }: { id: string; data: TablesUpdate<'properties'>; images?: ImageData[] }) => {
      const { data: updated, error } = await supabase
        .from('properties')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Atualizar imagens se fornecidas
      if (images !== undefined) {
        // Deletar imagens existentes
        await supabase
          .from('property_images')
          .delete()
          .eq('property_id', id);

        // Inserir novas imagens
        if (images.length > 0) {
        const imagesToInsert = images.map((img, index) => ({
            property_id: id,
            url: img.url,
            is_cover: img.is_cover || index === 0,
            display_order: img.display_order ?? index,
            ...(img.phash ? { phash: img.phash } : {}),
            ...(img.r2_key_full ? { r2_key_full: img.r2_key_full } : {}),
            ...(img.r2_key_thumb ? { r2_key_thumb: img.r2_key_thumb } : {}),
            ...(img.storage_provider ? { storage_provider: img.storage_provider } : {}),
          }));

          await supabase
            .from('property_images')
            .insert(imagesToInsert);
        }
      }

      // Buscar com relacionamentos
      const { data: fullData } = await supabase
        .from('properties')
        .select(`
          *,
          property_type:property_types(*),
          images:property_images(*)
        `)
        .eq('id', id)
        .single();

      return fullData as PropertyWithDetails;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      toast({
        title: 'Imóvel atualizado',
        description: 'O imóvel foi atualizado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar imóvel',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteProperty = useMutation({
    mutationFn: async (id: string) => {
      // Deletar todos os registros dependentes antes de excluir o imóvel
      await Promise.all([
        supabase.from('property_images').delete().eq('property_id', id),
        supabase.from('property_media').delete().eq('property_id', id),
        supabase.from('property_owners').delete().eq('property_id', id),
        supabase.from('property_visibility').delete().eq('property_id', id),
        supabase.from('property_partnerships').delete().eq('property_id', id),
        supabase.from('property_landing_content').delete().eq('property_id', id),
        supabase.from('import_run_items').delete().eq('property_id', id),
        supabase.from('marketplace_contact_access').delete().eq('marketplace_property_id', id),
        supabase.from('marketplace_properties').delete().eq('id', id),
      ]);

      // Limpar referências em leads, contracts e appointments (setar null ao invés de deletar)
      await Promise.all([
        supabase.from('leads').update({ property_id: null }).eq('property_id', id),
        supabase.from('contracts').update({ property_id: null }).eq('property_id', id),
        supabase.from('appointments').update({ property_id: null }).eq('property_id', id),
      ]);

      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      toast({
        title: 'Imóvel removido',
        description: 'O imóvel foi removido com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover imóvel',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk delete properties
  const bulkDeleteProperties = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!profile?.organization_id) {
        throw new Error('Usuário não está vinculado a uma organização');
      }

      if (!ids?.length) {
        throw new Error('Selecione ao menos 1 imóvel para continuar.');
      }

      type LogBulkOperationArgs = Database['public']['Functions']['log_bulk_operation']['Args'];
      type LogBulkOperationEntityIds = LogBulkOperationArgs['p_entity_ids'];

      // Registrar operação em massa (preferível por lidar melhor com permissões)
      try {
        const logArgs: LogBulkOperationArgs = {
          p_org_id: profile.organization_id,
          p_action: 'bulk_delete',
          p_entity_type: 'properties',
          p_entity_ids: ids as unknown as LogBulkOperationEntityIds,
          p_details: { count: ids.length } as Json,
        };

        await supabase.rpc('log_bulk_operation', logArgs);
      } catch (logError) {
        console.warn('Failed to log bulk operation:', logError);
      }

      // Process in chunks of 20 to avoid URL length limits
      const CHUNK_SIZE = 20;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        
        // Deletar todos os registros dependentes (ignorar erros de tabelas sem dados)
        const depResults = await Promise.allSettled([
          supabase.from('property_images').delete().in('property_id', chunk),
          supabase.from('property_media').delete().in('property_id', chunk),
          supabase.from('property_owners').delete().in('property_id', chunk),
          supabase.from('property_visibility').delete().in('property_id', chunk),
          supabase.from('property_partnerships').delete().in('property_id', chunk),
          supabase.from('property_landing_content').delete().in('property_id', chunk),
          supabase.from('import_run_items').delete().in('property_id', chunk),
          supabase.from('marketplace_contact_access').delete().in('marketplace_property_id', chunk),
          supabase.from('marketplace_properties').delete().in('id', chunk),
        ]);
        
        // Log any dependency deletion failures but don't block
        depResults.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.warn(`Dependency cleanup ${i} failed:`, r.reason);
          } else if (r.value?.error) {
            console.warn(`Dependency cleanup ${i} error:`, r.value.error.message);
          }
        });

        // Limpar referências (setar null) - also use allSettled
        const refResults = await Promise.allSettled([
          supabase.from('leads').update({ property_id: null }).in('property_id', chunk),
          supabase.from('contracts').update({ property_id: null }).in('property_id', chunk),
          supabase.from('appointments').update({ property_id: null }).in('property_id', chunk),
        ]);
        
        refResults.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.warn(`Reference cleanup ${i} failed:`, r.reason);
          } else if (r.value?.error) {
            console.warn(`Reference cleanup ${i} error:`, r.value.error.message);
          }
        });

        // Deletar os imóveis
        const { error } = await supabase
          .from('properties')
          .delete()
          .in('id', chunk);

        if (error) throw error;
      }
      
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      toast({
        title: 'Imóveis removidos',
        description: `${count} imóvel(is) removido(s) com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover imóveis',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk inactivate properties (processes in chunks to avoid URL length limits)
  const bulkInactivateProperties = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!profile?.organization_id) {
        throw new Error('Usuário não está vinculado a uma organização');
      }

      if (!ids?.length) {
        throw new Error('Selecione ao menos 1 imóvel para continuar.');
      }

      type LogBulkOperationArgs = Database['public']['Functions']['log_bulk_operation']['Args'];
      type LogBulkOperationEntityIds = LogBulkOperationArgs['p_entity_ids'];

      // Registrar operação em massa
      try {
        const logArgs: LogBulkOperationArgs = {
          p_org_id: profile.organization_id,
          p_action: 'bulk_inactivate',
          p_entity_type: 'properties',
          p_entity_ids: ids as unknown as LogBulkOperationEntityIds,
          p_details: { count: ids.length } as Json,
        };
        await supabase.rpc('log_bulk_operation', logArgs);
      } catch (logError) {
        console.warn('Failed to log bulk operation:', logError);
      }

      // Process in chunks of 20 to avoid URL length limits
      const CHUNK_SIZE = 20;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        
        const { error } = await supabase
          .from('properties')
          .update({ status: 'inativo' })
          .in('id', chunk);

        if (error) throw error;
      }
      
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties-advanced-search'] });
      toast({
        title: 'Imóveis inativados',
        description: `${count} imóvel(is) inativado(s) com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao inativar imóveis',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Publish property to marketplace
  const publishToMarketplace = useMutation({
    mutationFn: async (propertyId: string) => {
      if (!profile?.organization_id) {
        throw new Error('Usuário não está vinculado a uma organização');
      }

      toast({
        title: '📤 Publicando no Marketplace...',
        description: 'Processando em segundo plano.',
      });

      const { data: prop, error: propError } = await supabase
        .from('properties')
        .select(`*, property_type:property_types(*), images:property_images(*)`)
        .eq('id', propertyId)
        .single();

      if (propError || !prop) throw new Error('Imóvel não encontrado');

      // Fetch owner data if available
      const { data: ownerData } = await supabase
        .from('property_owners')
        .select('name, phone, email')
        .eq('property_id', propertyId)
        .eq('is_primary', true)
        .maybeSingle();

      // Upsert to marketplace_properties
      const coverImage = prop.images?.find(img => img.is_cover)?.url || prop.images?.[0]?.url || null;
      const imageUrls = prop.images?.map(img => img.url) || [];

      const { error } = await supabase
        .from('marketplace_properties')
        .upsert({
          id: propertyId,
          title: prop.title,
          description: prop.description,
          property_type_id: prop.property_type_id,
          transaction_type: prop.transaction_type,
          sale_price: prop.sale_price,
          rent_price: prop.rent_price,
          address_street: prop.address_street,
          address_number: prop.address_number,
          address_complement: prop.address_complement,
          address_neighborhood: prop.address_neighborhood,
          address_city: prop.address_city,
          address_state: prop.address_state,
          address_zipcode: prop.address_zipcode,
          bedrooms: prop.bedrooms || 0,
          suites: prop.suites || 0,
          bathrooms: prop.bathrooms || 0,
          parking_spots: prop.parking_spots || 0,
          area_total: prop.area_total,
          area_built: prop.area_built,
          amenities: prop.amenities,
          images: imageUrls,
          owner_name: ownerData?.name || null,
          owner_phone: ownerData?.phone || null,
          owner_email: ownerData?.email || null,
          status: prop.status,
          external_code: (prop as any).property_code || null,
          commission_percentage: (prop as any).commission_value || null,
          is_featured: false,
          organization_id: profile.organization_id,
        }, { onConflict: 'id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-published-ids'] });
      toast({
        title: '✅ Publicado no Marketplace',
        description: 'O imóvel foi publicado no marketplace com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao publicar no marketplace',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk publish properties to marketplace
  const bulkPublishToMarketplace = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!profile?.organization_id) {
        throw new Error('Usuário não está vinculado a uma organização');
      }
      if (!ids?.length) {
        throw new Error('Selecione ao menos 1 imóvel para continuar.');
      }

      toast({
        title: '📤 Publicando no Marketplace...',
        description: `Publicando ${ids.length} imóvel(is) em segundo plano.`,
      });

      // Batch fetch all properties and owners in parallel
      const CHUNK = 50;
      const allProps: any[] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { data } = await supabase
          .from('properties')
          .select(`*, property_type:property_types(*), images:property_images(*)`)
          .in('id', chunk);
        if (data) allProps.push(...data);
      }

      // Batch fetch owners
      const { data: allOwners } = await supabase
        .from('property_owners')
        .select('property_id, name, phone, email')
        .in('property_id', ids)
        .eq('is_primary', true);
      const ownerMap = new Map((allOwners || []).map(o => [o.property_id, o]));

      // Build upsert payload
      const rows = allProps.map(prop => {
        const owner = ownerMap.get(prop.id);
        const imageUrls = (prop.images as any[])?.map((img: any) => img.url) || [];
        return {
          id: prop.id,
          title: prop.title,
          description: prop.description,
          property_type_id: prop.property_type_id,
          transaction_type: prop.transaction_type,
          sale_price: prop.sale_price,
          rent_price: prop.rent_price,
          address_street: prop.address_street,
          address_number: prop.address_number,
          address_complement: prop.address_complement,
          address_neighborhood: prop.address_neighborhood,
          address_city: prop.address_city,
          address_state: prop.address_state,
          address_zipcode: prop.address_zipcode,
          bedrooms: prop.bedrooms || 0,
          suites: prop.suites || 0,
          bathrooms: prop.bathrooms || 0,
          parking_spots: prop.parking_spots || 0,
          area_total: prop.area_total,
          area_built: prop.area_built,
          amenities: prop.amenities,
          images: imageUrls,
          owner_name: owner?.name || null,
          owner_phone: owner?.phone || null,
          owner_email: owner?.email || null,
          status: prop.status,
          external_code: prop.property_code || null,
          commission_percentage: prop.commission_value || null,
          is_featured: false,
          organization_id: profile.organization_id,
        };
      });

      // Upsert in chunks
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from('marketplace_properties')
          .upsert(chunk, { onConflict: 'id' });
        if (error) throw error;
      }

      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-published-ids'] });
      toast({
        title: '✅ Publicados no Marketplace',
        description: `${count} imóvel(is) publicado(s) com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao publicar no marketplace',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk hide properties from marketplace
  const bulkHideFromMarketplace = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids?.length) {
        throw new Error('Selecione ao menos 1 imóvel para continuar.');
      }

      const CHUNK_SIZE = 20;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from('marketplace_properties')
          .delete()
          .in('id', chunk);
        if (error) throw error;
      }

      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-published-ids'] });
      toast({
        title: 'Removidos do Marketplace',
        description: `${count} imóvel(is) removido(s) do marketplace.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover do marketplace',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    properties,
    isLoading,
    error,
    refetch,
    createProperty: (propertyData: PropertyFormData, images: ImageData[] = [], ownerData?: OwnerData) => 
      createProperty.mutateAsync({ propertyData, images, ownerData }),
    updateProperty: (id: string, data: TablesUpdate<'properties'>, images?: ImageData[]) =>
      updateProperty.mutateAsync({ id, data, images }),
    deleteProperty: deleteProperty.mutateAsync,
    bulkDeleteProperties: bulkDeleteProperties.mutateAsync,
    bulkInactivateProperties: bulkInactivateProperties.mutateAsync,
    publishToMarketplace: publishToMarketplace.mutateAsync,
    bulkPublishToMarketplace: bulkPublishToMarketplace.mutateAsync,
    bulkHideFromMarketplace: bulkHideFromMarketplace.mutateAsync,
    isCreating: createProperty.isPending,
    isUpdating: updateProperty.isPending,
    isDeleting: deleteProperty.isPending,
    isBulkDeleting: bulkDeleteProperties.isPending,
    isBulkInactivating: bulkInactivateProperties.isPending,
    isPublishing: publishToMarketplace.isPending,
    isBulkPublishing: bulkPublishToMarketplace.isPending,
    isBulkHiding: bulkHideFromMarketplace.isPending,
  };
}
