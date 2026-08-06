"use client";

import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import {
  makeFolder,
  makePage,
  makeStickyNote,
  makeLinkedTask,
  daysFromNow,
  MOCK_SYSTEM_ID,
} from "../mock-data";
import { FolderCard } from "@/features/notebooks/FolderCard";
import { NotebookCard } from "@/features/notebooks/NotebookCard";
import { StickyNoteCard } from "@/features/sticky-notes/StickyNoteCard";
import { LinkedTaskCard } from "@/features/pages/LinkedTaskCard";

const noop = () => {};

export function NotebooksSection() {
  return (
    <Section
      id="notebooks"
      number="12"
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
            folder={makeFolder({ id: "f2", name: "Carpeta vacía", subfolderCount: 0, pageCount: 0 })}
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
                { id: "t1", title: "importante", color: "red", systemId: MOCK_SYSTEM_ID, isDefault: false },
                { id: "t2", title: "reunión", color: "blue", systemId: MOCK_SYSTEM_ID, isDefault: false },
              ],
            })}
            systemId={MOCK_SYSTEM_ID}
            href="#"
          />
          <NotebookCard
            page={makePage({
              id: "pg2",
              title: "Capítulo 3 — El regreso",
              isPinned: true,
              wordCount: 2431,
              updatedAt: new Date(daysFromNow(-1)),
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
          <StickyNoteCard note={makeStickyNote()} context={{ folderId: "f1" }} />
          <StickyNoteCard
            note={makeStickyNote({ id: "n2", title: null, content: "Solo contenido, sin título. Ideal para capturas rápidas.", color: "blue" })}
            context={{ folderId: "f1" }}
          />
          <StickyNoteCard
            note={makeStickyNote({ id: "n3", title: null, content: null, color: "pink" })}
            context={{ folderId: "f1" }}
          />
          <StickyNoteCard
            note={makeStickyNote({ id: "n4", title: "En página", content: "Con pageId muestra opciones de anclaje al margen.", color: "green" })}
            context={{ pageId: "p1" }}
          />
          <StickyNoteCard
            note={makeStickyNote({ id: "n5", title: "Tinta clara", content: "Papel oscuro.", color: "black" })}
            context={{ folderId: "f1" }}
          />
          <StickyNoteCard
            note={makeStickyNote({ id: "n6", title: "Neutra", content: "Papel blanco.", color: "white" })}
            context={{ folderId: "f1" }}
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
                task={makeLinkedTask({ id: "lt2", status: "done" })}
                onToggle={noop}
                onEdit={noop}
                onUnlink={noop}
              />
            </div>
          </Specimen>
          <Specimen label="Idea" className="items-stretch">
            <div className="w-full">
              <LinkedTaskCard
                task={makeLinkedTask({ id: "lt3", title: "¿Y si el capítulo 2 va primero?", taskType: "idea", status: "backlog" })}
                onToggle={noop}
                onEdit={noop}
                onUnlink={noop}
              />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>
    </Section>
  );
}
