import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, CheckCircle2, AlertCircle, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface RDContact {
  uuid: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  tags: string[];
  existsInCRM: boolean;
  existingLeadId: string | null;
}

interface RDSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RDSyncDialog({ open, onOpenChange }: RDSyncDialogProps) {
  const [contacts, setContacts] = useState<RDContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeExisting, setMergeExisting] = useState(false);
  const [fetched, setFetched] = useState(false);
  const queryClient = useQueryClient();

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("rd-station-list-contacts");
      if (error) throw error;
      if (data?.error) {
        if (data.needs_oauth) {
          toast.error("Conecte sua conta RD Station via OAuth primeiro.");
          return;
        }
        throw new Error(data.error);
      }
      const contactList = data.contacts || [];
      setContacts(contactList);
      setFetched(true);
      // Pre-select new contacts
      const newIds = new Set<string>();
      contactList.forEach((c: RDContact) => {
        if (!c.existsInCRM && c.uuid) newIds.add(c.uuid);
      });
      setSelectedIds(newIds);
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar contatos do RD Station.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleContact = (uuid: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toggleAll = (onlyNew: boolean) => {
    const filtered = contacts.filter(c => c.uuid && (onlyNew ? !c.existsInCRM : true));
    const allSelected = filtered.every(c => selectedIds.has(c.uuid!));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.delete(c.uuid!));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.add(c.uuid!));
        return next;
      });
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.warning("Selecione ao menos um contato para importar.");
      return;
    }
    setIsImporting(true);
    try {
      const selectedContacts = contacts.filter(c => c.uuid && selectedIds.has(c.uuid));
      const { data, error } = await supabase.functions.invoke("rd-station-sync-leads", {
        body: {
          selective: true,
          contact_uuids: selectedContacts.map(c => c.uuid),
          merge_existing: mergeExisting,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success(
        `Importação concluída: ${data.created || 0} criados, ${data.updated || 0} atualizados, ${data.duplicates || 0} duplicados.`
      );
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["rd-station-logs"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar leads.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setContacts([]);
    setFetched(false);
    setSelectedIds(new Set());
    setMergeExisting(false);
  };

  const newContacts = contacts.filter(c => !c.existsInCRM);
  const existingContacts = contacts.filter(c => c.existsInCRM);
  const selectedNew = newContacts.filter(c => c.uuid && selectedIds.has(c.uuid)).length;
  const selectedExisting = existingContacts.filter(c => c.uuid && selectedIds.has(c.uuid)).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Sincronizar Leads do RD Station
          </DialogTitle>
          <DialogDescription>
            Escolha quais contatos deseja importar para o CRM.
          </DialogDescription>
        </DialogHeader>

        {!fetched ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">
              Clique abaixo para buscar a lista de contatos disponíveis no RD Station.
            </p>
            <Button onClick={fetchContacts} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isLoading ? "Buscando contatos..." : "Buscar Contatos"}
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* Summary */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="gap-1">
                {contacts.length} contatos encontrados
              </Badge>
              <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-0">
                {newContacts.length} novos
              </Badge>
              <Badge variant="secondary" className="gap-1">
                {existingContacts.length} já existem no CRM
              </Badge>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
                  {newContacts.every(c => c.uuid && selectedIds.has(c.uuid)) ? "Desmarcar novos" : "Selecionar todos novos"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
                  {contacts.every(c => c.uuid && selectedIds.has(c.uuid!)) ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="merge-existing"
                  checked={mergeExisting}
                  onCheckedChange={(v) => setMergeExisting(!!v)}
                />
                <label htmlFor="merge-existing" className="text-xs text-muted-foreground cursor-pointer">
                  Atualizar dados de leads existentes
                </label>
              </div>
            </div>

            {/* Contact list */}
            <div className="flex-1 border rounded-lg max-h-[400px] overflow-y-auto">
              <div className="divide-y divide-border">
                {contacts.map((contact) => {
                  const key = contact.uuid || contact.email || contact.name;
                  const isSelected = contact.uuid ? selectedIds.has(contact.uuid) : false;
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer ${
                        contact.existsInCRM ? 'bg-muted/30' : ''
                      }`}
                      onClick={() => contact.uuid && toggleContact(contact.uuid)}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="shrink-0"
                        onCheckedChange={() => contact.uuid && toggleContact(contact.uuid)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{contact.name}</span>
                          {contact.existsInCRM && (
                            <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0 shrink-0">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Já existe
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {contact.email && (
                            <span className="text-xs text-muted-foreground truncate">{contact.email}</span>
                          )}
                          {contact.phone && (
                            <span className="text-xs text-muted-foreground">{contact.phone}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Import button */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                {selectedNew} novos + {selectedExisting} existentes selecionados
              </span>
              <Button onClick={handleImport} disabled={isImporting || selectedIds.size === 0}>
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isImporting ? "Importando..." : `Importar ${selectedIds.size} contatos`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
