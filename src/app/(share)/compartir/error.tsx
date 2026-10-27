"use client";

import { CompartirFallo } from "./CompartirScreen";

/** El error de compartir dice dónde quedó lo compartido: ver `CompartirFallo`. */
export default function CompartirError({ reset }: { error: Error; reset: () => void }) {
  return <CompartirFallo onReintentar={reset} />;
}
