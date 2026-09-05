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
    <nav className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#0e0e11]/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-[1120px] flex-wrap items-center gap-4 px-6 py-2.5">
        <Link href="/" className="flex items-center">
          <KinoMark size={28} glow={variant === "landing"} />
        </Link>

        {variant === "docs" && (
          <span className="rounded-md border border-white/10 px-2 py-0.5 font-jetbrains text-xs text-[#52525b]">
            docs
          </span>
        )}

        {segment && (
          <span className="rounded-md border border-[#818cf8]/25 bg-[#818cf8]/[0.10] px-2 py-0.5 font-jetbrains text-xs text-[#a5b4fc]">
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
                className="text-sm font-medium text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]"
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
              className="text-sm font-medium text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]"
            >
              ← Inicio
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
