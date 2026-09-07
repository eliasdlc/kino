import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { estaLimpio } from './denylist';

// El extractor del diario de sesiones.
//
// Lee las transcripciones de Claude Code del laptop y produce **un digest por
// semana** (D-15, decidida el 7 de septiembre). Kino no guarda nada crudo: los
// gigabytes no salen de este disco, y lo que sube son unos pocos kilobytes.
//
// Es determinista a propósito, y eso quiere decir sin modelo: dos ejecuciones
// sobre las mismas transcripciones producen el mismo digest byte a byte. Un
// resumen escrito por un modelo sería más bonito y haría imposible saber si el
// diario cambió porque cambió la semana o porque el modelo tuvo otro día.

/** Tope de la cita. El mismo número que `convex/digests.ts`, y por el mismo motivo. */
export const CITA_MAX = 280;

/** Mínimo para que una frase valga como cita. Menos es un "sí", "dale", "ok". */
export const CITA_MIN = 40;

/** Una cosa que Elias escribió, con dónde encontrarla. */
export interface Prompt {
  readonly sessionId: string;
  readonly proyecto: string;
  readonly instante: number;
  readonly texto: string;
  /** Línea dentro de su transcripción, para poder ir a mirarla. */
  readonly linea: number;
}

export interface Digest {
  readonly source: 'claude-code';
  /** La semana ISO: `2026-W37`. Es la identidad de la fila en Convex. */
  readonly externalId: string;
  readonly digest: {
    readonly summary: string;
    readonly quote: string;
    /** Huella del fragmento fuente completo, para comprobar la cita contra el disco. */
    readonly quoteHash: string;
    readonly quoteSession: string;
    readonly quoteOffset: number;
    readonly sesiones: number;
    readonly proyectos: readonly string[];
  };
}

// ── Semana ──────────────────────────────────────────────────────────────────

/**
 * La semana ISO de un instante, en UTC. La línea del lunes se lee un lunes por
 * la mañana, así que el corte de la semana es el que pone el lunes primero.
 */
export function semanaDe(instante: number): string {
  const d = new Date(instante);
  const jueves = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // El jueves de esa semana decide el año ISO, que es lo que hace que la última
  // semana de diciembre y la primera de enero no se peleen por las mismas filas:
  // el 31 de diciembre de 2025 y el 1 de enero de 2026 caen los dos en 2026-W01.
  jueves.setUTCDate(jueves.getUTCDate() + 4 - (jueves.getUTCDay() || 7));
  const anio = jueves.getUTCFullYear();
  const diasDesdeEnero = (jueves.getTime() - Date.UTC(anio, 0, 1)) / 86_400_000;
  const semana = Math.ceil((diasDesdeEnero + 1) / 7);
  return `${anio}-W${String(semana).padStart(2, '0')}`;
}

// ── Lectura ─────────────────────────────────────────────────────────────────

/**
 * Lo que Elias escribió, y sólo eso.
 *
 * Una transcripción lleva mensajes del modelo, resultados de herramientas,
 * adjuntos y ruido del propio cliente. La línea que sirve para citar es la que
 * él tecleó: `type: user` con el contenido en texto llano. Lo demás no es suyo.
 */
export function promptsDeTranscripcion(contenido: string, sessionId: string): Prompt[] {
  const prompts: Prompt[] = [];
  contenido.split('\n').forEach((linea, indice) => {
    if (!linea.startsWith('{')) return;
    let fila: Record<string, unknown>;
    try {
      fila = JSON.parse(linea) as Record<string, unknown>;
    } catch {
      return;
    }
    if (fila.type !== 'user') return;
    const mensaje = fila.message as { content?: unknown } | undefined;
    const texto = typeof mensaje?.content === 'string' ? mensaje.content.trim() : '';
    if (!texto || esRuidoDelCliente(texto)) return;
    const instante = Date.parse(String(fila.timestamp ?? ''));
    if (Number.isNaN(instante)) return;
    prompts.push({
      sessionId: String(fila.sessionId ?? sessionId),
      proyecto: proyectoDe(String(fila.cwd ?? '')),
      instante,
      texto,
      linea: indice + 1,
    });
  });
  return prompts;
}

/** Lo que el cliente mete en el hueco del usuario y no escribió nadie. */
function esRuidoDelCliente(texto: string): boolean {
  return (
    texto.startsWith('<') ||
    texto.startsWith('Caveat:') ||
    texto.startsWith('[Request interrupted') ||
    // Una ruta suelta es un fichero arrastrado a la ventana, no una frase.
    /^[/~][^\s]*$/.test(texto)
  );
}

/**
 * El nombre del proyecto a partir del `cwd`.
 *
 * La última carpeta no sirve: trabajar dentro de `ConoceRD/app` daría "app", y
 * abrir Claude Code en el home daría el nombre de usuario. El nombre bueno es
 * el que va justo después de `projects/`, que es como está organizado este
 * disco; fuera de ahí vale la última carpeta, y el home suelto no es un
 * proyecto sino no haber abierto ninguno.
 */
export function proyectoDe(cwd: string): string {
  const partes = cwd.split('/').filter(Boolean);
  const tras = partes.lastIndexOf('projects');
  if (tras >= 0 && partes[tras + 1]) return partes[tras + 1]!;
  if (partes.length <= 2) return 'sin proyecto';
  return partes[partes.length - 1]!;
}

/** Todas las transcripciones de `~/.claude/projects`, en orden estable. */
export async function leerTranscripciones(raiz: string): Promise<Prompt[]> {
  const prompts: Prompt[] = [];
  const proyectos = (await readdir(raiz, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  for (const proyecto of proyectos) {
    const dir = join(raiz, proyecto);
    const ficheros = (await readdir(dir)).filter((f) => f.endsWith('.jsonl')).sort();
    for (const fichero of ficheros) {
      const contenido = await readFile(join(dir, fichero), 'utf8');
      prompts.push(...promptsDeTranscripcion(contenido, fichero.replace(/\.jsonl$/, '')));
    }
  }
  return prompts;
}

// ── El digest ───────────────────────────────────────────────────────────────

/**
 * La cita de la semana: la frase más larga que quepa entera, y a igualdad de
 * longitud la más temprana. Es una regla y no un gusto, que es lo que hace que
 * dos ejecuciones den lo mismo.
 *
 * Lo que la denylist bloquea no entra ni como candidato. Una frase que no cabe
 * se recorta con puntos suspensivos, y el hash sigue apuntando al fragmento
 * entero para poder comprobarla contra el disco.
 */
export function citaDe(prompts: readonly Prompt[]): Prompt | null {
  const candidatos = prompts.filter((p) => p.texto.length >= CITA_MIN && estaLimpio(p.texto));
  if (candidatos.length === 0) return null;
  const orden = [...candidatos].sort((a, b) => {
    const cabeA = a.texto.length <= CITA_MAX ? 0 : 1;
    const cabeB = b.texto.length <= CITA_MAX ? 0 : 1;
    if (cabeA !== cabeB) return cabeA - cabeB;
    if (a.texto.length !== b.texto.length) return b.texto.length - a.texto.length;
    if (a.instante !== b.instante) return a.instante - b.instante;
    return a.sessionId.localeCompare(b.sessionId);
  });
  return orden[0]!;
}

const recortar = (texto: string) => (texto.length <= CITA_MAX ? texto : `${texto.slice(0, CITA_MAX - 1)}…`);

const huella = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex').slice(0, 16);

/** "kino, ConoceRD y 2 más", o la lista entera si son pocos. */
function listar(nombres: readonly string[]): string {
  if (nombres.length === 0) return 'ningún proyecto';
  if (nombres.length === 1) return nombres[0]!;
  if (nombres.length <= 3) return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  return `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más`;
}

/**
 * El digest de una semana. El resumen es mecánico: cuántas sesiones, en cuántos
 * días y sobre qué. Lo que lleva la voz de Elias es la cita, que es suya
 * literal, y por eso el resumen no intenta sonar a nada.
 */
export function construirDigest(semana: string, prompts: readonly Prompt[]): Digest | null {
  if (prompts.length === 0) return null;
  const sesiones = new Set(prompts.map((p) => p.sessionId));
  const dias = new Set(prompts.map((p) => new Date(p.instante).toISOString().slice(0, 10)));
  const proyectos = [...new Set(prompts.map((p) => p.proyecto))].sort();
  const cita = citaDe(prompts);

  const s = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const summary = `${s(sesiones.size, 'sesión', 'sesiones')} en ${s(dias.size, 'día', 'días')}, sobre ${listar(proyectos)}.`;

  return {
    source: 'claude-code',
    externalId: semana,
    digest: {
      summary,
      quote: cita ? recortar(cita.texto) : '',
      quoteHash: cita ? huella(cita.texto) : '',
      quoteSession: cita?.sessionId ?? '',
      quoteOffset: cita?.linea ?? 0,
      sesiones: sesiones.size,
      proyectos,
    },
  };
}

/** Un digest por semana, de la más vieja a la más nueva. */
export function digestsPorSemana(prompts: readonly Prompt[]): Digest[] {
  const porSemana = new Map<string, Prompt[]>();
  for (const prompt of prompts) {
    const semana = semanaDe(prompt.instante);
    (porSemana.get(semana) ?? porSemana.set(semana, []).get(semana)!).push(prompt);
  }
  return [...porSemana.keys()]
    .sort()
    .map((semana) => construirDigest(semana, porSemana.get(semana)!))
    .filter((d): d is Digest => d !== null);
}
