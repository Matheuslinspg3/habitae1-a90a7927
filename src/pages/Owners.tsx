import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Home, UserX } from "lucide-react";
import { useOwners, type OwnerWithDetails } from "@/hooks/useOwners";
import { OwnerTable } from "@/components/owners/OwnerTable";
import { OwnerForm } from "@/components/owners/OwnerForm";
import { OwnerDetails } from "@/components/owners/OwnerDetails";

export default function Owners() {
  const { owners, isLoading, createOwner, updateOwner, deleteOwner, bulkDeleteOwners, isCreating, isUpdating } = useOwners();

  const [formOpen, setFormOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<OwnerWithDetails | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<OwnerWithDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const totalOwners = owners.length;
  const withProperties = owners.filter((o) => o.property_count > 0).length;
  const withoutProperties = totalOwners - withProperties;

  const handleAdd = () => {
    setEditingOwner(null);
    setFormOpen(true);
  };

  const handleEdit = (owner: OwnerWithDetails) => {
    setEditingOwner(owner);
    setFormOpen(true);
  };

  const handleSelect = (owner: OwnerWithDetails) => {
    setSelectedOwner(owner);
    setDetailsOpen(true);
  };

  const handleSubmit = async (data: { name: string; phone: string; email: string; document: string; notes: string }) => {
    if (editingOwner) {
      await updateOwner.mutateAsync({
        id: editingOwner.id,
        data: {
          primary_name: data.name,
          phone: data.phone,
          email: data.email || null,
          document: data.document || null,
          notes: data.notes || null,
        },
      });
    } else {
      await createOwner.mutateAsync(data);
    }
    setFormOpen(false);
    setEditingOwner(null);
  };

  const handleDelete = async (id: string) => {
    await deleteOwner.mutateAsync(id);
  };

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <div className="relative flex-1">
      <PageHeader title="Proprietários" description="Gerencie os proprietários de imóveis" />
      
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalOwners}</p>
              <p className="text-xs text-muted-foreground">Total de proprietários</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Home className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{withProperties}</p>
              <p className="text-xs text-muted-foreground">Com imóveis vinculados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-muted">
              <UserX className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{withoutProperties}</p>
              <p className="text-xs text-muted-foreground">Sem imóveis</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <OwnerTable
        owners={owners}
        isLoading={isLoading}
        onSelect={handleSelect}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={handleAdd}
        onBulkDelete={bulkDeleteOwners}
      />

      {/* Form dialog */}
      <OwnerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        owner={editingOwner}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
      />

      {/* Details sheet */}
      <OwnerDetails
        owner={selectedOwner}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onEdit={handleEdit}
      />
    </div>
    </div>
    </div>
  );
}
