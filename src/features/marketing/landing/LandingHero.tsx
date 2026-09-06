import Link from "next/link";
import { HeroDemo } from "../HeroDemo";
import { btnPrimary, btnGhost } from "../styles";

export function LandingHero() {
  return (
    <header className="relative overflow-hidden">
      {/* Primary energy blob: breathing */}
      <div className="pointer-events-none absolute -top-[180px] left-1/2 -translate-x-1/2">
        <div
          className="h-[420px] w-[760px] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.18),transparent_70%)]"
          style={{ animation: "energy-breathe 5s ease-in-out infinite" }}
        />
      </div>
      {/* Warm accent blob: offset, slower */}
      <div className="pointer-events-none absolute -bottom-[80px] right-[5%]">
        <div
          className="h-[320px] w-[500px] bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.07),transparent_70%)]"
          style={{ animation: "energy-breathe-warm 7.5s ease-in-out infinite reverse" }}
        />
      </div>

      <div className="relative mx-auto flex max-w-[1120px] flex-wrap items-center gap-14 px-6 pb-24 pt-[88px]">
        <div className="min-w-[min(100%,420px)] shrink grow basis-[460px]">
          <p className="mb-5 font-jetbrains text-xs font-semibold uppercase tracking-[0.14em] text-[#818cf8]">
            Productividad basada en energía
          </p>
          <h1 className="mb-6 text-balance font-display text-[clamp(42px,5.5vw,68px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#f4f4f5]">
            Trabaja con tu <span className="text-[#818cf8]">energía</span>,
            <br />
            no contra ella.
          </h1>
          <p className="mb-9 max-w-[520px] text-pretty text-[18px] leading-[1.65] text-[#a1a1aa]">
            Kino aprende tu curva de energía y te dice{" "}
            <strong className="font-semibold text-[#e4e4e7]">
              qué hacer, cuándo hacerlo y cuándo descansar
            </strong>
            . Un plan diario corto y accionable: no otra lista infinita.
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <Link
              href="/register"
              className={`${btnPrimary} px-[26px] py-3.5 text-base shadow-[0_8px_32px_rgba(99,102,241,0.35)]`}
            >
              Crear cuenta gratis →
            </Link>
            <a href="#como-funciona" className={`${btnGhost} px-[22px] py-3.5 text-base`}>
              Ver cómo funciona
            </a>
          </div>
        </div>

        {/* Hero card: gentle float */}
        <div
          className="min-w-[min(100%,360px)] shrink grow-0 basis-[440px]"
          style={{ animation: "hero-float 6s ease-in-out infinite" }}
        >
          <HeroDemo />
        </div>
      </div>
    </header>
  );
}
