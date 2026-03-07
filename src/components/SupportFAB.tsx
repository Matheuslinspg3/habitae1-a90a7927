import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { SupportTicketDialog } from "@/components/settings/SupportTicketDialog";
import { useIsMobile } from "@/hooks/use-mobile";

export function SupportFAB() {
  const [pulse, setPulse] = useState(true);
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "fixed z-50 transition-all duration-300",
        // Desktop: bottom-right corner
        "right-6 bottom-6",
        // Mobile: above the bottom nav bar to avoid overlap
        isMobile && "right-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]"
      )}
    >
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
