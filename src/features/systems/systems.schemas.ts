import { z } from 'zod';
import { TEMPLATE_TYPE_VALUES } from '@/shared/types/enums';
import { githubRepoRefSchema } from '@/features/github-sync/github-sync.schemas';

export const createSystemSchema = z.object({
  name: z.string().min(1).max(255),
  identityStatement: z.string().max(500).optional(),
  // Deriva del set único de tipos seleccionables (incluye writing; excluye inbox,
  // que se crea de forma programática). Un arquetipo nuevo entra sin tocar esto.
  templateType: z.enum(TEMPLATE_TYPE_VALUES).optional(),
  energyIdeal: z.enum(["high", "medium", "low"]).optional(),
  color: z.enum(["red", "blue", "pink", "purple", "green", "orange", "yellow", "teal", "gray", "black", "white"]),
  icon: z.string().max(50).default("folder"),
  expectedFrequency: z.string().max(20).optional(),
  triggerContext: z.string().max(255).optional(),
});

const systemTabIdSchema = z.enum(["backlog", "planning", "action", "archive"]);

// Sustantivos que el usuario elige para SU sistema (D16). Cortos a propósito:
// caben en un chip de sidebar y en un CTA sin romper el layout.
const nounSchema = z.string().trim().min(1).max(24);

export const systemCompositionSchema = z.object({
  containers: z
    .object({ enabled: z.boolean(), noun: nounSchema, nounPlural: nounSchema })
    .optional(),
  pages: z
    .object({ noun: nounSchema, nounPlural: nounSchema, primary: z.boolean() })
    .optional(),
  // El id lo deriva la UI del label y no vuelve a cambiar: las tareas guardadas
  // apuntan a él. El tope evita convertir el selector en un menú infinito.
  taskKinds: z
    .array(z.object({ id: z.string().min(1).max(40), label: z.string().trim().min(1).max(32) }))
    .max(8)
    .optional(),
});

export const systemMetadataSchema = z.object({
  tabs: z.array(systemTabIdSchema).optional(),
  defaultTab: systemTabIdSchema.optional(),
  composition: systemCompositionSchema.optional(),
  // Solo Writing: meta diaria de palabras. 0 la desactiva sin borrar la clave.
  dailyWordGoal: z.coerce.number().int().min(0).max(100_000).optional(),
  // Solo Writing: sensibilidad del detector de hilos sueltos (KIN-137).
  chekhov: z
    .object({
      maxMentions: z.coerce.number().int().min(1).max(50),
      minSilentChapters: z.coerce.number().int().min(1).max(50),
    })
    .optional(),
  // Solo Project: repositorio cuyos issues alimentan el board (KIN-135). Se
  // escribe por `POST /api/systems/[id]/github/link`, que además comprueba
  // contra GitHub que existe y es accesible antes de guardarlo.
  github: githubRepoRefSchema.optional(),
});

export const updateSystemSchema = createSystemSchema.partial().extend({
  metadata: systemMetadataSchema.nullable().optional(),
});

export const reorderSystemsSchema = z.object({
  systemIds: z.array(z.string().uuid()),
});
