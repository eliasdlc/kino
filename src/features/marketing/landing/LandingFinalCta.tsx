import Link from "next/link";
import { KinoMark } from "../KinoMark";
import { btnPrimary } from "../styles";

export function LandingFinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06]">
      <div className="pointer-events-none absolute -bottom-[200px] left-1/2 h-[380px] w-[700px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.18),transparent_70%)]" />
      <div className="relative mx-auto max-w-[760px] px-6 py-[100px] text-center">
        <span className="mx-auto mb-[26px] flex w-fit">
          <KinoMark size={52} glow withWordmark={false} />
        </span>
        <h2 className="mb-4 text-balance font-display text-[clamp(32px,4.5vw,52px)] font-extrabold tracking-[-0.03em] text-[#f4f4f5]">
          Tu energía ya tiene un plan.
        </h2>
        <p className="mb-9 text-[17px] text-[#a1a1aa]">
          Dos semanas de check-ins y Kino te conocerá mejor que tu agenda.
        </p>
        <Link
          href="/register"
          className={`${btnPrimary} px-8 py-[15px] text-[17px] shadow-[0_8px_32px_rgba(99,102,241,0.35)]`}
        >
          Crear cuenta gratis →
        </Link>
      </div>
    </section>
  );
}
