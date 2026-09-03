/**
 * Lo que jsdom no trae y los componentes sí usan al montarse.
 *
 * Se carga en todos los tests del proyecto `dom` (ver `vitest.config.ts`). Cada
 * pieza de aquí existe porque un componente real la llama, no por si acaso: sin
 * ella el test falla dentro de un `useEffect` y no en lo que quería probar.
 */

/**
 * `useIsMobile` y `ThemeProvider` preguntan por media queries al montarse, y
 * jsdom no implementa `matchMedia`.
 *
 * La respuesta sale de `window.innerWidth`, que jsdom sí mantiene (1024 por
 * defecto), así que un test que quiera una pantalla de móvil lo asigna antes de
 * renderizar. Sólo entiende `max-width` y `min-width` en píxeles, que es lo único
 * que el proyecto consulta; cualquier otra query responde que no casa, porque
 * una respuesta inventada sería peor que una negativa.
 */
const WIDTH_QUERY = /\((max|min)-width:\s*(\d+(?:\.\d+)?)px\)/;

function matchesWidth(query: string): boolean {
  const found = WIDTH_QUERY.exec(query);
  if (!found) return false;
  const [, kind, px] = found;
  return kind === "max" ? window.innerWidth <= Number(px) : window.innerWidth >= Number(px);
}

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => {
    // Registrar y quitar oyentes no hace nada a propósito: jsdom no cambia de
    // tamaño solo, así que un cambio de media query no llega a ocurrir nunca.
    // Guardarlos daría a entender que alguien los va a llamar, y no es cierto.
    const ignore = () => {};
    return {
      media: query,
      get matches() {
        return matchesWidth(query);
      },
      onchange: null,
      addEventListener: ignore,
      removeEventListener: ignore,
      addListener: ignore,
      removeListener: ignore,
      dispatchEvent: () => false,
    };
  };
}
