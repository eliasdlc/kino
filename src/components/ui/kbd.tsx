import * as React from "react"
import { cn } from "@/lib/utils"

export type KbdProps = React.HTMLAttributes<HTMLElement>;

export const Kbd = React.forwardRef<HTMLElement, KbdProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <kbd
        ref={ref}
        className={cn(
          "pointer-events-none inline-flex h-[1.4rem] select-none items-center gap-1 rounded-md border border-border bg-muted px-1.5 font-mono text-[0.65rem] font-medium text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
      </kbd>
    )
  }
)
Kbd.displayName = "Kbd"
