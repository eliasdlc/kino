import Link from "next/link";
import { cardSurface, eyebrow } from "../styles";

const CARDS = [
  {
    kicker: "01 · empieza aquí",
    title: "Primeros pasos",
    desc: "Crea tu cuenta, configura tu perfil de energía y arma tu primer sistema.",
    href: "/docs#primeros-pasos",
  },
  {
    kicker: "02 · concepto",
    title: "Tu curva de energía",
    desc: "Qué es el cronotipo, cómo funcionan los check-ins y cómo aprende la predicción.",
    href: "/docs#energia",
  },
  {
    kicker: "03 · concepto",
    title: "Sistemas y tipos",
    desc: "Académico, profesional, emprendedor, personal y custom: cuál usar y cuándo.",
    href: "/docs#sistemas",
  },
  {
    kicker: "04 · concepto",
    title: "Plan de hoy vs. sugerencias",
    desc: "Tu compromiso y la recomendación de Kino: dos perspectivas del mismo día.",
    href: "/docs#plan",
  },
  {
    kicker: "05 · guía",
    title: "Focus timer",
    desc: "Pomodoro, estimado y libre. Cómo el recap de energía calibra tu curva.",
    href: "/docs#timer",
  },
  {
    kicker: "06 · avanzado",
    title: "API y MCP",
    desc: "Conecta Kino con tu asistente de IA: ~50 herramientas vía Model Context Protocol.",
    href: "/docs#mcp",
  },
];

export function LandingDocsTeaser() {
  return (
    <section id="docs" className="scroll-mt-20 border-t border-white/[0.06] bg-[#131316]">
      <div className="mx-auto max-w-[1120px] px-6 py-[88px]">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className={`mb-3.5 ${eyebrow}`}>Documentación</p>
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-bold tracking-[-0.025em] text-[#f4f4f5]">
              Aprende Kino en 10 minutos
            </h2>
          </div>
          <Link
            href="/docs"
            className="pb-1.5 text-[15px] font-semibold text-[#818cf8] transition-colors hover:text-[#a5b4fc]"
          >
            Ver toda la documentación →
          </Link>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`${cardSurface} flex flex-col gap-2 p-[22px] transition-colors hover:border-[#818cf8]/45`}
            >
              <p className="font-jetbrains text-[11px] text-[#6b6b74]">{c.kicker}</p>
              <h3 className="font-display text-[18px] font-bold text-[#f4f4f5]">{c.title}</h3>
              <p className="text-sm text-[#a1a1aa]">{c.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
