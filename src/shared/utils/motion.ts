/**
 * El `behavior` que le toca a un desplazamiento lanzado desde JavaScript.
 *
 * El bloque de `prefers-reduced-motion` de `globals.css` apaga transiciones y
 * animaciones CSS, pero no alcanza a un `scrollIntoView` ni a un `scrollBy`:
 * esos los anima el navegador por su cuenta y hay que preguntarle a la
 * preferencia antes de pedirlos, igual que hace la cuenta de la cifra de
 * energía en `EnergyTodayCard`.
 */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
