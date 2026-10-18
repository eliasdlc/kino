import { Suspense } from "react";
import { PuertaEsperando } from "@/features/auth/Puerta";
import { PUERTA_CREAR } from "@/features/auth/puertas.copy";
import { RegisterPage } from "@/features/auth/RegisterPage";

export const metadata = { title: "Crear cuenta, Kino" };

export default function Page() {
  return (
    <Suspense fallback={<PuertaEsperando {...PUERTA_CREAR} />}>
      <RegisterPage />
    </Suspense>
  );
}
