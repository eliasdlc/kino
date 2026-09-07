/**
 * `matchMedia` para jsdom, con las preferencias que el producto consulta.
 *
 * Vive aparte de `jsdom-setup` porque un test necesita cambiarlas: la cuenta
 * animada de la cifra de energía lee `prefers-reduced-motion` desde JavaScript,
 * y sin poder moverla no hay forma de probar que se apaga.
 */

const WIDTH_QUERY = /\((max|min)-width:\s*(\d+(?:\.\d+)?)px\)/;

/** Las preferencias del sistema que algún componente pregunta por JS. */
const PREFERENCES = {
  "(prefers-reduced-motion: reduce)": false,
  "(prefers-color-scheme: dark)": false,
};

type Preference = keyof typeof PREFERENCES;

const DEFAULTS = { ...PREFERENCES };

/** Enciende una preferencia para el test que viene. */
export function setMediaPreference(query: Preference, value: boolean): void {
  PREFERENCES[query] = value;
}

/** Movimiento reducido, la que más se usa. */
export function setReducedMotion(reduce: boolean): void {
  setMediaPreference("(prefers-reduced-motion: reduce)", reduce);
}

/** Vuelve a los valores de un sistema recién estrenado. Lo corre `jsdom-setup`. */
export function resetMediaPreferences(): void {
  Object.assign(PREFERENCES, DEFAULTS);
}

/**
 * La respuesta de una media query. El ancho sale de `window.innerWidth`, que
 * jsdom sí mantiene; las preferencias, del mapa de arriba. Cualquier otra query
 * responde que no casa, porque una respuesta inventada sería peor que una
 * negativa.
 */
function matches(query: string): boolean {
  if (query in PREFERENCES) return PREFERENCES[query as Preference];
  const found = WIDTH_QUERY.exec(query);
  if (!found) return false;
  const [, kind, px] = found;
  return kind === "max" ? window.innerWidth <= Number(px) : window.innerWidth >= Number(px);
}

/** Monta `matchMedia` si jsdom no lo trae. */
export function installMatchMedia(): void {
  if (typeof window === "undefined" || typeof window.matchMedia === "function") return;
  window.matchMedia = (query: string): MediaQueryList => {
    // Registrar y quitar oyentes no hace nada a propósito: jsdom no cambia de
    // tamaño solo ni cambia las preferencias del sistema, así que un cambio de
    // media query no llega a ocurrir nunca. Guardarlos daría a entender que
    // alguien los va a llamar, y no es cierto.
    const ignore = () => {};
    return {
      media: query,
      get matches() {
        return matches(query);
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
