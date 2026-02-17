import { RefreshCw, Building2, Users, Home, UserCheck, Database, Cloud, AlertTriangle, TrendingUp, HardDrive, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminMetrics } from "@/hooks/useAdminMetrics";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminAudit() {
  const { data: metrics, isLoading, error, refetch, isFetching } = useAdminMetrics();

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Acesso Negado</CardTitle>
            <CardDescription>
              {error.message || 'Você não tem permissão para acessar esta página.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Auditoria</h1>
          <p className="text-muted-foreground">
            Painel administrativo com métricas do sistema
          </p>
          {metrics?.timestamp && (
            <p className="text-sm text-muted-foreground mt-1">
              Última atualização: {format(new Date(metrics.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
        </div>
        <Button onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Imóveis"
          value={metrics?.counts?.properties}
          subValue={`${metrics?.counts?.properties_active || 0} ativos`}
          icon={<Home className="h-4 w-4" />}
          loading={isLoading}
        />
        <MetricCard
          title="Leads"
          value={metrics?.counts?.leads}
          subValue={`${metrics?.counts?.leads_active || 0} ativos`}
          icon={<UserCheck className="h-4 w-4" />}
          loading={isLoading}
        />
        <MetricCard
          title="Organizações"
          value={metrics?.counts?.organizations}
          icon={<Building2 className="h-4 w-4" />}
          loading={isLoading}
        />
        <MetricCard
          title="Usuários"
          value={metrics?.counts?.profiles}
          icon={<Users className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      {/* Storage Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Database Size */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Banco de Dados</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Imagens armazenadas</span>
                  <span className="font-medium">{metrics?.counts?.property_images || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Contratos</span>
                  <span className="font-medium">{metrics?.counts?.contracts || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tarefas</span>
                  <span className="font-medium">{metrics?.counts?.tasks || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Agendamentos</span>
                  <span className="font-medium">{metrics?.counts?.appointments || 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cloudinary Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cloudinary</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : metrics?.cloudinary?.error ? (
              <p className="text-sm text-muted-foreground">{metrics.cloudinary.error}</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Storage</span>
                    <span>{metrics?.cloudinary?.storage?.usedFormatted || '0'} / {metrics?.cloudinary?.storage?.limitFormatted || 'N/A'}</span>
                  </div>
                  <Progress value={metrics?.cloudinary?.storage?.percentage || 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Bandwidth</span>
                    <span>{metrics?.cloudinary?.bandwidth?.usedFormatted || '0'} / {metrics?.cloudinary?.bandwidth?.limitFormatted || 'N/A'}</span>
                  </div>
                  <Progress value={metrics?.cloudinary?.bandwidth?.percentage || 0} className="h-2" />
                </div>
                {metrics?.cloudinary?.plan && (
                  <Badge variant="secondary">Plano: {metrics.cloudinary.plan}</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Growth Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Crescimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              <GrowthCard
                label="Imóveis"
                last7={metrics?.growth?.properties_7d || 0}
                last30={metrics?.growth?.properties_30d || 0}
              />
              <GrowthCard
                label="Leads"
                last7={metrics?.growth?.leads_7d || 0}
                last30={metrics?.growth?.leads_30d || 0}
              />
              <GrowthCard
                label="Organizações"
                last7={metrics?.growth?.orgs_7d || 0}
                last30={metrics?.growth?.orgs_30d || 0}
              />
              <GrowthCard
                label="Usuários"
                last7={metrics?.growth?.users_7d || 0}
                last30={metrics?.growth?.users_30d || 0}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Saúde do Sistema
          </CardTitle>
          <CardDescription>Verificação de inconsistências e problemas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <HealthItem
                label="Imóveis sem tipo"
                value={metrics?.health?.properties_without_type || 0}
                isWarning={(metrics?.health?.properties_without_type || 0) > 0}
              />
              <HealthItem
                label="Imóveis sem preço"
                value={metrics?.health?.properties_without_price || 0}
                isWarning={(metrics?.health?.properties_without_price || 0) > 0}
              />
              <HealthItem
                label="Leads sem corretor"
                value={metrics?.health?.leads_without_broker || 0}
                isWarning={(metrics?.health?.leads_without_broker || 0) > 0}
              />
              <HealthItem
                label="Imagens órfãs"
                value={metrics?.health?.orphan_images || 0}
                isWarning={(metrics?.health?.orphan_images || 0) > 0}
              />
              <HealthItem
                label="Acessos marketplace (7d)"
                value={metrics?.health?.marketplace_access_7d || 0}
              />
              <HealthItem
                label="Contratos ativos"
                value={metrics?.health?.contracts_active || 0}
              />
              <HealthItem
                label="Faturas pendentes"
                value={metrics?.health?.invoices_pending || 0}
                isWarning={(metrics?.health?.invoices_pending || 0) > 5}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Por Organização
          </CardTitle>
          <CardDescription>Métricas detalhadas por organização</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Imóveis</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                    <TableHead className="text-right">Imagens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics?.organizations?.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {org.type === 'imobiliaria' ? 'Imobiliária' : 'Corretor'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {org.total_properties} <span className="text-muted-foreground">({org.active_properties})</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {org.total_leads} <span className="text-muted-foreground">({org.active_leads})</span>
                      </TableCell>
                      <TableCell className="text-right">{org.total_users}</TableCell>
                      <TableCell className="text-right">{org.total_images}</TableCell>
                    </TableRow>
                  ))}
                  {(!metrics?.organizations || metrics.organizations.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhuma organização encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Sizes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Tamanho das Tabelas
          </CardTitle>
          <CardDescription>Uso de espaço por tabela no banco de dados</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead className="text-right">Linhas</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics?.tableSizes?.map((table) => (
                    <TableRow key={table.table_name}>
                      <TableCell className="font-mono text-sm">{table.table_name}</TableCell>
                      <TableCell className="text-right">{table.row_count?.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{table.total_size}</TableCell>
                    </TableRow>
                  ))}
                  {(!metrics?.tableSizes || metrics.tableSizes.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Dados não disponíveis
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Properties by Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Imóveis por Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {metrics?.propertiesByStatus?.map((item) => (
                <Badge key={item.status} variant="secondary" className="text-sm py-1 px-3">
                  {item.status}: {item.count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Components

function MetricCard({ 
  title, 
  value, 
  subValue, 
  icon, 
  loading 
}: { 
  title: string; 
  value?: number; 
  subValue?: string;
  icon: React.ReactNode; 
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value?.toLocaleString('pt-BR') || 0}</div>
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GrowthCard({ 
  label, 
  last7, 
  last30 
}: { 
  label: string; 
  last7: number; 
  last30: number;
}) {
  return (
    <div className="p-4 rounded-lg border">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-4 mt-2">
        <div>
          <p className="text-xs text-muted-foreground">7 dias</p>
          <p className="text-lg font-semibold text-primary">+{last7}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">30 dias</p>
          <p className="text-lg font-semibold">+{last30}</p>
        </div>
      </div>
    </div>
  );
}

function HealthItem({ 
  label, 
  value, 
  isWarning 
}: { 
  label: string; 
  value: number;
  isWarning?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg border ${isWarning ? 'border-destructive bg-destructive/5' : ''}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${isWarning ? 'text-destructive' : ''}`}>
        {value.toLocaleString('pt-BR')}
      </p>
    </div>
  );
}
