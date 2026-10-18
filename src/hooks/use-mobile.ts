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
 * Si el viewport es de teléfono (menos de 768 px). Fuera de la hidratación lee
 * `matchMedia` en el render, no en un efecto: antes arrancaba en `false` y
 * cambiaba después de pintar, así que un teléfono abría primero la rama de
 * escritorio (el `Dialog` en vez de la hoja). En la hidratación React usa la
 * instantánea del servidor (escritorio) y corrige en el mismo commit; por eso
 * lo visible del shell (sidebar, pie, cabecera) se decide con CSS (`md:`) y no
 * pasa por aquí. Este hook es para lo que de verdad cambia de componente.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
