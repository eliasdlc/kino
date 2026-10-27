import Link from "next/link";
import { Button } from "@/components/ui/button";

// 404 amable en vez de la pantalla cruda de Next, con la misma gramática que
// `PageError`: título en display, la frase en la voz y una sola acción. Cubre
// rutas inexistentes y cualquier notFound() sin un not-found propio más cercano.
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-10 md:px-8 md:py-16">
      <div className="space-y-2">
        <h1 className="font-display text-[1.9rem] leading-[1.05] font-bold tracking-[-0.025em]">Esta página no está</h1>
        <p className="font-voice text-base italic leading-snug text-body">
          Puede que el enlace esté roto o que lo que buscas ya no exista.
        </p>
      </div>
      <Button size="lg" asChild className="sm:w-fit sm:min-w-40">
        <Link href="/dashboard">Ir a Hoy</Link>
      </Button>
    </div>
  );
}
