"use client";

import { api } from "@convex/_generated/api";

import { useState } from "react";
import { Section, SubSection, Specimen, SpecimenGrid, Seeded, seedQuery } from "../helpers";
import {
  MOCK_SYSTEM_ID,
  MOCK_PAGE_ID,
  makeMentionedEntity,
  makeEntityDetail, mid } from "../mock-data";
import { Button } from "@/components/ui/button";
import { CodexRail } from "@/features/entities/CodexRail";
import { CodexChips } from "@/features/entities/CodexChips";
import { EntityImages } from "@/features/entities/EntityImages";
import { CodexLibrary } from "@/features/entities/CodexLibrary";
import { CodexNav } from "@/features/entities/CodexNav";
import { EntityFicheSheet } from "@/features/entities/EntityFicheSheet";
import { MentionList, type MentionItem } from "@/features/entities/MentionList";
import { GraphCanvas } from "@/features/entities/UniverseGraph";
import { layoutGraph, type GraphEdge, type GraphNode } from "@/features/entities/entities.graph";
import type { MentionedEntityTransport } from "@/features/entities/entities.types";

/**
 * El Codex (PLAN-11 W2): el universo de la obra visto desde el capítulo abierto.
 *
 * Ni el rail ni la ficha reciben datos por props: los sacan del cache, igual que
 * en el editor. Cada specimen siembra su propio cliente, que es lo que permite
 * enseñar varios estados del mismo componente en la misma página.
 */

const CAST: MentionedEntityTransport[] = [
  makeMentionedEntity(),
  makeMentionedEntity({
    id: mid("00000000-0000-4000-8000-000000000301"),
    name: "Bruno Salazar",
    type: "character",
    summary: "Maestro del gremio. Sabe más de lo que dice sobre la madre de Aurelia.",
    mentionCount: 4,
  }),
  makeMentionedEntity({
    id: mid("00000000-0000-4000-8000-000000000302"),
    name: "Puerto Ceniza",
    type: "location",
    summary: "Ciudad portuaria bajo una niebla que nunca levanta del todo.",
    mentionCount: 2,
  }),
];

function seedRail(entities: MentionedEntityTransport[]) {
  return [
    seedQuery(api.entities.byPage, entities),
  ];
}

/** El sheet solo pinta con `open`, así que el specimen trae su propio disparador. */
function FicheSpecimen() {
  const [open, setOpen] = useState(false);
  const entity = makeEntityDetail();

  return (
    <Seeded
      stubs={[
        seedQuery(api.entities.byId, entity),
      ]}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Abrir ficha de {entity.name}
      </Button>
      <EntityFicheSheet
        entityId={entity.id}
        systemId={MOCK_SYSTEM_ID}
        open={open}
        onOpenChange={setOpen}
      />
    </Seeded>
  );
}

const noop = () => {};

/**
 * Una imagen de muestra dibujada aquí mismo: el catálogo no sube nada ni
 * depende de un servidor de imágenes, y el recorte de la portada se ve igual.
 */
function muestra(fondo: string, tinta: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" fill="${fondo}"/><path d="M0 70 Q75 40 150 62 T300 50 V100 H0Z" fill="${tinta}" opacity=".55"/><circle cx="235" cy="28" r="12" fill="${tinta}" opacity=".35"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Aurelia con portada y dos referencias en la galería. */
const CON_IMAGENES = makeEntityDetail({
  coverImageUrl: muestra("#e9e2d4", "#6b5a43"),
  images: [muestra("#dfe6e9", "#3f5661"), muestra("#efe1d9", "#8a4b3a")],
});

/** El elenco de la biblioteca: lo que devuelve `entities.bySystem`. */
const LIBRARY = CAST.map((e) => ({
  id: e.id,
  systemId: MOCK_SYSTEM_ID,
  type: e.type,
  name: e.name,
  aliases: [],
  summary: e.summary ?? null,
  coverImageUrl: null,
  createdAt: makeEntityDetail().createdAt,
  updatedAt: makeEntityDetail().updatedAt,
}));

/** El popup del @ tiene su propio tipo: entidades existentes + la opción de crear. */
const MENTION_ITEMS: MentionItem[] = [
  ...CAST.map((e) => ({ kind: "entity" as const, id: e.id, name: e.name, type: e.type })),
  { kind: "create", name: "Marea Baja", type: "character" },
];

/**
 * Universo de muestra para el grafo. El layout es determinista, así que este
 * specimen dibuja siempre el mismo mapa, y se puede comparar entre despliegues.
 */
const GRAPH_NODES: GraphNode[] = [
  { id: mid("aurelia"), name: "Aurelia", type: "character", mentionCount: 22, workIds: [] },
  { id: mid("bruno"), name: "Bruno Salazar", type: "character", mentionCount: 9, workIds: [] },
  { id: mid("puerto"), name: "Puerto Ceniza", type: "location", mentionCount: 14, workIds: [] },
  { id: mid("gremio"), name: "El Gremio", type: "faction", mentionCount: 6, workIds: [] },
  { id: mid("daga"), name: "La Daga", type: "object", mentionCount: 2, workIds: [] },
  { id: mid("marea"), name: "Marea Baja", type: "event", mentionCount: 1, workIds: [] },
];

const GRAPH_EDGES: GraphEdge[] = [
  { id: mid("e1"), from: "aurelia", to: "bruno", label: "maestro" },
  { id: mid("e2"), from: "bruno", to: "gremio", label: null },
  { id: mid("e3"), from: "aurelia", to: "puerto", label: "vive en" },
  { id: mid("e4"), from: "gremio", to: "puerto", label: null },
  { id: mid("e5"), from: "aurelia", to: "daga", label: "porta" },
];

export function CodexSection() {
  return (
    <Section id="codex" number="15" title="Codex">
      <SubSection
        title="Codex rail"
        description="Las entidades detectadas en el capítulo abierto. Se monta en el panel del editor de escritura."
      >
        <SpecimenGrid>
          <Specimen label="Con entidades" hint="page_entity_mentions con resultados">
            <Seeded stubs={seedRail(CAST)}>
              <div className="w-full max-w-64">
                <CodexRail pageId={MOCK_PAGE_ID} systemId={MOCK_SYSTEM_ID} />
              </div>
            </Seeded>
          </Specimen>

          <Specimen label="Capítulo sin menciones" hint="lista vacía">
            <Seeded stubs={seedRail([])}>
              <div className="w-full max-w-64">
                <CodexRail pageId={MOCK_PAGE_ID} systemId={MOCK_SYSTEM_ID} />
              </div>
            </Seeded>
          </Specimen>

          {/* No hay specimen del estado de carga a propósito. `usePageEntities`
              declara su propia queryFn, así que no se puede dejar en pending desde
              fuera: sin backend la query falla al instante y el rail cae al estado
              vacío. Un specimen etiquetado "Cargando" que pintase el vacío mentiría,
              y este catálogo sirve justamente para fiarse de lo que se ve. */}

          <Specimen label="Con fijado" hint="pinnedIds: la mesa de referencias de W4">
            <Seeded stubs={seedRail(CAST)}>
              <div className="w-full max-w-64">
                <CodexRail
                  pageId={MOCK_PAGE_ID}
                  systemId={MOCK_SYSTEM_ID}
                  pinnedIds={[CAST[0].id]}
                  onTogglePin={noop}
                />
              </div>
            </Seeded>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Biblioteca del codex"
        description="CodexLibrary: el elenco del mundo como índice, no como rejilla de cards. Una sección por tipo con su palabra en Bricolage y la cuenta en mute; una fila por entidad con su numeral en el margen, que abre la ficha. Encima, CodexNav: las lecturas son pestañas-palabra en tinta."
      >
        <SpecimenGrid>
          <Specimen label="Con elenco" hint="entities.bySystem con personajes y lugares">
            <Seeded stubs={[seedQuery(api.entities.bySystem, LIBRARY)]}>
              <div className="w-full max-w-xl space-y-4">
                <CodexNav systemId={MOCK_SYSTEM_ID} current="biblioteca" />
                <CodexLibrary systemId={MOCK_SYSTEM_ID} />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Universo vacío" hint="EmptyState en la columna de texto">
            <Seeded stubs={[seedQuery(api.entities.bySystem, [])]}>
              <div className="w-full max-w-xl">
                <CodexLibrary systemId={MOCK_SYSTEM_ID} />
              </div>
            </Seeded>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="CodexChips"
        description="Las entidades del capítulo abierto en una fila bajo el título, en el teléfono: el mismo codex del rail a un toque, sin tapar el texto. Cada ficha mide 2.85rem y abre la hoja de la entidad. La fila se desplaza en horizontal y, sin entidades, no se pinta."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Con entidades" hint="entities.byPage con tres; toca una para abrir su ficha" className="items-stretch">
            <Seeded stubs={[...seedRail(CAST), seedQuery(api.entities.byId, makeEntityDetail())]}>
              <div className="w-full max-w-sm overflow-hidden px-4">
                <CodexChips pageId={MOCK_PAGE_ID} systemId={MOCK_SYSTEM_ID} />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Capítulo sin menciones" hint="no deja una fila vacía: aquí no se pinta nada">
            <Seeded stubs={seedRail([])}>
              <div className="w-full max-w-sm px-4">
                <CodexChips pageId={MOCK_PAGE_ID} systemId={MOCK_SYSTEM_ID} />
              </div>
            </Seeded>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="EntityImages"
        description="La portada y la galería de referencias de una entidad, dentro de su ficha. Subir comprime a WebP en el cliente; sin almacenamiento configurado dice el error sin romper la ficha. Con ratón, quitar asoma al pasar por encima; en el teléfono se ve siempre y mide 2.85rem, y la miniatura crece a 4.5rem para que el aspa no la tape."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Sin imágenes" hint="Subir portada y el hueco punteado de la galería" className="items-stretch">
            <Seeded stubs={[]}>
              <div className="w-full max-w-sm">
                <EntityImages entity={makeEntityDetail()} systemId={MOCK_SYSTEM_ID} />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Con portada y referencias" hint="pasa el puntero para ver Quitar portada y Quitar imagen" className="items-stretch">
            <Seeded stubs={[]}>
              <div className="w-full max-w-sm">
                <EntityImages entity={CON_IMAGENES} systemId={MOCK_SYSTEM_ID} />
              </div>
            </Seeded>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Ficha de entidad"
        description="ResponsiveDialog: sheet en desktop, drawer en móvil. Atributos por tipo, relaciones y apariciones."
      >
        <Specimen label="Ficha completa" hint="EntityFicheSheet">
          <FicheSpecimen />
        </Specimen>
      </SubSection>

      <SubSection
        title="Menciones"
        description="El popup del @ dentro del editor. Se navega con flechas; la selección vuelve a 0 al cambiar la lista."
      >
        <SpecimenGrid>
          <Specimen label="Con resultados" hint="MentionList">
            <div className="w-full max-w-72">
              <MentionList items={MENTION_ITEMS} command={noop} />
            </div>
          </Specimen>

          <Specimen label="Sin resultados" hint="items vacío">
            <div className="w-full max-w-72">
              <MentionList items={[]} command={noop} />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Grafo del universo"
        description="Solo render sobre entity_relations. Monocromo: el tipo se lee por icono y el peso por tamaño. Se arrastra para desplazar y hay zoom; el borde punteado marca una entidad sin ninguna relación."
      >
        <SpecimenGrid>
          <Specimen label="Universo conectado" hint="GraphCanvas: 6 entidades, 5 relaciones">
            <div className="w-full">
              <GraphCanvas layout={layoutGraph(GRAPH_NODES, GRAPH_EDGES)} onOpen={noop} />
            </div>
          </Specimen>

          <Specimen label="Todo suelto" hint="sin relaciones: todos los bordes punteados">
            <div className="w-full">
              <GraphCanvas layout={layoutGraph(GRAPH_NODES, [])} onOpen={noop} />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>
    </Section>
  );
}
