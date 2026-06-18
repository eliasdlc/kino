"use client";

import { useEffect, useState } from "react";

const LEVELS = [
  { key: "alta", label: "🔥 Alta", color: "#f97316" },
  { key: "media", label: "⚡ Media", color: "#818cf8" },
  { key: "baja", label: "🌙 Baja", color: "#6b7280" },
] as const;

export function EnergyBadgeCycle() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((prev) => (prev + 1) % 3), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mb-[22px] flex gap-2">
      {LEVELS.map((l, i) => {
        const sel = i === active;
        return (
          <span
            key={l.key}
            className="rounded-full border px-3.5 py-[7px] font-jetbrains text-xs transition-all duration-500"
            style={{
              borderColor: sel ? `${l.color}55` : "rgba(255,255,255,0.10)",
              background: sel ? `${l.color}18` : "rgba(255,255,255,0.05)",
              color: sel ? "#e4e4e7" : "#52525b",
              boxShadow: sel ? `0 0 14px ${l.color}35` : "none",
            }}
          >
            {l.label}
          </span>
        );
      })}
    </div>
  );
}
