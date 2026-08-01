import { describe, expect, it } from 'vitest';
import {
  predictLevelForSlot,
  verdictFor,
  alphaImprovementPct,
  buildVerificationLoop,
  SLOT_HOUR_RANGES,
} from './energy.prediction';
import { CHRONOTYPE_CURVES, completionWeight, sessionWeight } from './energy.utils';
import { startedTimeLogsLast90DaysQuery } from './energy.queries';

describe('predictLevelForSlot', () => {
  it('promedia la curva sobre las horas del slot', () => {
    const flat = Array.from({ length: 24 }, () => 50);
    expect(predictLevelForSlot(flat, 'morning')).toBe(50);
    expect(predictLevelForSlot(flat, 'afternoon')).toBe(50);
    expect(predictLevelForSlot(flat, 'evening')).toBe(50);
  });

  it('cada slot mira solo sus horas', () => {
    const morningOnly = Array.from({ length: 24 }, (_, h) =>
      SLOT_HOUR_RANGES.morning.includes(h) ? 90 : 0,
    );
    expect(predictLevelForSlot(morningOnly, 'morning')).toBe(90);
    expect(predictLevelForSlot(morningOnly, 'afternoon')).toBe(1);
  });

  it('respeta la escala 1–100 del check-in', () => {
    const zeros = Array.from({ length: 24 }, () => 0);
    expect(predictLevelForSlot(zeros, 'evening')).toBe(1);

    const over = Array.from({ length: 24 }, () => 500);
    expect(predictLevelForSlot(over, 'evening')).toBe(100);
  });

  it('el cronotipo matutino predice más para la mañana que para la noche', () => {
    const curve = CHRONOTYPE_CURVES.morning;
    expect(predictLevelForSlot(curve, 'morning')).toBeGreaterThan(
      predictLevelForSlot(curve, 'evening'),
    );
  });

  it('una curva corta o vacía no revienta: las horas ausentes valen 0', () => {
    expect(predictLevelForSlot([], 'morning')).toBe(1);
  });
});

describe('verdictFor', () => {
  it('hasta 10 de diferencia es acierto', () => {
    expect(verdictFor(70, 70)).toBe('hit');
    expect(verdictFor(70, 80)).toBe('hit');
    expect(verdictFor(70, 60)).toBe('hit');
  });

  it('entre 11 y 25 está cerca', () => {
    expect(verdictFor(70, 81)).toBe('close');
    expect(verdictFor(70, 45)).toBe('close');
  });

  it('más de 25 es fallo', () => {
    expect(verdictFor(70, 44)).toBe('miss');
    expect(verdictFor(20, 90)).toBe('miss');
  });
});

describe('alphaImprovementPct', () => {
  it('convierte el delta de alpha en puntos porcentuales con un decimal', () => {
    expect(alphaImprovementPct(0.32, 0.347)).toBe(2.7);
  });

  it('no inventa mejora cuando el modelo no se movió o empeoró', () => {
    expect(alphaImprovementPct(0.4, 0.4)).toBeNull();
    expect(alphaImprovementPct(0.4, 0.35)).toBeNull();
  });

  it('sin alphas guardados no afirma nada', () => {
    expect(alphaImprovementPct(null, 0.5)).toBeNull();
    expect(alphaImprovementPct(0.5, null)).toBeNull();
  });
});

describe('buildVerificationLoop', () => {
  const base = {
    slot: 'afternoon' as const,
    predictedLevel: 72,
    reportedLevel: 65,
    alphaAtPrediction: 0.3,
    alphaBefore: 0.3,
    alphaAfter: 0.32,
    userVerdict: null,
  };

  it('arma el ciclo completo con el delta firmado y el veredicto', () => {
    const loop = buildVerificationLoop(base);
    expect(loop).toMatchObject({
      slot: 'afternoon',
      predictedLevel: 72,
      reportedLevel: 65,
      delta: -7,
      verdict: 'hit',
      alphaBeforePct: 30,
      alphaAfterPct: 32,
      improvementPct: 2,
      fromLearnedCurve: true,
    });
  });

  it('un delta positivo significa más energía de la esperada', () => {
    expect(buildVerificationLoop({ ...base, reportedLevel: 90 }).delta).toBe(18);
    expect(buildVerificationLoop({ ...base, reportedLevel: 90 }).verdict).toBe('close');
  });

  it('alpha 0 al predecir marca que la predicción vino del cronotipo, no de tu curva', () => {
    const loop = buildVerificationLoop({ ...base, alphaAtPrediction: 0 });
    expect(loop.fromLearnedCurve).toBe(false);
  });

  it('sin alphas guardados el ciclo se muestra sin prometer mejora', () => {
    const loop = buildVerificationLoop({ ...base, alphaBefore: null, alphaAfter: null });
    expect(loop.improvementPct).toBeNull();
    expect(loop.alphaBeforePct).toBeNull();
    expect(loop.verdict).toBe('hit');
  });

  it('conserva el veredicto que dio el usuario', () => {
    expect(buildVerificationLoop({ ...base, userVerdict: 'inaccurate' }).userVerdict).toBe('inaccurate');
  });
});

describe('peso de la evidencia de actividad', () => {
  it('una sesión de escritura pesa como un timer de tarea media', () => {
    expect(sessionWeight('writing', null)).toBe(sessionWeight('timer', 'medium'));
  });

  it('el nivel declarado de la tarea no altera el peso de una sesión de escritura', () => {
    // Un capítulo no tiene energyLevel; si llegara uno colado, se ignora.
    expect(sessionWeight('writing', 'low')).toBe(sessionWeight('writing', 'high'));
  });

  it('un timer pesa más que completar la misma tarea: el reloj corrió de verdad', () => {
    expect(sessionWeight('timer', 'high')).toBeGreaterThan(completionWeight('high'));
  });

  it('escribir pesa más que completar una tarea de energía baja', () => {
    expect(sessionWeight('writing', null)).toBeGreaterThan(completionWeight('low'));
  });

  it('un nivel ausente o desconocido cae en medio, no en cero', () => {
    expect(completionWeight(null)).toBe(completionWeight('medium'));
    expect(completionWeight('extreme')).toBe(1);
  });
});

/**
 * La consulta de calibración se compila a SQL sin tocar la DB: es la red que
 * atrapa una columna huérfana o un join perdido, que un test con `db` mockeado
 * dejaría pasar hasta runtime (lección de W2).
 */
describe('consulta de señales de calibración', () => {
  const USER = '11111111-1111-1111-1111-111111111111';
  const TZ = 'America/Santo_Domingo';

  it('incluye las sesiones de escritura además de los timers', () => {
    const { sql, params } = startedTimeLogsLast90DaysQuery(USER, TZ, new Date('2026-01-01')).toSQL();

    expect(sql).toContain('from "time_logs"');
    // leftJoin, no innerJoin: una sesión de escritura no tiene tarea y con el
    // innerJoin anterior desaparecía de la calibración.
    expect(sql).toContain('left join "tasks"');
    expect(sql).not.toContain('inner join "tasks"');
    expect(params).toContain('writing');
    expect(params).toContain('timer');
    expect(params).toContain(USER);
    expect(params).toContain(TZ);
  });
});
