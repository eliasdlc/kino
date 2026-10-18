"use client";

import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Section, SubSection, Specimen, SpecimenGrid, Seeded, seedQuery } from "../helpers";
import {
  makeTask,
  makeCheckin,
  makeEnergyPlanItem,
  mockWeeklyTrend,
  mockLearningInsight,
  mockAdvisorPattern,
  MOCK_CURVE, mid } from "../mock-data";
import { EnergyTodayCard } from "@/features/dashboard/EnergyTodayCard";
import { EnergyChart, curveSummary } from "@/features/dashboard/EnergyChart";
import { EnergyCount } from "@/features/dashboard/EnergyCount";
import { SectionHead } from "@/features/dashboard/SectionHead";
import { MarginRow } from "@/components/ui/margin-row";
import { STICKY_NOTE_COLORS, paperStyle } from "@/features/sticky-notes/sticky-note-colors";
import { EnergyCheckinForm } from "@/features/dashboard/EnergyCheckinForm";
import { FocusNowCard } from "@/features/dashboard/FocusNowCard";
import { PlanTaskRow } from "@/features/dashboard/PlanTaskRow";
import { WeeklyTrendsCard } from "@/features/dashboard/WeeklyTrendsCard";
import { LearningInsightCard } from "@/features/dashboard/LearningInsightCard";
import { AdvisorCard } from "@/features/dashboard/AdvisorCard";
import { OverBudgetExit } from "@/features/energy/OverBudgetExit";
import { CeilingMutedNotice } from "@/features/energy/CeilingMutedNotice";
import { ReturnNotice } from "@/features/today/ReturnNotice";
import { ClosingSignature } from "@/features/tasks/TaskDetailFields";
import type { TaskTransport } from "@/features/tasks/tasks.types";

const noop = () => {};

/** El día en sobregiro, con las tres que menos urgencia tienen. */
/** El instrumento descalibrado: catorce mediciones y su error. */
const TECHO_APAGADO = {
  mutedAt: "2026-09-08T00:00:00.000Z",
  errorMedio: 31,
  dias: 14,
  umbral: 25,
  predicciones: Array.from({ length: 14 }, (_, i) => {
    const dia = new Date(Date.UTC(2026, 7, 26 + i));
    const falla = i % 3 !== 0;
    return {
      date: dia.toISOString().slice(0, 10),
      slot: "morning",
      predicted: 50,
      reported: falla ? 16 : 42,
      error: falla ? 34 : 8,
    };
  }),
};

const SOBREGIRO = {
  committed: 62,
  limit: 50,
  overBy: 12,
  mover: [
    { id: "t-1", title: "Leer el syllabus de Bases de Datos", points: 3 },
    { id: "t-2", title: "Outline: en qué termina la historia", points: 3 },
    { id: "t-3", title: "Cambiar el filtro del agua", points: 1 },
  ],
};

/** La ausencia que el estado de regreso mide, con y sin datos de energía. */
const regreso = (conEnergia: boolean) => [
  seedQuery(api.today.returnNotice, {
    dias: 14,
    ultimaSesion: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    vencidas: 9,
    repetidas: 2,
    conEnergia,
  }),
];

/** Una tarea cerrada por cada vía, más una cerrada antes de que la firma existiera. */
const cerrada = (completedVia: string | null) =>
  ({ id: mid("t1"), title: "Entregar el informe", completedAt: new Date().toISOString(), completedVia }) as unknown as TaskTransport;

const conTiempo = (totalMinutes: number) => [seedQuery(api.tasks.timeLogSummary, { totalMinutes, sessionCount: 3 })];

/** Una fila que se tacha al tocar y se queda en su sitio: el gesto de Hoy, sin servidor. */
function StruckRowDemo() {
  const [done, setDone] = useState<Record<string, boolean>>({ p1: true });
  const [struck, setStruck] = useState<Record<string, boolean>>({ p1: true });
  const filas = [
    makeTask({ id: mid("p1"), title: "Terminar informe de laboratorio", priority: "critical", estimatedTime: "01:30:00" }),
    makeTask({ id: mid("p2"), title: "Revisar correos de la beca", estimatedTime: "00:30:00" }),
    makeTask({ id: mid("p3"), title: "Salir a caminar", priority: "low", energyLevel: "low", dueDate: "2026-09-08T12:00:00.000Z" }),
  ];
  const clave = (t: TaskTransport) => (t.title.startsWith("Terminar") ? "p1" : t.title.startsWith("Revisar") ? "p2" : "p3");
  return (
    <div className="max-w-xl">
      <SectionHead title="Plan de hoy" count="3 tareas, 1 hecha, 2:00" />
      {filas.map((t) => {
        const k = clave(t);
        return (
          <PlanTaskRow
            key={k}
            task={{ ...t, status: done[k] ? "done" : "today" } as TaskTransport}
            struck={Boolean(struck[k])}
            onComplete={() => {
              setDone((d) => ({ ...d, [k]: !d[k] }));
              setStruck((s) => ({ ...s, [k]: true }));
            }}
            onMoveToTomorrow={noop}
            onRemove={noop}
            onStartTimer={noop}
          />
        );
      })}
    </div>
  );
}

/** La nota adhesiva como papel real pegada en el margen de una fila. */
function PaperInMargin({ color, text }: { color: string; text: string }) {
  const paper = STICKY_NOTE_COLORS[color] ?? STICKY_NOTE_COLORS.yellow!;
  return (
    <span
      className="font-serif block size-[2.6rem] -rotate-[4deg] overflow-hidden rounded-[0.3rem] p-[0.3rem] text-[0.56rem] leading-[1.2]"
      style={{ ...paperStyle(paper.hex), color: paper.textHex }}
      aria-label={`Nota: ${text}`}
    >
      {text}
    </span>
  );
}

const chartData = MOCK_CURVE.map((predicted, hour) => ({
  hour,
  predicted,
  actual: hour === 9 ? 72 : hour === 15 ? 58 : null,
}));

export function DashboardSection() {
  return (
    <Section
      id="dashboard"
      number="10"
      title="Hoy"
      description="Las piezas de Hoy con datos de muestra: la cota con su cuenta, la curva de 24 barras en CSS, las filas de margen del plan que se tachan en su sitio, y las secciones con título y hairline que sustituyen a las cards. En laptop la energía va a la izquierda y el plan a la derecha; en el teléfono es la misma página, estrecha."
    >
      <SubSection
        title="La cota"
        description="La cifra del día en Bricolage 800 y en el acento, con su cuenta de 550 ms aislada en EnergyCount; la palabra que la explica es el h1 de la pantalla y la frase va en la voz, Literata cursiva. Debajo, la curva, el tramo como segmento en tinta y el registro como pastilla. La fecha de arriba enlaza al calendario. Interactivo (el guardado falla sin backend)."
      >
        <div className="max-w-xl">
          <EnergyTodayCard
            clock={{ hour: 15, date: "2026-09-11", timezone: "America/Santo_Domingo" }}
            initialCheckins={[makeCheckin()]}
            projectedCurve={MOCK_CURVE}
            chronotype="morning"
          />
        </div>
      </SubSection>

      <SubSection
        title="La cuenta de la cota"
        description="EnergyCount sola: cuenta de 0 al valor en 550 ms con ease-out cúbico; con movimiento reducido la cifra sale ya puesta. Es la única cifra de este tamaño en el producto."
      >
        <div className="flex items-end gap-8">
          <EnergyCount value={64} />
          <EnergyCount value={88} />
          <EnergyCount value={23} />
        </div>
      </SubSection>

      <SubSection
        title="La curva del día"
        description="EnergyChart en CSS puro: 24 barras de una rejilla escaladas con scaleY (nunca height), el pico en el acento, la hora actual en tinta y cada registro como un punto a la altura de su valor. No se anima. La figura lleva su frase como nombre accesible."
      >
        <div className="max-w-xl pl-(--margen)">
          <EnergyChart data={chartData} peak={{ start: 9, end: 12 }} currentHour={15} />
          <p className="mt-2 text-xs text-muted-foreground">{`Lo que lee un lector de pantalla: "${curveSummary(chartData, { start: 9, end: 12 }, 15)}"`}</p>
        </div>
      </SubSection>

      <SubSection title="El check-in" description="El formulario en la misma página: tramo y sueño como segmentos en tinta, la cifra en Bricolage sobre el deslizador, Guardar como única pastilla del acento.">
        <div className="max-w-md">
          <EnergyCheckinForm
            defaultLevel={65}
            initialSlot="morning"
            isPending={false}
            onSubmit={noop}
            onCancel={noop}
          />
        </div>
      </SubSection>

      <SubSection
        title="Enfoque ahora"
        description="La primera tarea del plan con las sesiones que le caben a la energía de este momento, bajo su título con hairline. Sin plan de hoy (no hay fetch aquí) no se pinta nada."
      >
        <div className="max-w-md">
          <FocusNowCard
            currentHour={15}
            energyItems={[makeEnergyPlanItem(makeTask({ title: "Repasar cálculo" }))]}
            projectedCurve={MOCK_CURVE}
          />
        </div>
      </SubSection>

      <SubSection
        title="La fila del plan y la tachada"
        description="PlanTaskRow es una fila de margen: el círculo de 48 px en el margen, el título a dos líneas, la meta con la palabra en peso y sólo vencida en coral, la duración en mute a la derecha. Un toque tacha la fila: el círculo se rellena con --ok, el título cae a mute y la fila se queda en su sitio. Las demás acciones viven en un menú de 48 px que en escritorio aparece al pasar el ratón. Tócalas."
      >
        <StruckRowDemo />
      </SubSection>

      <SubSection
        title="La nota adhesiva en el margen"
        description="Hoy no tiene notas adhesivas: viven en los manuscritos, y se quedan donde se pegan. Cuando una asome en una página de Diario, es papel real en el margen de su fila, con su color y su sombra, y nunca entra en la columna de texto."
      >
        <div className="max-w-xl">
          <MarginRow margin={<PaperInMargin color="yellow" text="Preguntar la fecha del examen" />} trailing="cap. 3">
            <span className="font-serif block text-base leading-tight">El tercer manuscrito</span>
            <span className="mt-0.5 block text-[0.82rem] text-muted-foreground">1.240 palabras, editado ayer</span>
          </MarginRow>
          <MarginRow margin={<PaperInMargin color="blue" text="Revisar el tono del diálogo" />} trailing="cap. 4">
            <span className="font-serif block text-base leading-tight">La carta que no llegó</span>
            <span className="mt-0.5 block text-[0.82rem] text-muted-foreground">860 palabras, hace tres días</span>
          </MarginRow>
        </div>
      </SubSection>

      <SubSection title="La fila inferior" description="Los bloques de abajo del plan, cada uno con su título y hairline, sin caja alrededor.">
        <SpecimenGrid cols={2}>
          <Specimen label="Últimos 7 días" hint="tasa de completado y energía de 7 días" className="items-stretch">
            <div className="w-full">
              <SectionHead title="Últimos 7 días" />
              <WeeklyTrendsCard trends={mockWeeklyTrend()} />
            </div>
          </Specimen>
          <Specimen label="Tu patrón" hint="pico, precisión, personalización" className="items-stretch">
            <div className="w-full">
              <SectionHead title="Tu patrón" />
              <LearningInsightCard insight={mockLearningInsight()} />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="El día que no cabe"
        description="La salida del sobregiro: la cifra delante, el día como sujeto, y las tres del plan que menos urgencia tienen ya elegidas. En ámbar, porque el rojo queda para lo irreversible y pasarse del techo no lo es. Sin botón de dejarlo así: el bloque se va cuando el día vuelve a caber, no cuando alguien lo silencia."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="OverBudgetExit" hint="62 de 50 puntos" className="items-stretch">
            <Seeded stubs={[seedQuery(api.energy.overBudgetExit, SOBREGIRO)]}>
              <div className="w-full">
                <OverBudgetExit />
              </div>
            </Seeded>
          </Specimen>
          <Specimen
            label="CeilingMutedNotice"
            hint="el techo apagado, con sus catorce mediciones"
            className="items-stretch"
          >
            <Seeded stubs={[seedQuery(api.energy.ceilingHonesty, TECHO_APAGADO)]}>
              <div className="w-full">
                <CeilingMutedNotice />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="AdvisorCard" hint="los dos patrones que quedan" className="items-stretch">
            <div className="w-full">
              <AdvisorCard
                pattern={mockAdvisorPattern()}
                actionTaskIds={["a"]}
                actionLabel="Poner la más pequeña en hoy"
                bulkAction="move-today"
              />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="La firma del cierre"
        description="En el detalle de una tarea cerrada: quién la cerró, por qué vía y cuánto trabajo observado tiene, que sale de los time logs y nunca de la estimación. Los tres estados van al mismo tamaño de letra a propósito: lo que no se sabe pesa lo mismo que lo que se sabe."
      >
        <SpecimenGrid>
          <Specimen label="Desde el navegador" hint="completedVia: session">
            <Seeded stubs={conTiempo(95)}>
              <ClosingSignature task={cerrada("session")} />
            </Seeded>
          </Specimen>
          <Specimen label="Cerrada en GitHub" hint="completedVia: sync, sin persona">
            <Seeded stubs={conTiempo(0)}>
              <ClosingSignature task={cerrada("sync")} />
            </Seeded>
          </Specimen>
          <Specimen label="Sin firma" hint="anterior al registro de autoría">
            <Seeded stubs={conTiempo(0)}>
              <ClosingSignature task={cerrada(null)} />
            </Seeded>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="El estado de regreso"
        description="Bajo el plan al volver después de más de siete días. No pide ninguna decisión, así que no gasta la única interrupción del día: si hoy además hay línea arriba, salen las dos."
      >
        <SpecimenGrid>
          <Specimen label="Con datos de energía" hint="conEnergia: true">
            <Seeded stubs={regreso(true)}>
              <ReturnNotice />
            </Seeded>
          </Specimen>
          <Specimen label="Sin datos del periodo" hint="lo dice en la misma frase y al mismo tamaño">
            <Seeded stubs={regreso(false)}>
              <ReturnNotice />
            </Seeded>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

    </Section>
  );
}
