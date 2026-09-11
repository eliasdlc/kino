import { Feather, GraduationCap, Hammer, Rocket, Settings, Star, type LucideIcon } from 'lucide-react';
import { SYSTEM_TYPE_CONFIG, type ArchetypeFieldDef, type SystemType } from '@/shared/lib/system-types';
import type { ColorValue, EnergyLevelValue, TemplateTypeValue } from '@/shared/types/enums';

/**
 * Manifiesto de identidad del onboarding (D14). El arquetipo es la estrategia de
 * adquisición: quien entra no elige "un tipo de sistema", elige **quién es**, y de
 * ahí sale con qué vocabulario, qué contenedores y qué contenido real arranca.
 *
 * Encima del manifiesto de arquetipo (`system-types.ts`), no en paralelo: aquí solo
 * vive lo propio del primer contacto: copy de la bifurcación, defaults del primer
 * sistema y la siembra. El vocabulario (clase / milestone / obra), los task kinds y
 * la energía se leen de `SYSTEM_TYPE_CONFIG`. Añadir una identidad es añadir una
 * entrada a `ONBOARDING_ARCHETYPES`, nunca un `if` por tipo.
 */

/**
 * El orden es el de la galería del alta. `propio` va último a propósito: su
 * frase es "ninguna de las anteriores", así que no puede leerse antes que ellas.
 */
export const ARCHETYPE_IDENTITIES = [
  'estudiante',
  'builder',
  'emprendedor',
  'personal',
  'escritor',
  'propio',
] as const;

export type ArchetypeIdentity = (typeof ARCHETYPE_IDENTITIES)[number];

export const DEFAULT_IDENTITY: ArchetypeIdentity = 'propio';

/**
 * Tarea sembrada. `{unidad}` se interpola con el nombre de la unidad y `{sistema}`
 * con el del sistema. `kind` debe estar declarado en los `taskKinds` del arquetipo
 *: el test del manifiesto lo verifica, y `createTask` lo rechaza en runtime.
 */
export interface SeedTaskSpec {
  title: string;
  kind?: string;
  energyLevel?: 'high' | 'medium' | 'low';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  /**
   * Arranca hoy: la tarea nace con `startDate` en el día local del usuario, lo
   * que la coloca en el plan de hoy. No se siembra un `status` a mano: en Kino
   * el status de scheduling se deriva de la fecha y el reconciliador devuelve a
   * backlog cualquier tarea sin `start_date`. Como mucho una por arquetipo: el
   * primer paso, no una lista que ya llega vencida.
   */
  startsToday?: boolean;
  /** Solo `project`: columna del board donde nace la tarjeta. */
  boardStatus?: string;
}

/**
 * Cómo se materializa lo que el usuario escribe en el paso de siembra.
 * `folder` → una carpeta con el rol del arquetipo (clase, milestone, obra).
 * `task` → una tarea suelta, para arquetipos sin carpetas (project) o sin
 * vocabulario propio (custom).
 */
export type SeedUnitKind = 'folder' | 'task';

export interface ArchetypeSeed {
  unitKind: SeedUnitKind;
  /** Titular del bloque de siembra dentro del paso de primer sistema. */
  title: string;
  subtitle: string;
  /** Ejemplos por slot; también fijan cuántos inputs se pintan de entrada. */
  placeholders: string[];
  maxUnits: number;
  /**
   * Campo extra que se pide por unidad, declarado en el `folderRole` del
   * arquetipo (escritor → `medium`). Se persiste en `folders.metadata`.
   */
  unitFieldId?: string;
  /** Tareas que nacen dentro de cada unidad (solo `unitKind: 'folder'`). */
  unitTasks: SeedTaskSpec[];
  /** Base que se aplica a la unidad cuando `unitKind` es `task`. */
  unitTaskDefaults?: Omit<SeedTaskSpec, 'title'>;
  /** Tareas del sistema, sin unidad. Se crean aunque no se siembre nada. */
  systemTasks: SeedTaskSpec[];
  /**
   * Primer manuscrito dentro de cada unidad. El título sale del vocabulario del
   * medium ("Capítulo 1", "Escena 1") y el contenido de su plantilla.
   */
  seedFirstPage?: boolean;
}

export interface OnboardingArchetype {
  id: ArchetypeIdentity;
  /** Arquetipo del primer sistema. Excluye `inbox`: ese no se elige, se crea solo. */
  systemType: TemplateTypeValue;
  icon: LucideIcon;
  /**
   * Slug del segmento en las landings `/para/*` (5.2). `null` → la identidad no
   * tiene landing propia; se llega a ella eligiéndola en el onboarding.
   */
  landingSlug: string | null;
  /**
   * Nombre con el que nace el primer sistema. El alta ya no lo pregunta, así que
   * no puede estar vacío: es el nombre que la persona va a ver en Hoy antes de
   * tocar nada, y renombrarlo es un gesto de un toque desde la cabecera.
   */
  systemNameDefault: string;
  systemNamePlaceholder: string;
  systemNameSuggestions: string[];
  /** Frase de identidad del sistema (se muestra citada en su cabecera). */
  identityStatement: string;
  /** Clave de `ICON_MAP` con la que nace el sistema. */
  systemIcon: string;
  systemColor: ColorValue;
  /** Cierre del onboarding: qué promete Kino a *esta* persona. */
  promise: string;
  seed: ArchetypeSeed;
}

export const ONBOARDING_ARCHETYPES: Record<ArchetypeIdentity, OnboardingArchetype> = {
  estudiante: {
    id: 'estudiante',
    systemType: 'academic',
    icon: GraduationCap,
    landingSlug: 'estudiantes',
    systemNameDefault: 'Semestre actual',
    systemNamePlaceholder: 'ej. Semestre actual',
    systemNameSuggestions: ['Semestre actual', 'Universidad', 'Maestría'],
    identityStatement: 'Llego a las entregas sin madrugadas de pánico.',
    systemIcon: 'graduation',
    systemColor: 'blue',
    promise: 'Cada mañana verás qué entrega toca antes de que la fecha te alcance.',
    seed: {
      unitKind: 'folder',
      title: '¿Qué clases llevas este semestre?',
      subtitle:
        'Cada clase es su propio espacio: sus entregas, sus exámenes y sus apuntes. Puedes añadir más después.',
      placeholders: ['Cálculo II', 'Historia del arte', 'Programación I'],
      maxUnits: 6,
      unitTasks: [
        { title: 'Primera entrega de {unidad}', kind: 'assignment', energyLevel: 'medium' },
      ],
      systemTasks: [
        { title: 'Leer el syllabus de cada clase', kind: 'reading', energyLevel: 'low', startsToday: true },
      ],
    },
  },
  builder: {
    id: 'builder',
    systemType: 'project',
    icon: Hammer,
    landingSlug: 'builders',
    systemNameDefault: 'Mi proyecto',
    systemNamePlaceholder: 'ej. Mi proyecto',
    systemNameSuggestions: ['Mi proyecto', 'Side project', 'Producto'],
    identityStatement: 'Envío cosas terminadas, no ramas a medias.',
    systemIcon: 'code',
    systemColor: 'teal',
    promise: 'Tu board arranca con trabajo real y sabes qué tocar en tu pico de energía.',
    seed: {
      unitKind: 'task',
      title: '¿Qué estás construyendo ahora?',
      subtitle: 'Cada cosa entra como tarjeta en la columna "Por hacer" de tu board.',
      placeholders: ['Terminar el login', 'Arreglar el bug del calendario', 'Publicar la landing'],
      maxUnits: 6,
      unitTasks: [],
      unitTaskDefaults: { energyLevel: 'high', boardStatus: 'todo' },
      systemTasks: [
        {
          title: 'Definir qué significa "terminado" en este proyecto',
          energyLevel: 'medium',
          startsToday: true,
          boardStatus: 'todo',
        },
      ],
    },
  },
  emprendedor: {
    id: 'emprendedor',
    systemType: 'entrepreneurial',
    icon: Rocket,
    landingSlug: 'emprendedores',
    systemNameDefault: 'Mi emprendimiento',
    systemNamePlaceholder: 'ej. Mi emprendimiento',
    systemNameSuggestions: ['Mi emprendimiento', 'Startup', 'Negocio'],
    identityStatement: 'Avanzo con experimentos, no con intuiciones.',
    systemIcon: 'rocket',
    systemColor: 'orange',
    promise: 'Tus milestones caen cuando estás en pico, no cuando estás fundido.',
    seed: {
      unitKind: 'folder',
      title: '¿Cuáles son tus próximos milestones?',
      subtitle:
        'Un milestone es un resultado, no una tarea: "primeros 10 clientes", no "escribir emails".',
      placeholders: ['Lanzar la beta', 'Primeros 10 clientes', 'Validar el precio'],
      maxUnits: 5,
      unitTasks: [
        { title: 'Primer experimento para {unidad}', kind: 'experiment', energyLevel: 'high' },
      ],
      systemTasks: [
        {
          title: 'Escribir en una línea qué problema resuelves',
          kind: 'learning',
          energyLevel: 'medium',
          startsToday: true,
        },
      ],
    },
  },
  personal: {
    id: 'personal',
    systemType: 'personal',
    icon: Star,
    landingSlug: null,
    systemNameDefault: 'Personal',
    systemNamePlaceholder: 'ej. Personal',
    systemNameSuggestions: ['Personal', 'Casa y salud', 'Mi vida'],
    identityStatement: 'Lo que sostiene mi vida no se cae por estar trabajando.',
    systemIcon: 'star',
    systemColor: 'green',
    promise: 'Lo de tu vida deja de competir con el trabajo por tu memoria.',
    seed: {
      unitKind: 'folder',
      title: '¿Qué áreas de tu vida quieres sostener?',
      subtitle:
        'Un área es algo que no se termina: salud, casa, papeles. Dentro viven sus hábitos y sus recados.',
      placeholders: ['Salud', 'Casa', 'Papeles y trámites'],
      maxUnits: 6,
      unitTasks: [{ title: 'Primer paso en {unidad}', kind: 'errand', energyLevel: 'low' }],
      systemTasks: [
        {
          title: 'Anotar el hábito que quieres sostener esta semana',
          kind: 'habit',
          energyLevel: 'low',
          startsToday: true,
        },
      ],
    },
  },
  escritor: {
    id: 'escritor',
    systemType: 'writing',
    icon: Feather,
    landingSlug: 'escritores',
    systemNameDefault: 'Escritura',
    systemNamePlaceholder: 'ej. Escritura',
    systemNameSuggestions: ['Escritura', 'Mis obras', 'Taller'],
    identityStatement: 'Escribo en mi mejor ventana creativa, no en la que sobra.',
    systemIcon: 'feather',
    systemColor: 'purple',
    promise: 'Tu obra ya existe: el pico creativo del día queda reservado para ella.',
    seed: {
      unitKind: 'folder',
      title: '¿Qué estás escribiendo?',
      subtitle:
        'La obra es el contenedor; dentro nacen los manuscritos. Elige su forma y el editor se monta para ella.',
      placeholders: ['El título de tu obra'],
      maxUnits: 3,
      unitFieldId: 'medium',
      seedFirstPage: true,
      unitTasks: [
        { title: 'Primera sesión de escritura en {unidad}', kind: 'write', energyLevel: 'high' },
      ],
      systemTasks: [
        { title: 'Outline: en qué termina la historia', kind: 'outline', energyLevel: 'medium', startsToday: true },
      ],
    },
  },
  propio: {
    id: 'propio',
    systemType: 'custom',
    icon: Settings,
    landingSlug: null,
    // Neutro a propósito: quien elige "ninguna de las anteriores" no ha dicho
    // en qué trabaja, así que Kino no lo adivina.
    systemNameDefault: 'Mi sistema',
    systemNamePlaceholder: 'ej. Trabajo',
    systemNameSuggestions: ['Trabajo', 'Salud', 'Finanzas', 'Casa'],
    identityStatement: '',
    systemIcon: 'folder',
    systemColor: 'blue',
    promise: 'Lo que ya tienes encima queda ordenado, y sabes por dónde empezar hoy.',
    seed: {
      unitKind: 'task',
      title: '¿Qué tienes pendiente ahora mismo?',
      subtitle: 'Escríbelo como lo dirías en voz alta. Ordenarlo viene después.',
      placeholders: ['Llamar al banco', 'Terminar la propuesta', 'Comprar los pasajes'],
      maxUnits: 6,
      unitTasks: [],
      unitTaskDefaults: {},
      // `custom` no declara task kinds, así que la tarea nace sin kind. Es lo
      // único que Kino puede saber de alguien que dijo "ninguna de las
      // anteriores": que tiene cosas encima y todavía no están escritas.
      systemTasks: [
        { title: 'Anotar lo que tienes encima ahora mismo', energyLevel: 'low', startsToday: true },
      ],
    },
  },
};

export const ARCHETYPE_LIST: OnboardingArchetype[] = ARCHETYPE_IDENTITIES.map(
  (id) => ONBOARDING_ARCHETYPES[id],
);

/**
 * Qué identidad del alta corresponde a cada arquetipo del manifiesto. `inbox`
 * queda fuera porque no se elige: se crea con la cuenta. El tipo es lo que hace
 * el trabajo: añadir un arquetipo a `SYSTEM_TYPE_CONFIG` deja de compilar hasta
 * que exista su entrada aquí, así que la galería nunca puede quedarse corta.
 */
export const IDENTITY_BY_SYSTEM_TYPE: Record<Exclude<SystemType, 'inbox'>, ArchetypeIdentity> = {
  academic: 'estudiante',
  project: 'builder',
  entrepreneurial: 'emprendedor',
  personal: 'personal',
  writing: 'escritor',
  custom: 'propio',
};

export function getArchetype(identity: ArchetypeIdentity): OnboardingArchetype {
  return ONBOARDING_ARCHETYPES[identity];
}

/**
 * Identidad preseleccionada al llegar desde una landing por segmento
 * (`/para/escritores` → `?para=escritores`). Un slug desconocido no rompe el
 * onboarding: cae en `null` y el usuario elige a mano.
 */
export function identityFromLandingSlug(slug: string | null | undefined): ArchetypeIdentity | null {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();
  return (
    ARCHETYPE_LIST.find((a) => a.landingSlug === normalized || a.id === normalized)?.id ?? null
  );
}

/**
 * Energía ideal con la que nace el sistema, leída del manifiesto de arquetipo.
 * `flexible` y `null` no son valores de la columna `energy_ideal`: esos casos
 * quedan sin preferencia en vez de inventarse una.
 */
export function archetypeEnergyIdeal(
  archetype: OnboardingArchetype,
): EnergyLevelValue | undefined {
  const energy = SYSTEM_TYPE_CONFIG[archetype.systemType].energyDefault;
  return energy === 'high' || energy === 'medium' || energy === 'low' ? energy : undefined;
}

/**
 * Definición del campo extra que se pide por unidad, resuelta contra el
 * `folderRole` del arquetipo. Devuelve `null` si el arquetipo no pide ninguno:
 * el formulario no inventa campos que el manifiesto no declare.
 */
export function seedUnitField(archetype: OnboardingArchetype): ArchetypeFieldDef | null {
  const fieldId = archetype.seed.unitFieldId;
  if (!fieldId) return null;
  const fields = SYSTEM_TYPE_CONFIG[archetype.systemType].folderRole?.fields ?? [];
  return fields.find((f) => f.id === fieldId) ?? null;
}

/** Vocabulario de la unidad sembrada, leído del manifiesto de arquetipo. */
export function seedUnitNoun(archetype: OnboardingArchetype): { singular: string; plural: string } {
  const folderRole = SYSTEM_TYPE_CONFIG[archetype.systemType].folderRole;
  if (archetype.seed.unitKind === 'folder' && folderRole) {
    return { singular: folderRole.noun, plural: folderRole.nounPlural };
  }
  return { singular: 'tarea', plural: 'tareas' };
}
