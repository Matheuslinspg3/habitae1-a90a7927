import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Image,
  Ruler,
  FileText,
  RefreshCw,
  ArrowLeft,
  Search,
  Building2,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Pencil,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface IncompleteProperty {
  id: string;
  title: string;
  address_neighborhood: string | null;
  address_city: string | null;
  sale_price: number | null;
  rent_price: number | null;
  import_status: string | null;
  import_warnings: string[];
  source_property_id: string | null;
  property_images: { id: string; url: string }[];
}

function parseImportWarnings(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.keys(raw as Record<string, unknown>).filter(k => (raw as Record<string, unknown>)[k]);
  }
  return [];
}

const warningLabels: Record<string, { label: string; icon: typeof Image; color: string }> = {
  sem_fotos: { label: 'Sem fotos', icon: Image, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  fotos_ausentes: { label: 'Sem fotos', icon: Image, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  poucas_fotos: { label: 'Poucas fotos', icon: Image, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  sem_metragem: { label: 'Sem metragem', icon: Ruler, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  metragem_ausente: { label: 'Sem metragem', icon: Ruler, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  sem_descricao: { label: 'Sem descrição', icon: FileText, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  descricao_gerada: { label: 'Descrição gerada', icon: FileText, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  sem_proprietario: { label: 'Sem proprietário', icon: AlertTriangle, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  endereco_duplicado: { label: 'Endereço duplicado', icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

export default function ImportPendencies() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWarning, setFilterWarning] = useState<string>('all');

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['incomplete-properties', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          title,
          address_neighborhood,
          address_city,
          sale_price,
          rent_price,
          import_status,
          import_warnings,
          source_property_id,
          property_images (id, url)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('source_provider', 'imobzi')
        .in('import_status', ['incomplete', 'needs_retry'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(p => ({
        ...p,
        import_warnings: parseImportWarnings(p.import_warnings),
      })) as IncompleteProperty[];
    },
    enabled: !!profile?.organization_id,
  });

  const filteredProperties = useMemo(() => {
    let result = properties;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(term) ||
        p.address_neighborhood?.toLowerCase().includes(term) ||
        p.address_city?.toLowerCase().includes(term)
      );
    }

    if (filterWarning !== 'all') {
      result = result.filter(p => p.import_warnings.includes(filterWarning));
    }

    return result;
  }, [properties, searchTerm, filterWarning]);

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredProperties.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProperties.map(p => p.id)));
    }
  };

  // Get warning stats
  const warningStats = useMemo(() => {
    const stats: Record<string, number> = {};
    properties.forEach(p => {
      p.import_warnings.forEach(w => {
        stats[w] = (stats[w] || 0) + 1;
      });
    });
    return stats;
  }, [properties]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/imoveis">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <PageHeader
          title="Imóveis com Pendências"
          description={`${properties.length} imóveis importados do Imobzi precisam de atenção`}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Image className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{warningStats['sem_fotos'] || 0}</p>
                <p className="text-xs text-muted-foreground">Sem fotos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Image className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{warningStats['poucas_fotos'] || 0}</p>
                <p className="text-xs text-muted-foreground">Poucas fotos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Ruler className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{warningStats['sem_metragem'] || warningStats['metragem_ausente'] || 0}</p>
                <p className="text-xs text-muted-foreground">Sem metragem</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{warningStats['descricao_gerada'] || 0}</p>
                <p className="text-xs text-muted-foreground">Descrição gerada</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar imóveis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterWarning} onValueChange={setFilterWarning}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por problema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os problemas</SelectItem>
            <SelectItem value="sem_fotos">Sem fotos</SelectItem>
            <SelectItem value="fotos_ausentes">Fotos ausentes</SelectItem>
            <SelectItem value="poucas_fotos">Poucas fotos</SelectItem>
            <SelectItem value="sem_metragem">Sem metragem</SelectItem>
            <SelectItem value="metragem_ausente">Metragem ausente</SelectItem>
            <SelectItem value="descricao_gerada">Descrição gerada</SelectItem>
            <SelectItem value="sem_proprietario">Sem proprietário</SelectItem>
            <SelectItem value="endereco_duplicado">Endereço duplicado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selecionados</span>
          <Button variant="outline" size="sm" disabled>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reimportar selecionados
          </Button>
        </div>
      )}

      {/* Properties List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {filteredProperties.length} imóveis
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleSelectAll}>
              {selectedIds.size === filteredProperties.length ? 'Desmarcar' : 'Selecionar'} todos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="divide-y">
              {filteredProperties.map((property) => (
                <PropertyRow
                  key={property.id}
                  property={property}
                  selected={selectedIds.has(property.id)}
                  onToggle={() => handleToggle(property.id)}
                />
              ))}
              {filteredProperties.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mb-4 text-green-500" />
                  <p className="font-medium">Nenhum imóvel com pendências!</p>
                  <p className="text-sm">Todos os imóveis estão completos.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function PropertyRow({ 
  property, 
  selected, 
  onToggle 
}: { 
  property: IncompleteProperty; 
  selected: boolean; 
  onToggle: () => void;
}) {
  const coverImage = property.property_images?.[0]?.url;
  const price = property.sale_price || property.rent_price;
  const location = [property.address_neighborhood, property.address_city].filter(Boolean).join(', ');

  return (
    <div 
      className={`flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
        selected ? 'bg-primary/5' : ''
      }`}
      onClick={onToggle}
    >
      <Checkbox checked={selected} onChange={() => {}} />
      
      <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
        {coverImage ? (
          <img src={coverImage} alt={property.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate">{property.title}</h4>
        <p className="text-sm text-muted-foreground truncate">{location || 'Endereço não informado'}</p>
        
        <div className="flex flex-wrap gap-1 mt-2">
          {property.import_warnings.map((warning) => {
            const config = warningLabels[warning];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <Badge key={warning} variant="secondary" className={`text-xs ${config.color}`}>
                <Icon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        {price && (
          <p className="font-medium text-primary">{formatCurrency(price)}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {property.property_images?.length || 0} fotos
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
        }}
        asChild
        title="Editar imóvel"
      >
        <Link to={`/imoveis/${property.id}?edit=true`}>
          <Pencil className="w-4 h-4" />
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
        }}
        asChild
        title="Ver detalhes"
      >
        <Link to={`/imoveis/${property.id}`}>
          <ExternalLink className="w-4 h-4" />
        </Link>
      </Button>
    </div>
  );
}
