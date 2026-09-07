import type { ArchetypeManifest, Gender, SystemTabId } from './system-types';

/**
 * Copy derivado del manifiesto. Un sistema académico vacío no dice "no hay
 * carpetas": dice "todavía no tienes clases" (D16).
 *
 * Todo sale de `folderRole`/`pageRole`: nada de tablas paralelas de textos por
 * arquetipo, que es exactamente la duplicación que el manifiesto vino a matar.
 * Lo único que se añadió al manifiesto para esto es el género del sustantivo:
 * sin él el español sale en neutro de traductor ("crear primero clase").
 */

export interface EmptyCopy {
  title: string;
  hint: string;
}

/** "la" / "el" / "las" / "los". */
export function article(gender: Gender, plural = false): string {
  if (plural) return gender === 'f' ? 'las' : 'los';
  return gender === 'f' ? 'la' : 'el';
}

/** "la primera" / "el primer": el ordinal apocopado que pide el masculino. */
export function firstOne(gender: Gender): string {
  return gender === 'f' ? 'la primera' : 'el primer';
}

/** Enclítico de objeto directo plural: "agrúpalas" / "agrúpalos". */
function themPronoun(gender: Gender): string {
  return gender === 'f' ? 'las' : 'los';
}

/**
 * Contenedores vacíos (sidebar, lista de carpetas de la superficie de docs).
 * `null` cuando el arquetipo no ofrece contenedores: ahí el estado vacío correcto
 * es no pintar nada, no explicar una ausencia.
 */
export function containersEmptyCopy(manifest: ArchetypeManifest): EmptyCopy | null {
  const role = manifest.folderRole;
  if (!role) return null;
  return {
    title: `Todavía no tienes ${role.nounPlural}`,
    hint: `Crea ${firstOne(role.gender)} ${role.noun} y organiza el resto desde ahí.`,
  };
}

/** Biblioteca de páginas vacía; menciona los contenedores si el arquetipo los tiene. */
export function pagesEmptyCopy(manifest: ArchetypeManifest): EmptyCopy {
  const page = manifest.pageRole;
  const folder = manifest.folderRole;
  const first = `Crea ${firstOne(page.gender)} ${page.noun}`;

  return {
    title: `Todavía no tienes ${page.nounPlural}`,
    hint: folder
      ? `${first} y, si quieres, agrúpa${themPronoun(page.gender)} en ${folder.nounPlural}.`
      : `${first} para empezar a escribir.`,
  };
}

/** Un contenedor abierto y sin nada dentro. */
export function containerDetailEmptyCopy(manifest: ArchetypeManifest): EmptyCopy {
  const page = manifest.pageRole;
  const noun = manifest.folderRole?.noun ?? 'carpeta';
  const gender = manifest.folderRole?.gender ?? 'f';
  return {
    title: `${gender === 'f' ? 'Esta' : 'Este'} ${noun} está ${gender === 'f' ? 'vacía' : 'vacío'}`,
    hint: `Crea ${firstOne(page.gender)} ${page.noun} o una subcarpeta para empezar a llenar${gender === 'f' ? 'la' : 'lo'}.`,
  };
}

/**
 * Estados vacíos del funnel de tareas. El vocabulario entra por la fuente del
 * trabajo (las clases, los milestones…), que es lo que el arquetipo sabe; la
 * palabra "tarea" se queda porque es global a Kino, no del arquetipo.
 */
export function tasksEmptyCopy(manifest: ArchetypeManifest, tab: SystemTabId): EmptyCopy {
  const plural = manifest.folderRole?.nounPlural ?? null;

  switch (tab) {
    case 'backlog':
      return {
        title: '¡Todo al día!',
        hint: plural
          ? `Nada esperando turno. Lo que pidan tus ${plural} entra por aquí.`
          : 'Nada esperando turno. Lo que captures sin fecha entra por aquí.',
      };
    case 'archive':
      return {
        title: 'Aún no hay nada aquí',
        hint: plural
          ? `Lo que completes en tus ${plural} se guarda aquí para tu referencia.`
          : 'Las tareas completadas aparecerán aquí para tu referencia.',
      };
    case 'planning':
      return {
        title: 'Nada que planificar',
        hint: plural
          ? `Cuando tus ${plural} pidan trabajo, lo organizas aquí.`
          : 'Captura algo primero y decide aquí cuándo lo haces.',
      };
    case 'action':
    default:
      return {
        title: 'No hay tareas en tu semana',
        hint: plural
          ? `Ve a Planificación para traer trabajo de tus ${plural}.`
          : 'No tienes trabajo programado. Ve a Planificación para organizar tareas de hoy o de la semana.',
      };
  }
}
