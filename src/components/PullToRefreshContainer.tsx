import { ReactNode } from "react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface PullToRefreshContainerProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function PullToRefreshContainer({
  onRefresh,
  children,
  className,
  disabled,
}: PullToRefreshContainerProps) {
  const isMobile = useIsMobile();
  const { containerRef, isRefreshing, pullDistance, pullProgress } = usePullToRefresh({
    onRefresh,
    disabled: disabled || !isMobile,
  });

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      style={{ transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined, transition: pullDistance === 0 ? "transform 0.3s ease" : undefined }}
    >
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-10 z-10 flex items-center justify-center">
          <Loader2
            className={cn(
              "h-6 w-6 text-primary transition-opacity",
              isRefreshing ? "animate-spin opacity-100" : "opacity-70"
            )}
            style={{ transform: isRefreshing ? undefined : `rotate(${pullProgress * 360}deg)` }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
