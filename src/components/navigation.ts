import type { LucideIcon } from "lucide-react";
import { Calendar, Inbox, Layers, ListTodo, Sun } from "lucide-react";

/**
 * La única lista de destinos de la app. La leen el pie del teléfono, el
 * sidebar de escritorio, la paleta y los atajos `g` + letra, así que un
 * destino que se renombra o se mueve cambia en los cuatro a la vez. Antes
 * cada uno tenía la suya: Bandeja llevaba a tres sitios y Hoy se llamaba
 * Dashboard en la paleta.
 *
 * El icono sólo lo pinta el sidebar de escritorio: en el teléfono los
 * destinos son palabras. `movil: false` marca lo que no cabe en el pie
 * (Calendario, que en el teléfono se alcanza desde Hoy y desde Tareas).
 */
export interface Destino {
  href: "/dashboard" | "/tasks" | "/systems" | "/bandeja" | "/calendar";
  label: string;
  icon: LucideIcon;
  /** La letra que sigue a `g` en el atajo de teclado. */
  tecla: string;
  /** Si tiene sitio en el pie del teléfono. */
  movil: boolean;
}

export const DESTINOS: readonly Destino[] = [
  { href: "/dashboard", label: "Hoy", icon: Sun, tecla: "d", movil: true },
  { href: "/tasks", label: "Tareas", icon: ListTodo, tecla: "t", movil: true },
  { href: "/systems", label: "Sistemas", icon: Layers, tecla: "s", movil: true },
  { href: "/bandeja", label: "Bandeja", icon: Inbox, tecla: "i", movil: true },
  { href: "/calendar", label: "Calendario", icon: Calendar, tecla: "c", movil: false },
];

/** Los cuatro del pie, en su orden. */
export const DESTINOS_MOVIL = DESTINOS.filter((d) => d.movil);

/**
 * Si la ruta actual cae dentro de un destino. Hoy sólo es Hoy: cualquier
 * otra ruta bajo `/dashboard` no existe, pero `/systems/<id>` sí es Sistemas.
 */
export function destinoActivo(href: Destino["href"], pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Qué cabecera corresponde a una ruta del teléfono. Una pantalla raíz lleva
 * la marca y la puerta a Ajustes; una anidada lleva «‹ padre». El nombre del
 * sistema lo pone quien conoce los sistemas (`MobileHeader`), aquí sólo se
 * decide la forma y el destino del Volver.
 */
export type Cabecera =
  | { tipo: "raiz" }
  | { tipo: "anidada"; padreHref: string; padreLabel: string | null; systemId?: string };

export function cabeceraDe(pathname: string): Cabecera {
  // El calendario no está en el pie: en el teléfono se llega desde la fecha de
  // Hoy, así que su cabecera vuelve allí en vez de fingir ser una raíz.
  if (pathname === "/calendar") return { tipo: "anidada", padreHref: "/dashboard", padreLabel: "Hoy" };
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return { tipo: "anidada", padreHref: "/dashboard", padreLabel: "Hoy" };
  }
  const sistema = pathname.match(/^\/systems\/([^/]+)(\/.*)?$/);
  if (!sistema) return { tipo: "raiz" };
  const [, systemId, resto] = sistema;
  if (!resto) return { tipo: "anidada", padreHref: "/systems", padreLabel: "Sistemas" };
  const carpeta = resto.match(/^\/folders\/([^/]+)\/(tablero|lectura)$/);
  if (carpeta) {
    return {
      tipo: "anidada",
      padreHref: `/systems/${systemId}/folders/${carpeta[1]}`,
      padreLabel: "Carpeta",
      systemId,
    };
  }
  return { tipo: "anidada", padreHref: `/systems/${systemId}`, padreLabel: null, systemId };
}
