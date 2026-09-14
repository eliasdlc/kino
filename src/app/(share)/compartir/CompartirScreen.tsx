"use client";

import Link from "next/link";
import { FileText, ImageIcon, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function Encabezado({ titulo, linea }: { titulo: string; linea: string }) {
  return (
    <header className="space-y-1">
      <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">{titulo}</h1>
      <p className="text-sm text-muted-foreground">{linea}</p>
    </header>
  );
}

function Salidas() {
  return (
    <div className="space-y-2">
      <Button asChild className="h-12 w-full rounded-full text-base">
        <Link href="/bandeja">Abrir Bandeja</Link>
      </Button>
      <Button asChild variant="secondary" className="h-12 w-full rounded-full text-base">
        <Link href="/dashboard">Compartir otra cosa</Link>
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
            className="max-h-64 w-full rounded-2xl object-cover"
          />
        ) : (
          <div className="grid h-40 w-full place-items-center rounded-2xl bg-secondary text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        )}
        <p className="truncate text-sm font-medium">{registro.name ?? "Foto"}</p>
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
      <div className="flex items-center gap-3">
        <Link2 className="size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{registro.url}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">{registro.text}</p>
    </div>
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
export function CompartirScreen({ registro, previewUrl, perdido, problema = null }: CompartirScreenProps) {
  if (perdido) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 p-5">
        <Encabezado
          titulo="No encontramos esto"
          linea="Si lo compartiste hace un momento, sigue en la cola del teléfono y aparecerá en Bandeja."
        />
        <Salidas />
      </main>
    );
  }

  if (!registro) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 p-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 p-5">
      <Encabezado titulo={problema ? "No se pudo guardar" : "Guardado"} linea={donde(registro, problema)} />
      <section className="rounded-2xl border border-border bg-card p-4">
        <Contenido registro={registro} previewUrl={previewUrl} />
      </section>
      <Salidas />
    </main>
  );
}
