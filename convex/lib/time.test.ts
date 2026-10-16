import { describe, expect, it } from 'vitest';
import { hourInTimeZone, userToday, zonedDayClockToUtc } from './time';

const SD = 'America/Santo_Domingo';
const at = (dayISO: string, hour: number, tz: string) => zonedDayClockToUtc(dayISO, hour * 60, tz).toISOString();

describe('userToday', () => {
  it('da el día local, no el UTC, en tz negativa', () => {
    // 2026-07-04 01:00 UTC = 2026-07-03 21:00 en Santo Domingo (UTC-4).
    const now = Date.parse('2026-07-04T01:00:00Z');
    expect(userToday(SD, now)).toBe('2026-07-03');
    expect(userToday('UTC', now)).toBe('2026-07-04');
  });
});

describe('zonedDayClockToUtc', () => {
  it('las 9 del usuario son las 9 del usuario, no las 9 UTC', () => {
    // Las 9 en Santo Domingo (UTC-4) = 13:00 UTC. Guardarlo como 09:00 UTC lo
    // pondría a las 5 de la mañana del usuario: el bug que este helper evita.
    expect(at('2026-07-03', 9, SD)).toBe('2026-07-03T13:00:00.000Z');
    expect(at('2026-07-03', 9, 'UTC')).toBe('2026-07-03T09:00:00.000Z');
  });

  it('una hora de la noche en tz negativa cae al día siguiente en UTC, sin correr el día local', () => {
    expect(at('2026-07-03', 22, SD)).toBe('2026-07-04T02:00:00.000Z');
  });

  it('respeta el offset vigente de la zona en esa fecha (DST)', () => {
    // Madrid: UTC+1 en enero, UTC+2 en julio. La misma hora local da distinto UTC.
    expect(at('2026-01-15', 9, 'Europe/Madrid')).toBe('2026-01-15T08:00:00.000Z');
    expect(at('2026-07-15', 9, 'Europe/Madrid')).toBe('2026-07-15T07:00:00.000Z');
  });

  it('acota el reloj al día en vez de desbordarlo', () => {
    expect(at('2026-07-03', 30, 'UTC')).toBe('2026-07-03T23:59:00.000Z');
    expect(at('2026-07-03', -5, 'UTC')).toBe('2026-07-03T00:00:00.000Z');
  });

  it('el día local arranca a la medianoche LOCAL, no a la medianoche UTC', () => {
    // Medianoche local del 3 jul en UTC-4 = 2026-07-03 04:00 UTC; tomar 00:00
    // UTC adelantaba el día cuatro horas.
    const start = zonedDayClockToUtc('2026-07-03', 0, SD).getTime();
    const end = zonedDayClockToUtc('2026-07-04', 0, SD).getTime();
    expect(new Date(start).toISOString()).toBe('2026-07-03T04:00:00.000Z');
    expect(new Date(end).toISOString()).toBe('2026-07-04T04:00:00.000Z');

    // Las 21:00 locales del día anterior (2 jul) son 2026-07-03 01:00 UTC: no
    // caen en el 3 jul. Las 21:00 locales del 3 jul sí.
    expect(Date.parse('2026-07-03T01:00:00Z') >= start).toBe(false);
    const today21 = Date.parse('2026-07-04T01:00:00Z');
    expect(today21 >= start && today21 < end).toBe(true);
  });

  it('UTC: el día va de medianoche a medianoche UTC', () => {
    expect(at('2026-07-03', 0, 'UTC')).toBe('2026-07-03T00:00:00.000Z');
    expect(at('2026-07-04', 0, 'UTC')).toBe('2026-07-04T00:00:00.000Z');
  });
});

describe('hora de la cuenta', () => {
  it('no depende de la zona del proceso y respeta medianoche y DST', () => {
    expect(hourInTimeZone(SD, Date.parse('2026-09-11T20:00:00Z'))).toBe(16);
    expect(hourInTimeZone(SD, Date.parse('2026-09-12T04:00:00Z'))).toBe(0);
    expect(hourInTimeZone('America/New_York', Date.parse('2026-01-11T20:00:00Z'))).toBe(15);
    expect(hourInTimeZone('America/New_York', Date.parse('2026-07-11T20:00:00Z'))).toBe(16);
  });
});
