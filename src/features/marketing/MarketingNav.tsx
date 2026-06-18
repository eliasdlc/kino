import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { KinoMark } from "./KinoMark";
import { btnPrimary, btnGhost } from "./styles";

const LANDING_LINKS = [
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#sistemas", label: "Sistemas" },
  { href: "/docs", label: "Docs" },
];

/**
 * Barra superior del sitio público. Detecta sesión en el server para mostrar
 * "Ir al panel" a los usuarios logueados en vez de Entrar/Crear cuenta.
 */
export async function MarketingNav({
  variant = "landing",
}: {
  variant?: "landing" | "docs";
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const appHref = session ? "/dashboard" : "/login";

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
          {variant === "docs" && (
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
              <Link href="/register" className={`${btnPrimary} px-4 py-2 text-sm`}>
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
