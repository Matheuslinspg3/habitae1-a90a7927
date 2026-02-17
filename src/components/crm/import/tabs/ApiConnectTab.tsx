import { Badge } from '@/components/ui/badge';
import { Zap, MessageSquare, BarChart3, Globe } from 'lucide-react';

const FUTURE_INTEGRATIONS = [
  { name: 'RD Station', icon: BarChart3, description: 'CRM e marketing' },
  { name: 'Zapier', icon: Zap, description: 'Automações e webhooks' },
  { name: 'Meta Ads', icon: Globe, description: 'Leads do Facebook e Instagram' },
  { name: 'WhatsApp Business', icon: MessageSquare, description: 'Leads via WhatsApp' },
];

export function ApiConnectTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Conecte o Habitae a outras plataformas para importar leads automaticamente.
      </p>

      <div className="space-y-3">
        {FUTURE_INTEGRATIONS.map((integration) => (
          <div
            key={integration.name}
            className="flex items-center gap-3 p-4 rounded-lg border bg-card opacity-60"
          >
            <integration.icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{integration.name}</p>
              <p className="text-xs text-muted-foreground">{integration.description}</p>
            </div>
            <Badge variant="secondary" className="text-xs">
              Em breve
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
