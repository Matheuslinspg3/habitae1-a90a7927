import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowRight, Check } from 'lucide-react';
import { type FieldMapping, HABITAE_FIELDS, validateMapping } from '../utils/fieldMatcher';

interface FieldMappingStepProps {
  mappings: FieldMapping[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
}

export function FieldMappingStep({ mappings, onMappingsChange }: FieldMappingStepProps) {
  const validation = validateMapping(mappings);
  const usedFields = new Set(mappings.filter(m => m.habitaeField).map(m => m.habitaeField));

  const handleChange = (csvField: string, habitaeField: string) => {
    const updated = mappings.map(m =>
      m.csvField === csvField
        ? { ...m, habitaeField: habitaeField === '_none' ? null : habitaeField }
        : m
    );
    onMappingsChange(updated);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Associe os campos do CSV aos campos do Habitae. O mapeamento automático já foi aplicado.
      </p>

      {!validation.valid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validation.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        {mappings.map((mapping) => {
          const isMatched = !!mapping.habitaeField;
          const field = HABITAE_FIELDS.find(f => f.id === mapping.habitaeField);

          return (
            <div
              key={mapping.csvField}
              className="flex items-center gap-3 p-2.5 rounded-lg border bg-card"
            >
              <div className="flex-1 min-w-0">
                <Badge variant="secondary" className="text-xs truncate max-w-full">
                  {mapping.csvField}
                </Badge>
              </div>

              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />

              <div className="flex-1 min-w-0">
                <Select
                  value={mapping.habitaeField || '_none'}
                  onValueChange={(v) => handleChange(mapping.csvField, v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Ignorar —</SelectItem>
                    {HABITAE_FIELDS.map((f) => (
                      <SelectItem
                        key={f.id}
                        value={f.id}
                        disabled={usedFields.has(f.id) && mapping.habitaeField !== f.id}
                      >
                        {f.label}
                        {'required' in f && f.required ? ' *' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isMatched && <Check className="h-4 w-4 shrink-0 text-green-500" />}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {mappings.filter(m => m.habitaeField).length} de {mappings.length} campos mapeados
      </p>
    </div>
  );
}
