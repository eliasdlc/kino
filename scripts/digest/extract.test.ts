/**
 * Qué se prueba: que el extractor es determinista, que la cita sale de una
 * regla y no de un gusto, que lo que la denylist bloquea no llega a subir, y
 * que un digest cabe en el tope de bytes que el servidor aplica.
 *
 * El determinismo es el criterio que sostiene todo lo demás: si dos pasadas
 * sobre la misma transcripción dieran cosas distintas, el diario no podría
 * decir si la semana cambió o si cambió el extractor.
 */
import { describe, expect, it } from 'vitest';
import { citaDe, construirDigest, digestsPorSemana, promptsDeTranscripcion, proyectoDe, semanaDe, CITA_MAX, type Prompt } from './extract';

const linea = (tipo: string, extra: Record<string, unknown>) => JSON.stringify({ type: tipo, ...extra });

const usuario = (texto: string, timestamp: string, cwd = '/home/decruce/dev/projects/kino') =>
  linea('user', { timestamp, sessionId: 'sesion-1', cwd, message: { content: texto } });

/** Una transcripción de laboratorio con todo el ruido que trae una de verdad. */
const TRANSCRIPCION = [
  usuario('Quiero que la firma del cierre viva en el servicio y no en el router, porque hay tres caminos', '2026-09-07T10:00:00.000Z'),
  linea('assistant', { timestamp: '2026-09-07T10:00:05.000Z', message: { content: [{ type: 'text', text: 'De acuerdo' }] } }),
  usuario('<command-name>/clear</command-name>', '2026-09-07T10:01:00.000Z'),
  usuario('/home/decruce/Downloads/captura.png', '2026-09-07T10:02:00.000Z'),
  usuario('dale', '2026-09-07T10:03:00.000Z'),
  linea('attachment', { timestamp: '2026-09-07T10:04:00.000Z' }),
  usuario('Ahora explícame por qué el cursor se toma antes de hablar con GitHub', '2026-09-07T10:05:00.000Z', '/home/decruce/dev/projects/conocerd'),
  'no es json',
  '',
].join('\n');

describe('el extractor del diario', () => {
  it('sólo se queda con lo que escribió una persona', () => {
    const prompts = promptsDeTranscripcion(TRANSCRIPCION, 'sesion-1');
    expect(prompts.map((p) => p.texto)).toEqual([
      'Quiero que la firma del cierre viva en el servicio y no en el router, porque hay tres caminos',
      'dale',
      'Ahora explícame por qué el cursor se toma antes de hablar con GitHub',
    ]);
    // El comando del cliente, la ruta arrastrada, la respuesta del modelo, el
    // adjunto y la línea que no es JSON se quedan fuera.
    expect(prompts).toHaveLength(3);
    expect(prompts.map((p) => p.proyecto)).toEqual(['kino', 'kino', 'conocerd']);
  });

  it('el proyecto sale de la carpeta del repo, no de la subcarpeta ni del home', () => {
    // Trabajar dentro de una subcarpeta seguía siendo el mismo proyecto.
    expect(proyectoDe('/home/decruce/dev/projects/ConoceRD/app')).toBe('ConoceRD');
    expect(proyectoDe('/home/decruce/dev/projects/kino')).toBe('kino');
    // Abrir Claude Code en el home no es trabajar en un proyecto.
    expect(proyectoDe('/home/decruce')).toBe('sin proyecto');
    // Fuera de `projects/` vale la última carpeta, que es lo único que hay.
    expect(proyectoDe('/opt/experimentos/pruebita')).toBe('pruebita');
  });

  it('dos pasadas sobre la misma transcripción dan el mismo digest byte a byte', () => {
    const una = digestsPorSemana(promptsDeTranscripcion(TRANSCRIPCION, 'sesion-1'));
    const otra = digestsPorSemana(promptsDeTranscripcion(TRANSCRIPCION, 'sesion-1'));
    expect(JSON.stringify(una)).toBe(JSON.stringify(otra));
  });

  it('la cita es la frase más larga que cabe, y trae con qué comprobarla en el disco', () => {
    const [digest] = digestsPorSemana(promptsDeTranscripcion(TRANSCRIPCION, 'sesion-1'));
    expect(digest!.digest.quote).toBe(
      'Quiero que la firma del cierre viva en el servicio y no en el router, porque hay tres caminos',
    );
    expect(digest!.digest.quoteHash).toMatch(/^[0-9a-f]{16}$/);
    expect(digest!.digest.quoteSession).toBe('sesion-1');
    expect(digest!.digest.quoteOffset).toBe(1);
    // "dale" no compite: por debajo del mínimo no es una cita, es un acuse.
    expect(digest!.digest.quote).not.toBe('dale');
  });

  it('lo que la denylist bloquea no puede acabar siendo la cita', () => {
    const conSecreto = [
      usuario(`export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEX y esto es lo más largo que escribí en toda la semana de trabajo`, '2026-09-07T11:00:00.000Z'),
      usuario('Una frase limpia y suficientemente larga para servir de cita', '2026-09-07T11:01:00.000Z'),
    ].join('\n');
    const [digest] = digestsPorSemana(promptsDeTranscripcion(conSecreto, 'sesion-1'));
    expect(digest!.digest.quote).toBe('Una frase limpia y suficientemente larga para servir de cita');
    expect(JSON.stringify(digest)).not.toContain('wJalr');
  });

  it('una frase que no cabe se recorta, y el hash sigue siendo el del fragmento entero', () => {
    const larga = `Esto es una explicación larguísima que no cabe en una cita ${'y sigue '.repeat(60)}fin`;
    const prompts: Prompt[] = [{ sessionId: 's', proyecto: 'kino', instante: Date.parse('2026-09-07T10:00:00Z'), texto: larga, linea: 1 }];
    const digest = construirDigest('2026-W37', prompts)!;
    expect(digest.digest.quote).toHaveLength(CITA_MAX);
    expect(digest.digest.quote.endsWith('…')).toBe(true);
    // La misma frase entera vuelve a dar el mismo hash: es lo que Elias compara.
    const otra = construirDigest('2026-W37', prompts)!;
    expect(otra.digest.quoteHash).toBe(digest.digest.quoteHash);
  });

  it('prefiere la que cabe entera antes que una más larga recortada', () => {
    const cabe = 'Una frase que cabe entera y es la que debería salir citada';
    const prompts: Prompt[] = [
      { sessionId: 's', proyecto: 'kino', instante: 1, texto: 'x'.repeat(CITA_MAX + 50), linea: 1 },
      { sessionId: 's', proyecto: 'kino', instante: 2, texto: cabe, linea: 2 },
    ];
    expect(citaDe(prompts)!.texto).toBe(cabe);
  });

  it('agrupa por semana ISO y el resumen dice sesiones, días y proyectos', () => {
    const dosSemanas = [
      usuario('Una frase de la semana treinta y siete que sirve como cita', '2026-09-07T10:00:00.000Z'),
      usuario('Una frase de la semana treinta y ocho que sirve como cita', '2026-09-15T10:00:00.000Z'),
    ].join('\n');
    const digests = digestsPorSemana(promptsDeTranscripcion(dosSemanas, 'sesion-1'));
    expect(digests.map((d) => d.externalId)).toEqual(['2026-W37', '2026-W38']);
    expect(digests[0]!.digest.summary).toBe('1 sesión en 1 día, sobre kino.');
  });

  it('la semana ISO no se pelea consigo misma en fin de año', () => {
    expect(semanaDe(Date.parse('2026-01-01T12:00:00Z'))).toBe('2026-W01');
    expect(semanaDe(Date.parse('2025-12-31T12:00:00Z'))).toBe('2026-W01');
    expect(semanaDe(Date.parse('2026-09-07T00:00:00Z'))).toBe('2026-W37');
  });

  it('un digest de una semana densa cabe holgado en los 8 KB del servidor', () => {
    const muchos: Prompt[] = Array.from({ length: 500 }, (_, i) => ({
      sessionId: `sesion-${i % 40}`,
      proyecto: `proyecto-${i % 12}`,
      instante: Date.parse('2026-09-07T10:00:00Z') + i * 60_000,
      texto: `Una frase de trabajo número ${i} con longitud suficiente para competir por la cita`,
      linea: i,
    }));
    const bytes = new TextEncoder().encode(JSON.stringify(construirDigest('2026-W37', muchos))).length;
    expect(bytes).toBeLessThan(8_192);
  });
});
