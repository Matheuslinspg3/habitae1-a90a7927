import { FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/contexts/DemoContext";

export function DemoBanner() {
  const { endDemo } = useDemo();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 py-2 px-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 animate-pulse" />
          <span className="text-sm font-medium">
            Modo Demonstração • Dados não serão salvos permanentemente
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={endDemo}
          className="h-7 px-2 text-amber-950 hover:bg-amber-600 hover:text-amber-950"
        >
          <span className="mr-1 text-xs">Sair do Demo</span>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
