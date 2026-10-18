"use client";

import { Section, SubSection, Specimen, SpecimenGrid, Seeded, seedQuery } from "../helpers";
import {
  makeFolder,
  makePage,
  makeSystem,
  makeStickyNote,
  makeLinkedTask,
  daysFromNow,
  MOCK_SYSTEM_ID, mid } from "../mock-data";
import { api } from "@convex/_generated/api";
import { Feather, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolderRow } from "@/features/notebooks/FolderRow";
import { FolderContents } from "@/features/notebooks/FolderContents";
import { NotebookRow } from "@/features/notebooks/NotebookRow";
import { IndexHead } from "@/features/notebooks/IndexHead";
import { RowActions } from "@/features/notebooks/RowActions";
import { ObraRow } from "@/features/systems/views/SystemWritingView";
import { Readings } from "@/features/systems/SystemDetailHeader";
import { systemTileStyle } from "@/features/systems/system-tint";
import { SystemColorPicker, SystemIconPicker } from "@/features/systems/SystemPickers";
import { NewFolderInline } from "@/features/folders/NewFolderInline";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import { useState } from "react";
import { StickyNoteCard } from "@/features/sticky-notes/StickyNoteCard";
import { LinkedTaskCard } from "@/features/pages/LinkedTaskCard";
import { DocumentRail, RailCard } from "@/features/pages/DocumentRail";
import type { OutlineItem } from "@/features/pages/mediums/outline";
import type { ReactNode } from "react";

const noop = () => {};

/** Un día fijo, para que "ayer" y "12 sept" no dependan del reloj de quien mira. */
const HOY = new Date(2026, 9, 18, 12);

/** Las filas preguntan por el sistema para hablar su vocabulario: aquí, uno de escritura. */
const INDICE_STUBS = [
  seedQuery(api.systems.list, [makeSystem({ id: MOCK_SYSTEM_ID, name: "La casa de las cotas", templateType: "writing", color: "purple" })]),
  seedQuery(api.folders.children, [makeFolder({ id: mid("parte-1"), name: "Capítulos 1 a 5", subfolderCount: 0, pageCount: 3 })]),
];

/** Los manuscritos de la obra del specimen. */
const PAGINAS_OBRA = [
  makePage({ id: mid("po-1"), title: "El clima que no cabe", folderId: mid("obra-1"), wordCount: 1240, updatedAt: new Date(2026, 9, 17).toISOString() }),
  makePage({ id: mid("po-2"), title: "La subida", folderId: mid("obra-1"), wordCount: 0, updatedAt: new Date(2026, 8, 12).toISOString() }),
];

/** Dos manuscritos de una carpeta. */
const PAGINAS_DE_CARPETA = [
  makePage({ id: mid("pc-1"), title: "El clima que no cabe", folderId: mid("fr-2"), wordCount: 1240, updatedAt: new Date(2026, 9, 17).toISOString() }),
  makePage({ id: mid("pc-2"), title: "La subida", folderId: mid("fr-2"), wordCount: 0, updatedAt: new Date(2026, 8, 12).toISOString() }),
];

export function NotebooksSection() {
  return (
    <Section
      id="notebooks"
      number="13"
      title="Índice, documentos y notas adhesivas"
      description="La biblioteca de un sistema como índice de Diario: títulos de sección con hairline, carpetas con numeral romano que se despliegan, documentos numerados con su cifra de palabras, y la nota adhesiva como papel. Nada es una tarjeta."
    >
      <SubSection
        title="IndexHead"
        description="El título de una sección del índice: la palabra en Bricolage, a la derecha su cuenta en mute o su acción con nombre, y un hairline fuerte debajo. Sustituye a la caja que agrupaba."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Con acción" className="items-stretch">
            <div className="w-full">
              <IndexHead title="Obras" trailing={<Button variant="link" size="sm" className="px-1">Nueva obra</Button>} />
            </div>
          </Specimen>
          <Specimen label="Con cuenta" className="items-stretch">
            <div className="w-full">
              <IndexHead title="Sin obra" trailing="1 manuscrito" />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="FolderRow"
        description="Una carpeta (obra, clase, área, milestone) como fila de índice: numeral romano en mute en el margen, el nombre, lo que contiene con el vocabulario del sistema. Tocar el nombre abre la carpeta; el chevron la despliega aquí con sus hijas, sangradas sólo por el margen. Renombrar y eliminar son operaciones con nombre: menú en escritorio, hoja en el teléfono. Sustituye a FolderCard."
      >
        <Seeded stubs={INDICE_STUBS}>
          <div className="w-full max-w-xl">
            <FolderRow folder={makeFolder({ id: mid("fr-1"), name: "Apuntes de clase" })} systemId={MOCK_SYSTEM_ID} index={1} href="#" />
            <FolderRow
              folder={makeFolder({ id: mid("fr-2"), name: "Primera parte: la subida", subfolderCount: 1, pageCount: 2 })}
              systemId={MOCK_SYSTEM_ID}
              index={2}
              href="#"
              defaultOpen
            >
              <FolderContents systemId={MOCK_SYSTEM_ID} folderId={mid("fr-2")} pages={PAGINAS_DE_CARPETA} now={HOY} />
            </FolderRow>
            <FolderRow
              folder={makeFolder({ id: mid("fr-3"), name: "Carpeta vacía", subfolderCount: 0, pageCount: 0 })}
              systemId={MOCK_SYSTEM_ID}
              index={3}
              href="#"
            >
              <FolderContents systemId={MOCK_SYSTEM_ID} folderId={mid("fr-3")} pages={[]} now={HOY} />
            </FolderRow>
          </div>
        </Seeded>
      </SubSection>

      <SubSection
        title="NotebookRow"
        description="Un documento como fila numerada: el número en mute en el margen, el título en Literata, la meta en mute (cuándo, sus etiquetas, terminado en --ok) y la cifra de palabras a la derecha. Sin vista previa ni chips de etiqueta. Sustituye a NotebookCard."
      >
        <Seeded stubs={INDICE_STUBS}>
          <div className="w-full max-w-xl">
            <NotebookRow
              page={makePage({
                id: mid("nr-1"),
                title: "El clima que no cabe",
                wordCount: 1240,
                updatedAt: new Date(2026, 9, 17).toISOString(),
                tags: [
                  { id: mid("t1"), title: "importante", color: "red", systemId: MOCK_SYSTEM_ID, isDefault: false },
                  { id: mid("t2"), title: "reunión", color: "blue", systemId: MOCK_SYSTEM_ID, isDefault: false },
                ],
              })}
              systemId={MOCK_SYSTEM_ID}
              index={1}
              href="#"
              now={HOY}
            />
            <NotebookRow
              page={makePage({ id: mid("nr-2"), title: "Don Fermín lee la cota", wordCount: 860, completedAt: new Date(2026, 8, 12).toISOString(), updatedAt: new Date(2026, 8, 12).toISOString() } as never)}
              systemId={MOCK_SYSTEM_ID}
              index={2}
              href="#"
              now={HOY}
            />
            <NotebookRow
              page={makePage({ id: mid("nr-3"), title: null, wordCount: 0, updatedAt: HOY.toISOString() })}
              systemId={MOCK_SYSTEM_ID}
              index={3}
              href="#"
              now={HOY}
            />
          </div>
        </Seeded>
      </SubSection>

      <SubSection
        title="ObraRow"
        description="Una obra de escritura, desplegada: medio, manuscritos y palabras contra la meta en la meta; dormida en coral con la palabra delante. Al desplegarse, la barra de la meta por transform, las acciones con nombre en pastillas (Leer, Tablero, Capítulo, Diario, Compilar), el medio como select nativo de 48 px, sus partes con el glifo de carpeta y sus manuscritos numerados."
      >
        <Seeded stubs={INDICE_STUBS}>
          <div className="w-full max-w-xl">
            <ObraRow
              obra={makeFolder({ id: mid("obra-1"), name: "Primera parte: la subida", metadata: { medium: "novel", wordGoal: 80000 }, subfolderCount: 0, pageCount: 2 })}
              index={1}
              pages={PAGINAS_OBRA}
              systemId={MOCK_SYSTEM_ID}
              pulse={{ folderId: mid("obra-1"), lastSessionAt: null, daysSinceLastSession: 31 }}
              now={HOY}
            />
          </div>
        </Seeded>
      </SubSection>

      <SubSection
        title="RowActions"
        description="Las operaciones de una fila con su nombre. En escritorio con ratón el botón aparece al pasar por la fila; en touch mide 2.85rem y abre una hoja con una fila de 48 px por operación, lo irreversible al final y en carmesí."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Visible siempre" hint="la cabecera de un sistema">
            <RowActions
              subject="La casa de las cotas"
              revealOnHover={false}
              actions={[
                { label: "Editar sistema", icon: Pencil, onSelect: noop },
                { label: "Eliminar sistema", icon: Trash2, destructive: true, onSelect: noop },
              ]}
            />
          </Specimen>
          <Specimen label="Cabecera de sistema: tile y lecturas" hint="las tres cifras salen del manifiesto">
            <div className="flex items-start gap-4">
              <span aria-hidden className="flex size-[2.4rem] items-center justify-center rounded-xl" style={systemTileStyle("purple")}>
                <Feather className="size-5" />
              </span>
              <Readings
                readings={[
                  { value: "0", label: "palabras hoy" },
                  { value: "136", label: "de 80.000" },
                  { value: "31", label: "días dormido", tone: "warn" },
                ]}
              />
            </div>
          </Specimen>
          <Specimen label="Lecturas esperando" hint="la forma de las tres cifras, sin animar">
            <Readings readings={null} />
          </Specimen>
          <Specimen label="Tile de los neutros" hint="blanco, gris y negro no tienen tinte que prestar">
            <div className="flex gap-3">
              {(["white", "gray", "black", "yellow"] as const).map((c) => (
                <span key={c} aria-hidden className="flex size-[2.4rem] items-center justify-center rounded-xl" style={systemTileStyle(c)}>
                  <Feather className="size-5" />
                </span>
              ))}
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Crear y elegir"
        description="Crear una carpeta es una acción con nombre en el título de su sección que abre una hoja con un campo de 48 px por campo del manifiesto. El color y el icono de un sistema son radios de 48 px en touch; el elegido, en tinta o en el tile teñido."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="NewFolderInline" hint="toca para abrir la hoja">
            <Seeded stubs={INDICE_STUBS}>
              <NewFolderInline
                systemId={MOCK_SYSTEM_ID}
                label="Nueva obra"
                placeholder="Nombre de la obra"
                fields={SYSTEM_TYPE_CONFIG.writing.folderRole!.fields}
              />
            </Seeded>
          </Specimen>
          <Specimen label="SystemColorPicker" className="items-stretch">
            <PickerDemo />
          </Specimen>
        </SpecimenGrid>
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
        description="El carril de títulos al borde de la columna de un documento. En reposo todas miden lo mismo de ancho y el brillo dice el nivel; pasa el puntero por encima y la de debajo crece y se aclara, con las vecinas decreciendo según se alejan. Nunca crece más que su lienzo: cuando no cabe suelta niveles. En un teléfono no se pinta."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="En reposo, tres niveles" hint="pasa el puntero por las marcas para ver la lupa">
            <RailStage>
              <DocumentRail items={RAIL_ITEMS} budget={600} onJump={noop} />
            </RailStage>
          </Specimen>
          <Specimen label="Con el lienzo lleno" hint="78 títulos en 200 px: se queda con los de primer nivel y aprieta el paso">
            <RailStage>
              <DocumentRail items={RAIL_LARGO} budget={200} onJump={noop} />
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

/** Un documento de clase largo: el caso que antes recortaba el carril. */
const RAIL_LARGO: OutlineItem[] = Array.from({ length: 78 }, (_, i) => ({
  pos: i * 10,
  kind: "heading" as const,
  depth: i % 4 === 0 ? 0 : i % 2 === 0 ? 1 : 2,
  label: `Apartado ${i + 1}`,
  preview: null,
}));

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

/** Los dos selectores de un sistema, enlazados: el icono elegido toma el tile del color elegido. */
function PickerDemo() {
  const [color, setColor] = useState("purple");
  const [icon, setIcon] = useState("feather");
  return (
    <div className="w-full space-y-3">
      <SystemColorPicker value={color} onChange={setColor} />
      <SystemIconPicker value={icon} color={color} onChange={setIcon} />
    </div>
  );
}
