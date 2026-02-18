import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tag, Plus, Pencil, Trash2, Check, X, GripVertical } from 'lucide-react';
import { useLeadTypes, type LeadType } from '@/hooks/useLeadTypes';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#fbbf24', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`w-6 h-6 rounded-full border-2 shrink-0 ${value === color ? 'border-foreground scale-110' : 'border-transparent'}`}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

function SortableTypeRow({
  type, isEditing, editName, editColor,
  onEditNameChange, onEditColorChange,
  onStartEdit, onSaveEdit, onCancelEdit, onDelete, isUpdating, isDeleting,
}: {
  type: LeadType; isEditing: boolean; editName: string; editColor: string;
  onEditNameChange: (v: string) => void; onEditColorChange: (v: string) => void;
  onStartEdit: () => void; onSaveEdit: () => void; onCancelEdit: () => void;
  onDelete: () => void; isUpdating: boolean; isDeleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: type.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="p-2.5 rounded-md border bg-card space-y-2">
        <ColorPicker value={editColor} onChange={onEditColorChange} />
        <div className="flex items-center gap-2">
          <Input value={editName} onChange={(e) => onEditNameChange(e.target.value)} className="flex-1 h-9" autoFocus />
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={onSaveEdit} disabled={isUpdating}>
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={onCancelEdit}>
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2.5 rounded-md border bg-card min-h-[44px]">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: type.color || '#6366f1' }} />
      <span className="flex-1 text-sm font-medium truncate">{type.name}</span>
      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={onStartEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={onDelete} disabled={isDeleting}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export function LeadTypeManager() {
  const { leadTypes, createLeadType, updateLeadType, deleteLeadType, reorderTypes, isCreating, isUpdating, isDeleting } = useLeadTypes();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = leadTypes.findIndex(t => t.id === active.id);
    const newIndex = leadTypes.findIndex(t => t.id === over.id);
    const reordered = arrayMove(leadTypes, oldIndex, newIndex);
    reorderTypes(reordered.map((t, i) => ({ id: t.id, position: i })));
  };

  const handleStartEdit = (type: LeadType) => {
    setEditingId(type.id);
    setEditName(type.name);
    setEditColor(type.color || '#6366f1');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('#6366f1');
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      updateLeadType({ id: editingId, name: editName.trim(), color: editColor });
      handleCancelEdit();
    }
  };

  const handleCreate = () => {
    if (newName.trim()) {
      createLeadType({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor('#6366f1');
      setShowAddForm(false);
    }
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteLeadType(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title="Gerenciar estágios de lead">
            <Tag className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[80vh] [display:flex] flex-col p-0">
          <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
            <DialogTitle>Gerenciar Estágios de Lead</DialogTitle>
            <DialogDescription>
              Arraste para reordenar. Crie, edite ou remova estágios.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={leadTypes.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 pb-2">
                  {leadTypes.map((type) => (
                    <SortableTypeRow
                      key={type.id}
                      type={type}
                      isEditing={editingId === type.id}
                      editName={editName}
                      editColor={editColor}
                      onEditNameChange={setEditName}
                      onEditColorChange={setEditColor}
                      onStartEdit={() => handleStartEdit(type)}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                      onDelete={() => setDeleteId(type.id)}
                      isUpdating={isUpdating}
                      isDeleting={isDeleting}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="p-4 sm:px-6 border-t shrink-0">
            {showAddForm ? (
              <div className="space-y-3">
                <Label>Novo Estágio de Lead</Label>
                <ColorPicker value={newColor} onChange={setNewColor} />
                <Input placeholder="Nome do estágio" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || isCreating}>
                    {isCreating ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setNewName(''); setNewColor('#6366f1'); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Estágio
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="z-[60]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este estágio de lead? Leads existentes com este estágio serão mantidos, mas o estágio não estará mais disponível para seleção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
