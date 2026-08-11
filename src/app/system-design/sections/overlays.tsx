"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  Zap,
  Calendar,
  Search,
  FileText,
  Layers,
  ListChecks,
} from "lucide-react";
import { SearchSnippet } from "@/features/search/SearchSnippet";
import {
  SNIPPET_CLOSE,
  SNIPPET_OPEN,
} from "@/features/search/search.types";

/**
 * Tal cual sale de `ts_headline`: la coincidencia va marcada con caracteres de
 * control, no con HTML. Se monta desde las constantes para que el specimen no
 * se desincronice si cambian.
 */
const SNIPPET_TAREA = `Repasar la ${SNIPPET_OPEN}canción${SNIPPET_CLOSE} del final`;
const SNIPPET_PAGINA = `Ana estaba escribiendo una ${SNIPPET_OPEN}canción${SNIPPET_CLOSE} sobre el mar`;

export function OverlaysSection() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Section
      id="overlays"
      number="07"
      title="Overlays"
      description="Diálogos, drawers, menús y toasts. Regla mobile: ResponsiveDialog decide Dialog (desktop) o Drawer (móvil) — es el patrón por defecto para formularios (project-mobile)."
    >
      <SubSection title="Diálogos">
        <SpecimenGrid cols={4}>
          <Specimen label="Dialog" hint="modal centrado, desktop">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Abrir dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar sistema</DialogTitle>
                  <DialogDescription>
                    Estructura estándar: título, descripción, cuerpo y footer.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="ds-dialog-name">Nombre</Label>
                  <Input id="ds-dialog-name" defaultValue="Universidad" />
                </div>
                <DialogFooter>
                  <Button variant="outline">Cancelar</Button>
                  <Button>Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Specimen>

          <Specimen label="ConfirmDialog" hint="confirmación destructiva estándar">
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              Eliminar…
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              title="¿Eliminar sistema?"
              description="Se moverá a la papelera junto con sus tareas."
              onConfirm={() => setConfirmOpen(false)}
              onCancel={() => setConfirmOpen(false)}
            />
          </Specimen>

          <Specimen label="ResponsiveDialog" hint="Dialog ≥md · Drawer en móvil">
            <ResponsiveDialog>
              <ResponsiveDialogTrigger asChild>
                <Button variant="outline">Abrir responsive</Button>
              </ResponsiveDialogTrigger>
              <ResponsiveDialogContent>
                <ResponsiveDialogHeader>
                  <ResponsiveDialogTitle>Nueva tarea</ResponsiveDialogTitle>
                  <ResponsiveDialogDescription>
                    Redimensiona la ventana bajo 768px para verlo como drawer.
                  </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>
                <div className="space-y-2 p-4 md:p-0">
                  <Label htmlFor="ds-resp-title">Título</Label>
                  <Input id="ds-resp-title" placeholder="Preparar entrega…" />
                </div>
              </ResponsiveDialogContent>
            </ResponsiveDialog>
          </Specimen>

          <Specimen label="Drawer" hint="bottom sheet móvil (vaul)">
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="outline">Abrir drawer</Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Detalle rápido</DrawerTitle>
                  <DrawerDescription>Desliza hacia abajo para cerrar.</DrawerDescription>
                </DrawerHeader>
                <div className="p-4 pt-0 text-sm text-muted-foreground">
                  Contenido del drawer.
                </div>
              </DrawerContent>
            </Drawer>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Sheet" description="Panel lateral (detalle de tarea usa side=right).">
        <SpecimenGrid cols={2}>
          <Specimen label="Right" hint="TaskDetailSheet">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Panel derecho</Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Detalle de tarea</SheetTitle>
                  <SheetDescription>Metadatos, subtareas, recordatorios.</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          </Specimen>
          <Specimen label="Left">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Panel izquierdo</Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Navegación</SheetTitle>
                  <SheetDescription>Variante lateral izquierda.</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Menús y popovers">
        <SpecimenGrid cols={4}>
          <Specimen label="DropdownMenu" hint="menú de opciones (cards, listas)">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Opciones</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem className="gap-2">
                  <Eye className="size-4" /> Ver
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Pencil className="size-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="size-4" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Specimen>

          <Specimen label="ContextMenu" hint="clic derecho sobre el área">
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  Clic derecho aquí
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-40">
                <ContextMenuItem className="gap-2">
                  <Eye className="size-4" /> Ver
                </ContextMenuItem>
                <ContextMenuItem className="gap-2">
                  <Pencil className="size-4" /> Editar
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" className="gap-2">
                  <Trash2 className="size-4" /> Eliminar
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </Specimen>

          <Specimen label="Popover" hint="contenido libre anclado">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Abrir popover</Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <p className="text-sm font-medium">Programar</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aquí viven pickers de fecha, filtros, etc.
                </p>
              </PopoverContent>
            </Popover>
          </Specimen>

          <Specimen label="Tooltip" hint="hover / focus">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Energía">
                  <Zap />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Nivel de energía</TooltipContent>
            </Tooltip>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Command"
        description="La base del command palette global (⌘K). Aquí embebido; en la app vive en un CommandDialog."
      >
        <div className="max-w-md rounded-lg border border-border">
          <Command>
            <CommandInput placeholder="Buscar o saltar a…" />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup heading="Acciones">
                <CommandItem>
                  <Plus className="size-4" /> Nueva tarea
                  <CommandShortcut>Q</CommandShortcut>
                </CommandItem>
                <CommandItem>
                  <Search className="size-4" /> Buscar en páginas
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Ir a">
                <CommandItem>
                  <Zap className="size-4" /> Dashboard
                  <CommandShortcut>G D</CommandShortcut>
                </CommandItem>
                <CommandItem>
                  <Calendar className="size-4" /> Calendario
                  <CommandShortcut>G C</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </SubSection>

      <SubSection
        title="Command · resultados de búsqueda (KIN-92)"
        description="Cuando hay término, el palette muestra resultados del servidor ordenados por relevancia. Los de tarea y página traen debajo el fragmento donde apareció el término, con la coincidencia resaltada — sin él, un resultado que casó por el cuerpo no explica por qué salió. Los sistemas no llevan fragmento: sólo tienen nombre."
      >
        <div className="max-w-md rounded-lg border border-border">
          <Command shouldFilter={false}>
            <CommandInput placeholder="cancion" />
            <CommandList>
              <CommandGroup heading="Tareas">
                <CommandItem>
                  <ListChecks className="mr-2 size-4 shrink-0 self-start text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">Revisar el capítulo</span>
                    <SearchSnippet snippet={SNIPPET_TAREA} />
                  </span>
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Páginas">
                <CommandItem>
                  <FileText className="mr-2 size-4 shrink-0 self-start text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">Canción de cuna</span>
                  </span>
                </CommandItem>
                <CommandItem>
                  <FileText className="mr-2 size-4 shrink-0 self-start text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">Capítulo tres</span>
                    <SearchSnippet snippet={SNIPPET_PAGINA} />
                  </span>
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Sistemas">
                <CommandItem>
                  <Layers className="mr-2 size-4 shrink-0 self-start text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">Novela</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </SubSection>

      <SubSection
        title="Toasts (sonner)"
        description="Toaster global con richColors, posición bottom-right (layout raíz)."
      >
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => toast("Tarea creada")}>
            Default
          </Button>
          <Button variant="outline" onClick={() => toast.success("Tarea completada")}>
            Success
          </Button>
          <Button variant="outline" onClick={() => toast.error("No se pudo guardar")}>
            Error
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast("Tarea archivada", {
                action: { label: "Deshacer", onClick: () => {} },
              })
            }
          >
            Con acción
          </Button>
        </div>
      </SubSection>
    </Section>
  );
}
