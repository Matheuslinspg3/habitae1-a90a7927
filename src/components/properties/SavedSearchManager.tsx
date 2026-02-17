import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Bookmark, ChevronDown, Trash2, Star } from 'lucide-react';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import { PropertyFilters } from '@/hooks/usePropertyFilters';

interface SavedSearchManagerProps {
  currentFilters: PropertyFilters;
  onLoadSearch: (filters: PropertyFilters) => void;
  hasActiveFilters: boolean;
}

export function SavedSearchManager({ currentFilters, onLoadSearch, hasActiveFilters }: SavedSearchManagerProps) {
  const { savedSearches, saveSearch, deleteSearch, isSaving } = useSavedSearches();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');

  const handleSave = () => {
    if (!searchName.trim()) return;
    saveSearch({ name: searchName.trim(), filters: currentFilters, notify: false });
    setSearchName('');
    setSaveDialogOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Save current search */}
      {hasActiveFilters && (
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 min-h-[44px]">
              <Bookmark className="h-4 w-4" />
              <span className="hidden sm:inline">Salvar busca</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Salvar busca</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Nome da busca (ex: Apartamentos Zona Sul)"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={!searchName.trim() || isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Load saved searches */}
      {savedSearches.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 min-h-[44px]">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Buscas salvas</span>
              <Badge variant="secondary" className="text-xs ml-1">{savedSearches.length}</Badge>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[260px]">
            {savedSearches.map((search) => (
              <DropdownMenuItem key={search.id} className="flex items-center justify-between gap-2">
                <button
                  onClick={() => onLoadSearch(search.filters)}
                  className="flex-1 text-left truncate"
                >
                  {search.name}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSearch(search.id); }}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remover busca salva"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
