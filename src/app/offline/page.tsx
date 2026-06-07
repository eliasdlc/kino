import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-background">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Kino</h1>
        <p className="text-lg font-medium text-muted-foreground">Sin conexión</p>
      </div>
      <p className="text-sm text-muted-foreground max-w-xs">
        No hay conexión a internet. Abre Kino cuando vuelvas a estar conectado para ver tus tareas y sistemas.
      </p>
      <Link
        href="/dashboard"
        className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
      >
        Intentar de nuevo
      </Link>
    </div>
  );
}
