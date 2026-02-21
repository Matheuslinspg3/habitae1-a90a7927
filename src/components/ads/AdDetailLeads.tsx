import React, { useState } from "react";
import { useAdLeads } from "@/hooks/useAdLeads";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import { AdLeadRow } from "./AdLeadRow";

interface AdDetailLeadsProps {
  externalAdId: string;
}

export function AdDetailLeads({ externalAdId }: AdDetailLeadsProps) {
  const { leads, isLoading } = useAdLeads({ externalAdId });

  if (isLoading) return <p className="text-muted-foreground text-sm py-4">Carregando leads...</p>;

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Inbox className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhum lead recebido para este anúncio.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2 mt-4">
      {leads.map(lead => (
        <AdLeadRow key={lead.id} lead={lead} />
      ))}
    </div>
  );
}
