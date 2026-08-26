import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { SystemWithSignalsTransport } from "@/features/systems/systems.types";
import type { FolderWithCounts } from "@/features/folders/folders.types";
import type { PageListItem, LinkedTask } from "@/features/pages/pages.types";
import type { StickyNoteItem } from "@/features/sticky-notes/sticky-notes.types";
import type { SprintTransport } from "@/features/sprints/sprints.types";
import type {
  TodayCheckinRow,
  WeeklyTrend,
  LearningInsight,
} from "@/features/energy/energy.service";
import type { EnergyPlanItemTransport } from "@/features/energy/energy.planner";
import type { AdvisorPattern } from "@/features/energy/energy.advisor";
import type { MentionedEntity, EntityDetail } from "@/features/entities/entities.types";
import type {
  WritingOverview,
  WritingSession,
  WorkJournal,
} from "@/features/writing/writing.types";
import type { LooseThread, LooseThreadsReport } from "@/features/writing/chekhov";
import type { TimelineReport } from "@/features/writing/timeline";
import type { Manuscript } from "@/features/writing/writing.manuscript";
import type { PlotGrid } from "@/features/writing/writing.plot";
import { withDeltas, type SnapshotListItem } from "@/features/writing/snapshots";
import type { StudioReport } from "@/features/writing/writing.studio";

/**
 * Datos de muestra para el catálogo visual. Los componentes compuestos de Kino
 * (SystemCard, task cards…) consumen filas reales de la DB; aquí las fabricamos
 * completas para que cada estado visual sea reproducible sin datos reales.
 */

/** Instante fijo del catálogo, en la misma forma que llega por la red. */
const NOW = "2026-07-15T12:00:00.000Z";
const NOW_DATE = new Date(NOW);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const MOCK_SYSTEM_ID = uuid(1);

export function makeTask(overrides: Partial<TaskTransport> = {}): TaskTransport {
  const base: TaskTransport = {
    id: uuid(100),
    userId: uuid(2),
    systemId: MOCK_SYSTEM_ID,
    parentTaskId: null,
    title: "Preparar entrega de diseño",
    description: null,
    status: "today",
    boardStatus: null,
    boardStatusChangedAt: null,
    energyLevel: "medium",
    priority: "medium",
    taskType: "task",
    dueDate: null,
    startDate: null,
    estimatedTime: null,
    recurrenceRule: null,
    recurrenceParentId: null,
    folderId: null,
    contextTagId: null,
    sprintId: null,
    externalSource: null,
    externalId: null,
    sortIndex: 0,
    metadata: null,
    inTodayPlan: false,
    notifiedBeforeDay: false,
    notifiedDueDay: false,
    reminderCount: 0,
    lastRemindedAt: null,
    clientRequestId: null,
    completedAt: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  } as unknown as TaskTransport;
  return { ...base, ...overrides };
}

/** Fecha relativa a hoy (ISO), para estados overdue / due-soon reproducibles. */
export function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function makeSystem(overrides: Partial<SystemWithSignalsTransport> = {}): SystemWithSignalsTransport {
  const base: SystemWithSignalsTransport = {
    id: uuid(1),
    userId: uuid(2),
    name: "Universidad",
    color: "blue",
    identityStatement: null,
    templateType: "academic",
    energyIdeal: null,
    icon: "book",
    isActive: true,
    isInbox: false,
    expectedFrequency: null,
    triggerContext: null,
    metadata: null,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    lastActivityAt: NOW,
    stale: false,
    daysSinceLastActivity: 1,
    activeTaskCount: 8,
  } as SystemWithSignalsTransport;
  return { ...base, ...overrides };
}

export function makeFolder(overrides: Partial<FolderWithCounts> = {}): FolderWithCounts {
  const base: FolderWithCounts = {
    id: uuid(200),
    name: "Apuntes de clase",
    color: "blue",
    sortIndex: 0,
    parentId: null,
    systemId: MOCK_SYSTEM_ID,
    metadata: null,
    subfolderCount: 2,
    pageCount: 5,
  } as FolderWithCounts;
  return { ...base, ...overrides };
}

export function makePage(overrides: Partial<PageListItem> = {}): PageListItem {
  const base: PageListItem = {
    id: uuid(300),
    title: "Notas de la reunión",
    folderId: null,
    systemId: MOCK_SYSTEM_ID,
    isPinned: false,
    parentPageId: null,
    createdAt: NOW,
    updatedAt: new Date(),
    contentPreview:
      "Resumen de decisiones: mover el lanzamiento una semana, priorizar el bug de sincronización y…",
    wordCount: 482,
    tags: [],
    subPageCount: 0,
  } as unknown as PageListItem;
  return { ...base, ...overrides };
}

export function makeStickyNote(overrides: Partial<StickyNoteItem> = {}): StickyNoteItem {
  const base: StickyNoteItem = {
    id: uuid(400),
    title: "Recordar",
    content: "Preguntar por la fecha del examen",
    color: "yellow",
    sortIndex: 0,
    pageId: null,
    folderId: null,
    positionSide: null,
    positionY: null,
    positionX: null,
    anchorId: null,
    stackId: null,
    textAnchor: null,
  } as StickyNoteItem;
  return { ...base, ...overrides };
}

export function makeLinkedTask(overrides: Partial<LinkedTask> = {}): LinkedTask {
  const base: LinkedTask = {
    id: uuid(500),
    title: "Enviar borrador al profesor",
    status: "today",
    priority: "medium",
    energyLevel: "medium",
    dueDate: null,
    startDate: null,
    description: null,
    taskType: "task",
    estimatedTime: null,
    folderId: null,
    systemId: MOCK_SYSTEM_ID,
    parentTaskId: null,
  } as LinkedTask;
  return { ...base, ...overrides };
}

export function makeSprint(overrides: Partial<SprintTransport> = {}): SprintTransport {
  const base: SprintTransport = {
    id: uuid(600),
    systemId: MOCK_SYSTEM_ID,
    name: "Sprint 3",
    goal: "Cerrar el flujo de onboarding",
    startDate: daysFromNow(-7),
    endDate: daysFromNow(7),
    status: "active",
    completedAt: null,
    sortOrder: 0,
  };
  return { ...base, ...overrides };
}

// ── Energía / dashboard ──────────────────────────────────────────────────────

/** Curva proyectada de 24h con pico de media mañana (forma realista). */
export const MOCK_CURVE: number[] = [
  30, 25, 20, 18, 20, 25, 35, 50, 65, 78, 85, 88, 80, 70, 60, 55, 58, 62, 65,
  60, 50, 45, 40, 35,
];

export function makeCheckin(overrides: Partial<TodayCheckinRow> = {}): TodayCheckinRow {
  const morning = new Date();
  morning.setHours(9, 15, 0, 0);
  const base: TodayCheckinRow = {
    id: uuid(700),
    slot: "morning",
    currentLevel: 72,
    sleepQuality: "good",
    predictionAccuracy: null,
    createdAt: morning,
  };
  return { ...base, ...overrides };
}

export function makeEnergyPlanItem(
  task: TaskTransport,
  overrides: Partial<Omit<EnergyPlanItemTransport, "task">> = {}
): EnergyPlanItemTransport {
  return {
    task,
    scheduledStartMinute: 9 * 60,
    effectiveEnergyAtStart: 80,
    startsHere: true,
    breakBefore: false,
    ...overrides,
  };
}

/** 7 días de snapshots/checkins; las cards solo leen date+completionRate y date+currentLevel. */
export function mockWeeklyTrend(): WeeklyTrend {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const rates = [0.4, 0.65, 0.8, null, 0.55, 0.9, 0.7];
  const levels = [55, 70, 82, null, 48, 88, 74];
  return {
    snapshots: days
      .map((date, i) => (rates[i] === null ? null : { date, completionRate: rates[i] }))
      .filter(Boolean),
    checkins: days
      .map((date, i) => (levels[i] === null ? null : { date, currentLevel: levels[i] }))
      .filter(Boolean),
  } as unknown as WeeklyTrend;
}

export function mockLearningInsight(overrides: Partial<LearningInsight> = {}): LearningInsight {
  const base = {
    hasCurve: true,
    peak: { start: 9, end: 12 },
    advice: { text: "Estás en tu pico: aprovecha para lo difícil", tone: "peak" },
    personalizationPct: 72,
    trend: "up",
    trendDelta: 6,
    sparkline: [22, 35, 41, 48, 60, 66, 72],
    correlationFactor: 2.1,
    accuracy: { rate: 78 },
    chronotype: "morning",
  } as unknown as LearningInsight;
  return { ...base, ...overrides };
}

export function mockAdvisorPattern(overrides: Partial<AdvisorPattern> = {}): AdvisorPattern {
  const base: AdvisorPattern = {
    id: "overload",
    label: "Sobrecarga",
    message: "Tienes más tareas críticas de las que caben en un día. Considera mover algunas a mañana.",
    severity: 2,
    urgency: 3,
    actionability: 2,
    score: 12,
  };
  return { ...base, ...overrides };
}

// ── Writing: Codex y motivación (PLAN-11 W2/W4) ──────────────────────────

export const MOCK_PAGE_ID = uuid(3);
export const MOCK_FOLDER_ID = uuid(4);

export function makeMentionedEntity(
  overrides: Partial<MentionedEntity> = {},
): MentionedEntity {
  return {
    id: uuid(300),
    name: "Aurelia Vance",
    type: "character",
    summary: "Cartógrafa del gremio; busca el mapa que su madre nunca terminó.",
    coverImageUrl: null,
    mentionCount: 7,
    ...overrides,
  };
}

export function makeEntityDetail(overrides: Partial<EntityDetail> = {}): EntityDetail {
  return {
    id: uuid(300),
    systemId: MOCK_SYSTEM_ID,
    type: "character",
    name: "Aurelia Vance",
    aliases: ["La Cartógrafa", "Vance"],
    summary: "Cartógrafa del gremio; busca el mapa que su madre nunca terminó.",
    coverImageUrl: null,
    createdAt: NOW_DATE,
    updatedAt: NOW_DATE,
    attributes: { edad: "34", origen: "Puerto Ceniza", rol: "Protagonista" },
    images: [],
    relations: [
      {
        id: uuid(310),
        label: "rival de",
        notes: null,
        other: { id: uuid(301), name: "Bruno Salazar", type: "character" },
        outgoing: true,
      },
      {
        id: uuid(311),
        label: "vive en",
        notes: null,
        other: { id: uuid(302), name: "Puerto Ceniza", type: "location" },
        outgoing: true,
      },
    ],
    appearances: [
      { pageId: MOCK_PAGE_ID, pageTitle: "Capítulo 1 · La marea baja", mentionCount: 7 },
      { pageId: uuid(303), pageTitle: "Capítulo 2 · El gremio", mentionCount: 3 },
    ],
    ...overrides,
  };
}

export function makeWritingOverview(
  overrides: Partial<WritingOverview> = {},
): WritingOverview {
  return {
    streakDays: 12,
    streakIncludesToday: true,
    wordsToday: 820,
    dailyWordGoal: 1_000,
    peakWindow: { start: 9, end: 11 },
    currentHour: 10,
    works: [{ folderId: MOCK_FOLDER_ID, lastSessionAt: NOW, daysSinceLastSession: 0 }],
    ...overrides,
  };
}

function makeSession(overrides: Partial<WritingSession> = {}): WritingSession {
  return {
    id: uuid(400),
    pageId: MOCK_PAGE_ID,
    pageTitle: "Capítulo 1 · La marea baja",
    folderId: MOCK_FOLDER_ID,
    startedAt: "2026-07-15T09:05:00Z",
    endedAt: "2026-07-15T10:40:00Z",
    durationMinutes: 95,
    wordsWritten: 820,
    ...overrides,
  };
}

export function makeWorkJournal(overrides: Partial<WorkJournal> = {}): WorkJournal {
  return {
    folderId: MOCK_FOLDER_ID,
    folderName: "La marea baja",
    wordGoal: 80_000,
    totalWords: 24_310,
    days: [
      {
        day: "2026-07-15",
        sessions: [makeSession()],
        words: 820,
        minutes: 95,
        cumulativeWords: 24_310,
        milestones: [{ kind: "goal-reached", goal: 1_000 }],
      },
      {
        day: "2026-07-14",
        sessions: [makeSession({ id: uuid(401), wordsWritten: 1_240, durationMinutes: 120 })],
        words: 1_240,
        minutes: 120,
        cumulativeWords: 23_490,
        milestones: [
          { kind: "chapter-completed", pageId: MOCK_PAGE_ID, pageTitle: "Capítulo 1 · La marea baja" },
          { kind: "streak", days: 10 },
        ],
      },
      {
        day: "2026-07-13",
        sessions: [makeSession({ id: uuid(402), wordsWritten: 460, durationMinutes: 45 })],
        words: 460,
        minutes: 45,
        cumulativeWords: 22_250,
        milestones: [],
      },
    ],
    ...overrides,
  };
}

function makeLooseThread(overrides: Partial<LooseThread> = {}): LooseThread {
  return {
    entityId: uuid(500),
    name: "La Daga",
    type: "object",
    totalMentions: 2,
    chapterCount: 1,
    firstChapter: { index: 2, id: uuid(600), title: "Capítulo 2 · El gremio" },
    lastChapter: { index: 2, id: uuid(600), title: "Capítulo 2 · El gremio" },
    silentChapters: 5,
    resolved: false,
    reopened: false,
    ...overrides,
  };
}

export function makeLooseThreadsReport(
  overrides: Partial<LooseThreadsReport> = {},
): LooseThreadsReport {
  return {
    folderId: MOCK_FOLDER_ID,
    folderName: "La marea baja",
    chapterCount: 7,
    settings: { maxMentions: 3, minSilentChapters: 3 },
    threads: [
      makeLooseThread(),
      makeLooseThread({
        entityId: uuid(501),
        name: "Marea Baja",
        type: "event",
        totalMentions: 1,
        silentChapters: 4,
        firstChapter: { index: 3, id: uuid(601), title: "Capítulo 3" },
        lastChapter: { index: 3, id: uuid(601), title: "Capítulo 3" },
      }),
      makeLooseThread({
        entityId: uuid(502),
        name: "Bruno Salazar",
        type: "character",
        totalMentions: 3,
        silentChapters: 3,
        reopened: true,
        firstChapter: { index: 1, id: uuid(602), title: "Capítulo 1" },
        lastChapter: { index: 4, id: uuid(603), title: "Capítulo 4 · La niebla" },
      }),
      makeLooseThread({
        entityId: uuid(503),
        name: "El posadero",
        type: "character",
        totalMentions: 1,
        silentChapters: 6,
        resolved: true,
        firstChapter: { index: 1, id: uuid(602), title: "Capítulo 1" },
        lastChapter: { index: 1, id: uuid(602), title: "Capítulo 1" },
      }),
    ],
    ...overrides,
  };
}

export function makeTimelineReport(
  overrides: Partial<TimelineReport> = {},
): TimelineReport {
  const chapter = (index: number, title: string) => ({
    pageId: uuid(700 + index),
    title,
    index,
    mentionCount: 2,
  });
  return {
    folderId: MOCK_FOLDER_ID,
    folderName: "La marea baja",
    chapterCount: 4,
    placed: [
      {
        entityId: uuid(800),
        name: "La caída del Puente Gris",
        summary: null,
        when: "Año 1023, otoño",
        what: "El puente cede durante la tormenta y aísla el puerto por dos inviernos.",
        order: 1,
        narratedIn: [chapter(3, "Capítulo 3 · Lo que quedó")],
        firstNarratedIndex: 3,
        outOfOrder: true,
      },
      {
        entityId: uuid(801),
        name: "El pacto del gremio",
        summary: null,
        when: "Año 1025, invierno",
        what: "Bruno firma en nombre de una casa que ya no existe.",
        order: 2,
        narratedIn: [chapter(1, "Capítulo 1"), chapter(2, "Capítulo 2 · El gremio")],
        firstNarratedIndex: 1,
        outOfOrder: false,
      },
      {
        entityId: uuid(802),
        name: "La marea baja",
        summary: null,
        when: "Año 1026, primavera",
        what: null,
        order: 3,
        narratedIn: [],
        firstNarratedIndex: null,
        outOfOrder: false,
      },
    ],
    unplaced: [
      {
        entityId: uuid(803),
        name: "El incendio de la torre",
        summary: "Nadie recuerda quién dio la orden.",
        when: null,
        what: null,
        order: null,
        narratedIn: [chapter(4, "Capítulo 4 · La niebla")],
        firstNarratedIndex: 4,
        outOfOrder: false,
      },
    ],
    ...overrides,
  };
}

const PROSE_CHAPTER = `<p>La niebla no levantó ese día, ni el siguiente. Aurelia lo anotó en el margen del mapa, con la letra pequeña que usaba para lo que no quería que nadie leyera.</p><p>El puerto seguía ahí abajo, respirando. Los barcos habían dejado de salir hacía dos semanas y nadie decía por qué.</p><div data-scene-break class="scene-break">* * *</div><p>Bruno la encontró en el taller, con la carta desplegada y la tinta todavía fresca.</p><p>—No vas a arreglarlo mirándolo —dijo.</p>`;

const SCREENPLAY_CHAPTER = `<p data-sp="sceneHeading" class="sp-sceneHeading">int. taller de mapas — noche</p><p data-sp="action" class="sp-action">Aurelia despliega la carta sobre la mesa. La tinta todavía huele.</p><p data-sp="character" class="sp-character">aurelia</p><p data-sp="parenthetical" class="sp-parenthetical">(sin levantar la vista)</p><p data-sp="dialogue" class="sp-dialogue">Mi madre dejó este borde sin cerrar a propósito.</p>`;

export function makeManuscript(overrides: Partial<Manuscript> = {}): Manuscript {
  const medium = overrides.medium ?? "novel";
  const body = medium === "screenplay" ? SCREENPLAY_CHAPTER : PROSE_CHAPTER;
  return {
    folderId: MOCK_FOLDER_ID,
    systemId: MOCK_SYSTEM_ID,
    title: "La marea baja",
    author: "Elias De La Cruz",
    medium,
    totalWords: 148,
    chapters: [
      { id: uuid(900), title: "Capítulo 1 · La niebla", content: body, wordCount: 84, completed: true },
      { id: uuid(901), title: "Capítulo 2 · El gremio", content: body, wordCount: 64, completed: false },
    ],
    ...overrides,
  };
}

export function makePlotGrid(overrides: Partial<PlotGrid> = {}): PlotGrid {
  const scene = (index: number, arc: string | null, preview: string, wordCount: number) => ({
    index,
    arc,
    preview,
    wordCount,
  });
  return {
    folderId: MOCK_FOLDER_ID,
    folderName: "La marea baja",
    arcs: ["Aurelia", "El gremio"],
    chapters: [
      {
        chapterId: uuid(950),
        title: "Capítulo 1 · La niebla",
        scenes: [
          scene(0, "Aurelia", "La niebla no levantó ese día, ni el siguiente. Aurelia lo anotó en el margen del mapa.", 640),
          scene(1, "El gremio", "Bruno la encontró en el taller, con la carta desplegada y la tinta todavía fresca.", 410),
        ],
      },
      {
        chapterId: uuid(951),
        title: "Capítulo 2 · El gremio",
        scenes: [
          scene(0, "El gremio", "Firmaron sin leerlo. Nadie preguntó en nombre de qué casa hablaba Bruno.", 520),
          scene(1, null, "El posadero cerró antes de tiempo y no dio explicaciones.", 180),
        ],
      },
      {
        chapterId: uuid(952),
        title: "Capítulo 3",
        scenes: [
          scene(0, "Aurelia", "El puerto seguía ahí abajo, respirando, y los barcos habían dejado de salir.", 300),
        ],
      },
    ],
    ...overrides,
  };
}

export function makeSnapshots(): SnapshotListItem[] {
  return withDeltas([
    { id: uuid(970), wordCount: 2480, createdAt: "2026-08-05T18:40:00Z", sessionStartedAt: "2026-08-05T17:05:00Z" },
    { id: uuid(971), wordCount: 1840, createdAt: "2026-08-04T09:20:00Z", sessionStartedAt: "2026-08-04T08:00:00Z" },
    { id: uuid(972), wordCount: 2010, createdAt: "2026-08-02T22:10:00Z", sessionStartedAt: "2026-08-02T21:15:00Z" },
    { id: uuid(973), wordCount: 640, createdAt: "2026-08-01T11:00:00Z", sessionStartedAt: null },
  ]);
}

export function makeStudioReport(overrides: Partial<StudioReport> = {}): StudioReport {
  return {
    systemId: MOCK_SYSTEM_ID,
    looseThreadCount: 3,
    suggestions: [
      {
        kind: "resume-chapter",
        title: "Retoma «Capítulo 4 · La niebla»",
        reason: "Es lo último que escribiste, hace 2 días · 1.240 palabras en La marea baja.",
        target: { kind: "page", id: MOCK_PAGE_ID },
        weight: 88,
      },
      {
        kind: "peak-window",
        title: "Estás dentro de tu ventana creativa",
        reason: "Es la franja donde tu energía registrada es más alta.",
        weight: 70,
      },
      {
        kind: "stale-work",
        title: "«El puerto» lleva 9 días sin sesión",
        reason: "Se mide contra sesiones reales, no contra la última vez que se guardó algo.",
        target: { kind: "folder", id: MOCK_FOLDER_ID },
        weight: 69,
      },
      {
        kind: "daily-goal",
        title: "Te faltan 180 palabras para la meta de hoy",
        reason: "Llevas 820 de 1.000.",
        weight: 50,
      },
      {
        kind: "loose-threads",
        title: "Hay 3 hilos sueltos por revisar",
        reason: "Entidades que se nombraron poco y llevan capítulos calladas.",
        target: { kind: "threads", id: "" },
        weight: 40,
      },
    ],
    codexGaps: [
      { entityId: uuid(980), name: "Puerto Ceniza", mentions: 22, chapters: 5 },
      { entityId: uuid(981), name: "El Gremio", mentions: 9, chapters: 3 },
      { entityId: uuid(982), name: "La Daga", mentions: 4, chapters: 1 },
    ],
    ...overrides,
  };
}
