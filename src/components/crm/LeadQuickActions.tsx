import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Phone, MessageCircle, Mail, Thermometer } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LeadQuickActionsProps {
  phone?: string | null;
  email?: string | null;
  temperature?: string | null;
  onChangeTemperature?: (temp: string) => void;
  compact?: boolean;
}

const TEMPERATURES = [
  { id: 'frio', label: 'Frio', color: 'text-blue-500' },
  { id: 'morno', label: 'Morno', color: 'text-yellow-500' },
  { id: 'quente', label: 'Quente', color: 'text-orange-500' },
  { id: 'prioridade', label: 'Prioridade Máxima', color: 'text-red-500' },
];

function LeadQuickActionsComponent({ phone, email, temperature, onChangeTemperature, compact }: LeadQuickActionsProps) {
  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) return;
    const cleaned = phone.replace(/\D/g, '');
    const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    window.open(`https://wa.me/${number}`, '_blank');
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) return;
    window.open(`tel:${phone}`, '_self');
  };

  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!email) return;
    window.open(`mailto:${email}`, '_self');
  };

  const currentTemp = TEMPERATURES.find(t => t.id === temperature);
  const size = compact ? 'h-6 w-6' : 'h-7 w-7';
  const iconSize = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {phone && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={size} onClick={handleWhatsApp}>
                <MessageCircle className={`${iconSize} text-emerald-500`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>WhatsApp</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={size} onClick={handleCall}>
                <Phone className={`${iconSize} text-primary`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ligar</TooltipContent>
          </Tooltip>
        </>
      )}
      {email && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className={size} onClick={handleEmail}>
              <Mail className={`${iconSize} text-primary`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>E-mail</TooltipContent>
        </Tooltip>
      )}
      {onChangeTemperature && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={size} onClick={(e) => e.stopPropagation()}>
              <Thermometer className={`${iconSize} ${currentTemp?.color || 'text-muted-foreground'}`} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {TEMPERATURES.map(temp => (
              <DropdownMenuItem
                key={temp.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeTemperature(temp.id);
                }}
                className={temperature === temp.id ? 'bg-accent' : ''}
              >
                <span className={`mr-2 ${temp.color}`}>●</span>
                {temp.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export const LeadQuickActions = memo(LeadQuickActionsComponent);
