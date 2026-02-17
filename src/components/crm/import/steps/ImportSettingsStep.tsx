import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useLeadStages } from '@/hooks/useLeadStages';
import { useBrokers } from '@/hooks/useBrokers';
import { Thermometer, UserCheck, FolderOpen } from 'lucide-react';

export interface ImportSettingsData {
  targetStage: string;
  brokerId: string | null;
  autoTemperature: boolean;
}

interface ImportSettingsStepProps {
  settings: ImportSettingsData;
  onSettingsChange: (settings: ImportSettingsData) => void;
}

export function ImportSettingsStep({ settings, onSettingsChange }: ImportSettingsStepProps) {
  const { brokers } = useBrokers();
  const { leadStages } = useLeadStages();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium">Etapa do funil de destino</Label>
        </div>
        <Select
          value={settings.targetStage}
          onValueChange={(v) => onSettingsChange({ ...settings, targetStage: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium">Atribuir a corretor</Label>
        </div>
        <Select
          value={settings.brokerId || '_auto'}
          onValueChange={(v) =>
            onSettingsChange({ ...settings, brokerId: v === '_auto' ? null : v })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_auto">Manter do CSV / Sem atribuição</SelectItem>
            {brokers.map((b) => (
              <SelectItem key={b.user_id} value={b.user_id}>
                {b.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          <Thermometer className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Classificação automática de temperatura</p>
            <p className="text-xs text-muted-foreground">
              Classifica leads como Frio, Morno ou Quente automaticamente
            </p>
          </div>
        </div>
        <Switch
          checked={settings.autoTemperature}
          onCheckedChange={(v) => onSettingsChange({ ...settings, autoTemperature: v })}
        />
      </div>
    </div>
  );
}
