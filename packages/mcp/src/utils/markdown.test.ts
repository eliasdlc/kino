import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, markdownToHtml } from './markdown.js';

/**
 * Lo que se prueba aquí es el viaje completo, no cada conversor por su lado: el
 * agente escribe markdown, la página guarda HTML, y la siguiente lectura tiene
 * que devolver algo que se pueda volver a escribir sin degradarse.
 *
 * Por eso casi todo son ida y vuelta. Un test que sólo mirara la salida de
 * `marked` no diría nada del problema real, que era leer HTML donde la tool
 * prometía markdown.
 */

const roundTrip = (markdown: string) => htmlToMarkdown(markdownToHtml(markdown));

describe('markdown ↔ html', () => {
  it('conserva encabezados, énfasis y enlaces', () => {
    expect(roundTrip('## Título\n\nUn **texto** con [enlace](https://usekino.dev).')).toBe(
      '## Título\n\nUn **texto** con [enlace](https://usekino.dev).',
    );
  });

  // Turndown alinea el marcador a cuatro columnas, que es markdown válido y lo
  // que hace estable el anidado. Lo que importa no es el byte exacto sino que la
  // lista siga siendo una lista, así que se compara contra su propia salida.
  it('conserva las listas, con su anidado', () => {
    expect(roundTrip('- uno\n  - anidado\n- dos')).toBe('-   uno\n    -   anidado\n-   dos');
  });

  it('conserva una tabla, que es lo que se perdía sin GFM', () => {
    const table = '| Tema | Estado |\n| --- | --- |\n| Derivadas | visto |';

    expect(roundTrip(table)).toContain('| Derivadas | visto |');
  });

  it('conserva una lista de tareas con su estado', () => {
    expect(roundTrip('- [x] hecho\n- [ ] pendiente')).toBe('-   [x]  hecho\n-   [ ]  pendiente');
  });

  /**
   * La garantía de verdad: un agente que lee, edita y guarda repite el viaje
   * cada vez. Si cada pasada añadiera o quitara algo, el documento se degradaría
   * solo, y eso no se ve en una comparación de una sola ida y vuelta.
   */
  it('no se degrada al repetir el viaje', () => {
    const documento = [
      '# Sesión',
      '',
      'Un párrafo con **énfasis**.',
      '',
      '- [x] hecho',
      '- uno',
      '  - anidado',
      '',
      '| Tema | Estado |',
      '| --- | --- |',
      '| Derivadas | visto |',
      '',
      '```ts',
      'const a = 1;',
      '```',
    ].join('\n');

    const primera = roundTrip(documento)!;

    expect(roundTrip(primera)).toBe(primera);
  });

  it('conserva un bloque de código con su lenguaje', () => {
    expect(roundTrip('```ts\nconst a = 1;\n```')).toBe('```ts\nconst a = 1;\n```');
  });

  it('lee las listas de tareas del editor, que no llevan checkbox sino atributo', () => {
    const fromEditor =
      '<ul data-type="taskList">' +
      '<li data-checked="true"><div><p>hecho</p></div></li>' +
      '<li data-checked="false"><div><p>pendiente</p></div></li>' +
      '</ul>';

    expect(htmlToMarkdown(fromEditor)).toBe('- [x] hecho\n- [ ] pendiente');
  });

  it('trata el vacío como vacío en las dos direcciones', () => {
    expect(markdownToHtml('')).toBeNull();
    expect(markdownToHtml(null)).toBeNull();
    expect(htmlToMarkdown('')).toBeNull();
    expect(htmlToMarkdown(null)).toBeNull();
    expect(htmlToMarkdown('<p></p>')).toBeNull();
  });
});
