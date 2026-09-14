"use client";

import { useEffect, useState } from "react";
import {
  borrarDeCola,
  leerCola,
  pedirAlmacenamientoPersistente,
  type RegistroCompartido,
} from "@/features/captures/shareTarget";
import { useCreateCapture } from "@/features/captures/captures.hooks";
import { FalloAlSubir, HERRAMIENTAS, prepararCaptura } from "@/features/captures/subirCaptura";
import { CompartirScreen } from "./CompartirScreen";

/**
 * Saca de la cola local lo que el worker acaba de guardar y pide que el
 * navegador no lo desaloje. El archivo espera aquí hasta que haya red, y si el
 * disco aprieta es lo primero que el navegador tiraría: sin el permiso
 * persistente desaparecería en silencio, que es justo lo que no puede pasar.
 */
export function CompartirPantalla({ recibo, fallo }: { recibo: string | null; fallo: boolean }) {
  const [registro, setRegistro] = useState<RegistroCompartido | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fueraDeLaCola, setFueraDeLaCola] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const { mutateAsync: crearCaptura } = useCreateCapture();

  // Sin recibo no hay nada que buscar, así que eso se deriva y no se guarda:
  // el único estado real es si la cola no lo tenía.
  const perdido = fallo || !recibo || fueraDeLaCola;

  useEffect(() => {
    if (fallo || !recibo) return;

    let url: string | null = null;
    let vivo = true;

    void (async () => {
      void pedirAlmacenamientoPersistente();
      const cola = await leerCola();
      const encontrado = cola.find((candidato) => candidato.id === recibo) ?? null;
      if (!vivo) return;
      if (!encontrado) {
        setFueraDeLaCola(true);
        return;
      }
      if (encontrado.blob) {
        url = URL.createObjectURL(encontrado.blob);
        setPreviewUrl(url);
      }
      setRegistro(encontrado);

      // Con red sube sola y sale de la cola. Sin red se queda donde está y la
      // pantalla ya lo dice: nada se pierde y nada promete lo que no puede.
      try {
        await crearCaptura(await prepararCaptura(encontrado, HERRAMIENTAS));
        if (!vivo) return;
        await borrarDeCola(encontrado.id);
        setRegistro({ ...encontrado, estado: "subida" });
      } catch (error) {
        if (!vivo) return;
        // Sin red se queda en la cola y sale sola. Por cualquier otro motivo no
        // va a salir, y la pantalla tiene que decirlo en vez de prometerlo.
        const esRed = error instanceof FalloAlSubir && error.motivo === "sin-red";
        if (!esRed) {
          const razon = error instanceof FalloAlSubir ? error.message : "No se pudo guardar en Kino.";
          setProblema(`${razon} Sigue en el teléfono, no se perdió.`);
        }
      }
    })();

    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [recibo, fallo, crearCaptura]);

  return <CompartirScreen registro={registro} previewUrl={previewUrl} perdido={perdido} problema={problema} />;
}
