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

export default crons;
