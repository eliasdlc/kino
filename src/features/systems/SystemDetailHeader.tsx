"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Download, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeleteSystem } from "./systems.hooks";
import { EditSystemDialog } from "./EditSystemDialog";
import { SystemRadiografia } from "./SystemRadiografia";
import type { SystemTransport } from "./systems.types";
import { type SystemSignals, formatStaleAdvisor } from "./systems.signals";
import { capitalize, resolveSystemManifest } from "@/shared/lib/system-manifest";
import { cn } from "@/lib/utils";
import { CyclePicker } from "@/features/academic/CyclePicker";
import { RowActions, type RowAction } from "@/features/notebooks/RowActions";
import { joinMeta } from "@/features/notebooks/index-format";
import { useFolders } from "@/features/folders/folders.hooks";
import { usePages } from "@/features/pages/pages.hooks";
import { useWritingOverview } from "@/features/writing/writing.hooks";
import { surfaceOf, systemSurfaces, type Surface } from "./system-surfaces";
import { ICON_MAP } from "./system-icons";
import { systemTileStyle } from "./system-tint";
import { signalReadings, writingReadings, type Reading } from "./system-readings";
import { DIAS_DORMIDA, readWordGoal } from "./views/writing-meta";
import type { AcademicPeriod } from "@/features/academic/academic.hooks";

interface SystemDetailHeaderProps {
  system: SystemTransport;
  signals: SystemSignals;
  /** La superficie con la que abre el sistema cuando la URL no dice otra. */
  landing?: Surface;
  /** Los ciclos que ya trajo el servidor, para que el selector no parpadee. */
  initialPeriods?: AcademicPeriod[];
}

/** Los valores del enum, en español y en minúscula: van en el eyebrow. */
const ENERGY_LABEL: Record<string, string> = { high: "energía alta", medium: "energía media", low: "energía baja" };
// «cada día» y no «diario»: en una obra, Diario es la bitácora de trabajo.
const FREQUENCY_LABEL: Record<string, string> = { daily: "cada día", weekly: "cada semana", monthly: "cada mes" };

/** La pestaña-palabra que es un enlace a otra pantalla (Estudio, Codex), con la forma de las de superficie. */
const WORD_LINK =
  "inline-flex h-[2.85rem] items-center px-1 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) hover:text-foreground focus-ring";

/** Un disclosure de la cabecera: una palabra con su chevron, 48 px en touch. */
export const DISCLOSURE =
  "inline-flex min-h-[2.85rem] items-center gap-1.5 rounded-full text-sm font-semibold text-muted-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) hover:text-foreground focus-ring md:pointer-fine:min-h-9";

/** Cambia de superficie sin renderizar la ruta en el servidor. */
function chooseSurface(tab: Surface) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("tab") === tab) return;
  url.searchParams.set("tab", tab);
  window.history.pushState(null, "", `${url.pathname}${url.search}`);
}

async function exportJson(system: SystemTransport) {
  const res = await fetch(`/api/systems/${system.id}/export`);
  if (!res.ok) return;
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(system.name ?? "sistema").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Las lecturas de un sistema de escritura salen de sus obras y sus sesiones, no de las tareas. */
function WritingReadings({ systemId, signals }: { systemId: string; signals: SystemSignals }) {
  const { data: overview } = useWritingOverview(systemId);
  const { data: obras = [] } = useFolders(systemId);
  // `usePages` lee hasta su tope: si paró ahí, la suma es un mínimo.
  const { data: pages = [], restantes } = usePages(systemId);
  if (!overview) return <Readings readings={null} lineas={2} />;
  const metas = obras.map((o) => readWordGoal((o.metadata ?? {}) as Record<string, unknown>) ?? 0);
  const goal = metas.reduce((a, b) => a + b, 0);
  const sesiones = overview.works.map((w) => w.daysSinceLastSession).filter((d): d is number => d !== null);
  return (
    <Readings
      readings={writingReadings({
        wordsToday: overview.wordsToday,
        totalWords: pages.reduce((sum, p) => sum + p.wordCount, 0),
        wordGoal: goal > 0 ? goal : null,
        // Sin una sesión registrada, el sistema dormido lo dice con sus días sin actividad.
        daysSinceSession:
          sesiones.length > 0 ? Math.min(...sesiones) : signals.stale ? signals.daysSinceLastActivity : null,
        staleAfter: DIAS_DORMIDA,
        parcial: restantes > 0,
      })}
    />
  );
}

/**
 * Tres cifras en Bricolage, cada una con su palabra debajo. Mientras llegan,
 * su forma con la tipografía real: la cifra en su alto de línea y la palabra
 * en `lineas` renglones (las de escritura, como «días dormido», parten en dos
 * en el teléfono).
 */
export function Readings({ readings, lineas = 1 }: { readings: Reading[] | null; lineas?: 1 | 2 }) {
  if (readings === null) {
    return (
      <div aria-hidden className="grid grid-cols-3 gap-x-4 gap-y-3 pt-1 md:flex md:gap-x-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col">
            <span className="font-display text-[1.6rem] leading-none md:text-[1.76rem]">
              <span className="inline-block h-[0.8em] w-12 rounded-md bg-muted align-middle" />
            </span>
            <span className="pt-1 text-sm leading-tight">
              <span className="block">
                <span className="inline-block h-[0.72em] w-20 max-w-full rounded-md bg-muted align-middle" />
              </span>
              {lineas === 2 && (
                <span className="block md:hidden">
                  <span className="inline-block h-[0.72em] w-12 rounded-md bg-muted align-middle" />
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-3 pt-1 md:flex md:gap-x-10">
      {readings.map((r) => (
        <div key={r.label} className="flex flex-col-reverse justify-end">
          <dt className="pt-1 text-sm leading-tight text-muted-foreground">{r.label}</dt>
          <dd
            className={cn(
              "font-display text-[1.6rem] leading-none font-bold tracking-[-0.02em] whitespace-nowrap tabular-nums md:text-[1.76rem]",
              r.tone === "warn" ? "text-task-overdue" : "text-foreground",
            )}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * La cabecera de un sistema, de Diario: el icono del arquetipo en un tile
 * teñido con el color del sistema, en el margen; el eyebrow con tipo, energía
 * y frecuencia; el nombre en Bricolage; la intención en Literata cursiva; tres
 * lecturas en cifras, y debajo las pestañas-palabra. Las acciones van en una
 * hoja con nombre en el teléfono.
 */
export function SystemDetailHeader({ system, signals, landing = "tasks", initialPeriods }: SystemDetailHeaderProps) {
  const currentTab = surfaceOf(useSearchParams().get("tab"), landing);
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const { mutate: deleteSystem } = useDeleteSystem();

  const manifest = resolveSystemManifest(system);
  const Icon = ICON_MAP[system.icon ?? ""] ?? manifest.icon;
  const writing = system.templateType === "writing";
  const readings = writing ? null : signalReadings(signals);
  // El aviso de dormido sólo cuando ninguna cifra lo dice ya: en escritura lo
  // dicen la tercera lectura y la fila de cada obra.
  const staleAdvisor =
    !system.isInbox && !writing && !readings?.some((r) => r.tone === "warn") ? formatStaleAdvisor(system, signals) : null;

  const eyebrow = system.isInbox
    ? "Bandeja"
    : joinMeta([
        manifest.label,
        system.energyIdeal && (ENERGY_LABEL[system.energyIdeal] ?? system.energyIdeal),
        system.expectedFrequency && (FREQUENCY_LABEL[system.expectedFrequency] ?? system.expectedFrequency),
        !system.isActive && "inactivo",
      ]);

  const actions: RowAction[] = [
    ...(!system.isInbox ? [{ label: "Editar sistema", icon: Pencil, onSelect: () => setEditOpen(true) }] : []),
    { label: "Exportar JSON", icon: Download, onSelect: () => void exportJson(system) },
    ...(!system.isInbox
      ? [{ label: "Eliminar sistema", icon: Trash2, destructive: true, onSelect: () => setConfirmDelete(true) }]
      : []),
  ];

  const surfaces = systemSurfaces(landing).map((tab) => ({
    tab,
    label: tab === "tasks" ? "Tareas" : capitalize(manifest.pageRole.nounPlural),
  }));

  return (
    <div className="w-full space-y-5">
      <header className="grid grid-cols-[var(--margen)_1fr_auto] gap-y-3">
        <span className="flex justify-start self-start pt-1">
          <span
            aria-hidden
            data-slot="system-tile"
            className="flex size-[2.4rem] items-center justify-center rounded-xl"
            style={systemTileStyle(system.color)}
          >
            <Icon className="size-5" strokeWidth={1.8} />
          </span>
        </span>

        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{eyebrow}</p>
          <h1 className="font-display text-[1.9rem] leading-[1.08] font-bold tracking-[-0.025em] text-balance wrap-anywhere">
            {system.name}
          </h1>
          {system.identityStatement && (
            <p className="font-voice text-[1.06rem] leading-normal text-body italic">{system.identityStatement}</p>
          )}
        </div>

        <div className="self-start pl-2">
          <RowActions subject={system.name} actions={actions} revealOnHover={false} />
        </div>

        <div className="col-start-2 col-end-4 min-w-0 space-y-3">
          {writing ? <WritingReadings systemId={system.id} signals={signals} /> : <Readings readings={readings} />}

          {staleAdvisor && (
            <p className="text-sm text-body">
              <span className="font-semibold text-task-overdue">dormido</span>
              {`. ${staleAdvisor}`}
            </p>
          )}

          {system.templateType === "academic" && <CyclePicker system={system} initialPeriods={initialPeriods} />}

          <div className="flex flex-wrap gap-x-5">
            {system.triggerContext && (
              <button
                type="button"
                onClick={() => setTriggerOpen((v) => !v)}
                aria-expanded={triggerOpen}
                className={DISCLOSURE}
              >
                <ChevronDown
                  aria-hidden
                  className={cn("size-4 transition-transform duration-(--dur-toque)", triggerOpen && "rotate-180")}
                />
                Cuándo empiezo
              </button>
            )}
            <SystemRadiografia systemId={system.id} />
          </div>
          {triggerOpen && system.triggerContext && (
            <p className="text-sm leading-relaxed text-body">{system.triggerContext}</p>
          )}
        </div>
      </header>

      {/* Las pestañas-palabra: la elegida en tinta con su subrayado. Cambian
          de superficie con `pushState`, sin pedirle la página al servidor;
          Estudio y Codex son pantallas, así que son enlaces. */}
      <Tabs value={currentTab} onValueChange={(v) => chooseSurface(v as Surface)}>
        <div className="flex items-end gap-x-5 overflow-x-auto border-b border-border">
          <TabsList variant="line" aria-label="Contenido del sistema" className="w-auto gap-5 border-b-0">
            {surfaces.map(({ tab, label }) => (
              <TabsTrigger key={tab} value={tab}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {writing && (
            <>
              <Link href={`/systems/${system.id}/estudio`} className={WORD_LINK}>
                Estudio
              </Link>
              <Link href={`/systems/${system.id}/codex`} className={WORD_LINK}>
                Codex
              </Link>
            </>
          )}
        </div>
      </Tabs>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar sistema"
        description={`"${system.name}" y todo su contenido se eliminarán permanentemente. Esta acción no se puede deshacer.`}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteSystem(system.id, { onSuccess: () => router.push("/systems") });
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <EditSystemDialog system={system} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
