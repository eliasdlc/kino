import { buildSuggestions } from "@/shared/suggestions/engine";
import type { Suggestion, SuggestionRule } from "@/shared/suggestions/types";

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
 * **porqué** al lado: la promesa del proyecto es inteligencia que no miente, y
 * una razón verificable es lo que separa una señal de una corazonada.
 *
 * El tipo, el orden y los estados vacíos viven en `@/shared/suggestions`, porque
 * el mini cerebro del sistema hace lo mismo con otras señales. Lo que se queda
 * aquí son las reglas, que sí son de escritura.
 */

export type SuggestionKind =
  | "resume-chapter"
  | "stale-work"
  | "daily-goal"
  | "peak-window"
  | "loose-threads"
  | "first-step";

/** A dónde llevan las sugerencias de escritura. */
export interface WritingTarget {
  kind: "page" | "folder" | "threads";
  id: string;
}

export type WritingSuggestion = Suggestion<SuggestionKind, WritingTarget>;

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

type WritingRule = SuggestionRule<StudioSignals, WritingSuggestion>;

const resumeChapter: WritingRule = ({ openChapter }) => {
  if (!openChapter) return null;
  const { title, folderName, wordCount, daysSinceEdit, pageId } = openChapter;
  return {
    kind: "resume-chapter",
    title: `Retoma «${title?.trim() || "el capítulo sin título"}»`,
    reason:
      daysSinceEdit === 0
        ? `Lo tocaste hoy y sigue sin terminar · ${wordCount.toLocaleString("es")} palabras en ${folderName}.`
        : `Es lo último que escribiste, hace ${daysSinceEdit} ${daysSinceEdit === 1 ? "día" : "días"} · ${wordCount.toLocaleString("es")} palabras en ${folderName}.`,
    target: { kind: "page", id: pageId },
    // Lo que quedó a medias gana casi siempre: retomar cuesta menos que abrir.
    weight: 90 - Math.min(20, daysSinceEdit),
  };
};

const staleWork: WritingRule = ({ staleWork: stale }) => {
  if (!stale || stale.daysSinceLastSession < STALE_DAYS) return null;
  const { name, daysSinceLastSession, folderId } = stale;
  return {
    kind: "stale-work",
    title: `«${name}» lleva ${daysSinceLastSession} días sin sesión`,
    reason: "Se mide contra sesiones reales, no contra la última vez que se guardó algo.",
    target: { kind: "folder", id: folderId },
    weight: 60 + Math.min(25, daysSinceLastSession),
  };
};

const dailyGoal: WritingRule = ({ dailyWordGoal, wordsToday }) => {
  if (!dailyWordGoal || dailyWordGoal <= 0) return null;
  const missing = dailyWordGoal - wordsToday;
  return missing > 0
    ? {
        kind: "daily-goal",
        title: `Te faltan ${missing.toLocaleString("es")} palabras para la meta de hoy`,
        reason: `Llevas ${wordsToday.toLocaleString("es")} de ${dailyWordGoal.toLocaleString("es")}.`,
        weight: 50,
      }
    : {
        kind: "daily-goal",
        title: "Meta del día cumplida",
        reason: `${wordsToday.toLocaleString("es")} palabras hoy. Lo de aquí en adelante es de regalo.`,
        weight: 30,
      };
};

const peakWindow: WritingRule = ({ peakWindow: window, currentHour }) => {
  if (!window) return null;
  const { start, end } = window;
  const inside = currentHour >= start && currentHour < end;
  return {
    kind: "peak-window",
    title: inside
      ? "Estás dentro de tu ventana creativa"
      : `Tu ventana creativa es de ${hour(start)} a ${hour(end)}`,
    reason: inside
      ? "Es la franja donde tu energía registrada es más alta."
      : "Sale de tu curva aprendida, no de una regla general.",
    weight: inside ? 70 : 20,
  };
};

const looseThreads: WritingRule = ({ looseThreadCount }) => {
  if (looseThreadCount <= 0) return null;
  return {
    kind: "loose-threads",
    title:
      looseThreadCount === 1
        ? "Hay 1 hilo suelto por revisar"
        : `Hay ${looseThreadCount} hilos sueltos por revisar`,
    reason: "Entidades que se nombraron poco y llevan capítulos calladas.",
    target: { kind: "threads", id: "" },
    weight: 40,
  };
};

const WRITING_RULES: readonly WritingRule[] = [
  resumeChapter,
  staleWork,
  dailyGoal,
  peakWindow,
  looseThreads,
];

/**
 * Un sistema sin un solo capítulo no tiene señales que medir, así que en vez de
 * correr las reglas contra ceros propone el primer paso, y solo ese.
 */
const FIRST_STEP: WritingSuggestion = {
  kind: "first-step",
  title: "Empieza el primer capítulo",
  reason: "Todavía no hay nada escrito en este sistema.",
  weight: 100,
};

export function buildWritingSuggestions(signals: StudioSignals): WritingSuggestion[] {
  if (!signals.hasAnyChapter) return [FIRST_STEP];
  return buildSuggestions(signals, WRITING_RULES);
}

function hour(value: number): string {
  return `${String(value).padStart(2, "0")}h`;
}
