import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid, List, MapPin, ArrowUpDown } from "lucide-react";

export type ViewMode = "grid" | "list" | "map";
export type PageSize = 50 | 150 | 300 | "all";
export type SortOption = "recent" | "oldest" | "price_asc" | "price_desc" | "beach_asc" | "beach_desc";

interface PropertyViewControlsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  pageSize: PageSize;
  onPageSizeChange: (size: PageSize) => void;
  totalCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}

export function PropertyViewControls({
  viewMode,
  onViewModeChange,
  pageSize,
  onPageSizeChange,
  totalCount,
  currentPage,
  onPageChange,
  sortBy = "recent",
  onSortChange,
}: PropertyViewControlsProps) {
  const numericPageSize = pageSize === "all" ? totalCount : pageSize;
  const totalPages = numericPageSize > 0 ? Math.ceil(totalCount / numericPageSize) : 1;

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        {/* View toggle */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(val) => val && onViewModeChange(val as ViewMode)}
          className="border rounded-md"
        >
          <ToggleGroupItem value="grid" aria-label="Grade" className="px-3">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Lista" className="px-3">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="map" aria-label="Mapa" className="px-3">
            <MapPin className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Sort */}
        {onSortChange && (
          <Select value={sortBy} onValueChange={(val) => onSortChange(val as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
              <SelectItem value="price_asc">Menor preço</SelectItem>
              <SelectItem value="price_desc">Maior preço</SelectItem>
              <SelectItem value="beach_asc">Mais perto da praia</SelectItem>
              <SelectItem value="beach_desc">Mais longe da praia</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Page size */}
        <Select
          value={String(pageSize)}
          onValueChange={(val) => {
            onPageSizeChange(val === "all" ? "all" : (Number(val) as PageSize));
            onPageChange(1);
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50 por página</SelectItem>
            <SelectItem value="150">150 por página</SelectItem>
            <SelectItem value="300">300 por página</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {totalCount} imóvel(is)
          {pageSize !== "all" && totalPages > 1 && ` • Página ${currentPage} de ${totalPages}`}
        </span>
        {pageSize !== "all" && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-2 py-1 rounded border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-2 py-1 rounded border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
