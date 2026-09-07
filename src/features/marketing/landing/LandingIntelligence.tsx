import { KinoMark } from "../KinoMark";
import { TimerDemo } from "../TimerDemo";
import { cardSurface, eyebrow } from "../styles";

const COACH_LINES = [
  "Son las 14h. Tu pico empieza en 2h: ahora toca lo liviano.",
  "Hiciste todo lo de hoy. Te queda energía media: ¿una más o descansamos?",
];

export function LandingIntelligence() {
  return (
    <section className="scroll-mt-20 border-t border-border bg-card">
      <div className="mx-auto max-w-[1120px] px-6 py-[88px]">
        <p className={`mb-3.5 ${eyebrow}`}>La inteligencia</p>
        <h2 className="mb-12 max-w-[640px] font-display text-[clamp(30px,4vw,44px)] font-bold tracking-[-0.025em] text-foreground">
          Un cerebro que decide por ti, para que tú solo hagas
        </h2>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[18px]">
          <div className={`${cardSurface} flex flex-col gap-2.5 p-[26px]`}>
            <h3 className="font-display text-[21px] font-bold text-foreground">
              Un plan, no una lista
            </h3>
            <p className="flex-1 text-[15px] text-muted-foreground">
              Nunca más mirar 40 tareas sin saber por dónde empezar. Kino te muestra{" "}
              <strong className="font-semibold text-foreground/85">una próxima acción clara</strong> y
              un plan corto que cabe en tu día.
            </p>
            <p className="mt-2 font-jetbrains text-xs text-muted-foreground">
              → adiós a la parálisis por decisión
            </p>
          </div>

          <div className={`${cardSurface} flex flex-col gap-2.5 p-[26px]`}>
            <h3 className="font-display text-[21px] font-bold text-foreground">
              Tu curva, aprendida
            </h3>
            <p className="flex-1 text-[15px] text-muted-foreground">
              Dices si eres alondra, búho o algo intermedio. A partir de ahí, check-ins de 2
              segundos y sesiones de foco afinan la predicción sola.
            </p>
            <p className="mt-2 font-jetbrains text-xs text-muted-foreground">
              → la curva se afina con cada check-in
            </p>
          </div>

          <div className={`${cardSurface} flex flex-col gap-3 p-[26px]`}>
            <h3 className="font-display text-[21px] font-bold text-foreground">
              Un coach, no un robot
            </h3>
            <div className="flex flex-col gap-2">
              {COACH_LINES.map((line) => (
                <div key={line} className="flex items-start gap-[9px]">
                  <span className="mt-0.5 flex-none">
                    <KinoMark size={20} withWordmark={false} />
                  </span>
                  <p className="rounded-[4px_12px_12px_12px] border border-primary/[0.16] bg-primary/[0.08] px-3 py-2 text-[13.5px] text-primary">
                    {line}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-1 font-jetbrains text-xs text-muted-foreground">
              → consejos contextuales, en tu idioma
            </p>
          </div>

          <div className={`${cardSurface} flex flex-col gap-3 p-[26px]`}>
            <h3 className="font-display text-[21px] font-bold text-foreground">
              Focus timer con propósito
            </h3>
            <TimerDemo />
            <p className="mt-1 font-jetbrains text-xs text-muted-foreground">
              → cada sesión enseña a Kino
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
