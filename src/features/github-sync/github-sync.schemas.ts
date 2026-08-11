import { z } from "zod";

/**
 * Reglas de nombres de GitHub: el owner admite alfanuméricos y guiones; el
 * repositorio además punto y guion bajo. Se valida aquí y no sólo en GitHub
 * para no montar una URL rara con lo que escriba el usuario.
 */
const ownerSchema = z
  .string()
  .trim()
  .min(1)
  .max(39)
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/, "Owner de GitHub inválido");

const repoSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._-]+$/, "Nombre de repositorio inválido");

export const githubRepoRefSchema = z.object({
  owner: ownerSchema,
  repo: repoSchema,
});

/**
 * Acepta también `owner/repo` pegado de la barra del navegador, que es como
 * la gente tiene el dato a mano.
 */
export const linkRepoSchema = z
  .object({
    owner: ownerSchema.optional(),
    repo: repoSchema.optional(),
    fullName: z.string().trim().optional(),
  })
  .transform((value, ctx) => {
    if (value.owner && value.repo) {
      return { owner: value.owner, repo: value.repo };
    }

    const partes = value.fullName?.split("/").filter(Boolean) ?? [];
    if (partes.length === 2) {
      const parsed = githubRepoRefSchema.safeParse({
        owner: partes[0],
        repo: partes[1],
      });
      if (parsed.success) return parsed.data;
    }

    ctx.addIssue({
      code: "custom",
      message: "Indica el repositorio como owner/repo",
    });
    return z.NEVER;
  });

export type LinkRepoInput = z.infer<typeof linkRepoSchema>;
