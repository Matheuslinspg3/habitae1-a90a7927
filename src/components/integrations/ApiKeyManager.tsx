import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Eye, EyeOff, Key, Loader2 } from "lucide-react";

interface ApiKeyEntry {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
}

interface ApiKeyManagerProps {
  apiKeys: ApiKeyEntry[];
  isLoading: boolean;
  onAdd: (name: string, apiKey: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function ApiKeyManager({ apiKeys, isLoading, onAdd, onDelete }: ApiKeyManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [showKeyValues, setShowKeyValues] = useState<Record<string, boolean>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) return;
    
    setIsAdding(true);
    const success = await onAdd(newKeyName.trim(), newKeyValue.trim());
    setIsAdding(false);
    
    if (success) {
      setNewKeyName("");
      setNewKeyValue("");
      setShowAddForm(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  const toggleShowKey = (id: string) => {
    setShowKeyValues(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}••••${key.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Chaves de API (X-Imobzi-Secret)</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar Chave
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="keyName">Nome da chave</Label>
            <Input
              id="keyName"
              placeholder="Ex: Imobzi Produção"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keyValue">X-Imobzi-Secret</Label>
            <Input
              id="keyValue"
              type="password"
              placeholder="Cole sua chave de API aqui"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleAdd} 
              disabled={isAdding || !newKeyName.trim() || !newKeyValue.trim()}
              size="sm"
            >
              {isAdding ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
              ) : (
                'Salvar'
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setShowAddForm(false);
                setNewKeyName("");
                setNewKeyValue("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Key className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma chave cadastrada</p>
          <p className="text-sm">Adicione uma chave de API para começar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{key.name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                    {showKeyValues[key.id] ? key.api_key : maskKey(key.api_key)}
                  </code>
                  <span>•</span>
                  <span>{formatDate(key.created_at)}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleShowKey(key.id)}
                >
                  {showKeyValues[key.id] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      disabled={deletingId === key.id}
                    >
                      {deletingId === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover chave?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. A chave "{key.name}" será removida permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(key.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
