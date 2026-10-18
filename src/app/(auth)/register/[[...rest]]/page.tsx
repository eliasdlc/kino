import { Suspense } from "react";
import { FormularioEsperando } from "@/features/auth/Puerta";
import { RegisterPage } from "@/features/auth/RegisterPage";

export const metadata = { title: "Crear cuenta, Kino" };

export default function Page() {
  return (
    <Suspense fallback={<FormularioEsperando />}>
      <RegisterPage />
    </Suspense>
  );
}
