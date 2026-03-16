import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, FileText, Home, ExternalLink, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OwnerAliases } from "./OwnerAliases";
import type { OwnerWithDetails } from "@/hooks/useOwners";
import { useOwners } from "@/hooks/useOwners";

interface OwnerDetailsProps {
  owner: OwnerWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (owner: OwnerWithDetails) => void;
}

interface LinkedProperty {
  id: string;
  title: string;
  code: string | null;
  status: string;
  address_city: string | null;
  address_neighborhood: string | null;
}

export function OwnerDetails({ owner, open, onOpenChange, onEdit }: OwnerDetailsProps) {
  const navigate = useNavigate();
  const { getOwnerProperties } = useOwners();
  const [properties, setProperties] = useState<LinkedProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  useEffect(() => {
    if (owner && open) {
      setLoadingProperties(true);
      getOwnerProperties(owner.id)
        .then((props) => setProperties(props as LinkedProperty[]))
        .catch(() => setProperties([]))
        .finally(() => setLoadingProperties(false));
    }
  }, [owner?.id, open]);

  if (!owner) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>{owner.primary_name}</span>
            <Button variant="ghost" size="icon" onClick={() => onEdit(owner)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{owner.phone || "—"}</span>
            </div>
            {owner.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{owner.email}</span>
              </div>
            )}
            {owner.document && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{owner.document}</span>
              </div>
            )}
          </div>

          {owner.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Observações</p>
                <p className="text-sm">{owner.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Aliases */}
          <OwnerAliases aliases={owner.aliases} primaryName={owner.primary_name} />

          <Separator />

          {/* Linked properties */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Imóveis vinculados</p>
              <Badge variant="secondary" className="gap-1">
                <Home className="h-3 w-3" />
                {owner.property_count}
              </Badge>
            </div>

            {loadingProperties ? (
              <div className="space-y-2">
                {[1, 2].map(i => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-4" />
                  </div>
                ))}
              </div>
            ) : properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum imóvel vinculado.</p>
            ) : (
              <div className="space-y-2">
                {properties.map((prop) => (
                  <div
                    key={prop.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 cursor-pointer"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/imoveis/${prop.id}`);
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium">{prop.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[prop.address_neighborhood, prop.address_city].filter(Boolean).join(", ") || "Sem localização"}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
