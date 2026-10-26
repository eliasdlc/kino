"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Folder, History, Layers, Plus } from "lucide-react";
import { useFolderChildren, useFolders, useUpdateFolder } from "@/features/folders/folders.hooks";
import { usePages, useCreatePage } from "@/features/pages/pages.hooks";
import { NewFolderInline } from "@/features/folders/NewFolderInline";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import { MEDIUM_CONFIG, MEDIUM_OPTIONS, resolveMedium, type MediumId } from "@/shared/lib/mediums";
import { capitalize, resolveSystemManifest } from "@/shared/lib/system-manifest";
import type { ArchetypeManifest } from "@/shared/lib/system-types";
import { WritingPulse } from "@/features/writing/WritingPulse";
import { WorkJournalDialog } from "@/features/writing/WorkJournalDialog";
import { useWritingOverview } from "@/features/writing/writing.hooks";
import { CompileMenu } from "@/features/writing/CompileMenu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MarginRow } from "@/components/ui/margin-row";
import { Progress } from "@/components/ui/progress";
import { RowsSkeleton } from "@/components/Skeletons";
import { FolderRow } from "@/features/notebooks/FolderRow";
import { IndexHead } from "@/features/notebooks/IndexHead";
import { NotebookRow } from "@/features/notebooks/NotebookRow";
import { NATIVE_SELECT_CLASS } from "@/features/notebooks/native-select";
import { countNoun, formatCount, joinMeta } from "@/features/notebooks/index-format";
import { cn } from "@/lib/utils";
import type { PageListItemTransport } from "@/features/pages/pages.types";
import type { FolderWithCounts } from "@/features/folders/folders.types";
import type { WorkPulse } from "@/features/writing/writing.types";
import type { SystemViewProps } from "./SystemDetailView";
import { DIAS_DORMIDA, readWordGoal } from "./writing-meta";

const folderRole = SYSTEM_TYPE_CONFIG.writing.folderRole!;
const pageRole = SYSTEM_TYPE_CONFIG.writing.pageRole;


/** La pastilla de una acción con nombre de la obra: Leer, Tablero, Capítulo. */
const CHIP = "gap-1.5 [&_svg]:size-4";

interface ObraProps {
  obra: FolderWithCounts;
  index: number;
  /** Los documentos del sistema por carpeta: la obra toma los suyos y los de sus partes. */
  pagesByFolder: ReadonlyMap<string, PageListItemTransport[]>;
  systemId: string;
  /** El vocabulario del sistema, una vez para todas las filas. */
  manifest: ArchetypeManifest;
  /** Desplegada al llegar: sólo la primera, para no montar todas las obras a la vez. */
  defaultOpen?: boolean;
  /** Pulso derivado de las sesiones reales; null si la obra nunca tuvo una. */
  pulse: WorkPulse | null;
  now?: Date;
}

/**
 * Una obra como fila del índice, plegable: el numeral romano, su medio, sus
 * manuscritos y lo escrito contra la meta. Al desplegarse enseña la barra de
 * la meta, las acciones con nombre (Leer, Tablero, Capítulo, Diario,
 * Compilar), el medio como un select de verdad, sus partes y sus manuscritos
 * numerados.
 */
export function ObraRow({ obra, index, pagesByFolder, systemId, manifest, defaultOpen = false, pulse, now }: ObraProps) {
  // Las partes (subcarpetas) cuentan: una obra cuyos capítulos viven en
  // "Capítulos 1 a 5" no tiene cero manuscritos. Un nivel, que es lo que el
  // índice enseña al desplegarla.
  const { data: partes = [] } = useFolderChildren(obra.id);
  const manuscripts = pagesByFolder.get(obra.id) ?? [];
  const todos = [...manuscripts, ...partes.flatMap((parte) => pagesByFolder.get(parte.id) ?? [])];
  const meta = (obra.metadata ?? {}) as Record<string, unknown>;
  // El medium gobierna la estructura del editor: se normaliza al leer, así las
  // obras con el texto libre de antes ("novela", "guión") siguen funcionando.
  const medium = MEDIUM_CONFIG[resolveMedium(meta)];
  const wordGoal = readWordGoal(meta);
  const totalWords = todos.reduce((sum, p) => sum + p.wordCount, 0);
  // Días sin escribir, contra sesiones reales y no contra `updatedAt`:
  // renombrar un capítulo no debería resucitar una obra parada.
  const stale = pulse?.daysSinceLastSession ?? null;
  const dormida = stale !== null && stale >= DIAS_DORMIDA;

  return (
    <FolderRow
      folder={obra}
      systemId={systemId}
      index={index}
      href={`/systems/${systemId}/folders/${obra.id}`}
      defaultOpen={defaultOpen}
      manifest={manifest}
      meta={
        <>
          {dormida && (
            <>
              <span className="font-semibold text-task-overdue">dormida</span>
              {`, ${stale} días sin sesión, `}
            </>
          )}
          {joinMeta([
            medium.label,
            countNoun(todos.length, pageRole.noun, pageRole.nounPlural),
            wordGoal ? `${formatCount(totalWords)} de ${formatCount(wordGoal)}` : `${formatCount(totalWords)} palabras`,
          ])}
        </>
      }
    >
      <ObraBody
        obra={obra}
        partes={partes}
        manuscripts={manuscripts}
        // Leer, Tablero y Compilar leen los capítulos de la carpeta de la obra,
        // no los de sus partes: sólo se ofrecen si ahí hay algo que leer. La
        // cuenta es la del servidor, que no se corta con el tope de la lista.
        hayTexto={obra.pageCount > 0}
        systemId={systemId}
        manifest={manifest}
        mediumId={medium.id}
        wordGoal={wordGoal}
        totalWords={totalWords}
        now={now}
      />
    </FolderRow>
  );
}

function ObraBody({
  obra,
  partes,
  manuscripts,
  hayTexto,
  systemId,
  manifest,
  mediumId,
  wordGoal,
  totalWords,
  now,
}: {
  obra: FolderWithCounts;
  partes: FolderWithCounts[];
  manuscripts: PageListItemTransport[];
  /** La obra tiene capítulos propios: lo que leen la lectura, el tablero y compilar. */
  hayTexto: boolean;
  systemId: string;
  manifest: ArchetypeManifest;
  mediumId: MediumId;
  wordGoal: number | null;
  totalWords: number;
  now?: Date;
}) {
  const { mutate: createPage, isPending } = useCreatePage(systemId);
  const { mutate: updateFolder } = useUpdateFolder(systemId);
  const [journalOpen, setJournalOpen] = useState(false);
  const meta = (obra.metadata ?? {}) as Record<string, unknown>;
  const medium = MEDIUM_CONFIG[mediumId];
  const unit = medium.unit.noun;
  const pct = wordGoal ? Math.min(100, Math.round((totalWords / wordGoal) * 100)) : null;

  /** Reescribe la metadata con las claves del manifiesto (el legacy `kind` sale). */
  function changeMedium(next: MediumId) {
    const targetDate = typeof meta.targetDate === "string" ? meta.targetDate : null;
    const pinned = Array.isArray(meta.pinnedEntityIds) ? meta.pinnedEntityIds : null;
    updateFolder({
      folderId: obra.id,
      data: {
        metadata: {
          medium: next,
          ...(wordGoal != null ? { wordGoal } : {}),
          ...(targetDate ? { targetDate } : {}),
          ...(pinned ? { pinnedEntityIds: pinned } : {}),
        },
      },
    });
  }

  function addManuscript() {
    createPage({
      folderId: obra.id,
      title: `${capitalize(unit)} ${manuscripts.length + 1}`,
      // Los mediums estructurados nacen con su esqueleto; la prosa, en blanco.
      content: medium.template || undefined,
    });
  }

  return (
    <>
      <div className="space-y-3 py-3 pl-(--margen)">
        {pct !== null && (
          <Progress value={pct} aria-label={`${formatCount(totalWords)} de ${formatCount(wordGoal!)} palabras`} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {hayTexto && (
            <>
              <Button asChild variant="secondary" size="sm" className={CHIP}>
                <Link href={`/systems/${systemId}/folders/${obra.id}/lectura`}>
                  <BookOpen aria-hidden />
                  Leer
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm" className={CHIP}>
                <Link href={`/systems/${systemId}/folders/${obra.id}/tablero`}>
                  <Layers aria-hidden />
                  Tablero
                </Link>
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            className={CHIP}
            disabled={isPending}
            onClick={addManuscript}
            aria-label={medium.unit.newLabel}
          >
            <Plus aria-hidden />
            {isPending ? "Creando" : capitalize(unit)}
          </Button>
          <Button variant="secondary" size="sm" className={CHIP} onClick={() => setJournalOpen(true)}>
            <History aria-hidden />
            Diario
          </Button>
          {hayTexto && <CompileMenu folderId={obra.id} systemId={systemId} />}
          <label className="sr-only" htmlFor={`medio-${obra.id}`}>
            Medio de la obra
          </label>
          <select
            id={`medio-${obra.id}`}
            value={mediumId}
            onChange={(e) => changeMedium(e.target.value as MediumId)}
            className={cn(NATIVE_SELECT_CLASS, "w-auto text-sm font-semibold md:pointer-fine:h-10")}
          >
            {MEDIUM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {partes.map((parte) => (
        <MarginRow
          key={parte.id}
          href={`/systems/${systemId}/folders/${parte.id}`}
          margin={<Folder className="mt-[0.45rem] size-5" aria-hidden />}
        >
          <span className="block truncate text-foreground">{parte.name}</span>
          <span className="block text-sm text-muted-foreground">
            {countNoun(parte.pageCount, pageRole.noun, pageRole.nounPlural)}
          </span>
        </MarginRow>
      ))}
      {manuscripts.map((m, i) => (
        <NotebookRow
          key={m.id}
          page={m}
          systemId={systemId}
          index={i + 1}
          href={`/systems/${systemId}/pages/${m.id}`}
          now={now}
          manifest={manifest}
        />
      ))}

      <WorkJournalDialog folderId={obra.id} folderName={obra.name} open={journalOpen} onOpenChange={setJournalOpen} />
    </>
  );
}

/**
 * Escritura: la biblioteca de obras como índice. Cada obra es una fila con
 * numeral romano que se despliega en sus acciones, sus partes y sus
 * manuscritos numerados con la cifra de palabras a la derecha. Lo que no tiene
 * obra va aparte, para no perderlo. Las palabras se derivan del contenido,
 * nunca de un contador persistido.
 */
export function SystemWritingView({ system }: SystemViewProps) {
  const { data: obras = [], isLoading: obrasLoading } = useFolders(system.id);
  const { data: pages = [], isLoading: pagesLoading } = usePages(system.id);
  const { data: overview } = useWritingOverview(system.id);
  const manifest = resolveSystemManifest(system);

  const isLoading = obrasLoading || pagesLoading;
  // Manuscritos sueltos (sin obra): se muestran aparte para no perderlos.
  const looseManuscripts = pages.filter((p) => !p.folderId && !p.parentPageId);
  const pulseByFolder = new Map((overview?.works ?? []).map((w) => [w.folderId, w]));
  // Una pasada por los documentos para todas las obras, no una por obra.
  const pagesByFolder = new Map<string, PageListItemTransport[]>();
  for (const page of pages) {
    if (!page.folderId) continue;
    const lista = pagesByFolder.get(page.folderId);
    if (lista) lista.push(page);
    else pagesByFolder.set(page.folderId, [page]);
  }

  const nuevaObra = (
    <NewFolderInline
      systemId={system.id}
      label={folderRole.newLabel}
      placeholder={folderRole.placeholder}
      fields={folderRole.fields}
    />
  );

  return (
    <div className="space-y-7">
      <section aria-labelledby={`${system.id}-obras`}>
        <IndexHead id={`${system.id}-obras`} title={capitalize(folderRole.nounPlural)} trailing={nuevaObra} />
        {isLoading ? (
          <div role="status" aria-busy aria-label="Cargando las obras">
            <RowsSkeleton rows={4} margin="numeral" />
          </div>
        ) : obras.length === 0 ? (
          <EmptyState
            className="pl-(--margen)"
            title="Todavía no tienes obras"
            description="Un libro, un blog, un cómic: crea la primera y ponle una meta de palabras."
          />
        ) : (
          <div>
            {obras.map((obra, i) => (
              <ObraRow
                key={obra.id}
                obra={obra}
                index={i + 1}
                pagesByFolder={pagesByFolder}
                systemId={system.id}
                manifest={manifest}
                defaultOpen={i === 0}
                pulse={pulseByFolder.get(obra.id) ?? null}
              />
            ))}
          </div>
        )}
      </section>

      {!isLoading && looseManuscripts.length > 0 && (
        <section aria-labelledby={`${system.id}-sin-obra`}>
          <IndexHead
            id={`${system.id}-sin-obra`}
            title="Sin obra"
            trailing={countNoun(looseManuscripts.length, pageRole.noun, pageRole.nounPlural)}
          />
          <div>
            {looseManuscripts.map((m, i) => (
              <NotebookRow
                key={m.id}
                page={m}
                systemId={system.id}
                index={i + 1}
                href={`/systems/${system.id}/pages/${m.id}`}
                manifest={manifest}
              />
            ))}
          </div>
        </section>
      )}

      {/* La ventana creativa, la racha y la meta del día: contexto de la
          biblioteca, debajo de ella y no delante. */}
      <WritingPulse systemId={system.id} />
    </div>
  );
}
