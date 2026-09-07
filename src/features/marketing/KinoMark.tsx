/**
 * Marca de Kino: el cuadrado en el acento, plano, con dos barras (energía) en el color de fondo,
 * opcionalmente con el wordmark "kino". Reutilizado en nav, footer y CTAs.
 */
export function KinoMark({
  size = 28,
  glow = false,
  withWordmark = true,
  wordmarkSize = 20,
}: {
  size?: number;
  glow?: boolean;
  withWordmark?: boolean;
  wordmarkSize?: number;
}) {
  const barW = Math.max(3, Math.round(size * 0.14));
  const barH = Math.max(6, Math.round(size * 0.29));

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="inline-flex items-center justify-center gap-1 bg-primary"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          boxShadow: glow ? "0 0.5em 1.4em -0.4em var(--glow)" : undefined,
        }}
      >
        <span
          className="rounded-[2px] bg-background"
          style={{ width: barW, height: barH }}
        />
        <span
          className="rounded-[2px] bg-background"
          style={{ width: barW, height: barH }}
        />
      </span>
      {withWordmark && (
        <span
          className="font-display font-bold tracking-[-0.02em] text-foreground"
          style={{ fontSize: wordmarkSize }}
        >
          kino
        </span>
      )}
    </span>
  );
}
