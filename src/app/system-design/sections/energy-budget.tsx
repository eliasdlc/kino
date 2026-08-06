"use client";

import { useState, useSyncExternalStore } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import { mockLearningInsight } from "../mock-data";
import { EnergyBudgetBar } from "@/features/energy/EnergyBudgetBar";
import { WeeklyRitualPrompt } from "@/features/energy/WeeklyRitualPrompt";
import { LearningInsightCard } from "@/features/dashboard/LearningInsightCard";
import { WeeklyReviewDaySection } from "@/features/settings/WeeklyReviewDaySection";
import { weeklyRitualKey } from "@/features/energy/WeeklyRitualDialog";
import { WEEKDAY_ORDER } from "@/features/energy/energy.ritual";
import { taskKeys } from "@/features/tasks/tasks.keys";
import { userSettingsKey } from "@/features/settings/settings.hooks";
import type { VerificationLoop } from "@/features/energy/energy.prediction";

/**
 * Las superficies de Fase 4 (energía visible).
 *
 * `EnergyBudgetBar` y `WeeklyRitualPrompt` no reciben datos por props: los
 * derivan del cache de react-query, igual que en el dashboard. Para poder
 * mostrar varios estados en la misma página cada specimen monta su propio
 * QueryClient sembrado — así lo que se ve aquí sale del mismo cálculo que ve el
 * usuario, en vez de un componente de mentira que se parezca.
 */

function seededTask(id: string, energyLevel: string, status: string) {
  return { id, title: `Tarea ${id}`, energyLevel, status };
}

/** Un QueryClient aislado por specimen, sembrado antes del primer render. */
function Seeded({
  seed,
  children,
}: {
  seed: (qc: QueryClient) => void;
  children: React.ReactNode;
}) {
  const [client] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
    });
    seed(qc);
    return qc;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * Monta solo en el cliente. La tira del ritual decide si hoy es el día de
 * revisión con `new Date()`, y en producción eso nunca corre en SSR porque los
 * ajustes aún no están en cache. Aquí sí los sembramos antes del primer render,
 * así que sin este guard el server (en su tz) y el cliente (en la del usuario)
 * pueden discrepar de día y romper la hidratación — un artefacto del specimen,
 * no del componente.
 */
const subscribeNoop = () => () => {};

function ClientOnly({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return <>{children}</>;
}

function seedBudget(tasks: ReturnType<typeof seededTask>[], limit: number) {
  return (qc: QueryClient) => {
    qc.setQueryData(taskKeys.todayPlan(), tasks as never);
    qc.setQueryData(userSettingsKey(), {
      dailyEnergyLimit: limit,
      timezone: "America/Santo_Domingo",
      theme: "system",
      notificationsEnabled: true,
      weeklyReviewDay: "sun",
    } as never);
  };
}

const highs = (n: number, done = 0) =>
  Array.from({ length: n }, (_, i) => seededTask(`h${i}`, "high", i < done ? "done" : "pending"));

/** El ciclo del día en sus tres desenlaces. */
const LOOPS: Array<{ label: string; hint: string; loop: VerificationLoop }> = [
  {
    label: "Acierto, y el modelo mejoró",
    hint: "verdict hit · improvementPct 4",
    loop: {
      slot: "morning",
      predictedLevel: 72,
      reportedLevel: 75,
      delta: 3,
      verdict: "hit",
      alphaBeforePct: 38,
      alphaAfterPct: 42,
      improvementPct: 4,
      fromLearnedCurve: true,
      userVerdict: null,
    },
  },
  {
    label: "Sin curva aprendida",
    hint: "fromLearnedCurve false · sale del cronotipo",
    loop: {
      slot: "afternoon",
      predictedLevel: 60,
      reportedLevel: 35,
      delta: -25,
      verdict: "miss",
      alphaBeforePct: 0,
      alphaAfterPct: 3,
      improvementPct: 3,
      fromLearnedCurve: false,
      userVerdict: null,
    },
  },
  {
    label: "El modelo no se movió",
    hint: "improvementPct null · ya te esperaba así",
    loop: {
      slot: "evening",
      predictedLevel: 48,
      reportedLevel: 44,
      delta: -4,
      verdict: "close",
      alphaBeforePct: 51,
      alphaAfterPct: 51,
      improvementPct: null,
      fromLearnedCurve: true,
      userVerdict: "accurate",
    },
  },
];

/**
 * La tira del ritual solo aparece el día de revisión del usuario, así que el
 * specimen siembra ese día como "hoy" — si no, la sección estaría vacía seis
 * días de cada siete.
 */
function seedRitual(qc: QueryClient) {
  const todayWeekday = WEEKDAY_ORDER[(new Date().getDay() + 6) % 7]!;
  const today = new Date().toISOString().slice(0, 10);
  const plus = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const weekdayIn = (n: number) =>
    WEEKDAY_ORDER[(new Date(Date.now() + n * 86_400_000).getDay() + 6) % 7]!;

  qc.setQueryData(userSettingsKey(), {
    dailyEnergyLimit: 50,
    timezone: "America/Santo_Domingo",
    theme: "system",
    notificationsEnabled: true,
    weeklyReviewDay: todayWeekday,
  } as never);

  qc.setQueryData(weeklyRitualKey(), {
    reviewDay: todayWeekday,
    isReviewDay: true,
    today,
    timezone: "America/Santo_Domingo",
    dailyLimit: 50,
    overdueCount: 4,
    todayBudget: {
      committed: 44,
      spent: 12,
      pending: 32,
      remaining: 6,
      limit: 50,
      pct: 88,
      spentPct: 24,
      state: "tight",
      overBy: 0,
    },
    redistribution: {
      assignments: [
        {
          taskId: "t1",
          title: "Cerrar el reporte de agosto",
          date: plus(1),
          weekday: weekdayIn(1),
          energyPoints: 5,
          rationale: "Tiene 18 pts libres; esta pesa 5.",
        },
        {
          taskId: "t2",
          title: "Responder a los tres correos pendientes",
          date: plus(1),
          weekday: weekdayIn(1),
          energyPoints: 1,
          rationale: "Tiene 13 pts libres; esta pesa 1.",
        },
        {
          taskId: "t3",
          title: "Revisar el contrato del proveedor",
          date: plus(2),
          weekday: weekdayIn(2),
          energyPoints: 3,
          rationale: "Tiene 9 pts libres; esta pesa 3.",
        },
      ],
      leftovers: [
        {
          taskId: "t4",
          title: "Rediseñar el onboarding completo",
          energyPoints: 5,
          reason: "no_room",
          explanation: "Ningún día de la semana tiene presupuesto libre para esta tarea.",
        },
      ],
      days: [
        { date: plus(1), weekday: weekdayIn(1), committedPoints: 44, remainingPoints: 6 },
        { date: plus(2), weekday: weekdayIn(2), committedPoints: 47, remainingPoints: 3 },
        { date: plus(3), weekday: weekdayIn(3), committedPoints: 50, remainingPoints: 0 },
      ],
    },
  } as never);
}

export function EnergyBudgetSection() {
  return (
    <Section
      id="energia"
      number="11"
      title="Energía visible (Fase 4)"
      description="El presupuesto del día, el ciclo de predicción verificado y el ritual semanal. El presupuesto avisa y nunca bloquea: los tonos marcan cuánto queda, no un permiso."
    >
      <SubSection
        title="EnergyBudgetBar"
        description="Comprometido (pendiente + hecho) sobre el límite. El tramo sólido es lo ya cumplido; el translúcido, lo que falta. Pasa a ámbar desde el 85 % (TIGHT_THRESHOLD_PCT) y a rojo al cruzar el límite."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="ok" hint="16/50 · 32 %" className="items-stretch">
            <div className="w-full">
              <Seeded
                seed={seedBudget(
                  [
                    seededTask("a", "medium", "done"),
                    seededTask("b", "medium", "done"),
                    seededTask("c", "high", "pending"),
                    seededTask("d", "high", "pending"),
                  ],
                  50
                )}
              >
                <EnergyBudgetBar />
              </Seeded>
            </div>
          </Specimen>

          <Specimen label="ok · día vacío" hint="0/50 · sin nada comprometido" className="items-stretch">
            <div className="w-full">
              <Seeded seed={seedBudget([], 50)}>
                <EnergyBudgetBar />
              </Seeded>
            </div>
          </Specimen>

          <Specimen label="tight" hint="45/50 · 90 %" className="items-stretch">
            <div className="w-full">
              <Seeded seed={seedBudget(highs(9, 3), 50)}>
                <EnergyBudgetBar />
              </Seeded>
            </div>
          </Specimen>

          <Specimen label="tight · presupuesto justo" hint="50/50 · el día está lleno" className="items-stretch">
            <div className="w-full">
              <Seeded seed={seedBudget(highs(10), 50)}>
                <EnergyBudgetBar />
              </Seeded>
            </div>
          </Specimen>

          <Specimen label="over" hint="60/50 · sobregiro de 10" className="items-stretch">
            <div className="w-full">
              <Seeded seed={seedBudget(highs(12, 2), 50)}>
                <EnergyBudgetBar />
              </Seeded>
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="El ciclo del día en LearningInsightCard"
        description="«Predije X, confirmaste Y, mi modelo mejoró Z». Las tres cifras salen de datos guardados: la predicción se escribió antes del check-in y el alpha se guardó antes y después de recalibrar."
      >
        <SpecimenGrid cols={3}>
          {LOOPS.map(({ label, hint, loop }) => (
            <Specimen key={label} label={label} hint={hint} className="items-stretch">
              <div className="w-full rounded-lg border border-border bg-card">
                <LearningInsightCard
                  insight={mockLearningInsight(
                    loop.fromLearnedCurve
                      ? { loop }
                      : {
                          // Sin curva aprendida no hay pico ni precisión que
                          // enseñar: el servicio los devuelve nulos. Dejarlos
                          // puestos pintaría un estado que no puede existir.
                          loop,
                          hasCurve: false,
                          peak: null,
                          advice: {
                            text: "Registra tu energía unos días y Kino aprenderá tu curva.",
                            tone: "rest",
                          },
                          personalizationPct: 0,
                          trend: "flat",
                          trendDelta: 0,
                          sparkline: [],
                          accuracy: null,
                          correlationFactor: null,
                        }
                  )}
                />
              </div>
            </Specimen>
          ))}
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Ritual semanal"
        description="La tira aparece solo el día de revisión elegido (weeklyReviewDay). «Repartir» abre el diálogo con el reparto propuesto: cada tarea vencida cae en el primer día donde cabe según el presupuesto, y lo que no entra se dice con el motivo."
      >
        <div className="max-w-xl">
          <ClientOnly>
            <Seeded seed={seedRitual}>
              <WeeklyRitualPrompt />
            </Seeded>
          </ClientOnly>
        </div>
      </SubSection>

      <SubSection
        title="WeeklyReviewDaySection"
        description="El ajuste que decide cuándo aparece la tira. Vive en Settings y comparte las etiquetas de los días con el diálogo del reparto, para que el día que eliges se llame igual en los dos sitios."
      >
        <div className="max-w-2xl">
          <Seeded seed={seedBudget([], 50)}>
            <WeeklyReviewDaySection />
          </Seeded>
        </div>
      </SubSection>
    </Section>
  );
}
