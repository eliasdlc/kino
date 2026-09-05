// `import.meta.glob` lo resuelve Vitest en los tests de Convex; TypeScript sólo necesita saber su forma.
interface ImportMeta {
  glob(pattern: string): Record<string, () => Promise<unknown>>;
}
