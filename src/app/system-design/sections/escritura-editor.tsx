"use client";

import { Heading1, Heading2, List, Quote, StickyNote, Table as TableIcon, Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { SubSection, Specimen, SpecimenGrid, Seeded, ClientOnly, seedQuery } from "../helpers";
import { MOCK_SYSTEM_ID, makePlotGrid, mid } from "../mock-data";
import { EditorProvider, useSharedEditor } from "@/features/pages/EditorContext";
import { EditorThumbBar } from "@/features/pages/EditorThumbBar";
import { WriterStatusBar } from "@/features/pages/WriterStatusBar";
import { SlashMenu, type SlashItem } from "@/features/pages/SlashMenu";
import { BUBBLE, BUBBLE_BUTTON } from "@/features/pages/bubble-styles";
import { LinkedTaskCard } from "@/features/pages/LinkedTaskCard";
import { ChapterStatusToggle } from "@/features/writing/ChapterStatusToggle";
import { WritingSessionButton } from "@/features/writing/WritingSessionButton";
import { PlotSceneList } from "@/features/writing/PlotSceneList";
import { ReferenceTable } from "@/features/writing/ReferenceTable";
import { ChapterSummaryPanel } from "@/features/writing/ChapterSummaryPanel";
import { ManuscriptOutline } from "@/features/pages/mediums/ManuscriptOutline";
import { NotebookTagPicker } from "@/features/pages/NotebookTagPicker";
import { LinkedTasksPanel } from "@/features/pages/LinkedTasksPanel";
import { EditorShortcutsHelp } from "@/features/pages/EditorShortcutsHelp";
import type { OutlineItem } from "@/features/pages/mediums/outline";
import type { WritingOverview } from "@/features/writing/writing.types";
import type { LinkedTaskTransport } from "@/features/pages/pages.types";

/**
 * El chrome del editor de escritura (rework 2, Diario). En el teléfono el
 * editor se queda con lo que escribir necesita: la barra del pulgar sobre el
 * teclado, el menú `/`, la barra de estado y el volver de la cabecera. Lo
 * demás vive en el panel, que abre Más.
 */

const PROSA = "<p>La cota del día marcaba 134 y nadie en la casa sabía leerla salvo Inés.</p>";

const SLASH: SlashItem[] = [
  { title: "Título 1", subtitle: "Encabezado grande", icon: Heading1, keywords: [], command: () => {} },
  { title: "Título 2", subtitle: "Encabezado mediano", icon: Heading2, keywords: [], command: () => {} },
  { title: "Lista", subtitle: "Con viñetas", icon: List, keywords: [], command: () => {} },
  { title: "Cita", subtitle: "Un párrafo apartado", icon: Quote, keywords: [], command: () => {} },
  { title: "Tabla", subtitle: "Tres por tres", icon: TableIcon, keywords: [], command: () => {} },
];

const OVERVIEW: WritingOverview = {
  streakDays: 12,
  streakIncludesToday: true,
  wordsToday: 420,
  dailyWordGoal: 500,
  peakWindow: { start: 9, end: 11 },
  currentHour: 10,
  works: [],
};

function BarraDelPulgar({ mention }: { mention: boolean }) {
  const editor = useSharedEditor();
  if (!editor) return null;
  return <EditorThumbBar editor={editor} mention={mention} onNote={() => {}} onMore={() => {}} forceVisible />;
}

const TAREAS: LinkedTaskTransport[] = [
  {
    id: mid("lt1"),
    title: "Releer el capítulo 2 en voz alta",
    status: "today",
    priority: "high",
    taskType: null,
    dueDate: "2026-09-08T12:00:00",
    estimatedTime: 25,
  } as unknown as LinkedTaskTransport,
  {
    id: mid("lt2"),
    title: "Buscar el nombre del perro",
    status: "done",
    priority: "medium",
    taskType: null,
    dueDate: null,
    estimatedTime: null,
  } as unknown as LinkedTaskTransport,
];

const INDICE: OutlineItem[] = [
  { pos: 1, kind: "heading", label: "La subida", depth: 0, preview: null },
  { pos: 40, kind: "scene", label: "Escena 1: La niebla no levantó ese día.", depth: 1, preview: null },
  { pos: 220, kind: "scene", label: "Escena 2: Bruno la encontró en el taller.", depth: 1, preview: null },
  { pos: 410, kind: "heading", label: "El gremio", depth: 0, preview: null },
];

const FICHAS = [
  { id: mid("ref1"), name: "Aurelia Voss", type: "character", coverImageUrl: null },
  { id: mid("ref2"), name: "Puerto Ceniza", type: "location", coverImageUrl: null },
  { id: mid("ref3"), name: "El gremio", type: "faction", coverImageUrl: null },
];

const ETIQUETAS = [
  { id: mid("tag1"), title: "Primer borrador", color: "blue" },
  { id: mid("tag2"), title: "Revisar", color: "orange" },
  { id: mid("tag3"), title: "Voz de Inés", color: "teal" },
];

/** El panel del editor: lo que abre Más, bloque a bloque y con sus datos. */
function PanelDelEditor() {
  return (
    <SpecimenGrid cols={2}>
      <Specimen label="Índice del capítulo" hint="ManuscriptOutline" className="items-stretch">
        <div className="w-full max-w-sm">
          <ManuscriptOutline items={INDICE} heading="Índice del capítulo" onJump={() => {}} />
        </div>
      </Specimen>
      <Specimen label="Mesa de referencias" hint="ReferenceTable, Quitar visible en un dedo" className="items-stretch">
        <div className="w-full max-w-sm">
          <Seeded stubs={[seedQuery(api.entities.bySystem, FICHAS)]}>
            <ReferenceTable
              systemId={MOCK_SYSTEM_ID}
              pinnedIds={[FICHAS[0].id, FICHAS[1].id]}
              onToggle={() => {}}
              canPin
            />
          </Seeded>
        </div>
      </Specimen>
      <Specimen label="Etiquetas" hint="NotebookTagPicker, puesta en tinta" className="items-stretch">
        <div className="w-full max-w-sm">
          <Seeded
            stubs={[seedQuery(api.tags.bySystem, ETIQUETAS), seedQuery(api.pages.tags, [ETIQUETAS[1]])]}
          >
            <NotebookTagPicker pageId={mid("p")} systemId={MOCK_SYSTEM_ID} />
          </Seeded>
        </div>
      </Specimen>
      <Specimen label="Resumen" hint="ChapterSummaryPanel, antes de pedirlo" className="items-stretch">
        <div className="w-full max-w-sm">
          <Seeded stubs={[]}>
            <ChapterSummaryPanel pageId={mid("p")} />
          </Seeded>
        </div>
      </Specimen>
      <Specimen label="Tareas del capítulo" hint="LinkedTasksPanel" className="items-stretch">
        <div className="w-full max-w-sm">
          <Seeded stubs={[seedQuery(api.pages.linkedTasks, TAREAS), seedQuery(api.tasks.bySystem, TAREAS)]}>
            <LinkedTasksPanel pageId={mid("p")} systemId={MOCK_SYSTEM_ID} />
          </Seeded>
        </div>
      </Specimen>
      <Specimen label="Atajos" hint="EditorShortcutsHelp" className="items-stretch">
        <div className="w-full max-w-sm">
          <EditorShortcutsHelp />
        </div>
      </Specimen>
    </SpecimenGrid>
  );
}

export function EscrituraEditorSubsections() {
  return (
    <>
      <SubSection
        title="Barra del pulgar"
        description="El formato pegado encima del teclado del teléfono, a 48 px cada botón. Sólo existe con el teclado abierto y el cursor en el texto; lo activo va en tinta. En una obra, la mención del codex ocupa el sitio de la lista."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Documento" hint="EditorThumbBar">
            <ClientOnly>
              <div className="w-[393px] max-w-full">
                <EditorProvider initialContent={PROSA}>
                  <BarraDelPulgar mention={false} />
                </EditorProvider>
              </div>
            </ClientOnly>
          </Specimen>
          <Specimen label="Obra con codex" hint="mention">
            <ClientOnly>
              <div className="w-[393px] max-w-full">
                <EditorProvider initialContent={PROSA}>
                  <BarraDelPulgar mention />
                </EditorProvider>
              </div>
            </ClientOnly>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Menús del editor"
        description="El menú `/` y el de la selección, arriba de lo marcado porque abajo está el teclado. Superficie de radio 1.125rem con la sombra de la casa; cada fila mide 48 px en un dedo."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="Menú de bloques" hint="SlashMenu">
            <SlashMenu items={SLASH} command={() => {}} />
          </Specimen>
          <Specimen label="Selección" hint="BubbleMenu: Nota y codex">
            <div className={BUBBLE}>
              <button type="button" className={BUBBLE_BUTTON}>
                <StickyNote className="size-4" />
                Nota
              </button>
              <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
              <span className="px-1 text-xs font-semibold text-muted-foreground">Codex</span>
            </div>
          </Specimen>
          <Specimen label="Tabla" hint="TableMenus, palabras y no signos">
            <div className={BUBBLE}>
              <button type="button" className={BUBBLE_BUTTON}>Añadir fila</button>
              <button type="button" className={BUBBLE_BUTTON}>Quitar fila</button>
              <button type="button" className={BUBBLE_BUTTON} aria-label="Borrar la tabla">
                <Trash2 className="size-4" />
              </button>
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Barra de estado del manuscrito"
        description="Palabras del capítulo, progreso de la obra (crece en transform) y racha. Papel con hairline, sin vidrio. Papel y Enfoque son interruptores en tinta."
      >
        <Specimen label="Con obra y meta" hint="WriterStatusBar">
          <ClientOnly>
            <div className="w-full">
              <Seeded stubs={[seedQuery(api.writing.overview, OVERVIEW)]}>
                <EditorProvider initialContent={PROSA}>
                  <WriterStatusBar
                    obra={{ id: mid("obra"), name: "La marea baja", wordGoal: 80000, wordsExcludingCurrent: 24000 }}
                    systemId={MOCK_SYSTEM_ID}
                    paper={false}
                    onTogglePaper={() => {}}
                    onToggleFocus={() => {}}
                  />
                </EditorProvider>
              </Seeded>
            </div>
          </ClientOnly>
        </Specimen>
      </SubSection>

      <SubSection
        title="Acciones del capítulo"
        description="En escritorio, palabras en la barra de arriba; en el teléfono, filas de margen al principio del panel. Terminado es --ok con su palabra; guardando lo dice sin girar nada."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Barra de escritorio" hint="variant barra">
            <div className="flex items-center gap-1">
              <WritingSessionButton pageId={mid("p")} pageTitle="La subida" systemId={MOCK_SYSTEM_ID} />
              <ChapterStatusToggle pageId={mid("p")} systemId={MOCK_SYSTEM_ID} title="La subida" initialCompletedAt={null} />
              <ChapterStatusToggle pageId={mid("p2")} systemId={MOCK_SYSTEM_ID} title="La subida" initialCompletedAt="2026-10-01" />
            </div>
          </Specimen>
          <Specimen label="Filas del panel" hint="variant fila" className="items-stretch">
            <div className="w-full max-w-sm">
              <WritingSessionButton pageId={mid("p")} pageTitle="La subida" systemId={MOCK_SYSTEM_ID} variant="fila" />
              <ChapterStatusToggle
                pageId={mid("p3")}
                systemId={MOCK_SYSTEM_ID}
                title="La subida"
                initialCompletedAt="2026-10-01"
                variant="fila"
              />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Tareas vinculadas"
        description="Filas de margen con el círculo de completar a 48 px. La meta en español separada por comas; el coral sólo con vencida, hecha en --ok."
      >
        <Specimen label="Pendiente y hecha" hint="LinkedTaskCard" className="items-stretch">
          <div className="w-full max-w-md">
            {TAREAS.map((t) => (
              <LinkedTaskCard key={t.id} task={t} onToggle={() => {}} onEdit={() => {}} onUnlink={() => {}} />
            ))}
          </div>
        </Specimen>
      </SubSection>

      <SubSection
        title="Panel del editor"
        description="Lo que abre Más en el teléfono (una hoja de abajo) y el botón del panel en escritorio. Cada bloque es un título con hairline y filas de margen; nada baja de 48 px en un dedo, y lo que en escritorio espera al hover se ve siempre en el teléfono."
      >
        <ClientOnly>
          <PanelDelEditor />
        </ClientOnly>
      </SubSection>

      <SubSection
        title="Tablero en el teléfono"
        description="Cada capítulo con su numeral en el margen y su título en Literata; cada escena una fila con Mover a 48 px, que abre una hoja con nombre."
      >
        <Specimen label="Tres capítulos" hint="PlotSceneList" className="items-stretch">
          <div className="w-[393px] max-w-full">
            <PlotSceneList grid={makePlotGrid()} systemId={MOCK_SYSTEM_ID} busy={false} onApply={() => {}} />
          </div>
        </Specimen>
      </SubSection>
    </>
  );
}
