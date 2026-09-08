import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

// Las tareas programadas las dispara Convex, no Vercel ni un servicio externo:
// el plan gratuito de Vercel admite una sola entrada diaria y los recordatorios
// necesitan quince minutos. Cada ejecución queda en `cronRuns` y el snapshot
// diario avisa en el log si alguna lleva demasiado callada (`lib/cronHealth.ts`).

const crons = cronJobs();

// 12:00 UTC: la madrugada ya pasó en América, así que "ayer" está cerrado para
// todos los usuarios y el snapshot no se queda a medias.
crons.daily('daily-snapshot', { hourUTC: 12, minuteUTC: 0 }, internal.scheduler.dailySnapshot);

crons.interval('task-reminders', { minutes: 15 }, internal.scheduler.taskReminders);

// 12:20 UTC: veinte minutos después del snapshot, para no competir con él. La
// poda va por lotes y se reprograma sola mientras queden filas de más de
// treinta días (`convex/eventLog.ts`).
//
// **Los diez segundos son de la entrada, no de cada poda.** Hoy sólo hay una
// aquí, y `convex/eventLog.test.ts` mide su lote de producción con margen de
// sobra. La segunda que entre (la de `itemLinks`, cuando exista quien las
// escriba) comparte ese presupuesto: se mide la suma, no cada una por su
// lado, o cuatro podas de diez segundos acabarán sin caber en una función de
// diez.
crons.daily('event-log-prune', { hourUTC: 12, minuteUTC: 20 }, internal.eventLog.podar, {});

export default crons;
