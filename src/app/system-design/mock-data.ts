import type { Task } from "@/features/tasks/tasks.types";
import type { SystemWithSignals } from "@/features/systems/systems.types";
import type { FolderWithCounts } from "@/features/folders/folders.types";
import type { PageListItem, LinkedTask } from "@/features/pages/pages.types";
import type { StickyNoteItem } from "@/features/sticky-notes/sticky-notes.types";
import type { Sprint } from "@/features/sprints/sprints.types";
import type {
  TodayCheckinRow,
  WeeklyTrend,
  LearningInsight,
} from "@/features/energy/energy.service";
import type { EnergyPlanItem } from "@/features/energy/energy.planner";
import type { AdvisorPattern } from "@/features/energy/energy.advisor";
import type { MentionedEntity, EntityDetail } from "@/features/entities/entities.types";
import type {
  WritingOverview,
  WritingSession,
  WorkJournal,
} from "@/features/writing/writing.types";
import type { LooseThread, LooseThreadsReport } from "@/features/writing/chekhov";

/**
 * Datos de muestra para el catálogo visual. Los componentes compuestos de Kino
 * (SystemCard, task cards…) consumen filas reales de la DB; aquí las fabricamos
 * completas para que cada estado visual sea reproducible sin datos reales.
 */

const NOW = new Date("2026-07-15T12:00:00Z");
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const MOCK_SYSTEM_ID = uuid(1);

export function makeTask(overrides: Partial<Task> = {}): Task {
  const base: Task = {
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
    completedAt: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  } as Task;
  return { ...base, ...overrides };
}

/** Fecha relativa a hoy (ISO), para estados overdue / due-soon reproducibles. */
export function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function makeSystem(overrides: Partial<SystemWithSignals> = {}): SystemWithSignals {
  const base: SystemWithSignals = {
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
    stale: false,
    daysSinceLastActivity: 1,
    activeTaskCount: 8,
  } as SystemWithSignals;
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

export function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  const base = {
    id: uuid(600),
    userId: uuid(2),
    systemId: MOCK_SYSTEM_ID,
    name: "Sprint 3",
    goal: "Cerrar el flujo de onboarding",
    startDate: new Date(daysFromNow(-7)),
    endDate: new Date(daysFromNow(7)),
    status: "active",
    completedAt: null,
    sortOrder: 0,
    externalId: null,
    createdAt: NOW,
    updatedAt: NOW,
  } as unknown as Sprint;
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
  task: Task,
  overrides: Partial<Omit<EnergyPlanItem, "task">> = {}
): EnergyPlanItem {
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
    createdAt: NOW,
    updatedAt: NOW,
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
    works: [{ folderId: MOCK_FOLDER_ID, lastSessionAt: NOW.toISOString(), daysSinceLastSession: 0 }],
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
