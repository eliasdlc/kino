/**
 * "Qué escribir hoy" (KIN-143), sin LLM.
 *
 * La decisión de producto fue MCP primero, y ese camino ya está entregado desde
 * W4: un agente puede leer y escribir el universo con las tools de historia. Lo
 * que faltaba era tener *dentro de la app* la parte que no necesita inferencia.
 *
 * Y resulta que es casi toda: qué obra lleva parada, qué capítulo quedó a medias,
 * cuánto falta para la meta del día, si es tu ventana creativa, qué hilos están
 * sueltos. Todo eso sale de datos que Kino ya captura. Cada sugerencia lleva el
 * **porqué** al lado — la promesa del proyecto es inteligencia que no miente, y
 * una razón verificable es lo que separa una señal de una corazonada.
 */

export type SuggestionKind =
  | "resume-chapter"
  | "stale-work"
  | "daily-goal"
  | "peak-window"
  | "loose-threads"
  | "first-step";

export interface Suggestion {
  kind: SuggestionKind;
  title: string;
  /** El dato concreto del que sale. Siempre comprobable. */
  reason: string;
  /** A dónde lleva la sugerencia, si lleva a algún sitio. */
  target?: { kind: "page" | "folder" | "threads"; id: string };
  /** Orden de presentación; mayor primero. */
  weight: number;
}

export interface StudioSignals {
  /** Capítulo abierto más recientemente y todavía sin terminar. */
  openChapter?: {
    pageId: string;
    title: string | null;
    folderName: string;
    wordCount: number;
    daysSinceEdit: number;
  } | null;
  /** Obra con más días sin sesión. */
  staleWork?: {
    folderId: string;
    name: string;
    daysSinceLastSession: number;
  } | null;
  wordsToday: number;
  dailyWordGoal: number | null;
  peakWindow: { start: number; end: number } | null;
  currentHour: number;
  looseThreadCount: number;
  /** Alguna obra con algún capítulo, aunque sea vacío. */
  hasAnyChapter: boolean;
}

/** Cuántos días sin tocar una obra la convierten en "parada". */
const STALE_DAYS = 3;

export function buildSuggestions(signals: StudioSignals): Suggestion[] {
  const out: Suggestion[] = [];

  if (!signals.hasAnyChapter) {
    return [
      {
        kind: "first-step",
        title: "Empieza el primer capítulo",
        reason: "Todavía no hay nada escrito en este sistema.",
        weight: 100,
      },
    ];
  }

  if (signals.openChapter) {
    const { title, folderName, wordCount, daysSinceEdit, pageId } = signals.openChapter;
    out.push({
      kind: "resume-chapter",
      title: `Retoma «${title?.trim() || "el capítulo sin título"}»`,
      reason:
        daysSinceEdit === 0
          ? `Lo tocaste hoy y sigue sin terminar · ${wordCount.toLocaleString("es")} palabras en ${folderName}.`
          : `Es lo último que escribiste, hace ${daysSinceEdit} ${daysSinceEdit === 1 ? "día" : "días"} · ${wordCount.toLocaleString("es")} palabras en ${folderName}.`,
      target: { kind: "page", id: pageId },
      // Lo que quedó a medias gana casi siempre: retomar cuesta menos que abrir.
      weight: 90 - Math.min(20, daysSinceEdit),
    });
  }

  if (signals.staleWork && signals.staleWork.daysSinceLastSession >= STALE_DAYS) {
    const { name, daysSinceLastSession, folderId } = signals.staleWork;
    out.push({
      kind: "stale-work",
      title: `«${name}» lleva ${daysSinceLastSession} días sin sesión`,
      reason: "Se mide contra sesiones reales, no contra la última vez que se guardó algo.",
      target: { kind: "folder", id: folderId },
      weight: 60 + Math.min(25, daysSinceLastSession),
    });
  }

  if (signals.dailyWordGoal && signals.dailyWordGoal > 0) {
    const missing = signals.dailyWordGoal - signals.wordsToday;
    out.push(
      missing > 0
        ? {
            kind: "daily-goal",
            title: `Te faltan ${missing.toLocaleString("es")} palabras para la meta de hoy`,
            reason: `Llevas ${signals.wordsToday.toLocaleString("es")} de ${signals.dailyWordGoal.toLocaleString("es")}.`,
            weight: 50,
          }
        : {
            kind: "daily-goal",
            title: "Meta del día cumplida",
            reason: `${signals.wordsToday.toLocaleString("es")} palabras hoy. Lo de aquí en adelante es de regalo.`,
            weight: 30,
          },
    );
  }

  if (signals.peakWindow) {
    const { start, end } = signals.peakWindow;
    const inside = signals.currentHour >= start && signals.currentHour < end;
    out.push({
      kind: "peak-window",
      title: inside
        ? "Estás dentro de tu ventana creativa"
        : `Tu ventana creativa es de ${hour(start)} a ${hour(end)}`,
      reason: inside
        ? "Es la franja donde tu energía registrada es más alta."
        : "Sale de tu curva aprendida, no de una regla general.",
      weight: inside ? 70 : 20,
    });
  }

  if (signals.looseThreadCount > 0) {
    out.push({
      kind: "loose-threads",
      title:
        signals.looseThreadCount === 1
          ? "Hay 1 hilo suelto por revisar"
          : `Hay ${signals.looseThreadCount} hilos sueltos por revisar`,
      reason: "Entidades que se nombraron poco y llevan capítulos calladas.",
      target: { kind: "threads", id: "" },
      weight: 40,
    });
  }

  return out.sort((a, b) => b.weight - a.weight || a.kind.localeCompare(b.kind));
}

function hour(value: number): string {
  return `${String(value).padStart(2, "0")}h`;
}
