import { CompartirPantalla } from "./CompartirPantalla";

export const metadata = { title: "Guardado en Kino" };

/**
 * El destino de compartir. Lo que llegó no viene del servidor: lo guardó el
 * service worker en la cola local antes de que esta ruta existiera, así que la
 * pantalla lo busca en el navegador por su recibo.
 */
export default async function CompartirPage({
  searchParams,
}: {
  searchParams: Promise<{ recibo?: string; fallo?: string }>;
}) {
  const { recibo, fallo } = await searchParams;
  return <CompartirPantalla recibo={recibo ?? null} fallo={fallo === "1"} />;
}
