import React from "react";
import { useAdLeads } from "@/hooks/useAdLeads";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdLeadRow } from "./AdLeadRow";

interface AdDetailLeadsProps {
  externalAdId: string;
}

export function AdDetailLeads({ externalAdId }: AdDetailLeadsProps) {
  const { leads, isLoading } = useAdLeads({ externalAdId });

  // PERF: UX — skeleton rows instead of plain text
  if (isLoading) return (
    <div className="space-y-2 mt-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );

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
