import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import type { OwnerAlias } from "@/hooks/useOwners";

interface OwnerAliasesProps {
  aliases: OwnerAlias[];
  primaryName: string;
}

export function OwnerAliases({ aliases, primaryName }: OwnerAliasesProps) {
  const sorted = [...aliases].sort((a, b) => (b.occurrence_count || 0) - (a.occurrence_count || 0));

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Nomes conhecidos</p>
      <div className="flex flex-wrap gap-2">
        {sorted.map((alias) => (
          <Badge
            key={alias.id}
            variant={alias.name === primaryName ? "default" : "secondary"}
            className="gap-1"
          >
            {alias.name === primaryName && <Star className="h-3 w-3" />}
            {alias.name}
            <span className="text-xs opacity-70">({alias.occurrence_count}×)</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
