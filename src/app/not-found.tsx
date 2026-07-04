import Link from "next/link";
import { Button } from "@/components/ui/button";

// 404 amable en vez de la pantalla cruda de Next. Cubre rutas inexistentes y
// cualquier notFound() sin un not-found propio más cercano.
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">No encontramos esta página</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Puede que el enlace esté roto o que lo que buscas ya no exista.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Volver al inicio</Link>
      </Button>
    </div>
  );
}
