/** Clases compartidas para los botones del sitio público: las mismas primitivas que la app, en pill. */
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground shadow-[0_0.5em_1.4em_-0.4em_var(--glow)] transition-colors hover:bg-primary/90";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full bg-secondary font-semibold text-foreground transition-colors hover:bg-secondary/70";

/** Superficie de tarjeta del sitio (añade el padding según el contexto). */
export const cardSurface = "rounded-2xl border border-border bg-card shadow-(--shadow)";

/** Etiqueta "eyebrow" que encabeza cada sección: caption en la cara de texto, con el acento. */
export const eyebrow =
  "text-xs font-semibold uppercase tracking-[0.06em] text-primary";
