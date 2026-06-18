import { EnergyBadgeCycle } from "../EnergyBadgeCycle";
import { cardSurface, eyebrow } from "../styles";

export function LandingHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="scroll-mt-20 border-t border-white/[0.06]"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-[88px]">
        <p className={`mb-3.5 ${eyebrow}`}>Cómo funciona</p>
        <h2 className="mb-4 font-display text-[clamp(30px,4vw,44px)] font-bold tracking-[-0.025em] text-[#f4f4f5]">
          Un ciclo de tres pasos
        </h2>
        <p className="mb-12 max-w-[560px] text-[17px] text-[#a1a1aa]">
          Cada paso alimenta al siguiente. Cuanto más lo usas, mejor te conoce Kino.
        </p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-[18px]">
          <div className={`${cardSurface} p-[26px]`}>
            <p className="mb-[18px] font-jetbrains text-[13px] font-semibold text-[#818cf8]">01</p>
            <EnergyBadgeCycle />
            <h3 className="mb-2 font-display text-xl font-bold text-[#f4f4f5]">
              Registra tu energía
            </h3>
            <p className="text-[15px] text-[#a1a1aa]">
              Tres toques al día: mañana, tarde y noche. Kino detecta tu cronotipo y construye
              tu curva real — no una genérica.
            </p>
          </div>

          <div className={`${cardSurface} p-[26px]`}>
            <p className="mb-[18px] font-jetbrains text-[13px] font-semibold text-[#818cf8]">02</p>
            <div className="mb-[22px] flex flex-col gap-1.5">
              <PlanRow dot="#f87171" title="Entregar informe" tag="vence hoy" tagColor="#f87171" />
              <PlanRow dot="#818cf8" title="Diseñar propuesta" tag="🔥 a las 10h" tagColor="#6b6b74" />
              <PlanRow dot="#52525b" title="Ordenar inbox" tag="🌙 a las 16h" tagColor="#6b6b74" />
            </div>
            <h3 className="mb-2 font-display text-xl font-bold text-[#f4f4f5]">Kino arma tu plan</h3>
            <p className="text-[15px] text-[#a1a1aa]">
              Urgencia + prioridad + tu energía por hora. Entre 3 y 7 tareas — lo difícil en tu
              pico, lo liviano en tus valles.
            </p>
          </div>

          <div className={`${cardSurface} p-[26px]`}>
            <p className="mb-[18px] font-jetbrains text-[13px] font-semibold text-[#818cf8]">03</p>
            <div className="mb-[22px] flex items-center gap-3.5">
              <div
                className="flex h-[58px] w-[58px] flex-none items-center justify-center rounded-full"
                style={{ background: "conic-gradient(#3ecf72 68%, rgba(255,255,255,0.08) 0)" }}
              >
                <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#18181c] font-jetbrains text-xs font-semibold text-[#f4f4f5]">
                  17:00
                </div>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#e4e4e7]">Pomodoro · 25 min</p>
                <p className="mt-0.5 font-jetbrains text-[11px] text-[#6b6b74]">
                  al terminar: ¿cómo fue tu energía?
                </p>
              </div>
            </div>
            <h3 className="mb-2 font-display text-xl font-bold text-[#f4f4f5]">
              Enfócate y cierra el ciclo
            </h3>
            <p className="text-[15px] text-[#a1a1aa]">
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
    <div className="flex items-center gap-[9px] rounded-[10px] border border-white/[0.07] bg-white/[0.04] px-[11px] py-[7px]">
      <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: dot }} />
      <span className="flex-1 text-[12.5px] text-[#d4d4d8]">{title}</span>
      <span className="font-jetbrains text-[10px]" style={{ color: tagColor }}>
        {tag}
      </span>
    </div>
  );
}
