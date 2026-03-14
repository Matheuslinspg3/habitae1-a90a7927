import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisitFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (feedback: string, rating: number) => void;
  isLoading?: boolean;
}

export function VisitFeedbackDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: VisitFeedbackDialogProps) {
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);

  useEffect(() => {
    if (open) {
      setFeedback("");
      setRating(0);
      setHoveredRating(0);
    }
  }, [open]);

  const handleSubmit = () => {
    if (rating === 0 || !feedback.trim()) return;
    onSubmit(feedback.trim(), rating);
    setFeedback("");
    setRating(0);
  };

  const displayRating = hoveredRating || rating;
  const canSubmit = rating > 0 && feedback.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar Visita Realizada</DialogTitle>
          <DialogDescription>
            Avalie a visita e registre suas observações.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Avaliação *</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoveredRating(n)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={cn(
                      "h-7 w-7 transition-colors",
                      n <= displayRating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
            {rating === 0 && (
              <p className="text-xs text-muted-foreground">Clique nas estrelas para avaliar</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="visit-feedback-text">Feedback *</Label>
            <Textarea
              id="visit-feedback-text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Como foi a visita? Observações importantes..."
              rows={3}
              className="text-sm resize-none"
            />
            {feedback.length === 0 && (
              <p className="text-xs text-muted-foreground">Campo obrigatório</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !canSubmit} className="h-10 gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
