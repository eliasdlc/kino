"use client";

import { useEffect, useMemo, useState } from "react";
import { KinoMark } from "./KinoMark";
import { useHydrated } from "@/shared/hooks/useHydrated";

type Level = "alta" | "media" | "baja";

const TASK_DEFS = [
  { id: "t1", title: "Preparar la presentación", meta: "🔥 alta · ~45m · Proyecto" },
  { id: "t2", title: "Revisar el PR del equipo", meta: "⚡ media · ~30m · Proyecto" },
  { id: "t3", title: "Leer 10 páginas", meta: "🌙 baja · ~15m · Personal" },
] as const;

const ADVISOR_LINES: Record<Level | "none", string> = {
  none: "Soy Kino. Registra tu energía y ajusto tu plan en tiempo real:",
  alta: "Energía alta registrada — ahora es el momento para lo difícil. Empieza por la presentación.",
  media: "Energía media — buen momento para el PR. Lo pesado, mejor en tu próximo pico.",
  baja: "Energía baja — sé amable contigo. Lee 10 páginas y considera una pausa.",
};

const CHECKIN_LEVELS: { key: Level; label: string }[] = [
  { key: "alta", label: "🔥 Alta" },
  { key: "media", label: "⚡ Media" },
  { key: "baja", label: "🌙 Baja" },
];

function curve(h: number) {
  const morning = 62 * Math.exp(-Math.pow((h - 10.5) / 2.8, 2));
  const evening = 48 * Math.exp(-Math.pow((h - 17.5) / 2.6, 2));
  return Math.max(8, Math.min(100, Math.round(14 + morning + evening)));
}

/** Tarjeta "Plan de hoy" interactiva del hero: marca tareas y registra energía. */
export function HeroDemo() {
  const mounted = useHydrated();
  const [hourNow, setHourNow] = useState(10);
  const [dateLabel, setDateLabel] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [checkin, setCheckin] = useState<Level | null>(null);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    const sync = () => {
      const d = new Date();
      setHourNow(Math.min(23, Math.max(6, d.getHours())));
      setDateLabel(
        d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
      );
    };
    sync();
    const id = setInterval(sync, 60_000);
    return () => clearInterval(id);
  }, []);

  function toggleTask(id: string) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const all = TASK_DEFS.every((t) => next[t.id]);
      const wasAll = TASK_DEFS.every((t) => prev[t.id]);
      if (all && !wasAll) {
        setConfetti(true);
        setTimeout(() => setConfetti(false), 1100);
      }
      return next;
    });
  }

  const bars = useMemo(() => {
    const out: { pct: number; color: string }[] = [];
    for (let h = 6; h <= 23; h++) {
      const isNow = h === hourNow;
      out.push({
        pct: curve(h),
        color: isNow
          ? "#818cf8"
          : h < hourNow
            ? "rgba(129,140,248,0.28)"
            : "rgba(255,255,255,0.10)",
      });
    }
    return out;
  }, [hourNow]);

  const doneCount = TASK_DEFS.filter((t) => checked[t.id]).length;
  const progressPct = Math.round((doneCount / 3) * 100);
  const advisorLine =
    doneCount === 3
      ? "¡Plan completado! 🎉 Te queda energía — ¿una tarea más o cerramos el día?"
      : ADVISOR_LINES[checkin ?? "none"];

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#18181c] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        {confetti && <Confetti />}

        <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] px-5 pb-3.5 pt-[18px]">
          <div>
            <p className="font-display text-[17px] font-bold text-[#f4f4f5]">Plan de hoy</p>
            <p className="mt-0.5 text-[12.5px] capitalize text-[#6b6b74]">
              {mounted ? dateLabel : " "}
            </p>
          </div>
          <span
            className="font-jetbrains text-[13px] font-semibold"
            style={{ color: doneCount === 3 ? "#3ecf72" : "#a1a1aa" }}
          >
            {doneCount}/3
          </span>
        </div>

        <div className="h-[3px] bg-white/[0.06]">
          <div
            className="h-full bg-[#3ecf72] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex flex-col">
          {TASK_DEFS.map((t) => {
            const done = !!checked[t.id];
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-3"
              >
                <button
                  type="button"
                  onClick={() => toggleTask(t.id)}
                  aria-label="Completar tarea"
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 text-[13px] font-extrabold leading-none text-[#0e0e11] transition-all"
                  style={{
                    borderColor: done ? "#3ecf72" : "rgba(255,255,255,0.28)",
                    background: done ? "#3ecf72" : "transparent",
                  }}
                >
                  {done ? "✓" : ""}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[14.5px] font-medium"
                    style={{
                      color: done ? "#6b6b74" : "#e4e4e7",
                      textDecoration: done ? "line-through" : "none",
                    }}
                  >
                    {t.title}
                  </p>
                  <p className="mt-px font-jetbrains text-[11px] text-[#6b6b74]">{t.meta}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 pb-1.5 pt-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="font-jetbrains text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b6b74]">
              Tu curva de hoy
            </p>
            <span className="inline-flex items-center gap-1.5 font-jetbrains text-[11px] text-[#818cf8]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#818cf8]"
                style={{ animation: "pulse-now 1.6s ease-in-out infinite" }}
              />
              ahora
            </span>
          </div>
          <div className="flex h-16 items-end gap-[3px]">
            {bars.map((bar, i) => (
              <div
                key={i}
                className="min-h-1 flex-1 rounded-t-[3px]"
                style={{ height: `${bar.pct}%`, background: bar.color }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between font-jetbrains text-[9.5px] text-[#52525b]">
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </div>

        <div className="mx-5 mb-[18px] mt-2.5 flex items-start gap-2.5 rounded-[14px] border border-[#6366f1]/[0.18] bg-[#6366f1]/[0.08] px-3.5 py-3">
          <span className="mt-px flex-none">
            <KinoMark size={22} withWordmark={false} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-2.5 text-[13px] leading-[1.5] text-[#c7d2fe]">{advisorLine}</p>
            <div className="flex flex-wrap gap-[7px]">
              {CHECKIN_LEVELS.map((l) => {
                const sel = checkin === l.key;
                return (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setCheckin(sel ? null : l.key)}
                    className="cursor-pointer rounded-full border px-[11px] py-[5px] font-jetbrains text-[11.5px] font-semibold transition-all"
                    style={{
                      borderColor: sel ? "rgba(129,140,248,0.7)" : "rgba(255,255,255,0.14)",
                      background: sel ? "rgba(129,140,248,0.2)" : "rgba(255,255,255,0.04)",
                      color: sel ? "#c7d2fe" : "#a1a1aa",
                    }}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center font-jetbrains text-[11px] text-[#52525b]">
      </p>
    </div>
  );
}

function Confetti() {
  const colors = ["#3ecf72", "#818cf8", "#fbbf24", "#f87171", "#a5b4fc"];
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const dist = 70 + (i % 4) * 22;
        return (
          <span
            key={i}
            style={
              {
                position: "absolute",
                left: "50%",
                top: "38%",
                width: 8,
                height: 8,
                borderRadius: i % 2 ? "999px" : "2px",
                background: colors[i % colors.length],
                "--tx": `calc(-50% + ${(Math.cos(angle) * dist).toFixed(0)}px)`,
                "--ty": `calc(-50% + ${(Math.sin(angle) * dist).toFixed(0)}px)`,
                animation: "marketing-confetti 800ms ease-out forwards",
                animationDelay: `${i * 18}ms`,
                willChange: "transform",
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
