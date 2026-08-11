import { useEffect, useState } from "react";

/**
 * Devuelve `value` con un retraso de `delayMs` desde el último cambio.
 * Evita disparar una búsqueda en cada tecla: el consumidor lee el valor
 * estable y solo reacciona cuando el usuario deja de escribir.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
