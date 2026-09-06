import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { KinoMark } from "../KinoMark";
import { btnPrimary, btnGhost, cardSurface, eyebrow } from "../styles";
import { SegmentHeroViz } from "./SegmentHeroViz";
import { otherSegments, segmentRegisterHref, type LandingSegment } from "./segments.manifest";

/**
 * Secciones de una landing por segmento. Todas leen del manifiesto: ninguna
 * decide nada por slug salvo la maqueta del hero. Reutilizan los tokens de la
 * identidad dark del route group `(marketing)`: mismo índigo, misma superficie
 * de tarjeta, mismo eyebrow monoespaciado que la landing genérica.
 */

const sectionShell = "border-t border-white/[0.06]";
const sectionInner = "mx-auto max-w-[1120px] px-6 py-[88px]";
const h2 =
  "font-display text-[clamp(30px,4vw,44px)] font-bold tracking-[-0.025em] text-[#f4f4f5]";

export function SegmentHero({ segment }: { segment: LandingSegment }) {
  return (
    <header className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-[180px] left-1/2 -translate-x-1/2">
        <div
          className="h-[420px] w-[760px] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.18),transparent_70%)]"
          style={{ animation: "energy-breathe 5s ease-in-out infinite" }}
        />
      </div>

      <div className="relative mx-auto flex max-w-[1120px] flex-wrap items-center gap-14 px-6 pb-24 pt-[88px]">
        <div className="min-w-[min(100%,420px)] shrink grow basis-[460px]">
          <p className={`mb-5 flex items-center gap-2 ${eyebrow}`}>
            <segment.icon className="h-4 w-4" aria-hidden />
            {segment.eyebrow}
          </p>
          <h1 className="mb-6 text-balance font-display text-[clamp(40px,5.2vw,64px)] font-extrabold leading-[1.04] tracking-[-0.03em] text-[#f4f4f5]">
            {segment.headline.lead}{" "}
            <span className="text-[#818cf8]">{segment.headline.accent}</span>{" "}
            {segment.headline.tail}
          </h1>
          <p className="mb-9 max-w-[520px] text-pretty text-[18px] leading-[1.65] text-[#a1a1aa]">
            {segment.subheadline}
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <Link
              href={segmentRegisterHref(segment)}
              className={`${btnPrimary} px-[26px] py-3.5 text-base shadow-[0_8px_32px_rgba(99,102,241,0.35)]`}
            >
              {segment.heroCta}
            </Link>
            <a href="#lo-que-hace" className={`${btnGhost} px-[22px] py-3.5 text-base`}>
              Ver qué hace
            </a>
          </div>
          <p className="mt-5 font-jetbrains text-[11.5px] text-[#52525b]">
            gratis · sin tarjeta · dos minutos de configuración
          </p>
        </div>

        <div
          className="min-w-[min(100%,360px)] shrink grow-0 basis-[440px]"
          style={{ animation: "hero-float 6s ease-in-out infinite" }}
        >
          <SegmentHeroViz slug={segment.slug} />
        </div>
      </div>
    </header>
  );
}

export function SegmentPains({ segment }: { segment: LandingSegment }) {
  return (
    <section className={sectionShell}>
      <div className={sectionInner}>
        <p className={`mb-3.5 ${eyebrow}`}>El problema</p>
        <h2 className={`mb-4 ${h2}`}>{segment.painsTitle}</h2>
        <p className="mb-12 max-w-[620px] text-[17px] text-[#a1a1aa]">{segment.painsLead}</p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[18px]">
          {segment.pains.map((pain, i) => (
            <div key={pain.title} className={`${cardSurface} p-[26px]`}>
              <p className="mb-4 font-jetbrains text-[13px] font-semibold text-[#818cf8]">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mb-2.5 font-display text-[19px] font-bold leading-snug text-[#f4f4f5]">
                {pain.title}
              </h3>
              <p className="text-[15px] leading-[1.6] text-[#a1a1aa]">{pain.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SegmentFeatures({ segment }: { segment: LandingSegment }) {
  return (
    <section id="lo-que-hace" className={`scroll-mt-20 ${sectionShell}`}>
      <div className={sectionInner}>
        <p className={`mb-3.5 ${eyebrow}`}>Lo que hace Kino</p>
        <h2 className={`mb-4 ${h2}`}>{segment.featuresTitle}</h2>
        <p className="mb-12 max-w-[620px] text-[17px] text-[#a1a1aa]">{segment.featuresLead}</p>

        {/* Dos columnas fijas: las tarjetas de feature llevan más texto que las
            del problema y en tres columnas la última fila queda huérfana. */}
        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
          {segment.features.map((f) => (
            <div key={f.title} className={`${cardSurface} flex flex-col gap-3 p-[26px]`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#818cf8]/20 bg-[#818cf8]/[0.10]">
                <f.icon className="h-[18px] w-[18px] text-[#a5b4fc]" aria-hidden />
              </span>
              <h3 className="font-display text-[19px] font-bold text-[#f4f4f5]">{f.title}</h3>
              <p className="flex-1 text-[15px] leading-[1.6] text-[#a1a1aa]">{f.body}</p>
              <p className="border-t border-white/[0.06] pt-3 font-jetbrains text-[11px] text-[#52525b]">
                {f.proof}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * El cierre común a las tres landings: lo que ningún competidor del segmento
 * hace. Dicho con el vocabulario del arquetipo, pero es la misma promesa.
 */
export function SegmentEnergy({ segment }: { segment: LandingSegment }) {
  return (
    <section className={`relative overflow-hidden ${sectionShell}`}>
      <div className="pointer-events-none absolute -bottom-[120px] right-[8%] h-[320px] w-[500px] bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.07),transparent_70%)]" />
      <div className="relative mx-auto max-w-[1120px] px-6 py-[88px]">
        <div className={`${cardSurface} flex flex-wrap items-center gap-10 p-[38px]`}>
          <div className="min-w-[min(100%,320px)] flex-1">
            <p className={`mb-3.5 ${eyebrow}`}>El diferenciador</p>
            <h2 className="mb-4 font-display text-[clamp(26px,3.2vw,36px)] font-bold tracking-[-0.02em] text-[#f4f4f5]">
              {segment.energyTitle}
            </h2>
            <p className="max-w-[560px] text-[16.5px] leading-[1.65] text-[#a1a1aa]">
              {segment.energyBody}
            </p>
            <Link
              href="/#como-funciona"
              className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#a5b4fc] transition-colors hover:text-[#c7d2fe]"
            >
              Cómo aprende tu curva
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="min-w-[min(100%,260px)] flex-none basis-[300px]">
            <EnergyCurveMini />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Curva de energía en miniatura: la misma forma que dibuja la landing genérica. */
function EnergyCurveMini() {
  const bars = Array.from({ length: 18 }, (_, i) => {
    const h = 6 + i;
    const morning = 62 * Math.exp(-Math.pow((h - 10.5) / 2.8, 2));
    const evening = 48 * Math.exp(-Math.pow((h - 17.5) / 2.6, 2));
    const pct = Math.max(8, Math.min(100, Math.round(14 + morning + evening)));
    return { pct, peak: pct > 62 };
  });

  return (
    <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="mb-3 font-jetbrains text-[10px] uppercase tracking-[0.1em] text-[#6b6b74]">
        Tu curva real
      </p>
      <div className="flex h-[86px] items-end gap-[3px]">
        {bars.map((b, i) => (
          <div
            key={i}
            className="min-h-1 flex-1 rounded-t-[3px]"
            style={{
              height: `${b.pct}%`,
              background: b.peak ? "#818cf8" : "rgba(129,140,248,0.22)",
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-jetbrains text-[9.5px] text-[#52525b]">
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
      <p className="mt-3 border-t border-white/[0.06] pt-3 text-[12.5px] text-[#a1a1aa]">
        Se construye con tres check-ins al día. En ~2 semanas converge con tu realidad.
      </p>
    </div>
  );
}

export function SegmentCta({ segment }: { segment: LandingSegment }) {
  return (
    <section className={`relative overflow-hidden ${sectionShell}`}>
      <div className="pointer-events-none absolute -bottom-[200px] left-1/2 h-[380px] w-[700px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.18),transparent_70%)]" />
      <div className="relative mx-auto max-w-[760px] px-6 py-[100px] text-center">
        <span className="mx-auto mb-[26px] flex w-fit">
          <KinoMark size={52} glow withWordmark={false} />
        </span>
        <h2 className="mb-4 text-balance font-display text-[clamp(30px,4.2vw,48px)] font-extrabold tracking-[-0.03em] text-[#f4f4f5]">
          {segment.closingTitle}
        </h2>
        <p className="mb-9 text-pretty text-[17px] leading-[1.65] text-[#a1a1aa]">
          {segment.closingBody}
        </p>
        <Link
          href={segmentRegisterHref(segment)}
          className={`${btnPrimary} px-8 py-[15px] text-[17px] shadow-[0_8px_32px_rgba(99,102,241,0.35)]`}
        >
          {segment.ctaLabel}
        </Link>
      </div>
    </section>
  );
}

/**
 * Puente entre landings. Que alguien llegue a la equivocada es lo normal: aquí
 * se corrige sin volver al inicio, y de paso las tres rutas quedan enlazadas
 * entre sí para que se descubran solas.
 */
export function SegmentSwitch({ segment }: { segment: LandingSegment }) {
  const others = otherSegments(segment.slug);
  return (
    <section className={sectionShell}>
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-8 gap-y-4 px-6 py-12">
        <p className="text-[15px] text-[#6b6b74]">
          ¿No eres {segment.audience}? Kino también viene en tu idioma:
        </p>
        <div className="flex flex-wrap gap-2.5">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/para/${o.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] font-medium text-[#d4d4d8] transition-colors hover:border-white/30 hover:text-[#f4f4f5]"
            >
              <o.icon className="h-4 w-4 text-[#818cf8]" aria-hidden />
              {o.navLabel}
            </Link>
          ))}
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] font-medium text-[#d4d4d8] transition-colors hover:border-white/30 hover:text-[#f4f4f5]"
          >
            Ver Kino completo
          </Link>
        </div>
      </div>
    </section>
  );
}
