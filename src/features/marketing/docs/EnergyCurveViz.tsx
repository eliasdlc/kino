function curve(h: number) {
  const morning = 62 * Math.exp(-Math.pow((h - 10.5) / 2.8, 2));
  const evening = 44 * Math.exp(-Math.pow((h - 17.5) / 2.6, 2));
  return Math.max(8, Math.min(100, Math.round(14 + morning + evening)));
}

const BARS = Array.from({ length: 18 }, (_, i) => {
  const pct = curve(i + 6);
  return {
    pct,
    color:
      pct > 70 ? "#818cf8" : pct > 40 ? "rgba(129,140,248,0.45)" : "rgba(255,255,255,0.12)",
  };
});

/** Curva de energía típica (cronotipo intermedio): ilustración estática de docs. */
export function EnergyCurveViz() {
  return (
    <div className="mb-5 rounded-2xl border border-white/[0.08] bg-[#18181c] p-[22px]">
      <p className="mb-3.5 font-jetbrains text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b6b74]">
        Curva típica · cronotipo intermedio
      </p>
      <div className="flex h-[90px] items-end gap-[3px]">
        {BARS.map((bar, i) => (
          <div
            key={i}
            className="min-h-1 flex-1 rounded-t-[3px]"
            style={{ height: `${bar.pct}%`, background: bar.color }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-jetbrains text-[10px] text-[#52525b]">
        <span>6h</span>
        <span>pico ~10–11h</span>
        <span>valle ~15h</span>
        <span>23h</span>
      </div>
    </div>
  );
}
