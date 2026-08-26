"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  SYSTEM_TAB_LABELS,
  SYSTEM_TYPE_CONFIG,
  type SystemComposition,
  type SystemTabId,
} from "@/shared/lib/system-types";
import {
  composeManifest,
  kindIdFromLabel,
  pluralize,
  resolveSystemManifest,
} from "@/shared/lib/system-manifest";
import { containersEmptyCopy, pagesEmptyCopy } from "@/shared/lib/archetype-copy";
import { useUpdateSystem } from "./systems.hooks";
import type { SystemTransport } from "./systems.types";

const ALL_TABS = SYSTEM_TYPE_CONFIG.custom.tabs;
const MAX_KINDS = 8;

interface ComposeSystemDialogProps {
  system: SystemTransport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Composición de un sistema `custom` (D16). El resto de arquetipos llega con
 * opinión; este llega con un formulario: cómo se llaman tus contenedores, qué
 * clases de tarea existen, si tus páginas mandan y qué tabs montas.
 *
 * El preview de abajo no es decorativo: enseña el estado vacío real que va a
 * ver el usuario, que es donde el vocabulario se nota.
 */
export function ComposeSystemDialog({ system, open, onOpenChange }: ComposeSystemDialogProps) {
  const { mutate: updateSystem, isPending } = useUpdateSystem();
  const manifest = resolveSystemManifest(system);
  const saved = system.metadata?.composition;

  const [containersOn, setContainersOn] = useState(manifest.folderRole !== null);
  const [containerNoun, setContainerNoun] = useState(manifest.folderRole?.noun ?? "carpeta");
  const [containerPlural, setContainerPlural] = useState(
    manifest.folderRole?.nounPlural ?? "carpetas",
  );
  const [pageNoun, setPageNoun] = useState(manifest.pageRole.noun);
  const [pagePlural, setPagePlural] = useState(manifest.pageRole.nounPlural);
  const [pagesPrimary, setPagesPrimary] = useState(manifest.pageRole.primary);
  const [kinds, setKinds] = useState<{ id: string; label: string }[]>(saved?.taskKinds ?? []);
  const [newKind, setNewKind] = useState("");
  const [tabs, setTabs] = useState<SystemTabId[]>(manifest.tabs);
  const [defaultTab, setDefaultTab] = useState<SystemTabId>(manifest.defaultTab);

  const composition: SystemComposition = {
    containers: {
      enabled: containersOn,
      noun: containerNoun.trim() || "carpeta",
      nounPlural: containerPlural.trim() || pluralize(containerNoun) || "carpetas",
    },
    pages: {
      noun: pageNoun.trim() || "página",
      nounPlural: pagePlural.trim() || pluralize(pageNoun) || "páginas",
      primary: pagesPrimary,
    },
    taskKinds: kinds,
  };

  const preview = composeManifest(SYSTEM_TYPE_CONFIG.custom, composition);
  const containersPreview = containersEmptyCopy(preview);
  const pagesPreview = pagesEmptyCopy(preview);

  function addKind() {
    const label = newKind.trim();
    if (!label || kinds.length >= MAX_KINDS) return;
    const id = kindIdFromLabel(label);
    if (kinds.some((k) => k.id === id)) {
      setNewKind("");
      return;
    }
    setKinds([...kinds, { id, label }]);
    setNewKind("");
  }

  function toggleTab(tab: SystemTabId) {
    const isOn = tabs.includes(tab);
    // Nunca dejar el sistema sin tabs.
    if (isOn && tabs.length === 1) return;
    const next = isOn
      ? ALL_TABS.filter((t) => t !== tab && tabs.includes(t))
      : ALL_TABS.filter((t) => t === tab || tabs.includes(t));
    setTabs(next);
    if (!next.includes(defaultTab)) setDefaultTab(next[0]);
  }

  function handleSave() {
    updateSystem(
      { systemId: system.id, data: { metadata: { tabs, defaultTab, composition } } },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Componer sistema</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Este arquetipo no trae vocabulario propio: el tuyo lo pones tú.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-6">
          {/* Contenedores */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="compose-containers">Contenedores</Label>
                <p className="text-xs text-muted-foreground">
                  Cómo agrupas el trabajo dentro del sistema.
                </p>
              </div>
              <Switch
                id="compose-containers"
                checked={containersOn}
                onCheckedChange={setContainersOn}
              />
            </div>
            {containersOn && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="compose-container-noun" className="text-xs font-normal text-muted-foreground">
                    Singular
                  </Label>
                  <Input
                    id="compose-container-noun"
                    value={containerNoun}
                    maxLength={24}
                    placeholder="carpeta"
                    onChange={(e) => {
                      const value = e.target.value;
                      // El plural sigue al singular mientras el usuario no lo edite
                      // a mano: escribir dos veces la misma palabra es fricción.
                      if (containerPlural === pluralize(containerNoun)) {
                        setContainerPlural(pluralize(value));
                      }
                      setContainerNoun(value);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="compose-container-plural" className="text-xs font-normal text-muted-foreground">
                    Plural
                  </Label>
                  <Input
                    id="compose-container-plural"
                    value={containerPlural}
                    maxLength={24}
                    placeholder="carpetas"
                    onChange={(e) => setContainerPlural(e.target.value)}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Páginas */}
          <section className="space-y-3 pt-4 border-t border-border">
            <div>
              <Label>Páginas</Label>
              <p className="text-xs text-muted-foreground">
                Cómo llamas a lo que escribes aquí.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="compose-page-noun" className="text-xs font-normal text-muted-foreground">
                  Singular
                </Label>
                <Input
                  id="compose-page-noun"
                  value={pageNoun}
                  maxLength={24}
                  placeholder="página"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (pagePlural === pluralize(pageNoun)) setPagePlural(pluralize(value));
                    setPageNoun(value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="compose-page-plural" className="text-xs font-normal text-muted-foreground">
                  Plural
                </Label>
                <Input
                  id="compose-page-plural"
                  value={pagePlural}
                  maxLength={24}
                  placeholder="páginas"
                  onChange={(e) => setPagePlural(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="compose-pages-primary" className="text-xs font-normal text-muted-foreground">
                Abrir el sistema en {pagePlural.trim() || "las páginas"} en vez de las tareas
              </Label>
              <Switch
                id="compose-pages-primary"
                checked={pagesPrimary}
                onCheckedChange={setPagesPrimary}
              />
            </div>
          </section>

          {/* Clases de tarea */}
          <section className="space-y-3 pt-4 border-t border-border">
            <div>
              <Label>Clases de tarea</Label>
              <p className="text-xs text-muted-foreground">
                Qué &ldquo;es&rdquo; una tarea aquí. Opcional: sin ninguna, las tareas son tareas.
              </p>
            </div>
            {kinds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {kinds.map((kind) => (
                  <span
                    key={kind.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs"
                  >
                    {kind.label}
                    <button
                      type="button"
                      aria-label={`Quitar ${kind.label}`}
                      onClick={() => setKinds(kinds.filter((k) => k.id !== kind.id))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newKind}
                maxLength={32}
                placeholder={kinds.length >= MAX_KINDS ? "Máximo alcanzado" : "Ej. Llamada"}
                disabled={kinds.length >= MAX_KINDS}
                onChange={(e) => setNewKind(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKind();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Añadir clase de tarea"
                onClick={addKind}
                disabled={!newKind.trim() || kinds.length >= MAX_KINDS}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            {kinds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Quitar una clase no toca las tareas que ya la usan; deja de ofrecerse al crear.
              </p>
            )}
          </section>

          {/* Tabs */}
          <section className="space-y-3 pt-4 border-t border-border">
            <div>
              <Label>Tabs visibles</Label>
              <p className="text-xs text-muted-foreground">
                El funnel completo o solo el tramo que usas. El marcado abre por defecto.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_TABS.map((tab) => {
                const on = tabs.includes(tab);
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => toggleTab(tab)}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      on
                        ? "border-foreground/30 bg-muted text-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground/50"
                    }`}
                  >
                    {SYSTEM_TAB_LABELS[tab]}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Abre en:</span>
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDefaultTab(tab)}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    defaultTab === tab
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {SYSTEM_TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          </section>

          {/* Preview del vocabulario */}
          <section className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Así se va a leer
            </p>
            {containersPreview && (
              <p className="text-sm">
                <span className="font-medium">{containersPreview.title}.</span>{" "}
                <span className="text-muted-foreground">{containersPreview.hint}</span>
              </p>
            )}
            <p className="text-sm">
              <span className="font-medium">{pagesPreview.title}.</span>{" "}
              <span className="text-muted-foreground">{pagesPreview.hint}</span>
            </p>
          </section>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
            Guardar
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
