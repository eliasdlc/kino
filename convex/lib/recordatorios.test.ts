import { describe, expect, it } from 'vitest';
import {
  armarResumen,
  avisosAntes,
  enSilencio,
  estadoDe,
  limiteDe,
  proximoAviso,
  proximoResumen,
  textoResumen,
  type Preferencias,
} from './recordatorios';

/**
 * Qué se prueba: el calendario de avisos que se le promete a la persona. Que la
 * recta final suene a seis horas y después cada dos, que nada suene de
 * madrugada, que lo que vence de noche reciba una última llamada, y que una
 * vencida insista sin tope.
 *
 * El defecto que esto sustituye: todo salía a medianoche, nada sonaba a la hora
 * de vencer, y después de dos a catorce avisos la tarea callaba para siempre.
 */

const TZ = 'America/Santo_Domingo'; // UTC-4 todo el año, sin horario de verano
const H = 3_600_000;
const prefs = (over: Partial<Preferencias> = {}): Preferencias => ({
  tz: TZ,
  intensidad: 'aggressive',
  silencioDesde: '22:00',
  silencioHasta: '07:00',
  ...over,
});
/** Un reloj local de Santo Domingo como instante. */
const local = (dia: number, hora: number, min = 0) => Date.UTC(2026, 9, dia, hora + 4, min);
const reloj = (t: number) => {
  const d = new Date(t - 4 * H);
  return `${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

/** Todos los avisos que recibe una tarea entre `desde` y `hasta`. */
function cronologia(dueDate: number, p: Preferencias, desde: number, hasta: number, intensidad?: 'off' | 'low') {
  const out: string[] = [];
  let t = desde;
  for (;;) {
    const siguiente = proximoAviso({ dueDate, intensidad }, p, t);
    if (siguiente === null || siguiente > hasta) return out;
    out.push(reloj(siguiente));
    t = siguiente;
  }
}

describe('la recta final', () => {
  it('agresivos: a seis horas, cada dos, a la última hora y a la hora', () => {
    expect(avisosAntes(local(7, 17), 'aggressive', prefs()).map(reloj)).toEqual(['7 11:00', '7 13:00', '7 15:00', '7 16:00', '7 17:00']);
  });

  it('medios y bajos avisan menos', () => {
    expect(avisosAntes(local(7, 17), 'medium', prefs()).map(reloj)).toEqual(['7 11:00', '7 15:00', '7 17:00']);
    expect(avisosAntes(local(7, 17), 'low', prefs()).map(reloj)).toEqual(['7 15:00', '7 17:00']);
  });

  it('nada suena en silencio, y lo que vence temprano recibe la última llamada la noche antes', () => {
    // Vence a las 06:30: todos sus avisos caen de madrugada.
    expect(avisosAntes(local(8, 6, 30), 'aggressive', prefs()).map(reloj)).toEqual(['7 21:00']);
  });

  it('una tarea sin hora vence al final de su día, no a medianoche', () => {
    expect(limiteDe(local(7, 0), TZ)).toBe(local(8, 0));
    expect(avisosAntes(local(7, 0), 'aggressive', prefs()).map(reloj)).toEqual(['7 18:00', '7 20:00', '7 21:00']);
  });

  it('sin horas de silencio no hay última llamada', () => {
    const p = prefs({ silencioDesde: '00:00', silencioHasta: '00:00' });
    expect(enSilencio(local(7, 3), p)).toBe(false);
    expect(avisosAntes(local(8, 6, 30), 'low', p).map(reloj)).toEqual(['8 04:30', '8 06:30']);
  });
});

describe('después de vencer', () => {
  it('agresivos insiste cada tres horas despierto y no se rinde', () => {
    const avisos = cronologia(local(7, 17), prefs(), local(7, 16, 30), local(20, 0));
    expect(avisos.slice(0, 6)).toEqual(['7 17:00', '7 20:00', '8 08:00', '8 11:00', '8 14:00', '8 17:00']);
    // Trece días después sigue avisando: no hay tope.
    expect(avisos.some((a) => a.startsWith('19 '))).toBe(true);
    expect(avisos.every((a) => !enSilencio(local(+a.split(' ')[0]!, +a.slice(-5, -3), +a.slice(-2)), prefs()))).toBe(true);
  });

  it('bajos deja la vencida al resumen de la mañana', () => {
    expect(proximoAviso({ dueDate: local(7, 17) }, prefs({ intensidad: 'low' }), local(7, 17))).toBeNull();
  });

  it('una tarea silenciada no tiene avisos', () => {
    expect(proximoAviso({ dueDate: local(7, 17), intensidad: 'off' }, prefs(), local(1, 0))).toBeNull();
  });

  it('la intensidad de la tarea manda sobre la de la cuenta', () => {
    expect(cronologia(local(7, 17), prefs(), local(7, 12), local(7, 18), 'low')).toEqual(['7 15:00', '7 17:00']);
  });
});

describe('lo que dice cada aviso', () => {
  it('en la recta final habla en horas y minutos', () => {
    expect(estadoDe(local(7, 17), local(7, 11), TZ).texto).toBe('Vence en 6 h');
    expect(estadoDe(local(7, 17), local(7, 16, 30), TZ).texto).toBe('Vence en 30 min');
    expect(estadoDe(local(7, 17), local(7, 17), TZ).texto).toBe('Vence ahora');
    expect(estadoDe(local(8, 6, 30), local(7, 21), TZ).texto).toBe('Vence mañana a las 06:30');
  });

  it('vencida, dice desde cuándo', () => {
    expect(estadoDe(local(7, 17), local(7, 20), TZ)).toEqual({ texto: 'Venció hace 3 h', vencida: true });
    expect(estadoDe(local(7, 0), local(8, 8), TZ)).toEqual({ texto: 'Venció ayer', vencida: true });
    expect(estadoDe(local(7, 17), local(12, 8), TZ).texto).toBe('Vencida hace 5 días');
  });

  it('sin hora, vence hoy durante todo el día', () => {
    expect(estadoDe(local(7, 0), local(7, 20), TZ)).toEqual({ texto: 'Vence hoy', vencida: false });
  });
});

describe('el resumen de la mañana', () => {
  const tarea = (id: string, dia: number, priority: 'critical' | 'high' | 'medium' | 'low', hora = 0) => ({
    id,
    title: id,
    dueDate: local(dia, hora),
    priority,
  });

  it('una alta aparece a tres, dos y un día; una baja sólo la víspera', () => {
    const ahora = local(4, 8);
    const r = armarResumen([tarea('alta', 7, 'high'), tarea('baja', 7, 'low'), tarea('lejana', 20, 'critical')], prefs(), ahora)!;
    expect(r.proximas.map((t) => [t.id, t.dias])).toEqual([['alta', 3]]);
    const vispera = armarResumen([tarea('alta', 7, 'high'), tarea('baja', 7, 'low')], prefs(), local(6, 8))!;
    expect(vispera.manana.map((t) => t.id)).toEqual(['alta', 'baja']);
  });

  it('lo vencido y lo de hoy entra siempre, y la cifra va en el título', () => {
    const r = armarResumen([tarea('vieja', 1, 'low'), tarea('hoy', 4, 'medium', 17)], prefs({ intensidad: 'low' }), local(4, 8))!;
    expect(r.vencidas.map((t) => t.id)).toEqual(['vieja']);
    expect(r.hoy.map((t) => t.id)).toEqual(['hoy']);
    expect(textoResumen(r)).toEqual({ title: '1 vencida · 1 para hoy', body: 'vieja · hoy' });
  });

  it('sin nada que decir no hay resumen', () => {
    expect(armarResumen([tarea('lejana', 28, 'high')], prefs(), local(4, 8))).toBeNull();
  });

  it('el próximo resumen cae a su hora local, hoy si no ha pasado y si no mañana', () => {
    expect(reloj(proximoResumen(TZ, '08:00', local(4, 6)))).toBe('4 08:00');
    expect(reloj(proximoResumen(TZ, '08:00', local(4, 8)))).toBe('5 08:00');
  });
});
