import { describe, expect, it } from 'vitest';
import {
  appendInteraction,
  buildCheckpoint,
  readCheckpoint,
  renderSession,
  writeSession,
  type Checkpoint,
} from './learning-session.js';
import { htmlToMarkdown, markdownToHtml } from './markdown.js';

const SESSION_ID = '9b6f1f60-2f0a-4a4d-9b8e-8d5f1a2b3c4d';
const AT = new Date('2026-08-28T04:00:00.000Z');

const checkpoint = (over: Partial<Checkpoint> = {}): Checkpoint => ({
  ...buildCheckpoint(
    SESSION_ID,
    {
      currentNodeId: 'derivadas.regla-cadena',
      lastUnderstood: 'La derivada mide la pendiente instantánea',
      nextAction: 'Derivar sin(3x) explicando cada paso',
      suggestedMinutes: 20,
    },
    AT,
  ),
  ...over,
});

const sesion = () =>
  renderSession({
    topic: 'Cálculo I',
    now: 'Regla de la cadena',
    why: 'Sin ella no salen las derivadas compuestas del examen',
    checkpoint: checkpoint(),
  });

describe('el documento de una sesión de aprendizaje', () => {
  it('se puede volver a leer justo después de escribirlo', () => {
    expect(readCheckpoint(sesion())).toEqual(checkpoint());
  });

  /**
   * El que de verdad importa. La sesión se guarda como HTML (es lo que el editor
   * renderiza) y se lee de vuelta como markdown, así que el checkpoint cruza el
   * round trip entero en cada paso. Si `marked` o turndown tocaran el bloque de
   * código, la sesión dejaría de poder reanudarse y no se vería hasta la segunda
   * conversación.
   */
  it('sobrevive al viaje por HTML, que es como se guarda', () => {
    const guardado = htmlToMarkdown(markdownToHtml(sesion()));

    expect(readCheckpoint(guardado)).toEqual(checkpoint());
  });

  it('reescribe el estado sin tocar el registro', () => {
    const conRegistro = appendInteraction(sesion(), {
      kind: 'probe',
      content: 'Confundió la regla del producto con la de la cadena',
      at: AT,
    });

    const siguiente = checkpoint({
      currentNodeId: 'derivadas.producto',
      nextAction: 'Comparar producto y cadena en un mismo ejemplo',
    });
    const actualizado = writeSession(conRegistro, {
      now: 'Regla del producto',
      why: 'Es la que estaba confundiendo',
      checkpoint: siguiente,
    });

    expect(readCheckpoint(actualizado)).toEqual(siguiente);
    expect(actualizado).toContain('Confundió la regla del producto con la de la cadena');
    expect(actualizado).toContain('## Después\n\nComparar producto y cadena en un mismo ejemplo');
  });

  it('el registro crece por abajo y conserva lo anterior', () => {
    const uno = appendInteraction(sesion(), { kind: 'teach', content: 'Primera', at: AT });
    const dos = appendInteraction(uno, { kind: 'check', content: 'Segunda', at: AT });

    expect(dos.indexOf('Primera')).toBeLessThan(dos.indexOf('Segunda'));
    expect(dos).toContain('### check · 2026-08-28T04:00:00.000Z');
  });

  it('las interacciones se quedan dentro del registro', () => {
    const conNota = `${sesion()}\n## Notas mías\n\nUna nota escrita a mano\n`;

    const despues = appendInteraction(conNota, { kind: 'note', content: 'Del agente', at: AT });

    expect(despues.indexOf('Del agente')).toBeLessThan(despues.indexOf('Una nota escrita a mano'));
  });
});

describe('una página que no es una sesión', () => {
  it('lo dice en vez de devolver un checkpoint a medias', () => {
    expect(() => readCheckpoint('# Una nota cualquiera\n\nTexto suelto.')).toThrow(/Checkpoint/);
    expect(() => readCheckpoint(null)).toThrow(/vacía/);
  });

  it('avisa cuando el JSON está roto y cuando le falta un campo', () => {
    const roto = sesion().replace(/"schemaVersion": 1,/, '"schemaVersion": 1');
    expect(() => readCheckpoint(roto)).toThrow(/no es JSON válido/);

    const incompleto = sesion().replace(/"nextAction": "[^"]*"/, '"nextAction": ""');
    expect(() => readCheckpoint(incompleto)).toThrow(/forma esperada/);
  });
});
