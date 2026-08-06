import { Folder, Tag } from 'lucide-react';
import {
  SYSTEM_TYPE_CONFIG,
  type ArchetypeManifest,
  type Gender,
  type SystemComposition,
  type SystemMetadata,
  type SystemTabId,
  type SystemType,
  type TaskKindDef,
} from './system-types';

/**
 * El manifiesto EFECTIVO de un sistema: el del arquetipo, más lo que ese sistema
 * concreto haya compuesto encima (D16).
 *
 * `SYSTEM_TYPE_CONFIG` sigue siendo la opinión del arquetipo; esto es la lectura
 * que hace la UI, que ya no puede asumir que dos sistemas del mismo tipo hablan
 * igual. La regla: **solo `custom` se deja componer**. Academic es "clases" para
 * todo el mundo porque el advisor, el onboarding y las cards comparten ese
 * vocabulario; un sistema sin opinión (`custom`) es justamente el que la pide
 * prestada al usuario.
 */

/** Sustantivos que la UI no debe dejar vacíos si el usuario borra el input. */
const FALLBACK_CONTAINER = { noun: 'carpeta', nounPlural: 'carpetas' };
const FALLBACK_PAGE = { noun: 'página', nounPlural: 'páginas' };

/**
 * Género de un sustantivo escrito por el usuario. Heurística de español, no
 * diccionario: acierta en la gran mayoría ("tabla" f, "capítulo" m, "canción" f)
 * y su único costo cuando falla es un artículo raro en un estado vacío.
 */
export function guessGender(noun: string): Gender {
  const word = noun.trim().toLowerCase();
  if (!word) return 'f';
  if (/(ción|sión|dad|tad|tud|umbre|ez|itis)$/.test(word)) return 'f';
  if (/a$/.test(word)) return 'f';
  return 'm';
}

/**
 * Id estable de un kind escrito por el usuario. Se deriva del label una sola vez
 * (al crearlo) y no vuelve a cambiar: las tareas ya guardadas apuntan a ese id,
 * así que renombrar el label no puede reescribirlo sin migrar tasks.metadata.
 */
export function kindIdFromLabel(label: string): string {
  const slug = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'kind';
}

/**
 * Plural sugerido mientras el usuario escribe el singular. Es una sugerencia
 * editable, no una regla: el campo plural sigue siendo suyo.
 */
export function pluralize(noun: string): string {
  const word = noun.trim();
  if (!word) return '';
  if (/z$/i.test(word)) return `${word.slice(0, -1)}ces`;
  if (/[aeiouáéíóú]$/i.test(word)) return `${word}s`;
  if (/s$/i.test(word)) return word;
  return `${word}es`;
}

/** Capitaliza para títulos y CTAs ("apuntes" → "Apuntes"). */
export function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function composedTaskKinds(kinds: SystemComposition['taskKinds']): TaskKindDef[] {
  if (!kinds?.length) return [];
  const seen = new Set<string>();
  const out: TaskKindDef[] = [];
  for (const kind of kinds) {
    const id = kind.id || kindIdFromLabel(kind.label);
    if (!kind.label.trim() || seen.has(id)) continue;
    seen.add(id);
    // Sin icono propio: el usuario nombra clases de tarea, no diseña iconografía.
    out.push({ id, label: kind.label.trim(), icon: Tag, fields: [] });
  }
  return out;
}

/** Aplica la composición de un sistema sobre el manifiesto base de su arquetipo. */
export function composeManifest(
  base: ArchetypeManifest,
  composition: SystemComposition | undefined | null,
): ArchetypeManifest {
  if (!composition) return base;

  const next: ArchetypeManifest = { ...base };

  if (composition.containers) {
    const { enabled } = composition.containers;
    const noun = composition.containers.noun?.trim() || FALLBACK_CONTAINER.noun;
    const nounPlural = composition.containers.nounPlural?.trim() || FALLBACK_CONTAINER.nounPlural;
    const gender = guessGender(noun);
    next.folderRole = enabled
      ? {
          noun,
          nounPlural,
          gender,
          newLabel: `${gender === 'f' ? 'Nueva' : 'Nuevo'} ${noun}`,
          placeholder: `Nombre ${gender === 'f' ? 'de la' : 'del'} ${noun}`,
          icon: base.folderRole?.icon ?? Folder,
          // Un sistema compuesto no declara campos: nombrar es la libertad que da
          // D16, diseñar formularios sería un editor de esquemas.
          fields: [],
        }
      : null;
  }

  if (composition.pages) {
    const noun = composition.pages.noun?.trim() || FALLBACK_PAGE.noun;
    const nounPlural = composition.pages.nounPlural?.trim() || FALLBACK_PAGE.nounPlural;
    next.pageRole = {
      noun,
      nounPlural,
      gender: guessGender(noun),
      primary: composition.pages.primary,
    };
  }

  const taskKinds = composedTaskKinds(composition.taskKinds);
  if (taskKinds.length > 0) next.taskKinds = taskKinds;

  return next;
}

/**
 * Manifiesto efectivo a partir de lo que guarda la fila `systems`.
 *
 * `tabs`/`defaultTab` se aplican a cualquier tipo (son una preferencia de vista,
 * no opinión del arquetipo); `composition` solo a `custom`.
 */
export function resolveManifest(
  templateType: string | null | undefined,
  metadata: SystemMetadata | null | undefined,
): ArchetypeManifest {
  const systemType = (templateType ?? 'custom') as SystemType;
  const base = SYSTEM_TYPE_CONFIG[systemType] ?? SYSTEM_TYPE_CONFIG.custom;

  const composed = systemType === 'custom' ? composeManifest(base, metadata?.composition) : base;

  const tabs = metadata?.tabs?.length ? metadata.tabs : composed.tabs;
  const defaultTab: SystemTabId =
    metadata?.defaultTab && tabs.includes(metadata.defaultTab)
      ? metadata.defaultTab
      : tabs.includes(composed.defaultTab)
        ? composed.defaultTab
        : tabs[0];

  if (tabs === composed.tabs && defaultTab === composed.defaultTab) return composed;
  return { ...composed, tabs, defaultTab };
}

/** Azúcar para cuando ya se tiene la fila del sistema en la mano. */
export function resolveSystemManifest(
  system: { templateType?: string | null; metadata?: SystemMetadata | null } | null | undefined,
): ArchetypeManifest {
  return resolveManifest(system?.templateType, system?.metadata);
}

/** Busca un kind en el manifiesto EFECTIVO (incluye los que compuso el usuario). */
export function findTaskKind(manifest: ArchetypeManifest, kindId: unknown): TaskKindDef | null {
  if (typeof kindId !== 'string') return null;
  return manifest.taskKinds.find((k) => k.id === kindId) ?? null;
}

/**
 * Superficie con que abre el sistema cuando la URL no pide una. `writing` ya
 * resuelve su naturaleza pages-first dentro de su propia vista, así que solo se
 * redirige a la biblioteca cuando la composición del usuario lo pide.
 */
export function landingSurface(
  system: { templateType?: string | null; metadata?: SystemMetadata | null },
): 'tasks' | 'docs' {
  const isCustom = (system.templateType ?? 'custom') === 'custom';
  return isCustom && system.metadata?.composition?.pages?.primary ? 'docs' : 'tasks';
}
