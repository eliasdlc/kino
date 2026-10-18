import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { KinoMark } from "@/features/marketing/KinoMark";

/**
 * Entrar y registrarse van sobre el papel del producto y siguen el tema del
 * dispositivo, como cualquier otra pantalla: las de Clerk leen los tokens.
 * La columna empieza arriba y no centrada: al abrir el teclado el campo activo
 * no salta, y `dvh` mide la ventana que de verdad se ve en el teléfono.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex items-center justify-between pt-[env(safe-area-inset-top)] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] md:px-8">
        <Link
          href="/"
          className="focus-ring inline-flex h-[2.85rem] items-center gap-2.5 rounded-md"
          aria-label="Kino, volver al inicio"
        >
          <KinoMark size={26} wordmarkSize={18} />
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
