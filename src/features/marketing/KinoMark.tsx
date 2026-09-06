/**
 * Marca de Kino: el cuadrado con gradiente índigo y dos "barritas" (energía),
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
        className="inline-flex items-center justify-center gap-1 bg-gradient-to-br from-[#818cf8] to-[#6366f1]"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          boxShadow: glow ? "0 0 18px rgba(99,102,241,0.45)" : undefined,
        }}
      >
        <span
          className="rounded-[2px] bg-[#0e0e11]"
          style={{ width: barW, height: barH }}
        />
        <span
          className="rounded-[2px] bg-[#0e0e11]"
          style={{ width: barW, height: barH }}
        />
      </span>
      {withWordmark && (
        <span
          className="font-display font-bold tracking-[-0.02em] text-[#f4f4f5]"
          style={{ fontSize: wordmarkSize }}
        >
          kino
        </span>
      )}
    </span>
  );
}
