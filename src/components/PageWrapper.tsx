import { cn } from "@/lib/utils";

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/**
 * Consistent page header with title, optional description, and action buttons.
 * Used at the top of every page inside PageWrapper.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/**
 * Shared layout wrapper for all page content.
 * Ensures consistent padding, max-width, and vertical spacing.
 */
export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <div className={cn("p-6 max-w-5xl mx-auto w-full space-y-6", className)}>
      {children}
    </div>
  );
}
