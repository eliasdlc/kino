/**
 * Lo que jsdom no trae y los componentes sí usan al montarse.
 *
 * Se carga en todos los tests del proyecto `dom` (ver `vitest.config.ts`). Cada
 * pieza de aquí existe porque un componente real la llama, no por si acaso: sin
 * ella el test falla dentro de un `useEffect` y no en lo que quería probar.
 * Cada polyfill dice quién lo llama, para que el día que ese componente
 * desaparezca se pueda borrar sin adivinar.
 */

// Las aserciones de `jest-dom`: `toBeVisible`, `toHaveAttribute`, `toHaveClass`.
// Sin ellas la salida honesta es `toBeDefined()`, que pasa aunque el elemento
// esté oculto, deshabilitado o vacío.
import "@testing-library/jest-dom/vitest";

import { beforeEach } from "vitest";
import { installMatchMedia, resetMediaPreferences } from "./media";
import { resetNavigation } from "./navigation";

/**
 * `matchMedia`: lo preguntan `useIsMobile` y `ThemeProvider` al montarse, y
 * `EnergyTodayCard` para saber si tiene que animar la cifra. El polyfill vive
 * en `./media` porque un test necesita cambiar las preferencias.
 */
installMatchMedia();

/**
 * `localStorage`: lo escribe `ThemeProvider` para recordar el tema de este
 * dispositivo, y lo lee el script inline del layout raíz. jsdom 29 no lo monta
 * en esta configuración, así que sin esto ningún test puede montar el árbol de
 * proveedores de la app.
 *
 * Es de memoria y se vacía antes de cada test, más abajo: un tema elegido en
 * un test no puede llegar al siguiente.
 */
class MemoryStorage implements Storage {
  #items = new Map<string, string>();
  get length(): number {
    return this.#items.size;
  }
  key(index: number): string | null {
    return [...this.#items.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.#items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.#items.set(key, String(value));
  }
  removeItem(key: string): void {
    this.#items.delete(key);
  }
  clear(): void {
    this.#items.clear();
  }
}

const memoryStorage = new MemoryStorage();

if (typeof window !== "undefined" && !window.localStorage) {
  Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true });
}

/**
 * `ResizeObserver`: lo montan Radix cuando posiciona un `Popover` o un
 * `Select`, Recharts al medir su contenedor, y `FloatingNotesLayer` para
 * recolocar las notas cuando el lienzo cambia de tamaño.
 *
 * Nunca dispara: jsdom no hace layout, así que no hay tamaño que cambiar. Lo
 * que evita es el `TypeError` del constructor.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

/**
 * La captura de puntero: la piden Radix `Select` y `DropdownMenu` al abrirse, y
 * la librería de arrastre en cualquier gesto. jsdom declara los métodos en el
 * prototipo pero no los implementa, así que se ponen sólo si faltan.
 */
if (typeof Element !== "undefined") {
  const element = Element.prototype as unknown as Record<string, unknown>;
  element.hasPointerCapture ??= () => false;
  element.setPointerCapture ??= () => {};
  element.releasePointerCapture ??= () => {};

  /**
   * `scrollIntoView`: lo llaman el menú de barra del editor (`SlashMenu`), la
   * lista de menciones (`MentionList`), la semana de foco (`TaskWeekFocusView`)
   * y el lienzo del cuaderno (`NotebookEditorSurface`) para traer a la vista el
   * elemento activo. jsdom no tiene scroll: no hacer nada es la verdad.
   */
  element.scrollIntoView ??= () => {};
}

/**
 * La medida de un trozo de texto: la piden `Range.getClientRects` y su
 * rectángulo, y los llama ProseMirror dentro de `coordsAtPos`. Es como el
 * editor sabe a qué altura de la pantalla cae una posición del documento, y de
 * ahí salen el punto donde se abre el creador de una nota y la altura a la que
 * viaja un ancla. jsdom no hace layout, así que la lista vacía y el rectángulo
 * en cero son la verdad, no un valor inventado.
 */
if (typeof Range !== "undefined") {
  const zeroRect = (): DOMRect => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  });
  const range = Range.prototype as unknown as Record<string, unknown>;
  range.getClientRects ??= () => Object.assign([] as DOMRect[], { item: () => null });
  range.getBoundingClientRect ??= zeroRect;
}

/**
 * El estado que un test le puede dejar al siguiente: el ancho de la ventana lo
 * mueve `renderMobile`, la URL la mueve `setNavigation` y las preferencias del
 * sistema las mueve `setReducedMotion`. Todo vuelve a su sitio antes de cada
 * test para que el orden de los ficheros no cambie el resultado.
 */
const DEFAULT_WIDTH = 1024;

beforeEach(() => {
  window.innerWidth = DEFAULT_WIDTH;
  window.localStorage.clear();
  resetMediaPreferences();
  resetNavigation();
});
