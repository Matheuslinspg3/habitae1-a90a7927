import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { SupportTicketDialog } from "@/components/settings/SupportTicketDialog";

export function SupportFAB() {
  const [pulse, setPulse] = useState(true);

  return (
    <div className="fixed left-4 bottom-20 z-50 md:fixed md:bottom-6 md:left-6">
      <SupportTicketDialog
        trigger={
          <button
            onClick={() => setPulse(false)}
            className={cn(
              "flex items-center justify-center",
              "w-12 h-12 md:w-14 md:h-14 rounded-full",
              "bg-destructive text-destructive-foreground",
              "shadow-lg hover:shadow-xl",
              "transition-all duration-200",
              "active:scale-90 touch-manipulation",
              pulse && "animate-pulse"
            )}
            aria-label="Reportar problema"
            title="Reportar problema"
          >
            <MessageCircleQuestion className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        }
      />
    </div>
  );
}
