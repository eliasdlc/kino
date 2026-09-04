/**
 * El contador de peticiones por identidad y cubo. Vive en memoria de la
 * instancia: dos instancias serverless no comparten cuenta, así que el límite
 * real es por instancia y el que de verdad protege el acceso es el de Clerk.
 */
export interface RateLimitStore {
  /** Cuenta esta request y devuelve el total acumulado en la ventana. */
  hit(identity: string, bucket: string, windowStart: Date): Promise<number>;
  /** Borra el contador. */
  reset(identity: string, bucket: string): Promise<void>;
}

const counters = new Map<string, { windowStart: number; hits: number }>();

export const memoryRateLimitStore: RateLimitStore = {
  async hit(identity, bucket, windowStart) {
    const key = `${identity}:${bucket}`;
    const current = counters.get(key);
    const start = windowStart.getTime();
    const hits = current && current.windowStart === start ? current.hits + 1 : 1;
    counters.set(key, { windowStart: start, hits });
    return hits;
  },

  async reset(identity, bucket) {
    counters.delete(`${identity}:${bucket}`);
  },
};
