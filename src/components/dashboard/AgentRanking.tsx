import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardRanking, type AgentRank } from "@/hooks/useDashboardRanking";

interface Props {
  dateRange: { from: Date; to: Date };
}

type SortKey = "active_leads" | "visits" | "closings" | "conversion" | "avg_response_hours";

export function AgentRanking({ dateRange }: Props) {
  const { data: agents = [], isLoading } = useDashboardRanking(dateRange);
  const [sortKey, setSortKey] = useState<SortKey>("closings");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...agents].sort((a, b) => {
    const getVal = (agent: AgentRank) => {
      if (sortKey === "conversion") {
        return agent.active_leads > 0 ? (agent.closings / agent.active_leads) * 100 : 0;
      }
      return agent[sortKey] ?? 999;
    };
    const diff = getVal(a) - getVal(b);
    return sortAsc ? diff : -diff;
  });

  const getInitials = (name: string) =>
    name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-display">Ranking de Corretores</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  if (agents.length === 0) return null;

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 text-[11px] font-medium text-muted-foreground hover:text-foreground gap-1"
      onClick={() => handleSort(field)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </Button>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-display flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Ranking de Corretores
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Corretor</TableHead>
              <TableHead><SortHeader label="Leads" field="active_leads" /></TableHead>
              <TableHead><SortHeader label="Visitas" field="visits" /></TableHead>
              <TableHead><SortHeader label="Fechamentos" field="closings" /></TableHead>
              <TableHead><SortHeader label="Tx. Conv." field="conversion" /></TableHead>
              <TableHead><SortHeader label="Tempo Resp." field="avg_response_hours" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((agent, index) => {
              const convRate = agent.active_leads > 0
                ? ((agent.closings / agent.active_leads) * 100).toFixed(0)
                : "0";
              const responseTime = agent.avg_response_hours !== null
                ? agent.avg_response_hours < 1
                  ? `${Math.round(agent.avg_response_hours * 60)}min`
                  : `${agent.avg_response_hours.toFixed(1)}h`
                : "—";

              return (
                <TableRow
                  key={agent.user_id}
                  className={cn(index === 0 && "bg-primary/5")}
                >
                  <TableCell className="font-medium text-sm">
                    {index === 0 ? <Trophy className="h-4 w-4 text-amber-500" /> : index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        {agent.avatar_url && <AvatarImage src={agent.avatar_url} />}
                        <AvatarFallback className="text-[10px]">{getInitials(agent.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate max-w-[120px]">{agent.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{agent.active_leads}</TableCell>
                  <TableCell className="text-sm">{agent.visits}</TableCell>
                  <TableCell className="text-sm font-semibold">{agent.closings}</TableCell>
                  <TableCell className="text-sm">{convRate}%</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{responseTime}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
