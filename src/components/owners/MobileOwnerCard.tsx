import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Home, Pencil, Trash2 } from "lucide-react";
import type { OwnerWithDetails } from "@/hooks/useOwners";

interface MobileOwnerCardProps {
  owner: OwnerWithDetails;
  onSelect: (owner: OwnerWithDetails) => void;
  onEdit: (owner: OwnerWithDetails) => void;
  onDelete: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function MobileOwnerCard({ owner, onSelect, onEdit, onDelete, selected, onToggleSelect }: MobileOwnerCardProps) {
  return (
    <Card className={`cursor-pointer active:scale-[0.98] transition-transform ${selected ? "ring-2 ring-primary/40 bg-primary/5" : ""}`} onClick={() => onSelect(owner)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {onToggleSelect && (
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selected}
                onCheckedChange={onToggleSelect}
                aria-label={`Selecionar ${owner.primary_name}`}
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{owner.primary_name}</p>
            {owner.aliases.length > 1 && (
              <p className="text-xs text-muted-foreground">+{owner.aliases.length - 1} apelido(s)</p>
            )}
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {owner.phone && <p>{owner.phone}</p>}
              {owner.email && <p className="truncate">{owner.email}</p>}
              {owner.document && <p>{owner.document}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge variant="secondary" className="gap-1">
              <Home className="h-3 w-3" />
              {owner.property_count}
            </Badge>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(owner)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(owner.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
