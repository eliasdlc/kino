import { sanitizePageHtml } from "@/shared/lib/sanitize";

/**
 * El único sitio del árbol que inyecta HTML de usuario.
 *
 * Concentrarlo en un componente es la garantía: `dangerouslySetInnerHTML` sobre
 * `pages.content` sólo aparece aquí, así que no hay forma de pintar un capítulo
 * saltándose el saneo, y una vista de lectura nueva lo hereda sin acordarse.
 *
 * Sanea en el render, no al guardar: el HTML entra por el editor y por el MCP, y
 * las filas que ya están en la base se escribieron sin filtro. Saneando aquí,
 * todas quedan cubiertas a la vez. Corre igual en el servidor y en el navegador
 * porque el modo lectura es un server component: si el saneo dependiera del DOM,
 * el payload viajaría vivo dentro del HTML del SSR.
 */
export function SanitizedHtml({
  html,
  className,
  ...rest
}: {
  html: string | null | undefined;
  className?: string;
} & Omit<React.ComponentProps<"div">, "children" | "dangerouslySetInnerHTML">) {
  return (
    <div
      {...rest}
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizePageHtml(html) }}
    />
  );
}
