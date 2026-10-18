import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

/** En el servidor no hay viewport: se asume escritorio y el CSS (`md:`) decide lo visible. */
function getServerSnapshot() {
  return false
}

/**
 * Si el viewport es de teléfono (menos de 768 px). Lee `matchMedia` en el
 * primer render del cliente, no en un efecto: antes arrancaba en `false` y
 * cambiaba después de pintar, así que un teléfono pintaba primero la rama de
 * escritorio (el `Dialog` en vez de la hoja, el sidebar entero) y saltaba al
 * hidratar. Lo que se puede decidir con CSS (`hidden md:flex`) no pasa por
 * aquí; este hook es para lo que de verdad cambia de componente.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
