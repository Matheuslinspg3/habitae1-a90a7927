import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Owner = Tables<"owners">;
export type OwnerAlias = Tables<"owner_aliases">;

export interface OwnerWithDetails extends Owner {
  aliases: OwnerAlias[];
  property_count: number;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export function useOwners() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["owners", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from("owners")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("primary_name");

      if (error) throw error;

      // Fetch aliases for all owners
      const ownerIds = data.map((o) => o.id);
      const { data: aliases = [] } = await supabase
        .from("owner_aliases")
        .select("*")
        .in("owner_id", ownerIds.length > 0 ? ownerIds : ["__none__"]);

      // Fetch property counts
      const { data: propertyCounts = [] } = await supabase
        .from("property_owners")
        .select("owner_id")
        .in("owner_id", ownerIds.length > 0 ? ownerIds : ["__none__"]);

      const countMap = new Map<string, number>();
      propertyCounts?.forEach((po) => {
        if (po.owner_id) {
          countMap.set(po.owner_id, (countMap.get(po.owner_id) || 0) + 1);
        }
      });

      const aliasMap = new Map<string, OwnerAlias[]>();
      aliases?.forEach((a) => {
        const list = aliasMap.get(a.owner_id) || [];
        list.push(a);
        aliasMap.set(a.owner_id, list);
      });

      return data.map((owner) => ({
        ...owner,
        aliases: aliasMap.get(owner.id) || [],
        property_count: countMap.get(owner.id) || 0,
      })) as OwnerWithDetails[];
    },
    enabled: !!profile?.organization_id,
  });

  const createOwner = useMutation({
    mutationFn: async (ownerData: {
      name: string;
      phone: string;
      email?: string;
      document?: string;
      notes?: string;
    }) => {
      if (!profile?.organization_id) throw new Error("Sem organização");

      const normPhone = normalizePhone(ownerData.phone);
      if (!normPhone) throw new Error("Telefone é obrigatório");

      const { data, error } = await supabase
        .from("owners")
        .insert({
          organization_id: profile.organization_id,
          primary_name: ownerData.name,
          phone: normPhone,
          email: ownerData.email || null,
          document: ownerData.document || null,
          notes: ownerData.notes || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um proprietário com este telefone.");
        }
        throw error;
      }

      // Create initial alias
      await supabase.from("owner_aliases").insert({
        owner_id: data.id,
        name: ownerData.name,
        occurrence_count: 1,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      toast({ title: "Proprietário cadastrado com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao cadastrar proprietário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateOwner = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        primary_name: string;
        phone: string;
        email: string | null;
        document: string | null;
        notes: string | null;
      }>;
    }) => {
      const updateData = { ...data };
      if (updateData.phone) {
        updateData.phone = normalizePhone(updateData.phone);
      }

      const { error } = await supabase
        .from("owners")
        .update(updateData)
        .eq("id", id);

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um proprietário com este telefone.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      toast({ title: "Proprietário atualizado com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar proprietário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteOwner = useMutation({
    mutationFn: async (id: string) => {
      // Unlink property_owners first
      await supabase
        .from("property_owners")
        .update({ owner_id: null })
        .eq("owner_id", id);

      const { error } = await supabase.from("owners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      queryClient.invalidateQueries({ queryKey: ["property-owners"] });
      toast({ title: "Proprietário removido com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover proprietário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  /**
   * Find or create owner by phone. Central deduplication logic.
   * Returns the owner_id.
   */
  async function findOrCreateByPhone(
    orgId: string,
    ownerData: { name: string; phone: string; email?: string; document?: string; notes?: string }
  ): Promise<string> {
    const normPhone = normalizePhone(ownerData.phone);
    if (!normPhone) throw new Error("Telefone é obrigatório para vincular proprietário");

    // Check if owner exists
    const { data: existing } = await supabase
      .from("owners")
      .select("id")
      .eq("organization_id", orgId)
      .eq("phone", normPhone)
      .maybeSingle();

    if (existing) {
      // Update alias occurrence or create new alias
      const { data: existingAlias } = await supabase
        .from("owner_aliases")
        .select("id, occurrence_count")
        .eq("owner_id", existing.id)
        .eq("name", ownerData.name)
        .maybeSingle();

      if (existingAlias) {
        await supabase
          .from("owner_aliases")
          .update({ occurrence_count: (existingAlias.occurrence_count || 0) + 1 })
          .eq("id", existingAlias.id);
      } else {
        await supabase.from("owner_aliases").insert({
          owner_id: existing.id,
          name: ownerData.name,
          occurrence_count: 1,
        });
      }

      // Recalculate primary_name (most frequent alias)
      const { data: allAliases } = await supabase
        .from("owner_aliases")
        .select("name, occurrence_count")
        .eq("owner_id", existing.id)
        .order("occurrence_count", { ascending: false })
        .limit(1);

      if (allAliases && allAliases.length > 0) {
        await supabase
          .from("owners")
          .update({ primary_name: allAliases[0].name })
          .eq("id", existing.id);
      }

      // Update email/document if provided and currently empty
      if (ownerData.email || ownerData.document) {
        const { data: currentOwner } = await supabase
          .from("owners")
          .select("email, document")
          .eq("id", existing.id)
          .single();

        const updates: Record<string, string> = {};
        if (ownerData.email && !currentOwner?.email) updates.email = ownerData.email;
        if (ownerData.document && !currentOwner?.document) updates.document = ownerData.document;

        if (Object.keys(updates).length > 0) {
          await supabase.from("owners").update(updates).eq("id", existing.id);
        }
      }

      return existing.id;
    }

    // Create new owner
    const { data: newOwner, error } = await supabase
      .from("owners")
      .insert({
        organization_id: orgId,
        primary_name: ownerData.name,
        phone: normPhone,
        email: ownerData.email || null,
        document: ownerData.document || null,
        notes: ownerData.notes || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Create first alias
    await supabase.from("owner_aliases").insert({
      owner_id: newOwner.id,
      name: ownerData.name,
      occurrence_count: 1,
    });

    return newOwner.id;
  }

  // Get properties linked to an owner
  async function getOwnerProperties(ownerId: string) {
    const { data, error } = await supabase
      .from("property_owners")
      .select(`
        property_id,
        properties:property_id (
          id, title, property_code, status, address_city, address_neighborhood
        )
      `)
      .eq("owner_id", ownerId);

    if (error) throw error;
    return data?.map((d) => {
      const prop = (d as any).properties;
      if (!prop) return null;
      return { ...prop, code: prop.property_code };
    }).filter(Boolean) || [];
  }

  return {
    owners,
    isLoading,
    createOwner,
    updateOwner,
    deleteOwner,
    findOrCreateByPhone,
    getOwnerProperties,
    isCreating: createOwner.isPending,
    isUpdating: updateOwner.isPending,
    isDeleting: deleteOwner.isPending,
  };
}
