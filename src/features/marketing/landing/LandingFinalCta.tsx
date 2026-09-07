import Link from "next/link";
import { KinoMark } from "../KinoMark";
import { btnPrimary } from "../styles";

export function LandingFinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div className="relative mx-auto max-w-[760px] px-6 py-[100px] text-center">
        <span className="mx-auto mb-[26px] flex w-fit">
          <KinoMark size={52} glow withWordmark={false} />
        </span>
        <h2 className="mb-4 text-balance font-display text-[clamp(32px,4.5vw,52px)] font-extrabold tracking-[-0.03em] text-foreground">
          Tu energía ya tiene un plan.
        </h2>
        <p className="mb-9 text-[17px] text-muted-foreground">
          Dos semanas de check-ins y tu curva deja de ser una suposición.
        </p>
        <Link
          href="/register"
          className={`${btnPrimary} px-8 py-[15px] text-[17px] shadow-[0_8px_32px_color-mix(in srgb, var(--ac) 35%, transparent)]`}
        >
          Crear cuenta gratis →
        </Link>
      </div>
    </section>
  );
}
