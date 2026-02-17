import * as React from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PageAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
}

interface PageHeaderActionsProps {
  actions: PageAction[];
  /** If true, show primary action as button even on mobile */
  showPrimaryOnMobile?: boolean;
}

export function PageHeaderActions({ actions, showPrimaryOnMobile = true }: PageHeaderActionsProps) {
  if (actions.length === 0) return null;

  const [primaryAction, ...secondaryActions] = actions;

  return (
    <>
      {/* Desktop: show all actions as buttons */}
      <div className="hidden sm:flex items-center gap-2">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || (index === 0 ? "default" : "outline")}
            onClick={action.onClick}
            disabled={action.disabled}
            className="min-h-[44px]"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>

      {/* Mobile: primary button + dropdown for rest */}
      <div className="flex sm:hidden items-center gap-2">
        {showPrimaryOnMobile && primaryAction && (
          <Button
            variant={primaryAction.variant || "default"}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            size="sm"
            className="min-h-[44px]"
          >
            {primaryAction.icon}
            <span className="sr-only sm:not-sr-only">{primaryAction.label}</span>
          </Button>
        )}

        {(secondaryActions.length > 0 || !showPrimaryOnMobile) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" aria-label="Mais ações">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(!showPrimaryOnMobile ? actions : secondaryActions).map((action, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={action.variant === "destructive" ? "text-destructive focus:text-destructive" : ""}
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );
}
