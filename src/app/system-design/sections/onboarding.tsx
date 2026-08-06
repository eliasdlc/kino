"use client";

import { useState } from "react";
import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import { StepIdentity } from "@/features/onboarding/steps/StepIdentity";
import { StepFirstSystem } from "@/features/onboarding/steps/StepFirstSystem";
import { StepPromise } from "@/features/onboarding/steps/StepPromise";
import {
  ARCHETYPE_LIST,
  getArchetype,
  seedUnitField,
  type ArchetypeIdentity,
} from "@/features/onboarding/onboarding.archetypes";
import type { SeedUnitInput } from "@/features/onboarding/onboarding.schemas";

/**
 * La bifurcación por identidad del onboarding (KIN-128 / D14).
 *
 * Los tres pasos que cambian con el arquetipo van aquí con datos reales del
 * manifiesto: lo que se ve es el mismo copy y el mismo plan de siembra que
 * recibe quien entra por primera vez. Los specimens de siembra se pintan por
 * arquetipo a propósito — el punto del ticket es que "clase", "milestone" y
 * "obra" no son el mismo formulario con otra etiqueta.
 */

const noop = () => {};

/** Unidades ya escritas, como quedarían justo antes de terminar el wizard. */
const FILLED_UNITS: Record<ArchetypeIdentity, SeedUnitInput[]> = {
  estudiante: [{ name: "Cálculo II" }, { name: "Historia del arte" }],
  builder: [{ name: "Terminar el login" }, { name: "Publicar la landing" }],
  emprendedor: [{ name: "Lanzar la beta" }],
  escritor: [{ name: "La casa vacía", field: "screenplay" }],
  propio: [{ name: "Llamar al banco" }],
};

function emptyUnits(identity: ArchetypeIdentity): SeedUnitInput[] {
  const archetype = getArchetype(identity);
  const firstOption = seedUnitField(archetype)?.options?.[0]?.value;
  return archetype.seed.placeholders.map(() => ({
    name: "",
    ...(firstOption ? { field: firstOption } : {}),
  }));
}

/** El paso es controlado: el specimen le presta el estado para poder tocarlo. */
function FirstSystemSpecimen({ identity }: { identity: ArchetypeIdentity }) {
  const archetype = getArchetype(identity);
  const [name, setName] = useState(archetype.systemNameDefault);
  const [units, setUnits] = useState<SeedUnitInput[]>(() => emptyUnits(identity));

  return (
    <StepFirstSystem
      identity={identity}
      name={name}
      onNameChange={setName}
      units={units}
      onUnitsChange={setUnits}
      onNext={noop}
      onBack={noop}
    />
  );
}

function IdentitySpecimen({ initial }: { initial: ArchetypeIdentity | null }) {
  const [value, setValue] = useState<ArchetypeIdentity | null>(initial);
  return <StepIdentity value={value} onChange={setValue} onNext={noop} onBack={noop} />;
}

export function OnboardingSection() {
  return (
    <Section
      id="onboarding"
      number="18"
      title="Onboarding por identidad"
      description="La bifurcación temprana decide vocabulario y contenido de arranque: un estudiante termina con su semestre esbozado, un escritor con su obra creada."
    >
      <SubSection
        title="Bifurcación"
        description="Cinco identidades leídas del manifiesto. El botón queda bloqueado hasta elegir; llegar desde /para/escritores preselecciona la tarjeta."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Sin elegir" hint="value={null} · Siguiente deshabilitado">
            <IdentitySpecimen initial={null} />
          </Specimen>
          <Specimen label="Preseleccionado desde la landing" hint='?para=escritores'>
            <IdentitySpecimen initial="escritor" />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Primer sistema y siembra"
        description="Mismo componente, cinco vocabularios. Nada de esto está hardcodeado: el sustantivo de la unidad, los ejemplos y el campo extra salen del manifiesto de arquetipo."
      >
        <SpecimenGrid cols={2}>
          {ARCHETYPE_LIST.map((archetype) => (
            <Specimen
              key={archetype.id}
              label={archetype.label}
              hint={`systemType: ${archetype.systemType} · unitKind: ${archetype.seed.unitKind}`}
            >
              <FirstSystemSpecimen identity={archetype.id} />
            </Specimen>
          ))}
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Cierre"
        description="El último paso previsualiza las tareas que la siembra va a crear de verdad — no un plan de muestra inventado."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Estudiante con dos clases" hint="2 carpetas + 3 tareas">
            <StepPromise
              identity="estudiante"
              systemName="Semestre actual"
              units={FILLED_UNITS.estudiante}
              onSubmit={noop}
              onBack={noop}
              isLoading={false}
            />
          </Specimen>
          <Specimen label="Escritor con su obra" hint="1 obra + primer manuscrito">
            <StepPromise
              identity="escritor"
              systemName="Escritura"
              units={FILLED_UNITS.escritor}
              onSubmit={noop}
              onBack={noop}
              isLoading={false}
            />
          </Specimen>
          <Specimen label="Builder" hint="sin carpetas: tarjetas del board">
            <StepPromise
              identity="builder"
              systemName="Mi proyecto"
              units={FILLED_UNITS.builder}
              onSubmit={noop}
              onBack={noop}
              isLoading={false}
            />
          </Specimen>
          <Specimen label="Sin sembrar nada" hint="propio + 0 unidades → estado vacío honesto">
            <StepPromise
              identity="propio"
              systemName="Trabajo"
              units={[]}
              onSubmit={noop}
              onBack={noop}
              isLoading={false}
            />
          </Specimen>
          <Specimen label="Guardando" hint="isLoading">
            <StepPromise
              identity="emprendedor"
              systemName="Mi emprendimiento"
              units={FILLED_UNITS.emprendedor}
              onSubmit={noop}
              onBack={noop}
              isLoading
            />
          </Specimen>
        </SpecimenGrid>
      </SubSection>
    </Section>
  );
}
