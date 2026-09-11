import type { InterruptionKind } from '../../schema';

// La cola de una sola interrupción al día, sin base de datos delante.
//
// El principio 8 dice que Kino interrumpe una vez al día y con prioridad
// estricta. Eso son dos reglas, y las dos viven aquí porque las dos se pueden
// probar par a par: cuál gana entre dos candidatos, y cuándo un candidato que
// lleva días delante deja pasar al siguiente.

/**
 * El nivel de cada clase. Prioridad **estricta**: un candidato de nivel 1
 * desaloja a todos los demás, aunque sean cuatro y él uno.
 *
 * 1. El lunes. Cita una sesión real y sólo sirve el lunes por la mañana.
 * 2. El auto-archivo. Kino ya hizo algo y hay que confirmarlo antes de que se
 *    acumule.
 * 3. Las cuatro propuestas. Ver `ORDEN_TERCERA`.
 * 4. El empuje de los veinte items de un sistema (D-18): propone una carpeta,
 *    y puede esperar a cualquier otra cosa.
 */
const NIVEL: Record<InterruptionKind, number> = {
  lunes: 1,
  autoArchivo: 2,
  techo: 3,
  cronotipo: 3,
  ritual: 3,
  agente: 3,
  empujeSistema: 4,
};

/**
 * El desempate dentro de la tercera prioridad (decisión D-26).
 *
 * Con una sola apertura al día y cuatro candidatos que la quieren, el orden no
 * puede quedar sin escribir: la propuesta del techo es la que desbloquea la
 * ventana de dato más corta del calendario, y sin este orden pierde contra un
 * archivar cualquiera. Recomendación del documento, entregada tal cual:
 * techo, cronotipo, ritual, agente.
 */
export const ORDEN_TERCERA: readonly InterruptionKind[] = ['techo', 'cronotipo', 'ritual', 'agente'];

/**
 * Días que una interrupción aguanta delante sin acuse antes de ceder el turno.
 *
 * La caducidad es por **tiempo mostrado** y no por acuse a propósito: quien
 * cierra la pestaña en vez de pulsar un botón nunca acusa nada, y con una
 * apertura al día eso significa no ver otra propuesta en dos meses. Dos días es
 * lo que tarda en dejar de ser noticia.
 */
export const DIAS_ANTES_DE_CEDER = 2;

const MS_POR_DIA = 86_400_000;

/** Un candidato a ocupar la interrupción del día. */
export type Candidato = {
  kind: InterruptionKind;
  /** Identidad dentro de su clase: el id de un digest, el de una propuesta, la semana del ritual. */
  key: string;
  /** Cuándo se mostró por primera vez, si ya se mostró alguna vez. */
  surfacedAt?: number;
  /** Cuándo se acusó recibo. Un candidato acusado ya no compite. */
  acknowledgedAt?: number;
  /** Lo que la línea pinta. La cola no lo mira. */
  payload: Record<string, unknown>;
};

/** Un candidato mostrado hace más de dos días y sin acusar cede el turno. */
export function cedioElTurno(candidato: Candidato, now: number): boolean {
  if (candidato.acknowledgedAt !== undefined) return true;
  if (candidato.surfacedAt === undefined) return false;
  return now - candidato.surfacedAt > DIAS_ANTES_DE_CEDER * MS_POR_DIA;
}

/**
 * Cuál de dos candidatos va delante: primero el nivel, luego el orden de la
 * tercera prioridad, y a igualdad de las dos cosas el que lleva más tiempo
 * esperando. Negativo si `a` gana.
 */
export function comparar(a: Candidato, b: Candidato): number {
  const porNivel = NIVEL[a.kind] - NIVEL[b.kind];
  if (porNivel !== 0) return porNivel;

  const porOrden = ORDEN_TERCERA.indexOf(a.kind) - ORDEN_TERCERA.indexOf(b.kind);
  if (porOrden !== 0) return porOrden;

  return (a.surfacedAt ?? Number.MAX_SAFE_INTEGER) - (b.surfacedAt ?? Number.MAX_SAFE_INTEGER);
}

/**
 * La única interrupción del día, o ninguna. Devolver `null` es un resultado
 * normal y no un hueco que rellenar: cuando no hay nada que preguntar, Hoy no
 * pinta nada encima del plan.
 */
export function laInterrupcion(candidatos: readonly Candidato[], now: number): Candidato | null {
  const vivos = candidatos.filter((candidato) => !cedioElTurno(candidato, now));
  if (vivos.length === 0) return null;
  return [...vivos].sort(comparar)[0];
}
