"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { BARRAS, duracionLegible, picosDe } from "./audio-peaks";

interface AudioWaveProps {
  /** El audio compartido, tal cual llegó. */
  src: string;
  /** Lo que el registro sabía de antemano, para no esperar a los metadatos. */
  segundos?: number | null;
  className?: string;
}

/** Decodifica el audio para sacar su forma. Sin soporte, no hay onda. */
async function leerPicos(src: string): Promise<number[]> {
  const Contexto = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Contexto) return [];
  const contexto = new Contexto();
  try {
    const datos = await (await fetch(src)).arrayBuffer();
    const buffer = await contexto.decodeAudioData(datos);
    return picosDe(buffer.getChannelData(0));
  } catch {
    return [];
  } finally {
    void contexto.close();
  }
}

/**
 * Una nota de voz compartida: se reproduce de verdad, y la onda que la dibuja
 * es la del propio audio y hace de barra de progreso. Cuando el navegador no
 * puede decodificar, quedan el control y la duración y no se dibuja nada: una
 * onda que no responde sería un adorno con forma de control.
 */
export function AudioWave({ src, segundos, className }: AudioWaveProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [picos, setPicos] = useState<number[]>([]);
  const [sonando, setSonando] = useState(false);
  const [transcurrido, setTranscurrido] = useState(0);
  const [total, setTotal] = useState(segundos ?? 0);

  useEffect(() => {
    let vivo = true;
    void leerPicos(src).then((valores) => {
      if (vivo) setPicos(valores);
    });
    return () => {
      vivo = false;
    };
  }, [src]);

  const avance = total > 0 ? transcurrido / total : 0;

  function alternar() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={alternar}
        aria-label={sonando ? "Pausar la nota de voz" : "Reproducir la nota de voz"}
        className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-primary"
      >
        {sonando ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>

      {picos.length > 0 && (
        <div aria-hidden className="flex h-8 min-w-0 flex-1 items-center gap-[2px] overflow-hidden">
          {picos.map((pico, indice) => (
            <span
              key={indice}
              style={{ height: `${Math.max(8, pico * 100)}%` }}
              className={cn(
                "w-[3px] shrink-0 rounded-full",
                indice / BARRAS <= avance ? "bg-primary" : "bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      )}

      <span className="ml-auto shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
        {duracionLegible(sonando || transcurrido > 0 ? transcurrido : total)}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={() => {
          setSonando(false);
          setTranscurrido(0);
        }}
        onTimeUpdate={(e) => setTranscurrido(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const duracion = e.currentTarget.duration;
          if (Number.isFinite(duracion)) setTotal(duracion);
        }}
      />
    </div>
  );
}
