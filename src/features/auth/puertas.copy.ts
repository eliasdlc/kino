/**
 * El título y la frase de cada puerta. Viven fuera de los componentes de
 * cliente porque la página del servidor los necesita para el `fallback` del
 * `Suspense`: el HTML inicial ya trae el h1 y la frase, y al hidratar no
 * entra nada encima del formulario.
 */
export const PUERTA_ENTRAR = {
  titulo: "Entra a tu día",
  voz: "Tu energía de hoy y lo que toca, donde lo dejaste.",
} as const;

export const PUERTA_CREAR = {
  titulo: "Crea tu cuenta",
  voz: "Después, una sola pregunta y estás en Hoy.",
} as const;
