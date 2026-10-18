import { Share2, WifiOff } from "lucide-react";
import { MarginRow } from "@/components/ui/margin-row";
import { Reintentar } from "@/features/offline/Reintentar";
import { SectionHead } from "@/features/dashboard/SectionHead";

export const metadata = { title: "Sin conexión, Kino" };

/**
 * Lo que el service worker sirve cuando una pantalla no carga sin red. Dice
 * qué pasó, qué sí funciona sin red (lo que compartes se guarda en el teléfono
 * y sube solo) y ofrece un reintento real, abajo, donde llega el pulgar.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 bg-background pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] text-foreground">
      <p className="font-display text-lg font-bold tracking-[-0.02em]">Kino</p>
      <header className="space-y-2">
        <h1 className="font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.03em]">Sin conexión</h1>
        <p className="font-voice text-[1.06rem] italic leading-snug text-body">
          Esta pantalla necesita la red. Tu día sigue donde lo dejaste.
        </p>
      </header>

      <section aria-labelledby="offline-si">
        <SectionHead id="offline-si" title="Sin red sí puedes" />
        <MarginRow margin={<Share2 className="mt-2 size-5" aria-hidden />}>
          <span className="block font-semibold">Compartir hacia Kino</span>
          <span className="block text-sm text-muted-foreground">Se guarda en el teléfono y sube solo a Bandeja cuando vuelva la red.</span>
        </MarginRow>
        <MarginRow margin={<WifiOff className="mt-2 size-5" aria-hidden />}>
          <span className="block font-semibold">Seguir en lo que ya tenías abierto</span>
          <span className="block text-sm text-muted-foreground">Lo que guardes se manda en cuanto haya conexión.</span>
        </MarginRow>
      </section>

      <div className="mt-auto">
        <Reintentar />
      </div>
    </main>
  );
}
