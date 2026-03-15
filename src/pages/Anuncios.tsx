import React, { lazy, Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/useTabParam";
import { useAdLeadsCount } from "@/hooks/useAdLeads";
import { Loader2, Megaphone, BarChart3, Sparkles, Palette, Video, Stamp } from "lucide-react";

import MetaAdsListContent from "@/components/ads/MetaAdsListContent";
import MetaLeadsInboxContent from "@/components/ads/MetaLeadsInboxContent";
import MetaStatsContent from "@/components/ads/MetaStatsContent";
import MetaSettingsContent from "@/components/ads/MetaSettingsContent";
import RDStationStatsContent from "@/components/ads/RDStationStatsContent";
import RDWebhookTab from "@/components/ads/rdstation/RDWebhookTab";
import RDOAuthTab from "@/components/ads/rdstation/RDOAuthTab";
import RDSettingsTab from "@/components/ads/rdstation/RDSettingsTab";

const GeradorAnunciosContent = lazy(() => import("../pages/GeradorAnuncios").then(m => ({ default: () => <m.default embedded /> })));
const GeradorArtesContent = lazy(() => import("@/components/ads/GeradorArtesContent"));
const GeradorVideoContent = lazy(() => import("@/components/ads/GeradorVideoContent"));
const BrandSettingsContent = lazy(() => import("@/components/marketing/BrandSettingsContent"));

const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function Anuncios() {
  const [section, setSection] = useTabParam("section", "meta");
  const [metaTab, setMetaTab] = useTabParam("meta_tab", "ads");
  const [rdTab, setRdTab] = useTabParam("rd_tab", "config");
  const { data: totalNew = 0 } = useAdLeadsCount();

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader
        title="Marketing"
        description="Gerencie campanhas, leads e conteúdo de marketing"
      />

      <div className="flex-1 p-4 sm:p-6 space-y-4">
        {/* Top-level sections */}
        <Tabs value={section} onValueChange={setSection}>
          <TabsList className="w-full sm:w-auto flex-wrap">
            <TabsTrigger value="meta" className="gap-2 flex-1 sm:flex-initial min-h-[44px]">
              <Megaphone className="h-4 w-4" />
              Meta Ads
              {totalNew > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full bg-destructive text-destructive-foreground">
                  {totalNew}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="rdstation" className="gap-2 flex-1 sm:flex-initial min-h-[44px]">
              <BarChart3 className="h-4 w-4" />
              RD Station
            </TabsTrigger>
            <TabsTrigger value="gerador" className="gap-2 flex-1 sm:flex-initial min-h-[44px]">
              <Sparkles className="h-4 w-4" />
              Gerador IA
            </TabsTrigger>
            <TabsTrigger value="artes" className="gap-2 flex-1 sm:flex-initial min-h-[44px]">
              <Palette className="h-4 w-4" />
              Gerador de Artes
            </TabsTrigger>
            <TabsTrigger value="video" className="gap-2 flex-1 sm:flex-initial min-h-[44px]">
              <Video className="h-4 w-4" />
              Gerador de Vídeo
            </TabsTrigger>
          </TabsList>

          {/* ── Meta Ads ── */}
          <TabsContent value="meta" className="mt-4 space-y-4">
            <Tabs value={metaTab} onValueChange={setMetaTab}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="ads" className="flex-1 sm:flex-initial min-h-[40px]">Anúncios</TabsTrigger>
                <TabsTrigger value="leads" className="flex-1 sm:flex-initial min-h-[40px] relative">
                  Leads
                  {totalNew > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full bg-destructive text-destructive-foreground">
                      {totalNew}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="estatisticas" className="flex-1 sm:flex-initial min-h-[40px]">Estatísticas</TabsTrigger>
                <TabsTrigger value="configuracoes" className="flex-1 sm:flex-initial min-h-[40px]">Configurações</TabsTrigger>
              </TabsList>

              <TabsContent value="ads" className="mt-4"><MetaAdsListContent /></TabsContent>
              <TabsContent value="leads" className="mt-4"><MetaLeadsInboxContent /></TabsContent>
              <TabsContent value="estatisticas" className="mt-4"><MetaStatsContent /></TabsContent>
              <TabsContent value="configuracoes" className="mt-4"><MetaSettingsContent /></TabsContent>
            </Tabs>
          </TabsContent>

          {/* ── RD Station ── */}
          <TabsContent value="rdstation" className="mt-4 space-y-4">
            <Tabs value={rdTab} onValueChange={setRdTab}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="config" className="flex-1 sm:flex-initial min-h-[40px]">Configurações</TabsTrigger>
                <TabsTrigger value="webhook" className="flex-1 sm:flex-initial min-h-[40px]">Webhook</TabsTrigger>
                <TabsTrigger value="oauth" className="flex-1 sm:flex-initial min-h-[40px]">Sincronização</TabsTrigger>
                <TabsTrigger value="estatisticas" className="flex-1 sm:flex-initial min-h-[40px]">Estatísticas</TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="mt-4"><RDSettingsTab /></TabsContent>
              <TabsContent value="webhook" className="mt-4"><RDWebhookTab /></TabsContent>
              <TabsContent value="oauth" className="mt-4"><RDOAuthTab /></TabsContent>
              <TabsContent value="estatisticas" className="mt-4"><RDStationStatsContent /></TabsContent>
            </Tabs>
          </TabsContent>

          {/* ── Gerador IA ── */}
          <TabsContent value="gerador" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <GeradorAnunciosContent />
            </Suspense>
          </TabsContent>

          {/* ── Gerador de Artes ── */}
          <TabsContent value="artes" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <GeradorArtesContent />
            </Suspense>
          </TabsContent>

          {/* ── Gerador de Vídeo ── */}
          <TabsContent value="video" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <GeradorVideoContent />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
