import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { KinoMark } from "./KinoMark";
import { btnPrimary, btnGhost } from "./styles";
import { getSegment, segmentRegisterHref } from "./segments/segments.manifest";

const LANDING_LINKS = [
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#sistemas", label: "Sistemas" },
  { href: "/docs", label: "Docs" },
];

/**
 * Barra superior del sitio público. Detecta sesión en el server para mostrar
 * "Ir al panel" a los usuarios logueados en vez de Entrar/Crear cuenta.
 *
 * `segment` es la variante de las landings por arquetipo: en vez de los anclas
 * de la home (que allí no existen) muestra el nombre del segmento y la vuelta
 * al sitio completo.
 */
export async function MarketingNav({
  variant = "landing",
  segmentSlug,
}: {
  variant?: "landing" | "docs" | "segment";
  /** Slug de la landing por arquetipo, sólo en `variant="segment"`. */
  segmentSlug?: string;
}) {
  const { userId } = await auth();
  const session = userId !== null;
  const appHref = session ? "/dashboard" : "/login";
  const segment = segmentSlug ? getSegment(segmentSlug) : null;
  // Desde una landing por segmento, "Crear cuenta" no puede perder el segmento:
  // es el mismo embudo que el CTA del hero.
  const registerHref = segment ? segmentRegisterHref(segment) : "/register";

  return (
    <nav className="sticky top-0 z-(--z-modal) border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-[1120px] items-center gap-3 px-5 py-2.5 md:px-6">
        <Link href="/" className="flex items-center">
          <KinoMark size={28} glow={variant === "landing"} />
        </Link>

        {variant === "docs" && (
          <span className="hidden rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground sm:inline-flex">
            docs
          </span>
        )}

        {segment && (
          <span className="hidden rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary sm:inline-flex">
            para {segment.navLabel.toLowerCase()}
          </span>
        )}

        <div className="flex-1" />

        {variant === "landing" && (
          <div className="hidden items-center gap-6 md:flex">
            {LANDING_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}

        <div className="flex flex-none items-center gap-2.5">
          {variant !== "landing" && (
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Inicio
            </Link>
          )}

          {session ? (
            <Link href="/dashboard" className={`${btnPrimary} px-4 py-2 text-sm`}>
              Ir al panel
            </Link>
          ) : variant === "docs" ? (
            <Link href={appHref} className={`${btnPrimary} px-4 py-2 text-sm`}>
              Abrir Kino
            </Link>
          ) : (
            <>
              <Link href="/login" className={`${btnGhost} px-3.5 py-2 text-sm`}>
                Entrar
              </Link>
              <Link href={registerHref} className={`${btnPrimary} px-4 py-2 text-sm`}>
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
