"use client";

import { useState, useMemo } from "react";
import { BarChart3, Flame, Mail, Moon, TrendingUp, Users, Zap, type LucideIcon } from "lucide-react";
import { eyebrow } from "../styles";

function curve(h: number) {
  const morning = 62 * Math.exp(-Math.pow((h - 10.5) / 2.8, 2));
  const evening = 48 * Math.exp(-Math.pow((h - 17.5) / 2.6, 2));
  return Math.max(8, Math.min(100, Math.round(14 + morning + evening)));
}

const ENERGY_ORDER = { baja: 0, media: 1, alta: 2 } as const;
type EnergyLevel = keyof typeof ENERGY_ORDER;

function getLevel(pct: number): EnergyLevel {
  if (pct >= 65) return "alta";
  if (pct >= 38) return "media";
  return "baja";
}

const LEVEL_META: Record<
  EnergyLevel,
  { Icon: LucideIcon; label: string; color: string; tip: string }
> = {
  alta: {
    Icon: Flame,
    label: "Alta",
    color: "var(--warn)",
    tip: "Pico de energía: empieza por lo más difícil.",
  },
  media: {
    Icon: Zap,
    label: "Media",
    color: "var(--ac)",
    tip: "Buen ritmo: reuniones y trabajo en equipo.",
  },
  baja: {
    Icon: Moon,
    label: "Baja",
    color: "var(--mute)",
    tip: "Cuida tu energía: lo pesado puede esperar.",
  },
};

const TASKS: {
  id: string;
  title: string;
  requires: EnergyLevel;
  time: string;
  Icon: LucideIcon;
}[] = [
  { id: "a", title: "Preparar la presentación", requires: "alta", time: "~45m", Icon: BarChart3 },
  { id: "b", title: "Revisar métricas del sprint", requires: "media", time: "~25m", Icon: TrendingUp },
  { id: "c", title: "Reunión de equipo", requires: "media", time: "~30m", Icon: Users },
  { id: "d", title: "Responder correos pendientes", requires: "baja", time: "~15m", Icon: Mail },
];

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

function barColor(pct: number) {
  if (pct >= 65) return "var(--warn)";
  if (pct >= 38) return "var(--ac)";
  return "var(--mute)";
}

export function LandingEnergyDemo() {
  const [hour, setHour] = useState(10);
  const pct = curve(hour);
  const level = getLevel(pct);
  const meta = LEVEL_META[level];

  const ranked = useMemo(() => {
    const currentRank = ENERGY_ORDER[level];
    return [...TASKS]
      .map((t) => ({ ...t, available: ENERGY_ORDER[t.requires] <= currentRank }))
      .sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        return ENERGY_ORDER[b.requires] - ENERGY_ORDER[a.requires];
      });
  }, [level]);

  return (
    <section
      className="border-t border-border overflow-hidden"
      style={{ background: "linear-gradient(to bottom, var(--bg), var(--sf))" }}
    >
      <div className="mx-auto max-w-[860px] px-6 py-[88px]">
        {/* Header */}
        <div className="mb-10 text-center">
          <p className={`mb-3 ${eyebrow}`}>Pruébalo</p>
          <h2 className="mb-4 font-display text-[clamp(26px,4vw,40px)] font-bold tracking-[-0.025em] text-foreground">
            Tu energía decide el orden
          </h2>
          <p className="text-[16px] text-muted-foreground">
            Toca cualquier hora: Kino reorganiza tu día en tiempo real.
          </p>
        </div>

        {/* Energy Curve */}
        <div className="mb-6">
          <div
            className="flex h-[88px] items-end gap-[3px]"
            role="group"
            aria-label="Curva de energía interactiva"
          >
            {HOURS.map((h) => {
              const barPct = curve(h);
              const isNow = h === hour;
              const isPast = h < hour;
              const color = barColor(barPct);
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHour(h)}
                  aria-label={`${h}:00: energía ${barPct}%`}
                  aria-pressed={isNow}
                  className="relative flex flex-1 cursor-pointer items-end"
                  style={{ height: "100%" }}
                >
                  <div
                    className="w-full rounded-t-[3px] transition-all duration-200"
                    style={{
                      height: `${barPct}%`,
                      background: isNow
                        ? `linear-gradient(to top, ${color}, ${color}cc)`
                        : color,
                      opacity: isNow ? 1 : isPast ? 0.28 : 0.11,
                      transform: isNow ? "scaleY(1.08)" : "scaleY(1)",
                      transformOrigin: "bottom",
                      boxShadow: isNow ? `0 0 14px ${color}70` : "none",
                    }}
                  />
                  {isNow && (
                    <span
                      className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 font-jetbrains text-[11px] text-foreground"
                      style={{ boxShadow: `0 0 16px ${color}40` }}
                    >
                      {h}:00
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between px-1 font-jetbrains text-[10px] text-muted-foreground">
            <span>6h</span>
            <span>10h</span>
            <span>14h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </div>

        {/* Energy Status */}
        <div
          className="mb-5 flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-all duration-500"
          style={{
            borderColor: `${meta.color}35`,
            background: `${meta.color}08`,
          }}
        >
          <div className="flex items-center gap-3">
            <meta.Icon className="size-6" style={{ color: meta.color }} aria-hidden />
            <div>
              <p className="font-semibold text-foreground/85">
                Energía {meta.label} · {hour}:00
              </p>
              <p className="text-[13px] text-muted-foreground">{meta.tip}</p>
            </div>
          </div>
          <div
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 font-jetbrains text-xs font-bold transition-all duration-500"
            style={{ borderColor: meta.color, color: meta.color }}
          >
            {pct}%
          </div>
        </div>

        {/* Task List */}
        <div className="flex flex-col gap-2">
          {ranked.map((t, i) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-500"
              style={{
                opacity: t.available ? 1 : 0.32,
                borderColor: i === 0 ? `${meta.color}50` : "color-mix(in srgb, var(--ink) 6%, transparent)",
                background: i === 0 ? `${meta.color}07` : "color-mix(in srgb, var(--ink) 2%, transparent)",
              }}
            >
              <span
                className="w-5 text-center font-jetbrains text-xs font-bold transition-colors duration-500"
                style={{ color: i === 0 ? meta.color : "var(--mute)" }}
              >
                {i + 1}
              </span>
              <t.Icon className="size-[18px] text-muted-foreground" aria-hidden />
              <span
                className="flex-1 text-[14px] font-medium transition-colors duration-500"
                style={{ color: t.available ? "var(--body)" : "var(--mute)" }}
              >
                {t.title}
              </span>
              <span className="font-jetbrains text-[11px] text-muted-foreground">{t.time}</span>
              {i === 0 ? (
                <span
                  className="rounded-full px-2.5 py-1 font-jetbrains text-[10px] font-semibold transition-all duration-500"
                  style={{ background: `${meta.color}22`, color: meta.color }}
                >
                  ahora
                </span>
              ) : !t.available ? (
                <span className="rounded-full border border-border bg-foreground/10 px-2.5 py-1 font-jetbrains text-[10px] text-muted-foreground">
                  + tarde
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
