import { EnergyBadgeCycle } from "../EnergyBadgeCycle";
import { cardSurface, eyebrow } from "../styles";

export function LandingHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="scroll-mt-20 border-t border-border"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-[88px]">
        <p className={`mb-3.5 ${eyebrow}`}>Cómo funciona</p>
        <h2 className="mb-4 font-display text-[clamp(30px,4vw,44px)] font-bold tracking-[-0.025em] text-foreground">
          Un ciclo de tres pasos
        </h2>
        <p className="mb-12 max-w-[560px] text-[17px] text-muted-foreground">
          Cada paso alimenta al siguiente. Cuanto más lo usas, mejor te conoce Kino.
        </p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-[18px]">
          <div className={`${cardSurface} p-[26px]`}>
            <p className="mb-[18px] font-jetbrains text-[13px] font-semibold text-primary">01</p>
            <EnergyBadgeCycle />
            <h3 className="mb-2 font-display text-xl font-bold text-foreground">
              Registra tu energía
            </h3>
            <p className="text-[15px] text-muted-foreground">
              Tres toques al día: mañana, tarde y noche. Kino detecta tu cronotipo y construye
              tu curva real: no una genérica.
            </p>
          </div>

          <div className={`${cardSurface} p-[26px]`}>
            <p className="mb-[18px] font-jetbrains text-[13px] font-semibold text-primary">02</p>
            <div className="mb-[22px] flex flex-col gap-1.5">
              <PlanRow dot="var(--warn)" title="Entregar informe" tag="vence hoy" tagColor="var(--warn)" />
              <PlanRow dot="var(--ac)" title="Diseñar propuesta" tag="alta, a las 10h" tagColor="var(--mute)" />
              <PlanRow dot="var(--mute)" title="Ordenar inbox" tag="baja, a las 16h" tagColor="var(--mute)" />
            </div>
            <h3 className="mb-2 font-display text-xl font-bold text-foreground">Kino arma tu plan</h3>
            <p className="text-[15px] text-muted-foreground">
              Urgencia + prioridad + tu energía por hora. Entre 3 y 7 tareas: lo difícil en tu
              pico, lo liviano en tus valles.
            </p>
          </div>

          <div className={`${cardSurface} p-[26px]`}>
            <p className="mb-[18px] font-jetbrains text-[13px] font-semibold text-primary">03</p>
            <div className="mb-[22px] flex items-center gap-3.5">
              <div
                className="flex h-[58px] w-[58px] flex-none items-center justify-center rounded-full"
                style={{ background: "conic-gradient(var(--ok) 68%, color-mix(in srgb, var(--ink) 8%, transparent) 0)" }}
              >
                <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-card font-jetbrains text-xs font-semibold text-foreground">
                  17:00
                </div>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground/85">Pomodoro · 25 min</p>
                <p className="mt-0.5 font-jetbrains text-[11px] text-muted-foreground">
                  al terminar: ¿cómo fue tu energía?
                </p>
              </div>
            </div>
            <h3 className="mb-2 font-display text-xl font-bold text-foreground">
              Enfócate y cierra el ciclo
            </h3>
            <p className="text-[15px] text-muted-foreground">
              Timer integrado con recap de energía. Cada sesión calibra tu curva: en ~2 semanas
              la predicción converge con tu realidad.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanRow({
  dot,
  title,
  tag,
  tagColor,
}: {
  dot: string;
  title: string;
  tag: string;
  tagColor: string;
}) {
  return (
    <div className="flex items-center gap-[9px] rounded-[10px] border border-border bg-foreground/10 px-[11px] py-[7px]">
      <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: dot }} />
      <span className="flex-1 text-[12.5px] text-foreground/80">{title}</span>
      <span className="font-jetbrains text-[10px]" style={{ color: tagColor }}>
        {tag}
      </span>
    </div>
  );
}
