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

// 12:20 UTC: veinte minutos después del snapshot, para no competir con él. Cada
// poda va por lotes y se reprograma sola mientras le quede trabajo.
//
// **Los diez segundos son de la entrada, no de cada poda.** Por eso hay una
// sola entrada (`convex/podas.ts`) y no una por tabla: la del log borra lo que
// pasó de treinta días, la de capturas caduca lo que nadie confirmó y borra lo
// que ya pasó su semana de gracia, y las dos se miden sumadas. La siguiente que
// entre (la de `itemLinks`, cuando exista quien las escriba) entra aquí y se
// mide con ellas, o cuatro podas de diez segundos acabarán sin caber en una
// función de diez.
crons.daily('podas-diarias', { hourUTC: 12, minuteUTC: 20 }, internal.podas.diaria, {});

export default crons;
