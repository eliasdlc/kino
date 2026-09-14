"use client";

import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import {
  makeFolder,
  makePage,
  makeStickyNote,
  makeLinkedTask,
  daysFromNow,
  MOCK_SYSTEM_ID, mid } from "../mock-data";
import { FolderCard } from "@/features/notebooks/FolderCard";
import { NotebookCard } from "@/features/notebooks/NotebookCard";
import { StickyNoteCard } from "@/features/sticky-notes/StickyNoteCard";
import { LinkedTaskCard } from "@/features/pages/LinkedTaskCard";
import { DocumentRail, RailCard } from "@/features/pages/DocumentRail";
import type { OutlineItem } from "@/features/pages/mediums/outline";
import type { ReactNode } from "react";

const noop = () => {};

export function NotebooksSection() {
  return (
    <Section
      id="notebooks"
      number="13"
      title="Notebooks, páginas y sticky notes"
      description="Los objetos físicos del arquetipo de escritura/notas: carpetas con papeles que asoman, cards de página con preview, post-its y tareas vinculadas a una página."
    >
      <SubSection
        title="FolderCard"
        description="Carpeta física sobre PhysicalCard: pestaña, solapa y papeles que se abanican en hover (solo si tiene contenido)."
      >
        <div className="grid max-w-lg grid-cols-2 gap-4">
          <FolderCard
            folder={makeFolder({ name: "Apuntes de clase" })}
            systemId={MOCK_SYSTEM_ID}
            onClick={noop}
          />
          <FolderCard
            folder={makeFolder({ id: mid("f2"), name: "Carpeta vacía", subfolderCount: 0, pageCount: 0 })}
            systemId={MOCK_SYSTEM_ID}
            onClick={noop}
          />
        </div>
      </SubSection>

      <SubSection
        title="NotebookCard"
        description="Card de página: fecha relativa (TODAY/YESTERDAY/…), preview del contenido, contador de palabras, tags con pill de color."
      >
        <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <NotebookCard
            page={makePage({
              tags: [
                { id: mid("t1"), title: "importante", color: "red", systemId: MOCK_SYSTEM_ID, isDefault: false },
                { id: mid("t2"), title: "reunión", color: "blue", systemId: MOCK_SYSTEM_ID, isDefault: false },
              ],
            })}
            systemId={MOCK_SYSTEM_ID}
            href="#"
          />
          <NotebookCard
            page={makePage({
              id: mid("pg2"),
              title: "Capítulo 3 — El regreso",
              isPinned: true,
              wordCount: 2431,
              updatedAt: daysFromNow(-1),
              contentPreview: "La casa dormía cuando ella bajó a la cocina…",
              subPageCount: 2,
            })}
            systemId={MOCK_SYSTEM_ID}
            href="#"
          />
        </div>
      </SubSection>

      <SubSection
        title="StickyNoteCard"
        description="Post-it interactivo (clic abre el popover de edición). Los tres estados de contenido y varios colores de papel."
      >
        <div className="grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
          <StickyNoteCard note={makeStickyNote()} context={{ folderId: mid("f1") }} />
          <StickyNoteCard
            note={makeStickyNote({ id: mid("n2"), title: null, content: "Solo contenido, sin título. Ideal para capturas rápidas.", color: "blue" })}
            context={{ folderId: mid("f1") }}
          />
          <StickyNoteCard
            note={makeStickyNote({ id: mid("n3"), title: null, content: null, color: "pink" })}
            context={{ folderId: mid("f1") }}
          />
          <StickyNoteCard
            note={makeStickyNote({ id: mid("n4"), title: "En página", content: "Con pageId muestra opciones de anclaje al margen.", color: "green" })}
            context={{ pageId: mid("p1") }}
          />
          <StickyNoteCard
            note={makeStickyNote({ id: mid("n5"), title: "Tinta clara", content: "Papel oscuro.", color: "black" })}
            context={{ folderId: mid("f1") }}
          />
          <StickyNoteCard
            note={makeStickyNote({ id: mid("n6"), title: "Neutra", content: "Papel blanco.", color: "white" })}
            context={{ folderId: mid("f1") }}
          />
        </div>
      </SubSection>

      <SubSection
        title="LinkedTaskCard"
        description="Tarea vinculada dentro de una página (panel lateral del editor): toggle, editar, desvincular."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="Pendiente" className="items-stretch">
            <div className="w-full">
              <LinkedTaskCard
                task={makeLinkedTask({ dueDate: daysFromNow(2), priority: "high" })}
                onToggle={noop}
                onEdit={noop}
                onUnlink={noop}
              />
            </div>
          </Specimen>
          <Specimen label="Completada" className="items-stretch">
            <div className="w-full">
              <LinkedTaskCard
                task={makeLinkedTask({ id: mid("lt2"), status: "done" })}
                onToggle={noop}
                onEdit={noop}
                onUnlink={noop}
              />
            </div>
          </Specimen>
          <Specimen label="Idea" className="items-stretch">
            <div className="w-full">
              <LinkedTaskCard
                task={makeLinkedTask({ id: mid("lt3"), title: "¿Y si el capítulo 2 va primero?", taskType: "idea", status: "backlog" })}
                onToggle={noop}
                onEdit={noop}
                onUnlink={noop}
              />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="DocumentRail"
        description="El carril de títulos al borde de la columna de un documento. Una marca por encabezado, el ancho dice el nivel y el acento marca la sección que se está leyendo. En un teléfono no se pinta: ahí el índice vive en el panel lateral."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Con la tercera sección activa" hint="activePos = 90">
            <RailStage>
              <DocumentRail items={RAIL_ITEMS} activePos={90} onJump={noop} />
            </RailStage>
          </Specimen>
          <Specimen label="Sin sección activa" hint="activePos = null, antes del primer scroll">
            <RailStage>
              <DocumentRail items={RAIL_ITEMS} activePos={null} onJump={noop} />
            </RailStage>
          </Specimen>
        </SpecimenGrid>

        <SpecimenGrid cols={2}>
          <Specimen label="Tarjeta de una sección con cuerpo" hint="puntero o foco sobre la marca">
            <div className="relative h-28 w-1">
              <RailCard item={RAIL_ITEMS[0]} />
            </div>
          </Specimen>
          <Specimen label="Tarjeta de una sección sin cuerpo" hint="preview = null">
            <div className="relative h-28 w-1">
              <RailCard item={RAIL_ITEMS[2]} />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>
    </Section>
  );
}

/** Los títulos de un apunte de clase, que es donde el carril hace su trabajo. */
const RAIL_ITEMS: OutlineItem[] = [
  { pos: 0, kind: "heading", depth: 0, label: "Análisis léxico", preview: "El lexer convierte una ristra de caracteres en tokens con su categoría." },
  { pos: 40, kind: "heading", depth: 1, label: "Autómatas finitos", preview: "Un autómata reconoce un lenguaje regular leyendo símbolo a símbolo." },
  { pos: 90, kind: "heading", depth: 2, label: "AFD contra AFND", preview: null },
  { pos: 140, kind: "heading", depth: 1, label: "Expresiones regulares", preview: "Toda expresión regular tiene un autómata equivalente, y al revés." },
  { pos: 200, kind: "heading", depth: 1, label: "Tabla de símbolos", preview: "Cada identificador que el lexer reconoce entra aquí con su ámbito." },
];

/**
 * El lienzo contra el que se posiciona el carril. En la app es el contenedor de
 * scroll del editor; aquí es una caja del mismo tamaño con texto detrás, porque
 * un carril sobre fondo vacío no enseña si tapa algo.
 */
function RailStage({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-72 w-full overflow-hidden rounded-xl border border-border bg-background">
      <div className="mx-auto max-w-sm space-y-3 px-10 py-8">
        <p className="text-lg font-semibold">Análisis léxico</p>
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-2 w-4/5 rounded bg-muted" />
        <p className="pt-2 text-sm font-semibold">Autómatas finitos</p>
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-2 w-3/5 rounded bg-muted" />
      </div>
      {children}
    </div>
  );
}
