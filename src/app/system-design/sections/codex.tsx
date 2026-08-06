"use client";

import { useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { Section, SubSection, Specimen, SpecimenGrid, Seeded } from "../helpers";
import {
  MOCK_SYSTEM_ID,
  MOCK_PAGE_ID,
  makeMentionedEntity,
  makeEntityDetail,
} from "../mock-data";
import { Button } from "@/components/ui/button";
import { CodexRail } from "@/features/entities/CodexRail";
import { EntityFicheSheet } from "@/features/entities/EntityFicheSheet";
import { MentionList, type MentionItem } from "@/features/entities/MentionList";
import { entityKeys } from "@/features/entities/entities.hooks";
import type { MentionedEntity } from "@/features/entities/entities.types";

/**
 * El Codex (PLAN-11 W2): el universo de la obra visto desde el capítulo abierto.
 *
 * Ni el rail ni la ficha reciben datos por props — los sacan del cache, igual que
 * en el editor. Cada specimen siembra su propio cliente, que es lo que permite
 * enseñar varios estados del mismo componente en la misma página.
 */

const CAST: MentionedEntity[] = [
  makeMentionedEntity(),
  makeMentionedEntity({
    id: "00000000-0000-4000-8000-000000000301",
    name: "Bruno Salazar",
    type: "character",
    summary: "Maestro del gremio. Sabe más de lo que dice sobre la madre de Aurelia.",
    mentionCount: 4,
  }),
  makeMentionedEntity({
    id: "00000000-0000-4000-8000-000000000302",
    name: "Puerto Ceniza",
    type: "location",
    summary: "Ciudad portuaria bajo una niebla que nunca levanta del todo.",
    mentionCount: 2,
  }),
];

function seedRail(entities: MentionedEntity[]) {
  return (qc: QueryClient) => {
    qc.setQueryData(entityKeys.byPage(MOCK_PAGE_ID), entities);
  };
}

/** El sheet solo pinta con `open`, así que el specimen trae su propio disparador. */
function FicheSpecimen() {
  const [open, setOpen] = useState(false);
  const entity = makeEntityDetail();

  return (
    <Seeded
      seed={(qc) => {
        qc.setQueryData(entityKeys.detail(entity.id), entity);
      }}
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

/** El popup del @ tiene su propio tipo: entidades existentes + la opción de crear. */
const MENTION_ITEMS: MentionItem[] = [
  ...CAST.map((e) => ({ kind: "entity" as const, id: e.id, name: e.name, type: e.type })),
  { kind: "create", name: "Marea Baja", type: "character" },
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
            <Seeded seed={seedRail(CAST)}>
              <div className="w-full max-w-64">
                <CodexRail pageId={MOCK_PAGE_ID} systemId={MOCK_SYSTEM_ID} />
              </div>
            </Seeded>
          </Specimen>

          <Specimen label="Capítulo sin menciones" hint="lista vacía">
            <Seeded seed={seedRail([])}>
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

          <Specimen label="Con fijado" hint="pinnedIds — la mesa de referencias de W4">
            <Seeded seed={seedRail(CAST)}>
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
    </Section>
  );
}
