const HOUR_MS = 60 * 60 * 1000;

/**
 * Cuánto puede callar cada tarea programada antes de que el silencio signifique
 * algo. Las dos las dispara Convex desde `convex/crons.ts`; si el deployment
 * deja de ejecutarlas (una función que no compila, un despliegue a medias) los
 * recordatorios push dejan de llegar y nada lo dice: el usuario concluye que la
 * app no tenía nada que recordarle.
 *
 * La tolerancia es varias veces el periodo de cada job a propósito. Una
 * ejecución perdida es ruido; lo que interesa es la ausencia sostenida, que es
 * la que significa "esto lleva roto un rato".
 */
export interface CronJobSpec {
  /** Cada cuánto debería correr, en texto, para el mensaje del aviso. */
  cadence: string;
  /** Silencio a partir del cual se avisa. */
  maxSilenceMs: number;
}

export const CRON_JOBS = {
  'daily-snapshot': {
    cadence: 'una vez al día',
    maxSilenceMs: 48 * HOUR_MS,
  },
  'task-reminders': {
    cadence: 'cada 15 minutos',
    // Ocho vueltas perdidas. Menos que esto convertiría cualquier hipo en una
    // alerta, y una alerta que salta sin motivo se acaba silenciando.
    maxSilenceMs: 2 * HOUR_MS,
  },
} as const satisfies Record<string, CronJobSpec>;

export type CronJobName = keyof typeof CRON_JOBS;

export const CRON_JOB_NAMES = Object.keys(CRON_JOBS) as CronJobName[];

export function isCronJobName(value: string): value is CronJobName {
  return value in CRON_JOBS;
}

/** Última ejecución que terminó bien, o `null` si no hay ninguna. */
export interface LastSuccess {
  job: CronJobName;
  /** Instante en milisegundos. */
  at: number | null;
}

export interface StaleCron {
  job: CronJobName;
  cadence: string;
  /** Milisegundos callado, o `null` si no consta ninguna ejecución buena. */
  silentForMs: number | null;
  reason: string;
}

/**
 * Decide qué jobs llevan demasiado callados. Puro: recibe las últimas
 * ejecuciones y el reloj, así que la regla se prueba sin base de datos y sin
 * esperar dos horas.
 *
 * Que un job no tenga ninguna ejecución registrada cuenta como ausencia, no
 * como "todavía no sabemos": es el caso de un cron que nunca llegó a correr.
 */
export function findStaleCrons(lastSuccesses: LastSuccess[], now: number): StaleCron[] {
  const seen = new Map(lastSuccesses.map((entry) => [entry.job, entry.at]));

  return CRON_JOB_NAMES.flatMap((job): StaleCron[] => {
    const spec = CRON_JOBS[job];
    const at = seen.get(job) ?? null;

    if (at === null) {
      return [{ job, cadence: spec.cadence, silentForMs: null, reason: `nunca se ha registrado una ejecución correcta de "${job}" (${spec.cadence})` }];
    }

    const silentForMs = now - at;
    if (silentForMs <= spec.maxSilenceMs) return [];

    return [{ job, cadence: spec.cadence, silentForMs, reason: `"${job}" (${spec.cadence}) lleva ${formatSilence(silentForMs)} sin terminar bien` }];
  });
}

/** Texto legible para el aviso: "3 horas" dice más que "10800000". */
export function formatSilence(ms: number): string {
  const hours = Math.floor(ms / HOUR_MS);
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} minutos`;
  if (hours < 48) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  return `${Math.floor(hours / 24)} días`;
}
