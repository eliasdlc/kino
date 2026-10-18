"use client";

import { useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { MarginRow } from "@/components/ui/margin-row";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface RowAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Lo irreversible va al final, separado y en carmesí. */
  destructive?: boolean;
}

interface RowActionsProps {
  /** De qué son las acciones: el nombre de la fila. Titula la hoja y el botón. */
  subject: string;
  actions: RowAction[];
  /** Escritorio con ratón: el botón sólo se ve al pasar por la fila (`group`). */
  revealOnHover?: boolean;
  className?: string;
}

/**
 * Las operaciones de una fila de índice, con su nombre. En escritorio es el
 * menú de siempre; en el teléfono, una hoja inferior con una fila de 48 px por
 * operación, porque un menú de escritorio flotando sobre el pulgar es el
 * control más pequeño de la pantalla. El botón mide 2.85rem en touch y se
 * achica sólo con un puntero fino.
 */
export function RowActions({ subject, actions, revealOnHover = true, className }: RowActionsProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const normales = actions.filter((a) => !a.destructive);
  const irreversibles = actions.filter((a) => a.destructive);
  const triggerClass = cn(
    "relative z-(--z-raised) text-muted-foreground md:pointer-fine:size-9",
    revealOnHover &&
      "md:pointer-fine:opacity-0 md:pointer-fine:transition-opacity md:pointer-fine:group-hover:opacity-100 md:pointer-fine:focus-visible:opacity-100 md:pointer-fine:data-[state=open]:opacity-100",
    className,
  );
  const etiqueta = `Opciones de ${subject}`;

  if (isMobile) {
    return (
      <>
        <Button variant="ghost" size="icon" aria-label={etiqueta} className={triggerClass} onClick={() => setOpen(true)}>
          <MoreHorizontal className="size-5" />
        </Button>
        <ResponsiveDialog open={open} onOpenChange={setOpen}>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle className="truncate">{subject}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="sr-only">Lo que puedes hacer con esta fila</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <div role="group" aria-label={etiqueta}>
              {[...normales, ...irreversibles].map((action) => (
                <MarginRow
                  key={action.label}
                  margin={<action.icon className="size-5" aria-hidden />}
                  onClick={() => {
                    setOpen(false);
                    action.onSelect();
                  }}
                  // Una operación es una línea: el glifo se centra con su etiqueta
                  // en vez de anclarse arriba como en una fila de dos niveles.
                  className={cn(
                    "font-semibold [&_[data-slot=margin-row-margin]]:self-center [&_[data-slot=margin-row-margin]]:pt-0",
                    action.destructive && "text-destructive [&_[data-slot=margin-row-margin]]:text-destructive",
                  )}
                >
                  {action.label}
                </MarginRow>
              ))}
            </div>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={etiqueta} className={triggerClass}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {normales.map((action) => (
          <DropdownMenuItem key={action.label} onSelect={action.onSelect}>
            <action.icon aria-hidden />
            {action.label}
          </DropdownMenuItem>
        ))}
        {normales.length > 0 && irreversibles.length > 0 && <DropdownMenuSeparator />}
        {irreversibles.map((action) => (
          <DropdownMenuItem key={action.label} variant="destructive" onSelect={action.onSelect}>
            <action.icon aria-hidden />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
