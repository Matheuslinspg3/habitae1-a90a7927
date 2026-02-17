import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layers, Plus, Pencil, Trash2, Check, X, Trophy, ThumbsDown, GripVertical } from 'lucide-react';
import { useLeadStages, type LeadStage } from '@/hooks/useLeadStages';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b',
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

function SortableStageRow({
  stage, isEditing, editName, editColor, editIsWin, editIsLoss,
  onEditNameChange, onEditColorChange, onEditIsWinChange, onEditIsLossChange,
  onStartEdit, onSaveEdit, onCancelEdit, onDelete, isUpdating, isDeleting,
}: {
  stage: LeadStage; isEditing: boolean; editName: string; editColor: string;
  editIsWin: boolean; editIsLoss: boolean;
  onEditNameChange: (v: string) => void; onEditColorChange: (v: string) => void;
  onEditIsWinChange: (v: boolean) => void; onEditIsLossChange: (v: boolean) => void;
  onStartEdit: () => void; onSaveEdit: () => void; onCancelEdit: () => void;
  onDelete: () => void; isUpdating: boolean; isDeleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
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
        <div className="flex gap-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={editIsWin} onCheckedChange={(v) => { onEditIsWinChange(!!v); if (v) onEditIsLossChange(false); }} />
            <Trophy className="h-3 w-3" /> Ganho
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={editIsLoss} onCheckedChange={(v) => { onEditIsLossChange(!!v); if (v) onEditIsWinChange(false); }} />
            <ThumbsDown className="h-3 w-3" /> Perdido
          </label>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2.5 rounded-md border bg-card min-h-[44px]">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#64748b' }} />
      <span className="flex-1 text-sm font-medium truncate">{stage.name}</span>
      {stage.is_win && <Trophy className="h-3.5 w-3.5 text-green-500 shrink-0" />}
      {stage.is_loss && <ThumbsDown className="h-3.5 w-3.5 text-red-500 shrink-0" />}
      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={onStartEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={onDelete} disabled={isDeleting}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export function LeadStageManager() {
  const { leadStages, createLeadStage, updateLeadStage, deleteLeadStage, reorderStages, isCreating, isUpdating, isDeleting } = useLeadStages();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#64748b');
  const [editIsWin, setEditIsWin] = useState(false);
  const [editIsLoss, setEditIsLoss] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#64748b');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = leadStages.findIndex(s => s.id === active.id);
    const newIndex = leadStages.findIndex(s => s.id === over.id);
    const reordered = arrayMove(leadStages, oldIndex, newIndex);
    reorderStages(reordered.map((s, i) => ({ id: s.id, position: i })));
  };

  const handleStartEdit = (stage: LeadStage) => {
    setEditingId(stage.id);
    setEditName(stage.name);
    setEditColor(stage.color || '#64748b');
    setEditIsWin(stage.is_win);
    setEditIsLoss(stage.is_loss);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('#64748b');
    setEditIsWin(false);
    setEditIsLoss(false);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      updateLeadStage({ id: editingId, name: editName.trim(), color: editColor, is_win: editIsWin, is_loss: editIsLoss });
      handleCancelEdit();
    }
  };

  const handleCreate = () => {
    if (newName.trim()) {
      createLeadStage({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor('#64748b');
      setShowAddForm(false);
    }
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteLeadStage(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title="Gerenciar estágios do funil">
            <Layers className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[80vh] [display:flex] flex-col p-0">
          <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
            <DialogTitle>Gerenciar Estágios do Funil</DialogTitle>
            <DialogDescription>
              Arraste para reordenar. Crie, edite ou remova estágios.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={leadStages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 pb-2">
                  {leadStages.map((stage) => (
                    <SortableStageRow
                      key={stage.id}
                      stage={stage}
                      isEditing={editingId === stage.id}
                      editName={editName}
                      editColor={editColor}
                      editIsWin={editIsWin}
                      editIsLoss={editIsLoss}
                      onEditNameChange={setEditName}
                      onEditColorChange={setEditColor}
                      onEditIsWinChange={setEditIsWin}
                      onEditIsLossChange={setEditIsLoss}
                      onStartEdit={() => handleStartEdit(stage)}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                      onDelete={() => setDeleteId(stage.id)}
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
                <Label>Novo Estágio</Label>
                <ColorPicker value={newColor} onChange={setNewColor} />
                <Input placeholder="Nome do estágio" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || isCreating}>
                    {isCreating ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setNewName(''); setNewColor('#64748b'); }}>
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
              Tem certeza que deseja excluir este estágio? Leads neste estágio precisarão ser movidos manualmente para outro estágio.
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
