import { ConvexError } from 'convex/values';

// Los mismos códigos que la API REST devolvía, ahora como error tipado que el
// cliente distingue por `data.code`.
export type DomainErrorCode = 'NOT_FOUND' | 'VALIDATION_ERROR' | 'FORBIDDEN' | 'CONFLICT';

export function notFound(message: string): never {
  throw new ConvexError({ code: 'NOT_FOUND' as const, message });
}

export function invalid(message: string): never {
  throw new ConvexError({ code: 'VALIDATION_ERROR' as const, message });
}

export function forbidden(message: string): never {
  throw new ConvexError({ code: 'FORBIDDEN' as const, message });
}
