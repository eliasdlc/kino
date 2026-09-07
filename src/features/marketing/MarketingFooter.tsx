import Link from "next/link";
import { KinoMark } from "./KinoMark";
import { LANDING_SEGMENTS } from "./segments/segments.manifest";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      {/* Las landings por arquetipo cuelgan de aquí en todas las páginas del
          sitio: es su enlace interno permanente, lo que las hace descubribles
          por un lector y rastreables por un buscador. */}
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-border px-6 py-6">
        <span className="font-jetbrains text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Kino para ti
        </span>
        <div className="flex flex-wrap items-center gap-[18px]">
          {LANDING_SEGMENTS.map((s) => (
            <Link
              key={s.slug}
              href={`/para/${s.slug}`}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {s.navLabel}
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-5 px-6 py-9">
        <KinoMark size={22} wordmarkSize={16} />
        <span className="text-[13px] text-muted-foreground">
          Productividad basada en energía
        </span>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-[18px]">
          <Link
            href="/docs"
            className="text-[13px] text-muted-foreground transition-colors hover:text-muted-foreground"
          >
            Docs
          </Link>
          <Link
            href="/login"
            className="text-[13px] text-muted-foreground transition-colors hover:text-muted-foreground"
          >
            Entrar
          </Link>
          <a
            href="https://github.com/eliasdlc/kino"
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-muted-foreground transition-colors hover:text-muted-foreground"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
