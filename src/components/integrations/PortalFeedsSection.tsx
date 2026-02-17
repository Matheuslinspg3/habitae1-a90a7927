import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Globe,
  Copy,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ExternalLink,
  Rss,
  Clock,
  Building2,
} from 'lucide-react';
import { usePortalFeeds, type PortalFeed } from '@/hooks/usePortalFeeds';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PORTAL_ICONS: Record<string, string> = {
  olx_zap: '🟠',
  chavesnamao: '🔑',
  imovelweb: '🏠',
};

const PORTAL_DESCRIPTIONS: Record<string, string> = {
  olx_zap: 'Formato VRSync compatível com OLX, ZAP Imóveis e VivaReal',
  chavesnamao: 'Formato XML nativo do portal Chaves na Mão',
  imovelweb: 'Formato compatível com Imovelweb (Navent)',
};

function PortalFeedCard({
  feed,
  onToggle,
  onRegenerate,
  onRotateToken,
  isRegenerating,
  isRotatingToken,
}: {
  feed: PortalFeed;
  onToggle: (feedId: string, isActive: boolean) => void;
  onRegenerate: (feedId: string) => void;
  onRotateToken: (feedId: string) => void;
  isRegenerating: boolean;
  isRotatingToken: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (feed.feed_url) {
      navigator.clipboard.writeText(feed.feed_url);
      setCopied(true);
      toast.success('URL copiada!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className={feed.is_active ? 'border-primary/30' : 'opacity-75'}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{PORTAL_ICONS[feed.portal_name] || '🌐'}</span>
            <div>
              <CardTitle className="text-base">{feed.portal_label}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {PORTAL_DESCRIPTIONS[feed.portal_name] || 'Portal de anúncios'}
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={feed.is_active}
            onCheckedChange={(checked) => onToggle(feed.id, checked)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {feed.is_active && (
          <>
            {/* Feed URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">URL do Feed XML</label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={feed.feed_url || ''}
                  className="text-xs font-mono h-8"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cole esta URL no painel do portal para iniciar a sincronização automática.
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                <span>{feed.total_properties_exported} imóveis exportados</span>
              </div>
              {feed.last_generated_at && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Atualizado {formatDistanceToNow(new Date(feed.last_generated_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              )}
              {feed.token_rotated_at && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Token rotacionado {formatDistanceToNow(new Date(feed.token_rotated_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRegenerate(feed.id)}
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Regenerar agora
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRotateToken(feed.id)}
                disabled={isRotatingToken}
              >
                {isRotatingToken ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Rotacionar token
              </Button>
              {feed.feed_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a href={feed.feed_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Visualizar XML
                  </a>
                </Button>
              )}
            </div>
          </>
        )}

        {!feed.is_active && (
          <p className="text-xs text-muted-foreground">
            Ative o feed para gerar a URL de integração com o portal.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function PortalFeedsSection() {
  const {
    feeds,
    isLoading,
    initializeFeeds,
    isInitializing,
    toggleFeed,
    regenerateFeed,
    isRegenerating,
    rotateFeedToken,
    isRotatingFeedToken,
  } = usePortalFeeds();

  // Auto-initialize feeds if none exist
  useEffect(() => {
    if (!isLoading && feeds.length === 0) {
      initializeFeeds();
    }
  }, [isLoading, feeds.length, initializeFeeds]);

  if (isLoading || isInitializing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Rss className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Portais de Anúncio</h2>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando portais...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Portais de Anúncio</h2>
            <p className="text-sm text-muted-foreground">
              Sincronize seus imóveis com os principais portais do Brasil via XML Feed
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          {feeds.filter(f => f.is_active).length} / {feeds.length} ativos
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {feeds.map(feed => (
          <PortalFeedCard
            key={feed.id}
            feed={feed}
            onToggle={(id, active) => toggleFeed({ feedId: id, isActive: active })}
            onRegenerate={regenerateFeed}
            onRotateToken={rotateFeedToken}
            isRegenerating={isRegenerating}
            isRotatingToken={isRotatingFeedToken}
          />
        ))}
      </div>
    </div>
  );
}
