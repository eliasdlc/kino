"use client";

import Link from "next/link";
import { FileText, ImageIcon, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarginRow } from "@/components/ui/margin-row";
import { Skeleton } from "@/components/ui/skeleton";
import { AudioWave } from "@/features/captures/AudioWave";
import type { RegistroCompartido } from "@/features/captures/shareTarget";

interface CompartirScreenProps {
  /** Lo que acaba de llegar, o nada mientras se busca en la cola. */
  registro: RegistroCompartido | null;
  /** La URL local del archivo, cuando lo hay. La crea quien tiene el blob. */
  previewUrl: string | null;
  /** Si el recibo no apareció en la cola. */
  perdido?: boolean;
  /**
   * Por qué no se pudo guardar en Kino, cuando no fue la red. Sin esto la
   * pantalla decía "sale solo cuando vuelva la red" ante un archivo rechazado,
   * que es prometer algo que no iba a pasar.
   */
  problema?: string | null;
  /**
   * Dentro de otra página (el catálogo) el recibo no es la página: va en un
   * div y su título es un h2, para no meter un segundo `main` ni un segundo h1.
   */
  incrustada?: boolean;
}

/**
 * Dónde quedó lo compartido, en una línea. Nunca se archiva en silencio, y
 * tampoco se promete que salga solo cuando no va a salir.
 */
function donde(registro: RegistroCompartido, problema: string | null): string {
  if (registro.estado === "subida") return "Está en Bandeja, sin confirmar.";
  if (problema) return problema;
  return "Guardado en el teléfono. Sale solo cuando vuelva la red.";
}

/** La columna del recibo con el área segura, la misma dentro y fuera del catálogo. */
const COLUMNA =
  "mx-auto flex w-full max-w-md flex-col gap-6 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]";

/** Como página: papel a toda la altura visible, con las salidas abajo. */
const PAGINA = `${COLUMNA} min-h-dvh`;

/** Dentro de otra página mide lo que dice: un alto fijo dejaba un hueco bajo una frase. */
const INCRUSTADA = COLUMNA;

/** El título y la línea de dónde quedó, en la voz como en las demás puertas. */
function Encabezado({ titulo, linea, Titular }: { titulo: string; linea: string; Titular: "h1" | "h2" }) {
  return (
    <header className="space-y-2">
      <Titular className="font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.03em]">{titulo}</Titular>
      <p className="font-voice text-[1.06rem] italic leading-snug text-body">{linea}</p>
    </header>
  );
}

/**
 * Las dos salidas, abajo, donde llega el pulgar. La segunda va a Hoy y lo
 * dice: antes se llamaba "Compartir otra cosa" y llevaba a Hoy, que no abre
 * nada para compartir (compartir se hace desde la otra app).
 */
function Salidas() {
  return (
    <div className="mt-auto space-y-2">
      <Button asChild size="lg" className="w-full text-base">
        <Link href="/bandeja">Abrir Bandeja</Link>
      </Button>
      <Button asChild size="lg" variant="secondary" className="w-full text-base">
        <Link href="/dashboard">Ir a Hoy</Link>
      </Button>
    </div>
  );
}

/** La vista previa de lo compartido, por tipo. */
function Contenido({ registro, previewUrl }: { registro: RegistroCompartido; previewUrl: string | null }) {
  if (registro.kind === "photo") {
    return (
      <div className="space-y-2">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- un blob local no pasa por el optimizador
          <img
            src={previewUrl}
            alt={registro.name ?? "Lo que compartiste"}
            className="max-h-64 w-full rounded-xl object-cover"
          />
        ) : (
          <div className="grid h-40 w-full place-items-center rounded-xl bg-secondary text-muted-foreground">
            <ImageIcon className="size-8" aria-hidden />
          </div>
        )}
        <MarginRow margin={<ImageIcon className="mt-2 size-5" aria-hidden />}>
          <span className="block truncate font-medium">{registro.name ?? "Foto"}</span>
        </MarginRow>
      </div>
    );
  }

  if (registro.kind === "voice") {
    return previewUrl ? (
      <AudioWave src={previewUrl} segundos={null} />
    ) : (
      <p className="text-sm font-medium">{registro.name ?? "Nota de voz"}</p>
    );
  }

  if (registro.kind === "link") {
    return (
      <MarginRow margin={<Link2 className="mt-2 size-5" aria-hidden />}>
        <span className="block truncate font-medium">{registro.url}</span>
      </MarginRow>
    );
  }

  return (
    <MarginRow margin={<FileText className="mt-2 size-5" aria-hidden />}>
      <span className="block whitespace-pre-wrap break-words font-voice text-[1.06rem] leading-relaxed text-foreground">
        {registro.text}
      </span>
    </MarginRow>
  );
}

/**
 * El recibo de lo que acabas de compartir: qué llegó, dónde quedó, y dos
 * salidas. El triaje no ocurre aquí, ocurre en Bandeja, que es donde ya se
 * triajea: esta pantalla se abre con el teléfono en la mano y con prisa.
 *
 * Vive fuera del grupo de la app a propósito. El layout de la app monta once
 * piezas globales antes de pintar nada y resuelve la sesión con un redirect, que
 * es la misma trampa del POST por otro camino.
 */
export function CompartirScreen({ registro, previewUrl, perdido, problema = null, incrustada = false }: CompartirScreenProps) {
  const Pagina = incrustada ? "div" : "main";
  const Titular = incrustada ? "h2" : "h1";
  const pagina = incrustada ? INCRUSTADA : PAGINA;

  if (perdido) {
    return (
      <Pagina className={pagina}>
        <Encabezado
          Titular={Titular}
          titulo="No encontramos esto"
          linea="Si lo compartiste hace un momento, sigue en la cola del teléfono y aparecerá en Bandeja."
        />
        <Salidas />
      </Pagina>
    );
  }

  if (!registro) {
    return (
      <Pagina aria-busy className={pagina}>
        <div className="space-y-2">
          <Skeleton className="h-[2.1rem] w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="mt-auto space-y-2">
          <Skeleton className="h-[3.2rem] w-full rounded-full" />
          <Skeleton className="h-[3.2rem] w-full rounded-full" />
        </div>
      </Pagina>
    );
  }

  return (
    <Pagina className={pagina}>
      <Encabezado Titular={Titular} titulo={problema ? "No se pudo guardar" : "Guardado"} linea={donde(registro, problema)} />
      <section aria-label="Lo que compartiste">
        <Contenido registro={registro} previewUrl={previewUrl} />
      </section>
      <Salidas />
    </Pagina>
  );
}

/**
 * El único error del producto que puede prometer algo: lo compartido ya está
 * guardado en el teléfono antes de que esta pantalla exista, así que se dice
 * dónde quedó en vez de mandar a la pantalla de error de la app. Lo pinta
 * `compartir/error.tsx`; vive aquí para que el catálogo lo enseñe igual.
 */
export function CompartirFallo({ onReintentar, incrustada = false }: { onReintentar: () => void; incrustada?: boolean }) {
  const Pagina = incrustada ? "div" : "main";
  return (
    <Pagina className={incrustada ? INCRUSTADA : PAGINA}>
      <Encabezado
        Titular={incrustada ? "h2" : "h1"}
        titulo="No se pudo abrir"
        linea="Lo que compartiste sigue guardado en el teléfono y aparecerá en Bandeja. No se perdió."
      />
      <div className="mt-auto space-y-2">
        <Button size="lg" onClick={onReintentar} className="w-full text-base">
          Reintentar
        </Button>
        <Button asChild size="lg" variant="secondary" className="w-full text-base">
          <Link href="/bandeja">Abrir Bandeja</Link>
        </Button>
      </div>
    </Pagina>
  );
}
