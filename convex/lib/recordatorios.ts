import { calendarDayInTz } from './time';
import { minutesInTimeZone, zonedDayClockToUtc } from '../../src/shared/time';
import { PRIORITY_RANK, type Priority } from '../../src/shared/lib/effective-priority';
import { DIAS_EN_RESUMEN, HORAS_ANTES, VENCIDA_CADA_H, type Intensidad, type IntensidadTarea } from './recordatoriosConstantes';

export { DIAS_EN_RESUMEN, HORAS_ANTES, VENCIDA_CADA_H, type Intensidad, type IntensidadTarea };

// Cuándo se avisa de una tarea, sin saber nada de la base ni de la red.
//
// Hay dos mecanismos y no se pisan:
//
//   1. **El resumen de la mañana**, una vez al día a la hora que la persona
//      elige. Lleva lo vencido, lo que vence hoy y lo que se acerca en los
//      próximos días. Es el aviso «con tiempo»: los días previos viven aquí.
//   2. **Los avisos por tarea**, sólo en la recta final y después de vencer.
//      Empiezan seis horas antes, se aprietan cada dos, suenan a la hora y,
//      si la tarea sigue sin hacerse, insisten **sin tope** hasta que se
//      termine, se mueva la fecha o se silencie.
//
// Todo lo que cae dentro de las horas de silencio se salta. Para que saltarlo
// no deje sin aviso a lo que vence de madrugada, esas tareas ganan una
// «última llamada» una hora antes de que empiece el silencio.

export interface Preferencias {
  tz: string;
  intensidad: Intensidad;
  /** Reloj local 'HH:MM'. Si coincide con `silencioHasta`, no hay silencio. */
  silencioDesde: string;
  silencioHasta: string;
}

export const INTENSIDAD_POR_DEFECTO: Intensidad = 'aggressive';
export const SILENCIO_POR_DEFECTO = { desde: '22:00', hasta: '07:00' } as const;
export const RESUMEN_POR_DEFECTO = '08:00';

const MIN = 60_000;
const H = 60 * MIN;
const DIA = 24 * H;

/** Las intensidades suaves recortan esa antelación. */
const TOPE_DIAS_RESUMEN: Record<Intensidad, number> = { aggressive: 7, medium: 2, low: 1 };

export function relojAMinutos(reloj: string): number {
  const [h, m] = reloj.split(':').map(Number);
  return ((h ?? 0) % 24) * 60 + (m ?? 0);
}

/** ¿Cae `instante` dentro de las horas de silencio? El rango cruza la medianoche. */
export function enSilencio(instante: number, prefs: Preferencias): boolean {
  const desde = relojAMinutos(prefs.silencioDesde);
  const hasta = relojAMinutos(prefs.silencioHasta);
  if (desde === hasta) return false;
  const m = minutesInTimeZone(prefs.tz, instante);
  return desde < hasta ? m >= desde && m < hasta : m >= desde || m < hasta;
}

/**
 * Una tarea «sin hora» se guarda como la medianoche local de su día
 * (`schema.ts`). Una medianoche exacta se lee así, como sólo fecha.
 */
export function esSoloFecha(dueDate: number, tz: string): boolean {
  return minutesInTimeZone(tz, dueDate) === 0;
}

/** El día siguiente (yyyy-MM-dd) a uno dado, sin aritmética de calendario a mano. */
function diaSiguiente(dia: string, tz: string): string {
  return calendarDayInTz(zonedDayClockToUtc(dia, 12 * 60, tz).getTime() + DIA, tz);
}

function diaAnterior(dia: string, tz: string): string {
  return calendarDayInTz(zonedDayClockToUtc(dia, 12 * 60, tz).getTime() - DIA, tz);
}

/**
 * El instante en que la tarea deja de estar a tiempo. Con hora, esa hora. Sin
 * hora, el final de su día: vence «hoy» durante todo el día, no a las 00:00.
 */
export function limiteDe(dueDate: number, tz: string): number {
  if (!esSoloFecha(dueDate, tz)) return dueDate;
  return zonedDayClockToUtc(diaSiguiente(calendarDayInTz(dueDate, tz), tz), 0, tz).getTime();
}

/**
 * La última llamada: una hora antes del silencio que se come el límite. Sólo
 * para lo que vence de noche o en las dos primeras horas de la mañana, que es
 * lo que sin ella no recibiría ningún aviso despierto.
 */
function ultimaLlamada(limite: number, prefs: Preferencias): number | null {
  const desde = relojAMinutos(prefs.silencioDesde);
  if (desde === relojAMinutos(prefs.silencioHasta)) return null;
  if (!enSilencio(limite, prefs) && !enSilencio(limite - 2 * H, prefs)) return null;
  const minuto = (desde - 60 + 24 * 60) % (24 * 60);
  const dia = calendarDayInTz(limite, prefs.tz);
  let llamada = zonedDayClockToUtc(dia, minuto, prefs.tz).getTime();
  if (llamada >= limite) llamada = zonedDayClockToUtc(diaAnterior(dia, prefs.tz), minuto, prefs.tz).getTime();
  return llamada < limite ? llamada : null;
}

/** Los avisos previos al límite, ya sin los que caen en silencio. */
export function avisosAntes(dueDate: number, intensidad: Intensidad, prefs: Preferencias): number[] {
  const limite = limiteDe(dueDate, prefs.tz);
  const soloFecha = esSoloFecha(dueDate, prefs.tz);
  const puntos = HORAS_ANTES[intensidad]
    // Sin hora, el «es ahora» sería la medianoche: la vencida lo cubre.
    .filter((h) => !(soloFecha && h === 0))
    .map((h) => limite - h * H);
  const llamada = ultimaLlamada(limite, prefs);
  if (llamada !== null && !puntos.some((p) => Math.abs(p - llamada) < 30 * MIN)) puntos.push(llamada);
  return [...new Set(puntos)].filter((p) => !enSilencio(p, prefs)).sort((a, b) => a - b);
}

/**
 * El próximo aviso de una tarea estrictamente después de `despues`, o `null`
 * si ya no le queda ninguno. Es lo que se guarda en `tasks.nextReminderAt`.
 */
export function proximoAviso(
  tarea: { dueDate: number; intensidad?: IntensidadTarea },
  prefs: Preferencias,
  despues: number,
): number | null {
  const intensidad = tarea.intensidad ?? prefs.intensidad;
  if (intensidad === 'off') return null;
  const previo = avisosAntes(tarea.dueDate, intensidad, prefs).find((p) => p > despues);
  if (previo !== undefined) return previo;

  const cadaH = VENCIDA_CADA_H[intensidad];
  if (cadaH === null) return null;
  const limite = limiteDe(tarea.dueDate, prefs.tz);
  const paso = cadaH * H;
  let k = Math.max(1, Math.floor((despues - limite) / paso) + 1);
  // Acotado: con nueve horas de silencio y un paso de tres, el siguiente
  // despierto está a tres pasos como mucho.
  for (let intento = 0; intento < 64; intento++, k++) {
    const t = limite + k * paso;
    if (!enSilencio(t, prefs)) return t;
  }
  return null;
}

/** El próximo resumen de la mañana estrictamente después de `despues`. */
export function proximoResumen(tz: string, hora: string, despues: number): number {
  const minuto = relojAMinutos(hora);
  let dia = calendarDayInTz(despues, tz);
  for (let intento = 0; intento < 3; intento++) {
    const t = zonedDayClockToUtc(dia, minuto, tz).getTime();
    if (t > despues) return t;
    dia = diaSiguiente(dia, tz);
  }
  return despues + DIA;
}

// ── Textos ──────────────────────────────────────────────────────────────────

function reloj(instante: number, tz: string): string {
  const m = minutesInTimeZone(tz, instante);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Días de calendario entre dos fechas yyyy-MM-dd. */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / DIA);
}

/**
 * Lo que dice el aviso de una tarea en este momento. Se calcula con la hora
 * real del envío y no con la del punto que tocaba: si el cron llega tarde, el
 * texto sigue siendo verdad.
 */
export function estadoDe(dueDate: number, ahora: number, tz: string): { texto: string; vencida: boolean } {
  const limite = limiteDe(dueDate, tz);
  const soloFecha = esSoloFecha(dueDate, tz);
  const hoy = calendarDayInTz(ahora, tz);
  const diaVence = calendarDayInTz(dueDate, tz);
  const falta = limite - ahora;

  if (falta > 0) {
    if (soloFecha) {
      const dias = diasEntre(hoy, diaVence);
      return { texto: dias <= 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`, vencida: false };
    }
    if (falta <= 15 * MIN) return { texto: 'Vence ahora', vencida: false };
    if (falta < 55 * MIN) return { texto: `Vence en ${Math.round(falta / MIN)} min`, vencida: false };
    if (falta <= 6 * H + 30 * MIN) return { texto: `Vence en ${Math.round(falta / H)} h`, vencida: false };
    const dias = diasEntre(hoy, diaVence);
    const cuando = dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
    return { texto: `Vence ${cuando} a las ${reloj(dueDate, tz)}`, vencida: false };
  }
  if (!soloFecha && -falta <= 15 * MIN) return { texto: 'Vence ahora', vencida: false };
  if (!soloFecha && -falta < 24 * H) {
    const horas = Math.max(1, Math.round(-falta / H));
    return { texto: `Venció hace ${horas} h`, vencida: true };
  }
  const dias = Math.max(1, diasEntre(diaVence, hoy));
  return { texto: dias === 1 ? 'Venció ayer' : `Vencida hace ${dias} días`, vencida: true };
}

// ── El resumen de la mañana ─────────────────────────────────────────────────

export interface TareaParaResumen {
  id: string;
  title: string;
  dueDate: number;
  priority: Priority;
  intensidad?: IntensidadTarea;
}

export interface Resumen {
  vencidas: TareaParaResumen[];
  hoy: TareaParaResumen[];
  manana: TareaParaResumen[];
  proximas: Array<TareaParaResumen & { dias: number }>;
}

/**
 * Qué entra en el resumen de hoy. Lo vencido y lo de hoy entra siempre; lo que
 * viene, según la prioridad elegida (`DIAS_EN_RESUMEN`) recortada por la
 * intensidad. Una tarea silenciada no sale.
 */
export function armarResumen(tareas: TareaParaResumen[], prefs: Preferencias, ahora: number): Resumen | null {
  const hoy = calendarDayInTz(ahora, prefs.tz);
  const out: Resumen = { vencidas: [], hoy: [], manana: [], proximas: [] };
  for (const t of tareas) {
    const intensidad = t.intensidad ?? prefs.intensidad;
    if (intensidad === 'off') continue;
    const dias = diasEntre(hoy, calendarDayInTz(t.dueDate, prefs.tz));
    const vencida = limiteDe(t.dueDate, prefs.tz) <= ahora;
    if (vencida) out.vencidas.push(t);
    else if (dias <= 0) out.hoy.push(t);
    else if (dias <= Math.min(DIAS_EN_RESUMEN[t.priority], TOPE_DIAS_RESUMEN[intensidad])) {
      if (dias === 1) out.manana.push(t);
      else out.proximas.push({ ...t, dias });
    }
  }
  const porUrgencia = (a: TareaParaResumen, b: TareaParaResumen) =>
    PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.dueDate - b.dueDate;
  out.vencidas.sort((a, b) => a.dueDate - b.dueDate);
  out.hoy.sort(porUrgencia);
  out.manana.sort(porUrgencia);
  out.proximas.sort((a, b) => a.dias - b.dias || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  const total = out.vencidas.length + out.hoy.length + out.manana.length + out.proximas.length;
  return total === 0 ? null : out;
}

/** El push del resumen: la cifra primero, que es lo que se lee con la pantalla bloqueada. */
export function textoResumen(r: Resumen): { title: string; body: string } {
  const partes: string[] = [];
  if (r.vencidas.length) partes.push(`${r.vencidas.length} vencida${r.vencidas.length > 1 ? 's' : ''}`);
  if (r.hoy.length) partes.push(`${r.hoy.length} para hoy`);
  if (r.manana.length) partes.push(`${r.manana.length} para mañana`);
  if (r.proximas.length) partes.push(`${r.proximas.length} en los próximos días`);
  const nombres = [...r.vencidas, ...r.hoy, ...r.manana, ...r.proximas].map((t) => t.title);
  const resto = nombres.length - 3;
  const body = nombres.slice(0, 3).join(' · ') + (resto > 0 ? ` y ${resto} más` : '');
  return { title: partes.join(' · '), body };
}
