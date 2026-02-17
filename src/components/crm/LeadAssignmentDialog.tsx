import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UserPlus,
  Shuffle,
  Users,
  TrendingUp,
  TrendingDown,
  Award,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useLeadAssignment, type BrokerWithStats } from '@/hooks/useLeadAssignment';
import type { Lead } from '@/hooks/useLeads';

interface LeadAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

export function LeadAssignmentDialog({ open, onOpenChange, lead }: LeadAssignmentDialogProps) {
  const { brokers, getBrokersWithStats, pickBrokerByRoulette, assignLead, isAssigning } = useLeadAssignment();
  const [mode, setMode] = useState<'manual' | 'roulette'>('manual');
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('');
  const [brokersWithStats, setBrokersWithStats] = useState<BrokerWithStats[]>([]);
  const [roulettePick, setRoulettePick] = useState<BrokerWithStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);

  // Load broker stats when dialog opens
  useEffect(() => {
    if (!open) {
      setSelectedBrokerId('');
      setRoulettePick(null);
      setMode('manual');
      return;
    }
    setIsLoadingStats(true);
    getBrokersWithStats().then(stats => {
      setBrokersWithStats(stats);
      setIsLoadingStats(false);
    });
  }, [open]);

  const handleRoulette = async () => {
    setIsSpinning(true);
    // Small delay for visual effect
    await new Promise(r => setTimeout(r, 800));
    const pick = await pickBrokerByRoulette();
    setRoulettePick(pick);
    setIsSpinning(false);
  };

  const handleAssign = () => {
    if (!lead) return;
    const brokerId = mode === 'roulette' ? roulettePick?.user_id : selectedBrokerId;
    const brokerName = mode === 'roulette'
      ? roulettePick?.full_name
      : brokers.find(b => b.user_id === selectedBrokerId)?.full_name;

    if (!brokerId || !brokerName) return;

    assignLead(
      { leadId: lead.id, brokerId, brokerName },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg mx-4 sm:mx-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Atribuir Lead
          </DialogTitle>
          <DialogDescription>
            Designe o lead <span className="font-medium text-foreground">"{lead.name}"</span> a um corretor.
          </DialogDescription>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => { setMode('manual'); setRoulettePick(null); }}
          >
            <Users className="h-4 w-4" />
            Manual
          </Button>
          <Button
            variant={mode === 'roulette' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => { setMode('roulette'); setSelectedBrokerId(''); }}
          >
            <Shuffle className="h-4 w-4" />
            Roleta Inteligente
          </Button>
        </div>

        <Separator />

        {mode === 'manual' ? (
          <div className="space-y-4">
            <Select value={selectedBrokerId} onValueChange={setSelectedBrokerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um corretor" />
              </SelectTrigger>
              <SelectContent>
                {brokers.map(broker => (
                  <SelectItem key={broker.user_id} value={broker.user_id}>
                    {broker.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show stats for selected broker */}
            {selectedBrokerId && (
              <BrokerStatsCard
                broker={brokersWithStats.find(b => b.user_id === selectedBrokerId)}
                isLoading={isLoadingStats}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A roleta seleciona automaticamente o melhor corretor baseado em:
              carga atual de leads, histórico de conversões e leads perdidos.
            </p>

            {!roulettePick && !isSpinning && (
              <Button onClick={handleRoulette} variant="outline" className="w-full gap-2">
                <Shuffle className="h-4 w-4" />
                Girar Roleta
              </Button>
            )}

            {isSpinning && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analisando desempenho dos corretores...</p>
              </div>
            )}

            {roulettePick && !isSpinning && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg border bg-primary/5 border-primary/20">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{roulettePick.full_name}</p>
                    <p className="text-xs text-muted-foreground">Selecionado pela roleta inteligente</p>
                  </div>
                </div>
                <BrokerStatsCard broker={roulettePick} isLoading={false} />
                <Button variant="ghost" size="sm" onClick={handleRoulette} className="gap-1.5">
                  <Shuffle className="h-3.5 w-3.5" />
                  Girar novamente
                </Button>
              </div>
            )}

            {/* All brokers ranking */}
            {brokersWithStats.length > 0 && !isLoadingStats && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ranking de disponibilidade</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {[...brokersWithStats]
                    .sort((a, b) => a.score - b.score)
                    .map((b, i) => (
                      <div
                        key={b.user_id}
                        className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}.</span>
                          <span className={roulettePick?.user_id === b.user_id ? 'font-medium text-primary' : ''}>
                            {b.full_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{b.activeLeads} ativos</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAssign}
            disabled={
              isAssigning ||
              (mode === 'manual' && !selectedBrokerId) ||
              (mode === 'roulette' && !roulettePick)
            }
          >
            {isAssigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Atribuindo...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Atribuir Lead
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BrokerStatsCard({ broker, isLoading }: { broker?: BrokerWithStats; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  if (!broker) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50 border">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-lg font-semibold">{broker.activeLeads}</span>
        <span className="text-[10px] text-muted-foreground text-center">Leads ativos</span>
      </div>
      <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50 border">
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="text-lg font-semibold">{broker.wonLeads}</span>
        <span className="text-[10px] text-muted-foreground text-center">Ganhos</span>
      </div>
      <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50 border">
        <TrendingDown className="h-4 w-4 text-destructive" />
        <span className="text-lg font-semibold">{broker.coldLeads}</span>
        <span className="text-[10px] text-muted-foreground text-center">Perdidos</span>
      </div>
    </div>
  );
}
