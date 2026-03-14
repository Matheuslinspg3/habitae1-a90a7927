import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { LeadCard } from './LeadCard';
import { LeadForm } from './LeadForm';
import { LeadDetails } from './LeadDetails';
import { PropertySuggestionsDialog } from './PropertySuggestionsDialog';
import { LeadFilters } from './LeadFilters';
import { LeadMetrics } from './LeadMetrics';
import { LeadAssignmentDialog } from './LeadAssignmentDialog';
import { LeadListView } from './LeadListView';
import { LeadBulkToolbar } from './LeadBulkToolbar';
import { MobileKanbanView } from './MobileKanbanView';
import { ExportButton } from './ExportButton';
import { CRMImportWizard } from './import/CRMImportWizard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, LayoutGrid, List, Flame, Snowflake, Sun, Zap, CheckSquare, HelpCircle, ArrowLeftRight } from 'lucide-react';
import { registerLeadScoreEvent } from '@/lib/leadScore';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove as sortableArrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LeadStage } from '@/hooks/useLeadStages';
import { useLeadStages } from '@/hooks/useLeadStages';

const UNCLASSIFIED_STAGE: LeadStage = {
  id: '__unclassified__',
  name: 'Sem classificação',
  color: '#9ca3af',
  position: -1,
  organization_id: null,
  is_default: false,
  is_win: false,
  is_loss: false,
  created_at: '',
};
import { useIsMobile } from '@/hooks/use-mobile';
import { useLeads, type Lead, type CreateLeadInput } from '@/hooks/useLeads';
import { useBrokers } from '@/hooks/useBrokers';
import { useProperties } from '@/hooks/useProperties';
import { usePropertyTypes } from '@/hooks/usePropertyTypes';
import { useToast } from '@/hooks/use-toast';
import { useTrackAction, trackSearch, trackFilterUsed, trackTaskCompletion } from '@/hooks/useAnalytics';

const TEMP_CHIPS = [
  { value: 'prioridade', label: 'Prioridade', icon: Zap, activeClass: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700' },
  { value: 'quente', label: 'Quente', icon: Flame, activeClass: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700' },
  { value: 'morno', label: 'Morno', icon: Sun, activeClass: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700' },
  { value: 'frio', label: 'Frio', icon: Snowflake, activeClass: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700' },
] as const;

function SortableColumnWrapper({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function KanbanBoard() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const trackAction = useTrackAction();
  
  const {
    leads,
    leadStages,
    leadsByStage,
    stageStats,
    isLoading,
    refetch,
    createLead,
    updateLead,
    updateLeadStage,
    reorderLeads,
    deleteLead,
    inactivateLead,
    bulkDeleteLeads,
    bulkInactivateLeads,
    bulkMoveStage,
    isCreating,
    isUpdating,
    isDeleting,
    isInactivating,
  } = useLeads();

  const { reorderStages } = useLeadStages();
  const { brokers } = useBrokers();
  const { properties } = useProperties();
  const { propertyTypes } = usePropertyTypes();

  const [search, setSearch] = useState('');
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    // Debounced tracking handled by the filter component; track on clear/empty
    if (val.length >= 3) {
      trackSearch('crm', true);
    }
  }, []);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedTemperature, setSelectedTemperature] = useState<string | null>(() => {
    try {
      return localStorage.getItem('crm_temperature_filter') || null;
    } catch {
      return null;
    }
  });

  // Persist temperature filter
  const handleTemperatureChange = (value: string | null) => {
    setSelectedTemperature(value);
    trackFilterUsed(`crm_temperature_${value || 'clear'}`);
    try {
      if (value) {
        localStorage.setItem('crm_temperature_filter', value);
      } else {
        localStorage.removeItem('crm_temperature_filter');
      }
    } catch { /* ignore */ }
  };
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [columnReorderMode, setColumnReorderMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assigningLead, setAssigningLead] = useState<Lead | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [lastCreatedLeadData, setLastCreatedLeadData] = useState<CreateLeadInput | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = leadStages.findIndex(s => s.id === active.id);
    const newIndex = leadStages.findIndex(s => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(leadStages, oldIndex, newIndex);
    reorderStages(reordered.map((s, i) => ({ id: s.id, position: i })));
  }, [leadStages, reorderStages]);

  // Filter and sort leads (stalest first)
  const filteredLeadsByStage = useMemo(() => {
    const searchLower = search.toLowerCase();
    
    const applyFilters = (stageLeads: Lead[], stageId: string) => {
      if (search) {
        stageLeads = stageLeads.filter(
          (lead) =>
            lead.name.toLowerCase().includes(searchLower) ||
            lead.email?.toLowerCase().includes(searchLower) ||
            lead.phone?.includes(search)
        );
      }
      if (selectedBrokerId) {
        stageLeads = stageLeads.filter((lead) => lead.broker_id === selectedBrokerId);
      }
      if (selectedSource) {
        stageLeads = stageLeads.filter((lead) => lead.source === selectedSource);
      }
      if (selectedTemperature) {
        stageLeads = stageLeads.filter((lead) => lead.temperature === selectedTemperature);
      }
      // Sort: oldest updated_at first (stalest leads on top)
      return [...stageLeads].sort((a, b) => 
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      );
    };

    const result = leadStages.reduce((acc, stage) => {
      acc[stage.id] = applyFilters(leadsByStage[stage.id] || [], stage.id);
      return acc;
    }, {} as Record<string, Lead[]>);

    // Include unclassified leads
    result['__unclassified__'] = applyFilters(leadsByStage['__unclassified__'] || [], '__unclassified__');

    return result;
  }, [leadsByStage, leadStages, search, selectedBrokerId, selectedSource, selectedTemperature]);

  const filteredStageStats = useMemo(() => {
    const allStageIds = [...leadStages.map(s => s.id), '__unclassified__'];
    return allStageIds.reduce((acc, stageId) => {
      const stageLeads = filteredLeadsByStage[stageId] || [];
      acc[stageId] = {
        count: stageLeads.length,
        totalValue: stageLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0),
      };
      return acc;
    }, {} as Record<string, { count: number; totalValue: number }>);
  }, [filteredLeadsByStage, leadStages]);

  const filteredLeads = useMemo(() => {
    return Object.values(filteredLeadsByStage).flat();
  }, [filteredLeadsByStage]);

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const overId = over.id as string;

    // Determine target stage: is overId a stage or a lead?
    const isStage = leadStages.some(s => s.id === overId);
    let targetStageId: string;
    
    if (isStage) {
      targetStageId = overId;
    } else {
      const overLead = leads.find(l => l.id === overId);
      if (!overLead) return;
      targetStageId = overLead.lead_stage_id || '';
    }

    const sourceStageId = lead.lead_stage_id || '';
    const sourceLeads = [...(filteredLeadsByStage[sourceStageId] || [])];
    const targetLeads = sourceStageId === targetStageId 
      ? sourceLeads 
      : [...(filteredLeadsByStage[targetStageId] || [])];

    if (sourceStageId === targetStageId) {
      const oldIndex = sourceLeads.findIndex(l => l.id === leadId);
      const newIndex = isStage 
        ? sourceLeads.length - 1 
        : sourceLeads.findIndex(l => l.id === overId);
      
      if (oldIndex === newIndex) return;

      const reordered = arrayMove(sourceLeads, oldIndex, newIndex);
      const updates = reordered.map((l, i) => ({
        id: l.id,
        position: i,
        lead_stage_id: targetStageId,
      }));
      reorderLeads(updates);
    } else {
      const insertIndex = isStage
        ? targetLeads.length
        : targetLeads.findIndex(l => l.id === overId);

      const newSource = sourceLeads.filter(l => l.id !== leadId);
      const newTarget = [...targetLeads];
      newTarget.splice(insertIndex >= 0 ? insertIndex : newTarget.length, 0, lead);

      const updates = [
        ...newSource.map((l, i) => ({ id: l.id, position: i, lead_stage_id: sourceStageId })),
        ...newTarget.map((l, i) => ({ id: l.id, position: i, lead_stage_id: targetStageId })),
      ];
      reorderLeads(updates);

      // Register score event for stage change
      const sourceIdx = leadStages.findIndex(s => s.id === sourceStageId);
      const targetIdx = leadStages.findIndex(s => s.id === targetStageId);
      const targetStage = leadStages.find(s => s.id === targetStageId);
      
      if (targetStage?.is_win) {
        registerLeadScoreEvent(leadId, "stage_win", { from: sourceStageId, to: targetStageId });
      } else if (targetStage?.is_loss) {
        registerLeadScoreEvent(leadId, "stage_loss", { from: sourceStageId, to: targetStageId });
      } else if (targetIdx > sourceIdx) {
        registerLeadScoreEvent(leadId, "stage_advanced", { from: sourceStageId, to: targetStageId });
      } else {
        registerLeadScoreEvent(leadId, "stage_moved", { from: sourceStageId, to: targetStageId });
      }
    }
  }, [leads, leadStages, filteredLeadsByStage, reorderLeads]);

  const handleLeadClick = useCallback((lead: Lead) => {
    if (activeId) return;
    trackAction('crm_lead_click', { leadId: lead.id });
    setSelectedLead(lead);
    setDetailsOpen(true);
  }, [activeId, trackAction]);

  const handleNewLead = useCallback(() => {
    setEditingLead(null);
    setFormOpen(true);
  }, []);

  const handleEditLead = useCallback(() => {
    setEditingLead(selectedLead);
    setDetailsOpen(false);
    setFormOpen(true);
  }, [selectedLead]);

  const handleDeleteLead = useCallback(() => {
    if (selectedLead) {
      deleteLead(selectedLead.id);
      setDetailsOpen(false);
      setSelectedLead(null);
    }
  }, [selectedLead, deleteLead]);

  const handleInactivateLead = useCallback(() => {
    if (selectedLead) {
      inactivateLead(selectedLead.id);
      setDetailsOpen(false);
      setSelectedLead(null);
    }
  }, [selectedLead, inactivateLead]);

  const handleAssignLead = useCallback((lead?: Lead) => {
    const target = lead || selectedLead;
    if (target) {
      setAssigningLead(target);
      setAssignmentOpen(true);
    }
  }, [selectedLead]);

  const handleFormSubmit = async (data: CreateLeadInput) => {
    if (editingLead) {
      await new Promise<void>((resolve, reject) => {
        updateLead(
          { id: editingLead.id, ...data },
          { onSuccess: () => resolve(), onError: reject }
        );
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        createLead(data, {
          onSuccess: () => {
            // Show property suggestions after creating a new lead with interests
            if (data.transaction_interest) {
              setLastCreatedLeadData(data);
              setSuggestionsOpen(true);
            }
            resolve();
          },
          onError: reject,
        });
      });
    }
  };

  const propertyOptions = useMemo(() => {
    return properties.map((p) => ({ id: p.id, title: p.title }));
  }, [properties]);

  const selectionMode = selectedIds.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
  }, [filteredLeads]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    bulkDeleteLeads([...selectedIds]);
    clearSelection();
  }, [selectedIds, bulkDeleteLeads, clearSelection]);

  const handleBulkInactivate = useCallback(() => {
    bulkInactivateLeads([...selectedIds]);
    clearSelection();
  }, [selectedIds, bulkInactivateLeads, clearSelection]);

  const handleBulkMoveStage = useCallback((stageId: string) => {
    bulkMoveStage({ ids: [...selectedIds], lead_stage_id: stageId });
    const stage = leadStages.find((s) => s.id === stageId);
    toast({ title: 'Leads movidos', description: `${selectedIds.size} lead(s) movidos para "${stage?.name}".` });
    clearSelection();
  }, [selectedIds, bulkMoveStage, leadStages, toast, clearSelection]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-40" />
        </div>
        {isMobile ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="w-72 lg:w-80 h-64 flex-shrink-0" />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <LeadMetrics leads={leads} />
      
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between">
        <LeadFilters
          search={search}
          onSearchChange={setSearch}
          selectedBrokerId={selectedBrokerId}
          onBrokerChange={setSelectedBrokerId}
          brokers={brokers}
          selectedSource={selectedSource}
          onSourceChange={setSelectedSource}
          selectedTemperature={selectedTemperature}
          onTemperatureChange={handleTemperatureChange}
        />
        <div className="flex gap-2">
          <div className="flex border rounded-md overflow-hidden shrink-0">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode('kanban')}
              title="Kanban"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode('list')}
              title="Lista"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          {viewMode === 'kanban' && !isMobile && (
            <Button
              variant={columnReorderMode ? 'default' : 'outline'}
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setColumnReorderMode(!columnReorderMode)}
              title="Reordenar colunas"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant={selectionMode ? 'default' : 'outline'}
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => selectionMode ? clearSelection() : selectAll()}
            title="Selecionar em lote"
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Importar</span>
          </Button>
          <ExportButton leads={filteredLeads} leadStages={leadStages} />
          <Button onClick={handleNewLead} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" />
            <span className="sm:inline">Novo Lead</span>
          </Button>
        </div>
      </div>

      {/* Quick temperature filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-2">
        {TEMP_CHIPS.map(({ value, label, icon: Icon, activeClass }) => {
          const isActive = selectedTemperature === value;
          return (
            <button
              key={value}
              onClick={() => handleTemperatureChange(isActive ? null : value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0 min-h-[32px] ${
                isActive ? activeClass : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
              {isActive && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">
                  {leads.filter(l => l.temperature === value).length}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Bulk actions toolbar */}
      <LeadBulkToolbar
        selectedCount={selectedIds.size}
        totalCount={filteredLeads.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onBulkDelete={handleBulkDelete}
        onBulkInactivate={handleBulkInactivate}
        onBulkMoveStage={handleBulkMoveStage}
        leadStages={leadStages}
        isDeleting={isDeleting}
        isInactivating={isInactivating}
        allSelected={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
      />

      {viewMode === 'list' ? (
        <LeadListView
          leads={filteredLeads}
          leadStages={leadStages}
          onLeadClick={handleLeadClick}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          selectionMode={selectionMode}
        />
      ) : isMobile ? (
        <MobileKanbanView
          leadStages={leadStages}
          leadsByStage={filteredLeadsByStage}
          stageStats={filteredStageStats}
          onLeadClick={handleLeadClick}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          selectionMode={selectionMode}
        />
      ) : columnReorderMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleColumnDragEnd}
        >
          <SortableContext items={leadStages.map(s => s.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-3 lg:gap-4 overflow-x-auto pb-4 -mx-2 px-2">
              <KanbanColumn
                key="__unclassified__"
                stage={UNCLASSIFIED_STAGE}
                leads={filteredLeadsByStage['__unclassified__'] || []}
                stats={filteredStageStats['__unclassified__'] || { count: 0, totalValue: 0 }}
                onLeadClick={handleLeadClick}
              />
              {leadStages.map((stage) => (
                <SortableColumnWrapper key={stage.id} id={stage.id}>
                  <KanbanColumn
                    stage={stage}
                    leads={filteredLeadsByStage[stage.id] || []}
                    stats={filteredStageStats[stage.id] || { count: 0, totalValue: 0 }}
                    onLeadClick={handleLeadClick}
                  />
                </SortableColumnWrapper>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 lg:gap-4 overflow-x-auto pb-4 -mx-2 px-2">
            <KanbanColumn
              key="__unclassified__"
              stage={UNCLASSIFIED_STAGE}
              leads={filteredLeadsByStage['__unclassified__'] || []}
              stats={filteredStageStats['__unclassified__'] || { count: 0, totalValue: 0 }}
              onLeadClick={handleLeadClick}
            />
            {leadStages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={filteredLeadsByStage[stage.id] || []}
                stats={filteredStageStats[stage.id] || { count: 0, totalValue: 0 }}
                onLeadClick={handleLeadClick}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeLead && <LeadCard lead={activeLead} />}
          </DragOverlay>
        </DndContext>
      )}

      <LeadForm
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={editingLead}
        leadStages={leadStages}
        brokers={brokers}
        properties={propertyOptions}
        propertyTypes={propertyTypes}
        onSubmit={handleFormSubmit}
        isLoading={isCreating || isUpdating}
      />

      <LeadDetails
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        lead={selectedLead}
        leadStages={leadStages}
        onEdit={handleEditLead}
        onDelete={handleDeleteLead}
        onInactivate={handleInactivateLead}
        onAssign={() => handleAssignLead()}
        isDeleting={isDeleting}
        isInactivating={isInactivating}
      />

      <LeadAssignmentDialog
        open={assignmentOpen}
        onOpenChange={setAssignmentOpen}
        lead={assigningLead}
      />

      <CRMImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportComplete={() => refetch()}
      />

      {lastCreatedLeadData && (
        <PropertySuggestionsDialog
          open={suggestionsOpen}
          onOpenChange={(open) => {
            setSuggestionsOpen(open);
            if (!open) setLastCreatedLeadData(null);
          }}
          leadName={lastCreatedLeadData.name}
          leadInterests={lastCreatedLeadData}
          properties={properties}
        />
      )}
    </div>
  );
}
