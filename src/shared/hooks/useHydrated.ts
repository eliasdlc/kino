import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * `false` durante SSR y el primer render del cliente; `true` tras la hidratación.
 *
 * Reemplaza el patrón `const [mounted, setMounted] = useState(false)` +
 * `useEffect(() => setMounted(true), [])`, que dispara un render extra en
 * cascada y viola react-hooks/set-state-in-effect. Útil para valores que sólo
 * son estables en el cliente (hora local, fecha) sin provocar mismatch de
 * hidratación: renderiza el snapshot de servidor primero y el del cliente
 * después.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
