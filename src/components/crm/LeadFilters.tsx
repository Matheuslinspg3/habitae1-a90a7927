import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, SlidersHorizontal } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import type { LeadType } from '@/hooks/useLeadTypes';
import type { Broker } from '@/hooks/useBrokers';
import type { LeadStage } from '@/hooks/useLeadStages';
import { LeadTypeManager } from './LeadTypeManager';
import { LeadStageManager } from './LeadStageManager';
import { LEAD_SOURCES, TEMPERATURES } from '@/hooks/useLeads';
import { useUserRoles } from '@/hooks/useUserRole';

interface LeadFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedTypeId: string | null;
  onTypeChange: (value: string | null) => void;
  leadTypes: LeadType[];
  selectedStage: string | null;
  onStageChange: (value: string | null) => void;
  leadStages: LeadStage[];
  selectedBrokerId: string | null;
  onBrokerChange: (value: string | null) => void;
  brokers: Broker[];
  selectedSource: string | null;
  onSourceChange: (value: string | null) => void;
  selectedTemperature: string | null;
  onTemperatureChange: (value: string | null) => void;
}

export function LeadFilters({
  search,
  onSearchChange,
  selectedTypeId,
  onTypeChange,
  leadTypes,
  selectedStage,
  onStageChange,
  leadStages,
  selectedBrokerId,
  onBrokerChange,
  brokers,
  selectedSource,
  onSourceChange,
  selectedTemperature,
  onTemperatureChange,
}: LeadFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { isAdminOrAbove } = useUserRoles();
  const canManageTypes = isAdminOrAbove;
  const hasAdvancedFilters = !!selectedStage || !!selectedBrokerId || !!selectedSource || !!selectedTemperature;

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-1">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            className="pl-10"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedTypeId || 'all'}
            onValueChange={(value) => onTypeChange(value === 'all' ? null : value)}
          >
            <SelectTrigger className="flex-1 sm:w-[160px]">
              <SelectValue placeholder="Estágio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estágios</SelectItem>
              {leadTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: type.color || '#6366f1' }}
                    />
                    <span className="truncate">{type.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManageTypes && <LeadTypeManager />}
          {canManageTypes && <LeadStageManager />}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant={hasAdvancedFilters ? 'default' : 'outline'} size="icon" className="shrink-0">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Select
              value={selectedStage || 'all'}
              onValueChange={(value) => onStageChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="flex-1 sm:w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {leadStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedBrokerId || 'all'}
              onValueChange={(value) => onBrokerChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="flex-1 sm:w-[160px]">
                <SelectValue placeholder="Corretor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os corretores</SelectItem>
                {brokers.map((broker) => (
                  <SelectItem key={broker.user_id} value={broker.user_id}>
                    {broker.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedSource || 'all'}
              onValueChange={(value) => onSourceChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="flex-1 sm:w-[160px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {LEAD_SOURCES.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedTemperature || 'all'}
              onValueChange={(value) => onTemperatureChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="flex-1 sm:w-[160px]">
                <SelectValue placeholder="Temperatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas temperaturas</SelectItem>
                {TEMPERATURES.map((temp) => (
                  <SelectItem key={temp.id} value={temp.id}>
                    <span className={`mr-1 ${temp.color}`}>●</span>
                    {temp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasAdvancedFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onStageChange(null);
                  onBrokerChange(null);
                  onSourceChange(null);
                  onTemperatureChange(null);
                }}
                className="text-xs"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
