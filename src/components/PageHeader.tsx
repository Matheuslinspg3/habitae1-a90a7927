import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ReactNode } from "react";
import { BreadcrumbNav, type BreadcrumbItem } from "@/components/BreadcrumbNav";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <header className="md:sticky md:top-0 z-10 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 border-b border-border/30">
      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-2.5 sm:py-4">
        {/* SidebarTrigger only on desktop — mobile uses MobileTopBar */}
        <SidebarTrigger className="-ml-1 min-h-[44px] min-w-[44px] hidden md:flex" aria-label="Abrir menu" />
        <Separator orientation="vertical" className="h-6 hidden md:block" />
        <div className="flex-1 min-w-0">
          {breadcrumbs && breadcrumbs.length > 1 && (
            <BreadcrumbNav items={breadcrumbs} className="mb-1" />
          )}
          <h1 className="font-display text-lg sm:text-2xl font-extrabold tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block uppercase tracking-widest mt-0.5">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
