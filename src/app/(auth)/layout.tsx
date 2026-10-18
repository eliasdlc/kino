import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Entrar y registrarse van sobre el papel del producto y siguen el tema del
 * dispositivo, como cualquier otra pantalla: las de Clerk leen los tokens.
 * La columna empieza arriba y no centrada: al abrir el teclado el campo activo
 * no salta, y `dvh` mide la ventana que de verdad se ve en el teléfono. La
 * marca es la de la cabecera de la app, la palabra en Bricolage sin tile: la
 * puerta es la primera pantalla del producto, no de la landing.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex items-center justify-between pt-[env(safe-area-inset-top)] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))] md:px-6">
        <Link
          href="/"
          className="focus-ring inline-flex h-[2.85rem] items-center rounded-md px-2 font-display text-lg font-bold tracking-[-0.02em] text-foreground"
          aria-label="Kino, volver al inicio"
        >
          Kino
        </Link>
        <Link
          href="/"
          className="focus-ring inline-flex h-[2.85rem] items-center gap-0.5 rounded-md px-2 text-base font-semibold text-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) hover:text-primary"
        >
          <ChevronLeft className="size-5 stroke-[2.2] text-muted-foreground" aria-hidden />
          Inicio
        </Link>
      </div>

      <div className="flex flex-1 justify-center px-5 pt-6 pb-[max(3rem,env(safe-area-inset-bottom))] md:items-center md:pt-0">
        <div className="w-[min(100%,26rem)]">{children}</div>
      </div>
    </div>
  );
}
