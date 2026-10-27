"use client";

import { Heading1, Heading2, List, Quote, Table as TableIcon } from "lucide-react";
import { api } from "@convex/_generated/api";
import { SubSection, Specimen, SpecimenGrid, Seeded, ClientOnly, seedQuery } from "../helpers";
import { MOCK_FOLDER_ID, MOCK_SYSTEM_ID, makeLinkedTask, makeManuscript, makePlotGrid, mid } from "../mock-data";
import { EditorProvider, useSharedEditor } from "@/features/pages/EditorContext";
import { EditorThumbBar } from "@/features/pages/EditorThumbBar";
import { WriterStatusBar } from "@/features/pages/WriterStatusBar";
import { SlashMenu, type SlashItem } from "@/features/pages/SlashMenu";
import { SelectionToolbar } from "@/features/pages/SelectionToolbar";
import { TableToolbar } from "@/features/pages/TableMenus";
import { EditorPanelBody } from "@/features/pages/EditorPanel";
import { CompileMenu } from "@/features/writing/CompileMenu";
import { MEDIUM_CONFIG } from "@/shared/lib/mediums";
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
import type { PageDetailTransport } from "@/features/pages/pages.types";

/**
 * El chrome del editor de escritura (rework 2, Diario). En el teléfono el
 * editor se queda con lo que escribir necesita: la barra del pulgar sobre el
 * teclado, el menú `/`, la barra de estado y el volver de la cabecera. Lo
 * demás vive en el panel, que abre la puerta del título («Capítulo»).
 *
 * Los menús flotantes se pintan con sus propios componentes (la barra de la
 * selección, la de la tabla, el cuerpo del panel), no con réplicas: si el
 * componente cambia, el catálogo cambia con él.
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

function BarraDeSeleccion() {
  const editor = useSharedEditor();
  if (!editor) return null;
  return <SelectionToolbar editor={editor} writer systemId={MOCK_SYSTEM_ID} onNote={() => {}} />;
}

function BarraDeTabla() {
  const editor = useSharedEditor();
  if (!editor) return null;
  return <TableToolbar editor={editor} />;
}

const TABLA =
  "<table><tbody><tr><th><p>Quién</p></th><th><p>Dónde</p></th></tr><tr><td><p>Inés</p></td><td><p>La casa</p></td></tr></tbody></table>";

const TAREAS = [
  makeLinkedTask({
    id: mid("lt1"),
    title: "Releer el capítulo 2 en voz alta",
    priority: "high",
    dueDate: "2026-09-08T12:00:00",
    estimatedTime: "00:25:00",
  }),
  makeLinkedTask({ id: mid("lt2"), title: "Buscar el nombre del perro", status: "done" }),
];

const CAPITULO: PageDetailTransport = {
  id: mid("p"),
  userId: mid(2),
  folderId: MOCK_FOLDER_ID,
  systemId: MOCK_SYSTEM_ID,
  parentPageId: null,
  title: "Interior, cocina",
  content: PROSA,
  isPinned: false,
  completedAt: null,
  deletedAt: null,
  clientRequestId: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  createdVia: "session",
  agentEditPolicy: "confirmation_required",
  linkedTasks: [],
};

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
            <div className="w-64 max-w-full">
              <SlashMenu items={SLASH} command={() => {}} />
            </div>
          </Specimen>
          <Specimen label="Selección" hint="SelectionToolbar: Nota y codex">
            <ClientOnly>
              <EditorProvider initialContent={PROSA}>
                <BarraDeSeleccion />
              </EditorProvider>
            </ClientOnly>
          </Specimen>
          <Specimen label="Tabla" hint="TableToolbar: palabras enteras, se desplaza si no cabe">
            <ClientOnly>
              <div className="w-full max-w-[22rem]">
                <EditorProvider initialContent={TABLA}>
                  <BarraDeTabla />
                </EditorProvider>
              </div>
            </ClientOnly>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Barra de estado del manuscrito"
        description="Palabras del capítulo, progreso de la obra en tinta (crece en transform) y racha en --ok. Papel con hairline, sin vidrio. Papel cálido y Enfoque son interruptores: borde apagados, tinta llena puestos."
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
        description="En escritorio, palabras en la barra de arriba que reservan el ancho de la más larga; en el teléfono, filas de margen al principio del panel. Terminado es --ok con su palabra; guardando lo dice sin girar nada. El sustantivo concuerda con el medium."
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
          <Specimen label="En un guion" hint="unit escena: «la escena», «terminada»" className="items-stretch">
            <div className="w-full max-w-sm">
              <WritingSessionButton
                pageId={mid("p")}
                pageTitle="Interior, cocina"
                systemId={MOCK_SYSTEM_ID}
                unit={MEDIUM_CONFIG.screenplay.unit}
                variant="fila"
              />
              <ChapterStatusToggle
                pageId={mid("p4")}
                systemId={MOCK_SYSTEM_ID}
                title="Interior, cocina"
                initialCompletedAt={null}
                unit={MEDIUM_CONFIG.screenplay.unit}
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
        description="Lo que abre la puerta del título en el teléfono (una hoja de abajo) y el botón del panel en escritorio. Cada bloque es un título con hairline y filas de margen; nada baja de 48 px en un dedo, y lo que en escritorio espera al hover se ve siempre en el teléfono."
      >
        <ClientOnly>
          <PanelDelEditor />
        </ClientOnly>
      </SubSection>

      <SubSection
        title="La hoja del panel entera"
        description="El cuerpo de la hoja tal como lo monta el editor del teléfono: la sesión y el estado arriba, luego páginas, índice, codex, mesa, resumen, versiones, etiquetas, tareas y exportar. Los bloques sin datos enseñan su forma quieta."
      >
        <Specimen label="Esta escena" hint="EditorPanelBody, movil, guion" className="items-stretch">
          <ClientOnly>
            <div className="w-[393px] max-w-full px-5">
              <Seeded stubs={[seedQuery(api.tags.bySystem, ETIQUETAS), seedQuery(api.pages.tags, [])]}>
                <EditorPanelBody
                  page={CAPITULO}
                  systemId={MOCK_SYSTEM_ID}
                  rootPageId={mid("p")}
                  initialSubPages={[]}
                  writer
                  obra={null}
                  obraMetadata={null}
                  medium={MEDIUM_CONFIG.screenplay}
                  outline={INDICE}
                  onJump={() => {}}
                  onClose={() => {}}
                  movil
                />
              </Seeded>
            </div>
          </ClientOnly>
        </Specimen>
      </SubSection>

      <SubSection
        title="Compilar"
        description="Un botón con su palabra («Compilando» mientras trabaja, sin icono que gire). En escritorio abre un menú; en el teléfono, una hoja con tres filas de 48 px y una línea de estado reservada."
      >
        <Specimen label="Con la obra cargada" hint="CompileMenu">
          <CompileMenu folderId={MOCK_FOLDER_ID} systemId={MOCK_SYSTEM_ID} manuscript={makeManuscript()} />
        </Specimen>
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
