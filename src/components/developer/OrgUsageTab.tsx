import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { HardDrive, Image, Building2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface OrgUsage {
  id: string;
  name: string;
  type: string;
  created_at: string;
  total_properties: number;
  active_properties: number;
  total_leads: number;
  total_contracts: number;
  total_users: number;
  total_images: number;
  total_media: number;
  storage_bytes: number;
  total_tasks: number;
  total_appointments: number;
  total_invoices: number;
  total_marketplace: number;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export function OrgUsageTab() {
  const [search, setSearch] = useState("");
  
  const { data: orgUsage = [], isLoading, refetch, isFetching } = useQuery<OrgUsage[]>({
    queryKey: ["dev-org-usage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_org_usage");
      if (error) throw error;
      return (data as unknown as OrgUsage[]) || [];
    },
  });

  const totalStorageBytes = orgUsage.reduce((sum, o) => sum + (o.storage_bytes || 0), 0);
  const totalImages = orgUsage.reduce((sum, o) => sum + (o.total_images || 0) + (o.total_media || 0), 0);

  const filtered = orgUsage.filter(o => 
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Storage Total</p>
              <p className="text-xl font-bold">{formatBytes(totalStorageBytes)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <Image className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Imagens Total</p>
              <p className="text-xl font-bold">{totalImages.toLocaleString("pt-BR")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Organizações</p>
              <p className="text-xl font-bold">{orgUsage.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">Consumo por Organização</CardTitle>
              <CardDescription>Storage e registros por organização</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar organização..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead className="text-right">Imóveis</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Leads</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Usuários</TableHead>
                  <TableHead className="text-right">Imagens</TableHead>
                  <TableHead className="text-right">Storage</TableHead>
                  <TableHead className="w-28 hidden sm:table-cell">% Storage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((org) => {
                  const storagePercent = totalStorageBytes > 0 ? Math.round((org.storage_bytes / totalStorageBytes) * 100) : 0;
                  return (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{org.name}</p>
                          <Badge variant="outline" className="text-[10px] mt-0.5">
                            {org.type === 'imobiliaria' ? 'Imobiliária' : 'Corretor'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-medium">{org.total_properties}</span>
                        <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">({org.active_properties})</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{org.total_leads}</TableCell>
                      <TableCell className="text-right tabular-nums hidden md:table-cell">{org.total_users}</TableCell>
                      <TableCell className="text-right tabular-nums">{(org.total_images || 0) + (org.total_media || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatBytes(org.storage_bytes || 0)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Progress value={storagePercent} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">{storagePercent}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {isLoading ? "Carregando..." : "Nenhuma organização encontrada"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
