"use client";

import { api } from "@convex/_generated/api";

import { useState } from "react";
import { Section, Seeded, SpecimenGrid, Specimen, SubSection, seedQuery } from "../helpers";
import { makeSystem, makeTask, MOCK_SYSTEM_ID, mid } from "../mock-data";
import { Button } from "@/components/ui/button";
import { ComposeSystemDialog } from "@/features/systems/ComposeSystemDialog";
import { CustomTaskCard } from "@/features/tasks/cards/CustomTaskCard";
import {
  SYSTEM_TYPE_CONFIG,
  type ArchetypeManifest,
  type SystemComposition,
  type SystemType,
} from "@/shared/lib/system-types";
import { resolveManifest } from "@/shared/lib/system-manifest";
import {
  containerDetailEmptyCopy,
  containersEmptyCopy,
  pagesEmptyCopy,
  tasksEmptyCopy,
} from "@/shared/lib/archetype-copy";

/**
 * Sistema componible y vocabulario de arquetipo (KIN-134 / D16).
 *
 * Los estados vacíos son el sitio donde más se nota que un producto habla tu
 * idioma o el de su base de datos, así que aquí se ven todos juntos: la misma
 * pantalla vacía dicha en cinco vocabularios, y el formulario con el que un
 * sistema `custom` se inventa el suyo.
 */

const BUFETE: SystemComposition = {
  containers: { enabled: true, noun: "expediente", nounPlural: "expedientes" },
  pages: { noun: "minuta", nounPlural: "minutas", primary: false },
  taskKinds: [
    { id: mid("audiencia"), label: "Audiencia" },
    { id: mid("escrito"), label: "Escrito" },
  ],
};

const SHOWCASE: { key: string; label: string; hint: string; manifest: ArchetypeManifest }[] = [
  ...(["academic", "entrepreneurial", "writing", "personal", "project"] as SystemType[]).map(
    (type) => ({
      key: type,
      label: SYSTEM_TYPE_CONFIG[type].label,
      hint: `systemType: ${type}`,
      manifest: SYSTEM_TYPE_CONFIG[type],
    }),
  ),
  {
    key: "custom-compuesto",
    label: "Custom compuesto",
    hint: "composition: expediente / minuta",
    manifest: resolveManifest("custom", { composition: BUFETE }),
  },
];

/** Caja vacía real: mismo borde punteado y jerarquía que usan las vistas. */
function EmptyBox({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="w-full rounded-lg border border-dashed p-4 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function ComposeSpecimen() {
  const [open, setOpen] = useState(false);
  const system = makeSystem({
    name: "Bufete",
    templateType: "custom",
    icon: "folder",
    metadata: { composition: BUFETE },
  });
  return (
    <Seeded stubs={[seedQuery(api.systems.list, [system])]}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Componer
      </Button>
      <ComposeSystemDialog system={system} open={open} onOpenChange={setOpen} />
    </Seeded>
  );
}

function CustomCardSpecimen({ kind }: { kind: string | null }) {
  const system = makeSystem({
    id: MOCK_SYSTEM_ID,
    name: "Bufete",
    templateType: "custom",
    metadata: { composition: BUFETE },
  });
  const task = makeTask({
    title: "Preparar alegato de cierre",
    metadata: kind ? { kind } : null,
  });
  return (
    <Seeded stubs={[seedQuery(api.systems.list, [system])]}>
      <div className="w-full">
        <CustomTaskCard
          task={task}
          systemId={MOCK_SYSTEM_ID}
          onToggle={() => {}}
          onDelete={() => {}}
        />
      </div>
    </Seeded>
  );
}

export function ComposableSection() {
  return (
    <Section
      id="componible"
      number="19"
      title="Sistema componible y vocabulario"
      description="Un sistema académico vacío no dice «no hay carpetas»: dice «todavía no tienes clases». Todo el copy de esta sección sale del manifiesto — solo cambia el arquetipo, no el componente."
    >
      <SubSection
        title="Contenedores vacíos"
        description="El mismo estado vacío en cinco vocabularios. Los arquetipos sin contenedores (Proyecto) no pintan nada: explicar una ausencia que el usuario nunca pidió es ruido."
      >
        <SpecimenGrid cols={2}>
          {SHOWCASE.map(({ key, label, hint, manifest }) => {
            const copy = containersEmptyCopy(manifest);
            return (
              <Specimen key={key} label={label} hint={hint}>
                {copy ? (
                  <EmptyBox {...copy} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sin contenedores: folderRole = null
                  </p>
                )}
              </Specimen>
            );
          })}
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Biblioteca y contenedor abierto"
        description="La superficie de páginas y el detalle de un contenedor concuerdan en género con su sustantivo: «esta clase está vacía», «este milestone está vacío»."
      >
        <SpecimenGrid cols={2}>
          {SHOWCASE.map(({ key, label, hint, manifest }) => (
            <Specimen key={key} label={label} hint={hint} className="flex-col items-stretch gap-2">
              <EmptyBox {...pagesEmptyCopy(manifest)} />
              {manifest.folderRole && <EmptyBox {...containerDetailEmptyCopy(manifest)} />}
            </Specimen>
          ))}
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Funnel de tareas vacío"
        description="«Tarea» es palabra de Kino y se queda; lo que cambia es de dónde viene el trabajo — de tus clases, de tus obras, de tus expedientes."
      >
        <SpecimenGrid cols={2}>
          {SHOWCASE.map(({ key, label, hint, manifest }) => (
            <Specimen key={key} label={label} hint={hint} className="flex-col items-stretch gap-2">
              <EmptyBox {...tasksEmptyCopy(manifest, "backlog")} />
              <EmptyBox {...tasksEmptyCopy(manifest, "action")} />
              <EmptyBox {...tasksEmptyCopy(manifest, "archive")} />
            </Specimen>
          ))}
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Componer un sistema custom"
        description="El formulario que produce ese vocabulario. El preview del final es el estado vacío real: se ve cómo va a leerse antes de guardar."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Diálogo de composición" hint="ComposeSystemDialog · systemType custom">
            <ComposeSpecimen />
          </Specimen>
          <Specimen
            label="Card con kind compuesto"
            hint="metadata.kind = audiencia"
            className="items-stretch"
          >
            <CustomCardSpecimen kind="audiencia" />
          </Specimen>
          <Specimen label="Card sin kind" hint="sin componer: fila genérica" className="items-stretch">
            <CustomCardSpecimen kind={null} />
          </Specimen>
        </SpecimenGrid>
      </SubSection>
    </Section>
  );
}
