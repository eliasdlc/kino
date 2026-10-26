import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { invalid } from './errors';

/**
 * Dónde trabaja el agente, traducido a un sistema de Kino.
 *
 * El agente manda su carpeta de trabajo (`workingDirectory`) y, si es un repo
 * git, el remoto de `origin` (`gitRemote`). Las reglas de `workdirRules`
 * asignan una carpeta o un repo a un sistema:
 *
 * - **El repo manda sobre la carpeta.** Un repo se reconoce por su remoto, no
 *   por dónde está clonado, así que su regla vale en cada clon y cada worktree.
 * - **Entre carpetas, la más profunda gana y las subcarpetas heredan.** Se
 *   compara por segmentos de ruta: `/a/Uni` cubre `/a/Uni/tema1`, nunca
 *   `/a/Universidad`.
 * - Una regla cuyo sistema ya no está activo no cuenta, y se sigue buscando.
 */

/** PATH_MAX de macOS. Una ruta más larga no es una carpeta de trabajo. */
export const WORKDIR_PATH_MAX = 1024;
/** Un remoto con host y ruta de grupo; GitLab admite subgrupos anidados. */
export const WORKDIR_REMOTE_MAX = 512;
/**
 * Reglas por persona. Son carpetas que alguien eligió a mano: doscientas son
 * años de proyectos, y el techo impide que un agente en bucle llene la tabla.
 */
export const WORKDIR_RULES_MAX = 200;

export type WorkdirKind = Doc<'workdirRules'>['kind'];

/** La carpeta y el repo ya normalizados; cualquiera de los dos puede faltar. */
export interface Workdir {
  path?: string;
  repo?: string;
}

/**
 * Una ruta absoluta en su forma de clave: sin barras repetidas ni al final, y
 * con `.` y `..` resueltos. `null` si no es absoluta (`~/x`, `./x`, `C:\x`),
 * porque el servidor no sabe dónde está el home de nadie.
 */
export function normalizePath(raw: string): string | null {
  const value = raw.trim();
  if (!value.startsWith('/')) return null;
  const segments: string[] = [];
  for (const segment of value.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

/** La carpeta y todas las que la contienen, de la más profunda a `/`. */
export function pathAncestors(path: string): string[] {
  const segments = path.split('/').filter(Boolean);
  const out: string[] = [];
  for (let n = segments.length; n > 0; n--) out.push(`/${segments.slice(0, n).join('/')}`);
  out.push('/');
  return out;
}

/**
 * Un remoto git como `host/dueño/nombre` en minúsculas, que es lo que
 * comparten las formas en que se escribe el mismo repo:
 * `https://github.com/a/b.git`, `git@github.com:a/b.git`,
 * `ssh://git@github.com/a/b` y `github.com/a/b` dan todos `github.com/a/b`.
 * Las credenciales de una URL https no llegan a la clave. `null` si no hay un
 * host con dominio y al menos un segmento de ruta (un remoto local, por
 * ejemplo).
 */
export function normalizeRemote(raw: string): string | null {
  const value = raw.trim();
  let host: string;
  let path: string;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    host = url.hostname;
    path = url.pathname;
  } else {
    const match = /^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/.exec(value) ?? /^([^/\s]+)\/(.+)$/.exec(value);
    if (!match) return null;
    host = match[1]!;
    path = match[2]!;
  }
  const segments = path.split('/').filter(Boolean);
  const last = segments.pop()?.replace(/\.git$/i, '');
  if (last) segments.push(last);
  if (!host.includes('.') || segments.length === 0) return null;
  return `${host}/${segments.join('/')}`.toLowerCase();
}

/**
 * Lo que manda el agente, normalizado. Una ruta o un remoto que no se pueden
 * leer son un error, no una ausencia: callarlo mandaría la tarea a la Bandeja
 * sin que nadie supiera por qué.
 */
export function readWorkdir(input: { workingDirectory?: string; gitRemote?: string }): Workdir {
  const workdir: Workdir = {};
  if (input.workingDirectory !== undefined) {
    const path = normalizePath(input.workingDirectory);
    if (!path) invalid('workingDirectory tiene que ser la ruta absoluta de la carpeta de trabajo, como /home/ana/proyectos/tesis');
    workdir.path = path;
  }
  if (input.gitRemote !== undefined) {
    const repo = normalizeRemote(input.gitRemote);
    if (!repo) invalid('gitRemote tiene que ser la URL del remoto, como https://github.com/ana/tesis.git o git@github.com:ana/tesis.git');
    workdir.repo = repo;
  }
  return workdir;
}

/** Las claves a probar, en orden de preferencia: el repo, y luego cada carpeta de la más profunda a la raíz. */
export function workdirCandidates(workdir: Workdir): { kind: WorkdirKind; key: string }[] {
  const out: { kind: WorkdirKind; key: string }[] = [];
  if (workdir.repo) out.push({ kind: 'repo', key: workdir.repo });
  if (workdir.path) for (const key of pathAncestors(workdir.path)) out.push({ kind: 'path', key });
  return out;
}

export interface WorkdirMatch {
  rule: Doc<'workdirRules'>;
  system: Doc<'systems'>;
}

/**
 * El sistema al que va lo que se haga en `workdir`, o `null` si ninguna regla
 * de esta persona lo cubre. Cada candidato es una lectura por clave exacta en
 * el índice de la persona: lee como mucho una fila por segmento de la ruta,
 * nunca la tabla.
 */
export async function resolveWorkdir(ctx: QueryCtx, userId: Id<'users'>, workdir: Workdir): Promise<WorkdirMatch | null> {
  for (const { kind, key } of workdirCandidates(workdir)) {
    const rule = await ctx.db
      .query('workdirRules')
      .withIndex('by_user_kind_key', (q) => q.eq('userId', userId).eq('kind', kind).eq('key', key))
      .first();
    if (!rule) continue;
    const system = await ctx.db.get(rule.systemId);
    if (system && system.userId === userId && system.isActive) return { rule, system };
  }
  return null;
}
