import { z } from 'zod';

export const CHECKIN_SLOTS = ['morning', 'afternoon', 'evening'] as const;
export type CheckinSlot = (typeof CHECKIN_SLOTS)[number];

export const createCheckinSchema = z.object({
  currentLevel: z.number().int().min(1).max(100),
  sleepQuality: z.enum(['good', 'partial', 'poor']).default('partial'),
  slot: z.enum(CHECKIN_SLOTS).optional(),
});

export const updateCheckinAccuracySchema = z.object({
  accuracy: z.enum(['accurate', 'partial', 'inaccurate']),
  slot: z.enum(CHECKIN_SLOTS).optional(),
});

// ── Time-blocking (Fase 4.3) ───────────────────────────────────────────────

const DAY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato yyyy-MM-dd');

/** Hora local del usuario, 0–23. El agente habla en horas, no en instantes. */
const HOUR = z.coerce.number().int().min(0).max(23);

export const scheduleBlockSchema = z.object({
  taskId: z.string(),
  date: DAY,
  hour: HOUR,
});

export const blockProposalQuerySchema = z.object({
  date: DAY.optional(),
  startHour: HOUR.optional(),
});

export const applyRitualSchema = z.object({
  assignments: z
    .array(z.object({ taskId: z.string(), date: DAY }))
    .min(1, 'Hace falta al menos una tarea que reprogramar')
    .max(100),
});

export type ScheduleBlockInput = z.infer<typeof scheduleBlockSchema>;
export type ApplyRitualInput = z.infer<typeof applyRitualSchema>;

export type CreateCheckinInput = z.infer<typeof createCheckinSchema>;
// Tipo de entrada del cliente: sleepQuality es opcional (solo se envía en la mañana).
// El backend rellena el default 'partial' al parsear para slots sin sueño.
export type CreateCheckinClientInput = z.input<typeof createCheckinSchema>;
export type UpdateAccuracyInput = z.infer<typeof updateCheckinAccuracySchema>;

// ── Perfil declarado (Fase 6) ──────────────────────────────────────────────

/**
 * Lo que la persona declara de su energía: cronotipo, cuánto duerme, qué la
 * recarga y cuántas horas tiene. El alta ya no pregunta ninguno de los cuatro,
 * así que este es el único sitio donde se escriben, y todos son opcionales: se
 * guarda lo que se toca y nada más.
 *
 * No es lo mismo que la curva aprendida. Esto es lo que dices de ti; la curva
 * es lo que Kino midió. Cuando las dos se contradicen, gana la medida, y eso es
 * exactamente lo que el interruptor de honestidad publica.
 */
export const updateEnergyProfileSchema = z
  .object({
    chronotype: z.enum(['morning', 'intermediate', 'evening']).optional(),
    sleepTypicalHours: z.number().int().min(4).max(12).optional(),
    availableHoursPerDay: z.number().int().min(1).max(16).optional(),
    rechargePresets: z
      .array(z.object({ label: z.string().min(1).max(50), delta: z.number().int().min(-50).max(50) }))
      .max(8)
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, 'Debe incluir al menos un campo');

export type UpdateEnergyProfileInput = z.infer<typeof updateEnergyProfileSchema>;
