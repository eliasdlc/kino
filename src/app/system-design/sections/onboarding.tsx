"use client";

import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ClientOnly, Section, Seeded, seedQuery, SubSection, Specimen, SpecimenGrid } from "../helpers";
import { CAPTURA_CON_ITEMS, CAPTURA_POR_CADUCAR, makeSystem, makeTask, mid } from "../mock-data";
import { ArchetypeGallery } from "@/features/onboarding/ArchetypeGallery";
import { GlobalCalendarMobileView } from "@/features/calendar/GlobalCalendarMobileView";
import { ProgramarSheet } from "@/features/calendar/ProgramarSheet";
import { groupTasksByDay } from "@/features/calendar/calendar.layout";
import { startOfWeek } from "date-fns";
import { InboxView } from "@/features/systems/views/InboxView";
import { GroupNudge } from "@/features/systems/GroupNudge";
import { CaptureRow } from "@/features/captures/CaptureRow";
import { ShareConfirm } from "@/features/captures/ShareConfirm";
import { PuertaEncabezado, PuertaEsperando } from "@/features/auth/Puerta";
import { PUERTA_CREAR, PUERTA_ENTRAR } from "@/features/auth/puertas.copy";
import { PastillaSinConexion } from "@/features/offline/OfflineIndicator";
import { Reintentar } from "@/features/offline/Reintentar";
import { CompartirFallo, CompartirScreen } from "@/app/(share)/compartir/CompartirScreen";
import { AudioWave } from "@/features/captures/AudioWave";
import { SearchEmptyState } from "@/features/search/SearchEmptyState";
import { CalendarioEscritorio } from "@/features/calendar/CalendarioEscritorio";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import {
  ARCHETYPE_LIST,
  DEFAULT_IDENTITY,
  type ArchetypeIdentity,
} from "@/features/onboarding/onboarding.archetypes";
import { buildSeedPlan } from "@/features/onboarding/onboarding.seed";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";

/**
 * Las puertas y el resto: el calendario del teléfono, Bandeja con sus capturas,
 * entrar y crear cuenta, el alta de una pregunta, offline y el recibo de
 * compartir. El alta son dos pantallas y una pregunta; la segunda es Hoy, así
 * que de ella se enseña la galería y lo que cada arquetipo siembra.
 *
 * Ni una etiqueta de este archivo es literal: el nombre sale de
 * `SYSTEM_TYPE_CONFIG.label` y la siembra de `buildSeedPlan`, el mismo que corre
 * en el servidor. Lo que se ve es lo que recibe quien entra por primera vez.
 */


const noop = () => {};

function aLas(hora: number, minutos = 0): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, minutos).toISOString();
}

const DIA_CON_TAREAS: TaskTransport[] = [
  makeTask({ id: mid("cal-a"), title: "Revisar el capítulo tres", startDate: aLas(9, 30), estimatedTime: "01:00:00", energyLevel: "high" }),
  makeTask({ id: mid("cal-b"), title: "Llamar a la editorial", dueDate: aLas(16), effectivePriority: "high", priority: "high" }),
  makeTask({ id: mid("cal-c"), title: "Leer antes de dormir", startDate: aLas(23, 15), energyLevel: "low", estimatedTime: "00:30:00" }),
  makeTask({ id: mid("cal-d"), title: "Entregar el resumen", dueDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() }),
];
const SIN_FECHA: TaskTransport[] = [
  makeTask({ id: mid("cal-e"), title: "Escribir la sinopsis", energyLevel: "medium" }),
  makeTask({ id: mid("cal-f"), title: "Ordenar las notas del viaje", energyLevel: "low" }),
];

/** El calendario del teléfono con su estado de día elegido y la sin fecha abierta. */
function CalendarioSpecimen({ tareas }: { tareas: TaskTransport[] }) {
  const [dia, setDia] = useState(() => new Date(new Date().setHours(0, 0, 0, 0)));
  return (
    <div className="w-full max-w-[393px] overflow-hidden rounded-xl border border-border bg-background">
      <GlobalCalendarMobileView
        selectedDay={dia}
        onSelectDay={setDia}
        byDayAllDay={groupTasksByDay(tareas, { timed: false })}
        timedByDay={groupTasksByDay(tareas, { timed: true })}
        unscheduledTasks={SIN_FECHA}
        onProgramar={noop}
        onOpenTask={noop}
        onComplete={noop}
        tituloComo="h2"
      />
    </div>
  );
}

/**
 * La rejilla de escritorio con la columna de sin programar en filas de índice.
 * Lleva `@dnd-kit` dentro; en la app se carga sola en escritorio.
 */
function EscritorioSpecimen() {
  const [semana, setSemana] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dia, setDia] = useState(() => new Date(new Date().setHours(0, 0, 0, 0)));
  return (
    <div className="h-[34rem] w-full overflow-hidden rounded-xl border border-border bg-background">
      <CalendarioEscritorio
        datos={{
          byDayAllDay: groupTasksByDay(DIA_CON_TAREAS, { timed: false }),
          timedByDay: groupTasksByDay(DIA_CON_TAREAS, { timed: true }),
          unscheduledTasks: SIN_FECHA,
          sugerencia: (task) => (task.energyLevel === "low" ? 16 : 10),
        }}
        weekStart={semana}
        onWeekStart={setSemana}
        selectedDay={dia}
        onSelectDay={setDia}
        projectedCurve={[]}
        onUpdate={noop}
        onProgramar={noop}
        onOpenTask={noop}
        onAcceptSuggestion={noop}
      />
    </div>
  );
}

function ProgramarSpecimen() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Programar Escribir la sinopsis
      </Button>
      <ProgramarSheet
        task={SIN_FECHA[0]!}
        day={new Date()}
        open={open}
        onOpenChange={setOpen}
        suggestedHour={10}
        onSchedule={noop}
      />
    </>
  );
}

const BANDEJA = makeSystem({ id: mid("sys-resto"), name: "Bandeja", templateType: "inbox", isInbox: true });
const SUELTAS = Array.from({ length: 3 }, (_, i) =>
  makeTask({ id: mid(`band-${i}`), systemId: BANDEJA.id, title: ["Comprar el cuaderno cuadriculado", "Idea: cheat sheet de límites", "Buscar el paper original"][i]!, status: "backlog" }),
);

function ConfirmarSpecimen() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir la captura con propuestas
      </Button>
      <ShareConfirm captura={CAPTURA_CON_ITEMS} open={open} onOpenChange={setOpen} onConfirm={() => setOpen(false)} onDiscard={() => setOpen(false)} />
    </>
  );
}

function SinLeerSpecimen() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir una captura que nadie ha leído
      </Button>
      <ShareConfirm captura={CAPTURA_POR_CADUCAR} open={open} onOpenChange={setOpen} onConfirm={() => setOpen(false)} onDiscard={() => setOpen(false)} />
    </>
  );
}

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
      title="Las puertas, Bandeja y el calendario"
      description="Lo que queda fuera de Hoy, Tareas y Sistemas, en Diario: el calendario del teléfono como página del día, Bandeja como una lista de filas de margen, entrar y crear cuenta sin la card de Clerk, el alta de una pregunta, offline y el recibo de compartir."
    >
      <SubSection
        title="El calendario en el teléfono"
        description="La cabecera en dos renglones (título con Hoy, fecha con las flechas) para caber desde 320 px. La semana en una tira de siete días de 2.85rem hasta el canto del papel, el elegido en tinta y hoy con el numeral en ámbar; un punto por tarea hasta tres. Debajo, el día: las de hora con la hora en el margen, a cualquier hora (23:15 también), y las de todo el día con su glifo. Tocar una fila abre el detalle; a la derecha, Mover (la misma hoja que programa) y el círculo de completar de 48 px. El vacío lleva a las que no tienen fecha."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Un día con tareas" hint="con hora, todo el día y sin programar" className="items-stretch">
            <ClientOnly>
              <CalendarioSpecimen tareas={DIA_CON_TAREAS} />
            </ClientOnly>
          </Specimen>
          <Specimen label="Un día vacío" hint="EmptyState, sin rejilla de horas de adorno" className="items-stretch">
            <ClientOnly>
              <CalendarioSpecimen tareas={[]} />
            </ClientOnly>
          </Specimen>
          <Specimen label="ProgramarSheet" hint="la operación con nombre que sustituye al arrastre; con fecha se llama Mover">
            <ProgramarSpecimen />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="El calendario en escritorio"
        description="Un trozo aparte que sólo se pide en escritorio, porque trae @dnd-kit: el teléfono no lo descarga. La columna de sin programar es un índice de filas con hairline, como en el teléfono, con la hora que pide la energía en tinta subrayada (es una sugerencia, no la acción primaria) y Programar. Los bloques de la rejilla se abren con clic, Intro o Espacio, y se arrastran sólo con el ratón."
      >
        <Specimen label="CalendarioEscritorio" hint="semana, todo el día, bloques y sin programar" className="items-stretch">
          <ClientOnly>
            <EscritorioSpecimen />
          </ClientOnly>
        </Specimen>
      </SubSection>

      <SubSection
        title="Bandeja"
        description="Una sola lista de filas de margen: la captura con su glifo en el margen y su estado en palabras (sin leer, cuántas propone, cuándo llegó, de dónde; caducada en coral), la tarea con el círculo de 48 px que tacha en su sitio y ofrece Deshacer 4 s. Bajo el título, siempre una línea que dice qué espera. Descartar una captura también ofrece Deshacer 4 s y confirmar dice cuántas tareas creó y dónde. El empuje de ocho es una fila con la cifra en el margen."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Con capturas y tareas" hint="initialCaptures del servidor" className="items-stretch">
            <Seeded stubs={[seedQuery(api.tasks.bySystem, SUELTAS)]}>
              <div className="w-full max-w-[393px]">
                <InboxView system={BANDEJA} initialTasks={SUELTAS} initialCaptures={[CAPTURA_CON_ITEMS, CAPTURA_POR_CADUCAR]} tituloComo="h2" />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Vacía" hint="EmptyState con la acción de capturar" className="items-stretch">
            <Seeded stubs={[seedQuery(api.tasks.bySystem, [])]}>
              <div className="w-full max-w-[393px]">
                <InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[]} tituloComo="h2" />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="CaptureRow" hint="con propuestas, por caducar y caducada" className="items-stretch">
            <ul className="w-full max-w-[393px] [&>li:last-child>*]:border-b-0">
              <CaptureRow captura={CAPTURA_CON_ITEMS} onOpen={noop} />
              <CaptureRow captura={CAPTURA_POR_CADUCAR} onOpen={noop} />
              <CaptureRow captura={{ ...CAPTURA_POR_CADUCAR, id: mid("cap-resto"), kind: "voice", url: null, status: "expired", avisa: false }} onOpen={noop} />
            </ul>
          </Specimen>
          <Specimen label="GroupNudge" hint="desde ocho, la cifra en el margen" className="items-stretch">
            <div className="w-full max-w-[393px]">
              <GroupNudge count={12} onTriage={noop} />
            </div>
          </Specimen>
          <Specimen label="ShareConfirm" hint="marcas en tinta, títulos enteros, la lista se desplaza y Confirmar se queda">
            <ConfirmarSpecimen />
          </Specimen>
          <Specimen label="ShareConfirm sin leer" hint="cómo conectar el agente, Dejarla aquí, Descartarla">
            <SinLeerSpecimen />
          </Specimen>
          <Specimen label="AudioWave" hint="reproduce de verdad; por encima de 12 MB no lee el cuerpo ni dibuja onda" className="items-stretch">
            <div className="w-full max-w-[24rem]">
              <AudioWave src="/sounds/no-existe.webm" segundos={47} />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Las puertas"
        description="Entrar y crear cuenta llevan la marca de la cabecera (la palabra Kino, sin tile), el título en Bricolage y una frase del producto en la voz, y el formulario de Clerk se asienta en el papel, sin card ni sombras, con campos, enlace del pie y ojo de la contraseña a 48 px. Antes de hidratar ya se pintan el título, la frase y la forma del formulario con sus huecos reales. Offline dice qué sí funciona sin red y reintenta de verdad; el recibo de compartir y su error dicen dónde quedó lo compartido, en la voz."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Entrar, antes de hidratar" hint="PuertaEsperando: el fallback de la ruta" className="items-stretch">
            <div className="w-full max-w-[26rem]">
              <PuertaEsperando {...PUERTA_ENTRAR} tituloComo="h2" />
            </div>
          </Specimen>
          <Specimen label="Crear cuenta" hint="la frase dice qué viene después" className="items-stretch">
            <div className="w-full max-w-[26rem]">
              <PuertaEncabezado {...PUERTA_CREAR} tituloComo="h2" />
            </div>
          </Specimen>
          <Specimen label="OfflineIndicator" hint="papel con hairline, sin desenfoque ni sombra">
            <PastillaSinConexion />
          </Specimen>
          <Specimen label="Reintentar" hint="sin red lo dice en vez de recargar" className="items-stretch">
            <div className="w-full max-w-[24rem]">
              <Reintentar />
            </div>
          </Specimen>
          <Specimen label="El recibo de compartir" hint="texto compartido, sin card" className="items-stretch">
            <div className="w-full max-w-[393px] overflow-hidden rounded-xl border border-border bg-background">
              <CompartirScreen
                registro={{ id: "reg-cat", ownerId: null, kind: "text", name: null, size: 0, text: "Idea para la tesis: medir la energía antes de planear, no después.", url: null, receivedAt: 0, estado: "subida", blob: null }}
                previewUrl={null}
                incrustada
              />
            </div>
          </Specimen>
          <Specimen label="El error de compartir" hint="compartir/error.tsx: dice que no se perdió" className="items-stretch">
            <div className="w-full max-w-[393px] overflow-hidden rounded-xl border border-border bg-background">
              <CompartirFallo onReintentar={noop} incrustada />
            </div>
          </Specimen>
          <Specimen label="SearchEmptyState" hint="dice dónde miró, en la voz, con «o»" className="items-stretch">
            <div className="w-full max-w-[26rem]">
              <SearchEmptyState query="marco teórico" />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="La única pregunta del alta"
        description="Seis filas de margen, una por arquetipo del manifiesto menos Bandeja, que se crea con la cuenta y no se elige. El icono en el margen, la fila entera es la acción y la elegida se dice en tinta: el ámbar queda para Entrar. Ni el nombre ni los sustantivos de abajo se escriben en el componente."
      >
        <SpecimenGrid cols={2}>
          <Specimen
            label="Como llega"
            hint={`value=${DEFAULT_IDENTITY}, Entrar activo desde el primer momento`}
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
              hint={`systemType: ${archetype.systemType}, unitKind: ${archetype.seed.unitKind}`}
            >
              <SeedSpecimen identity={archetype.id} />
            </Specimen>
          ))}
        </SpecimenGrid>
      </SubSection>
    </Section>
  );
}
