/**
 * El contenedor del contenido de la app. Reserva abajo lo que ocupa el chrome
 * del teléfono leyendo `--kino-bottom-chrome`, y no un número: la barra
 * flotante, el banner del timer y el área segura suman en la variable, así que
 * cambiar la barra no deja al último elemento de una lista debajo de ella. En
 * escritorio la variable vale cero y no reserva nada.
 */
export function AppMain({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto bg-background" style={{ paddingBottom: "var(--kino-bottom-chrome)" }}>
      {children}
    </main>
  );
}
