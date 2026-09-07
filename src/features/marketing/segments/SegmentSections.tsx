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

const sectionShell = "border-t border-border";
const sectionInner = "mx-auto max-w-[1120px] px-6 py-[88px]";
const h2 =
  "font-display text-[clamp(30px,4vw,44px)] font-bold tracking-[-0.025em] text-foreground";

export function SegmentHero({ segment }: { segment: LandingSegment }) {
  return (
    <header className="relative overflow-hidden">

      <div className="relative mx-auto flex max-w-[1120px] flex-wrap items-center gap-14 px-6 pb-24 pt-[88px]">
        <div className="min-w-[min(100%,420px)] shrink grow basis-[460px]">
          <p className={`mb-5 flex items-center gap-2 ${eyebrow}`}>
            <segment.icon className="h-4 w-4" aria-hidden />
            {segment.eyebrow}
          </p>
          <h1 className="mb-6 text-balance font-display text-[clamp(40px,5.2vw,64px)] font-extrabold leading-[1.04] tracking-[-0.03em] text-foreground">
            {segment.headline.lead}{" "}
            <span className="text-primary">{segment.headline.accent}</span>{" "}
            {segment.headline.tail}
          </h1>
          <p className="mb-9 max-w-[520px] text-pretty text-[18px] leading-[1.65] text-muted-foreground">
            {segment.subheadline}
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <Link
              href={segmentRegisterHref(segment)}
              className={`${btnPrimary} px-[26px] py-3.5 text-base shadow-[0_8px_32px_color-mix(in srgb, var(--ac) 35%, transparent)]`}
            >
              {segment.heroCta}
            </Link>
            <a href="#lo-que-hace" className={`${btnGhost} px-[22px] py-3.5 text-base`}>
              Ver qué hace
            </a>
          </div>
          <p className="mt-5 font-jetbrains text-[11.5px] text-muted-foreground">
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
        <p className="mb-12 max-w-[620px] text-[17px] text-muted-foreground">{segment.painsLead}</p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[18px]">
          {segment.pains.map((pain, i) => (
            <div key={pain.title} className={`${cardSurface} p-[26px]`}>
              <p className="mb-4 font-jetbrains text-[13px] font-semibold text-primary">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mb-2.5 font-display text-[19px] font-bold leading-snug text-foreground">
                {pain.title}
              </h3>
              <p className="text-[15px] leading-[1.6] text-muted-foreground">{pain.body}</p>
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
        <p className="mb-12 max-w-[620px] text-[17px] text-muted-foreground">{segment.featuresLead}</p>

        {/* Dos columnas fijas: las tarjetas de feature llevan más texto que las
            del problema y en tres columnas la última fila queda huérfana. */}
        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
          {segment.features.map((f) => (
            <div key={f.title} className={`${cardSurface} flex flex-col gap-3 p-[26px]`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-primary/20 bg-primary/[0.10]">
                <f.icon className="h-[18px] w-[18px] text-primary" aria-hidden />
              </span>
              <h3 className="font-display text-[19px] font-bold text-foreground">{f.title}</h3>
              <p className="flex-1 text-[15px] leading-[1.6] text-muted-foreground">{f.body}</p>
              <p className="border-t border-border pt-3 font-jetbrains text-[11px] text-muted-foreground">
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
      <div className="relative mx-auto max-w-[1120px] px-6 py-[88px]">
        <div className={`${cardSurface} flex flex-wrap items-center gap-10 p-[38px]`}>
          <div className="min-w-[min(100%,320px)] flex-1">
            <p className={`mb-3.5 ${eyebrow}`}>El diferenciador</p>
            <h2 className="mb-4 font-display text-[clamp(26px,3.2vw,36px)] font-bold tracking-[-0.02em] text-foreground">
              {segment.energyTitle}
            </h2>
            <p className="max-w-[560px] text-[16.5px] leading-[1.65] text-muted-foreground">
              {segment.energyBody}
            </p>
            <Link
              href="/#como-funciona"
              className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-primary transition-colors hover:text-primary"
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
    <div className="rounded-[14px] border border-border bg-foreground/10 p-4">
      <p className="mb-3 font-jetbrains text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        Tu curva real
      </p>
      <div className="flex h-[86px] items-end gap-[3px]">
        {bars.map((b, i) => (
          <div
            key={i}
            className="min-h-1 flex-1 rounded-t-[3px]"
            style={{
              height: `${b.pct}%`,
              background: b.peak ? "var(--ac)" : "color-mix(in srgb, var(--ac) 22%, transparent)",
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-jetbrains text-[9.5px] text-muted-foreground">
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
      <p className="mt-3 border-t border-border pt-3 text-[12.5px] text-muted-foreground">
        Se construye con tres check-ins al día. En ~2 semanas converge con tu realidad.
      </p>
    </div>
  );
}

export function SegmentCta({ segment }: { segment: LandingSegment }) {
  return (
    <section className={`relative overflow-hidden ${sectionShell}`}>
      <div className="relative mx-auto max-w-[760px] px-6 py-[100px] text-center">
        <span className="mx-auto mb-[26px] flex w-fit">
          <KinoMark size={52} glow withWordmark={false} />
        </span>
        <h2 className="mb-4 text-balance font-display text-[clamp(30px,4.2vw,48px)] font-extrabold tracking-[-0.03em] text-foreground">
          {segment.closingTitle}
        </h2>
        <p className="mb-9 text-pretty text-[17px] leading-[1.65] text-muted-foreground">
          {segment.closingBody}
        </p>
        <Link
          href={segmentRegisterHref(segment)}
          className={`${btnPrimary} px-8 py-[15px] text-[17px] shadow-[0_8px_32px_color-mix(in srgb, var(--ac) 35%, transparent)]`}
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
        <p className="text-[15px] text-muted-foreground">
          ¿No eres {segment.audience}? Kino también viene en tu idioma:
        </p>
        <div className="flex flex-wrap gap-2.5">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/para/${o.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[13.5px] font-medium text-foreground/80 transition-colors hover:border-border hover:text-foreground"
            >
              <o.icon className="h-4 w-4 text-primary" aria-hidden />
              {o.navLabel}
            </Link>
          ))}
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[13.5px] font-medium text-foreground/80 transition-colors hover:border-border hover:text-foreground"
          >
            Ver Kino completo
          </Link>
        </div>
      </div>
    </section>
  );
}
