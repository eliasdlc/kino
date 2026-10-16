import { z } from 'zod';

export const CHECKIN_SLOTS = ['morning', 'afternoon', 'evening'] as const;
export type CheckinSlot = (typeof CHECKIN_SLOTS)[number];

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
