/**
 * `turndown-plugin-gfm` no publica tipos. Lo que se usa de él es una sola
 * función, así que se declara aquí en vez de arrastrar un `any` hasta el
 * conversor.
 *
 * Sin `import`/`export` en el nivel superior a propósito: un `.d.ts` que sea un
 * módulo no puede declarar módulos ajenos, sólo aumentarlos.
 */
declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown';

  /** Tablas, tachado, listas de tareas y bloques de código cercados. */
  export function gfm(service: TurndownService): void;
}
