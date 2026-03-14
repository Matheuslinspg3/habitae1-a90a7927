import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

export function useLeadDocuments(leadId: string | undefined) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Fetch templates for org
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['lead_document_templates', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('lead_document_templates' as any)
        .select('*, lead_document_template_items(*)')
        .eq('organization_id', orgId)
        .order('created_at');
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });

  // Fetch documents for this lead
  const { data: documents = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ['lead_documents', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_documents' as any)
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!leadId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!leadId) return;
    const channel = supabase
      .channel(`lead-docs-${leadId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lead_documents',
        filter: `lead_id=eq.${leadId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['lead_documents', leadId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [leadId, queryClient]);

  // Upload document
  const uploadDocument = useMutation({
    mutationFn: async ({
      file,
      templateItemId,
      notes,
    }: {
      file: File;
      templateItemId: string | null;
      notes?: string;
    }) => {
      if (!leadId || !orgId || !user?.id) throw new Error('Missing context');

      const ext = file.name.split('.').pop() || 'bin';
      const timestamp = Date.now();
      const storagePath = `${orgId}/${leadId}/${templateItemId || 'avulso'}_${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('lead-documents')
        .upload(storagePath, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;

      const { data: insertData, error: insertError } = await supabase
        .from('lead_documents' as any)
        .insert({
          lead_id: leadId,
          organization_id: orgId,
          template_item_id: templateItemId,
          file_name: file.name,
          storage_path: storagePath,
          file_size_bytes: file.size,
          mime_type: file.type,
          status: 'received',
          uploaded_by: user.id,
          notes: notes || null,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Trigger AI validation in background
      try {
        await supabase.functions.invoke('validate-document', {
          body: {
            document_id: (insertData as any).id,
            storage_path: storagePath,
            expected_type: templateItemId ? 'template_item' : 'general',
          },
        });
      } catch {
        // Non-blocking
      }

      return insertData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_documents', leadId] });
      toast({ title: 'Documento enviado', description: 'Arquivo carregado com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
    },
  });

  // Review document (approve/reject)
  const reviewDocument = useMutation({
    mutationFn: async ({
      documentId,
      status,
      rejectionReason,
    }: {
      documentId: string;
      status: 'approved' | 'rejected';
      rejectionReason?: string;
    }) => {
      const { error } = await supabase
        .from('lead_documents' as any)
        .update({
          status,
          rejection_reason: rejectionReason || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_documents', leadId] });
      toast({ title: 'Documento revisado' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Delete document
  const deleteDocument = useMutation({
    mutationFn: async (doc: { id: string; storage_path: string }) => {
      await supabase.storage.from('lead-documents').remove([doc.storage_path]);
      const { error } = await supabase.from('lead_documents' as any).delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_documents', leadId] });
      toast({ title: 'Documento removido' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Create default templates
  const createDefaultTemplates = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Sem organização');
      const { error } = await supabase.rpc('create_default_document_templates' as any, { p_org_id: orgId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_document_templates', orgId] });
      toast({ title: 'Templates criados', description: 'Templates padrão criados com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Get signed URL for private docs
  const getDocumentUrl = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('lead-documents')
      .createSignedUrl(storagePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  };

  return {
    templates,
    documents,
    isLoadingTemplates,
    isLoadingDocs,
    uploadDocument,
    reviewDocument,
    deleteDocument,
    createDefaultTemplates,
    getDocumentUrl,
  };
}
