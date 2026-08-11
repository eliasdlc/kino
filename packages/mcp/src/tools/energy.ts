import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KinoFetch } from '../client.js';

export function registerEnergyTools(server: McpServer, kinoFetch: KinoFetch) {
  server.tool(
    'get_energy_checkin',
    'Obtiene el check-in de energía del usuario para hoy (nivel actual y calidad de sueño), si ya lo registró.',
    {},
    async () => {
      const checkin = await kinoFetch('/api/energy/checkin');
      return { content: [{ type: 'text', text: JSON.stringify(checkin, null, 2) }] };
    },
  );

  server.tool(
    'create_energy_checkin',
    'Registra el check-in de energía del usuario para hoy. currentLevel es 1-100 y sleepQuality es good/partial/poor.',
    {
      currentLevel: z
        .number()
        .int()
        .min(1)
        .max(100)
        .describe('Nivel de energía actual de 1 a 100'),
      sleepQuality: z
        .enum(['good', 'partial', 'poor'])
        .describe('Calidad del sueño: good (bueno), partial (parcial), poor (malo)'),
    },
    async (data) => {
      const checkin = await kinoFetch('/api/energy/checkin', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { content: [{ type: 'text', text: JSON.stringify(checkin, null, 2) }] };
    },
  );

  server.tool(
    'get_today_plan',
    'Obtiene el plan de energía de hoy: tareas recomendadas ajustadas al nivel de energía y límite diario del usuario.',
    {},
    async () => {
      const plan = await kinoFetch('/api/energy/plan/today');
      return { content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }] };
    },
  );

  // ── Time-blocking consciente de energía ──────────────────────────────────

  server.tool(
    'get_energy_windows',
    'Ventanas de energía del usuario y presupuesto del día: cronotipo, curva (aprendida o teórica), ventana pico, capacidad media por tramo (mañana/tarde/noche), predicción guardada de hoy y energía comprometida vs. límite. Úsalo ANTES de proponer o mover bloques. Si peak es null, Kino todavía no aprendió la curva: no inventes una mejor ventana.',
    {},
    async () => {
      const windows = await kinoFetch('/api/energy/windows');
      return { content: [{ type: 'text', text: JSON.stringify(windows, null, 2) }] };
    },
  );

  server.tool(
    'propose_day_blocks',
    'Propone bloques horarios para un día usando el mismo planificador que ve el usuario: coloca lo exigente en los tramos de más energía, sugiere pausas cada ~90 min y explica por qué cada tarea va donde va. NO escribe nada — devuelve la propuesta y las tareas que quedaron fuera con su motivo (budget = no cabe en el día, energy = pide más energía de la proyectada). Para escribirla usa schedule_task_block.',
    {
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('Día a planificar en formato yyyy-MM-dd (default: hoy en la tz del usuario)'),
      startHour: z
        .number()
        .int()
        .min(0)
        .max(23)
        .optional()
        .describe('Hora local en que arranca la jornada (default 9)'),
    },
    async ({ date, startHour }) => {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (startHour !== undefined) params.set('startHour', String(startHour));
      const query = params.toString();
      const proposal = await kinoFetch(`/api/energy/blocks${query ? `?${query}` : ''}`);
      return { content: [{ type: 'text', text: JSON.stringify(proposal, null, 2) }] };
    },
  );

  server.tool(
    'schedule_task_block',
    'Coloca (o mueve) el bloque de una tarea en un día y hora locales del usuario. El bloque no es una entidad aparte: es la tarea programada en el calendario global. Devuelve qué tan bien encaja esa hora con la curva de energía y avisa si el día queda en sobregiro — el sobregiro nunca impide la operación.',
    {
      taskId: z.string().uuid().describe('ID de la tarea a bloquear'),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe('Día en formato yyyy-MM-dd'),
      hour: z
        .number()
        .int()
        .min(0)
        .max(23)
        .describe('Hora local del usuario, 0-23 (la hora se interpreta en su timezone)'),
    },
    async (data) => {
      const block = await kinoFetch('/api/energy/blocks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { content: [{ type: 'text', text: JSON.stringify(block, null, 2) }] };
    },
  );

  // ── Ritual de revisión semanal ────────────────────────────────────────────

  server.tool(
    'get_weekly_ritual',
    'Estado del ritual de revisión semanal: tareas vencidas y en qué día de los próximos siete caben según el presupuesto de energía de cada día, con las que no tienen lugar y por qué. No escribe nada. isReviewDay indica si hoy es el día de revisión que el usuario eligió.',
    {},
    async () => {
      const ritual = await kinoFetch('/api/rituals/weekly');
      return { content: [{ type: 'text', text: JSON.stringify(ritual, null, 2) }] };
    },
  );

  server.tool(
    'apply_weekly_ritual',
    'Aplica el reparto de la revisión semanal: reprograma cada tarea al día indicado (cambia su programación, NUNCA su fecha límite). Normalmente se llama con las asignaciones que devolvió get_weekly_ritual, quitando las que el usuario no quiera. Devuelve las aplicadas y las que fallaron.',
    {
      assignments: z
        .array(
          z.object({
            taskId: z.string().uuid(),
            date: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .describe('Día destino en formato yyyy-MM-dd'),
          }),
        )
        .min(1)
        .max(100)
        .describe('Tareas a reprogramar con su día destino'),
    },
    async (data) => {
      const result = await kinoFetch('/api/rituals/weekly', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'clear_task_block',
    'Saca una tarea del calendario (elimina su programación) sin tocar su fecha límite. Los eventos no pueden quedarse sin fecha de inicio: para un evento, muévelo de hora con schedule_task_block.',
    {
      taskId: z.string().uuid().describe('ID de la tarea a desprogramar'),
    },
    async ({ taskId }) => {
      const task = await kinoFetch(`/api/energy/blocks?taskId=${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
      });
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    },
  );
}
