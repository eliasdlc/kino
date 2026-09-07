import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KinoMark } from "@/features/marketing/KinoMark";

/**
 * Entrar y registrarse van sobre el fondo del producto y siguen el tema del
 * dispositivo, como cualquier otra pantalla: las de Clerk leen los tokens.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between px-5 py-4 md:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Kino, volver al inicio">
          <KinoMark size={26} wordmarkSize={18} />
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-12">
        <div className="w-[min(100%,420px)]">{children}</div>
      </div>
    </div>
  );
}
