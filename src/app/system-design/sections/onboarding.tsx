"use client";

import { useState } from "react";
import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import { ArchetypeGallery } from "@/features/onboarding/ArchetypeGallery";
import {
  ARCHETYPE_LIST,
  DEFAULT_IDENTITY,
  type ArchetypeIdentity,
} from "@/features/onboarding/onboarding.archetypes";
import { buildSeedPlan } from "@/features/onboarding/onboarding.seed";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";

/**
 * El alta: dos pantallas y una pregunta. La segunda pantalla es Hoy, así que lo
 * único que hay que enseñar aquí es la galería y lo que cada arquetipo siembra.
 *
 * Ni una etiqueta de este archivo es literal: el nombre sale de
 * `SYSTEM_TYPE_CONFIG.label` y la siembra de `buildSeedPlan`, el mismo que corre
 * en el servidor. Lo que se ve es lo que recibe quien entra por primera vez.
 */

/** El specimen le presta el estado a la galería para poder tocarla. */
function GallerySpecimen({ initial }: { initial: ArchetypeIdentity }) {
  const [value, setValue] = useState<ArchetypeIdentity>(initial);
  return (
    <div className="max-h-[26rem]">
      <ArchetypeGallery value={value} onChange={setValue} />
    </div>
  );
}

/**
 * Lo que se escribe al entrar, sin que nadie haya escrito una unidad, que es lo
 * que pasa siempre con el alta de dos pantallas.
 */
function SeedSpecimen({ identity }: { identity: ArchetypeIdentity }) {
  const archetype = ARCHETYPE_LIST.find((a) => a.id === identity);
  if (!archetype) return null;
  const plan = buildSeedPlan(identity, archetype.systemNameDefault, []);

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">{archetype.systemNameDefault}</p>
      {plan.tasks.length === 0 && plan.folders.length === 0 ? (
        <p className="text-xs text-muted-foreground">No siembra nada.</p>
      ) : (
        <ul className="space-y-1">
          {plan.tasks.map((task) => (
            <li key={task.title} className="flex items-baseline gap-2 text-xs">
              <span className="flex-1">{task.title}</span>
              {task.startsToday && <span className="shrink-0 text-primary">hoy</span>}
              {task.boardStatus && (
                <span className="shrink-0 text-muted-foreground">{task.boardStatus}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OnboardingSection() {
  return (
    <Section
      id="onboarding"
      number="18"
      title="El alta: dos pantallas y una pregunta"
      description="La única pregunta es en qué trabajas. El perfil de energía, el nombre del sistema y la zona horaria los escribe el servidor con un valor declarado, y la segunda pantalla es Hoy con el plan ya sembrado."
    >
      <SubSection
        title="La única pregunta"
        description="Seis filas, una por arquetipo del manifiesto menos Bandeja, que se crea con la cuenta y no se elige. La fila entera es la acción: la elegida se vuelve el acento, sin radio dibujado. Ni el nombre ni los sustantivos de abajo se escriben en el componente."
      >
        <SpecimenGrid cols={2}>
          <Specimen
            label="Como llega"
            hint={`value=${DEFAULT_IDENTITY} · Entrar activo desde el primer momento`}
          >
            <GallerySpecimen initial={DEFAULT_IDENTITY} />
          </Specimen>
          <Specimen label="Preseleccionado desde la landing" hint="?para=escritores">
            <GallerySpecimen initial="escritor" />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Lo que siembra cada arquetipo"
        description="Sin unidades escritas, que es el único caso que existe ahora. Una tarea estrena el día por arquetipo: el primer día no puede ser una lista que ya llega imposible."
      >
        <SpecimenGrid cols={2}>
          {ARCHETYPE_LIST.map((archetype) => (
            <Specimen
              key={archetype.id}
              label={SYSTEM_TYPE_CONFIG[archetype.systemType].label}
              hint={`systemType: ${archetype.systemType} · unitKind: ${archetype.seed.unitKind}`}
            >
              <SeedSpecimen identity={archetype.id} />
            </Specimen>
          ))}
        </SpecimenGrid>
      </SubSection>
    </Section>
  );
}
