"use client";

import { useState } from "react";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { MEDIUM_CONFIG } from "@/shared/lib/mediums";
import { downloadBlob, slugify } from "@/shared/utils/download";
import type { Manuscript } from "./writing.manuscript";
import {
  buildDocxParts,
  compileManuscript,
  coverBlocks,
  type CompileMeta,
  type DocxBlock,
} from "./compile";
import { domParse, htmlToDocxBlocks } from "./html-to-docx";
import { useManuscript } from "./writing.hooks";

/**
 * Compilar la obra entera en un archivo (KIN-139).
 *
 * Todo pasa en el cliente. El navegador ya tiene el texto, ya trae `turndown` y
 * un `.docx` es un zip de XML que arma `jszip`, que ya es dependencia: así una
 * novela larga no se pelea con el límite de 10s de la función serverless. El PDF
 * lo hace el propio navegador imprimiendo el modo lectura, que ya tiene su hoja
 * de estilos: un motor de PDF en el bundle haría peor lo que ya se hace bien.
 */
export function CompileMenu({
  folderId,
  systemId,
  manuscript: preloaded,
}: {
  folderId: string;
  systemId: string;
  /** El modo lectura ya lo tiene; la biblioteca de obras lo pide al abrir. */
  manuscript?: Manuscript;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Sin `preloaded`, el manuscrito se pide solo cuando se abre el menú: la
  // biblioteca de obras no debería descargar el texto de todas las novelas.
  const { data: fetched, isLoading } = useManuscript(
    preloaded ? null : open ? folderId : null,
  );
  const manuscript = preloaded ?? fetched;

  async function run(format: "text" | "docx") {
    if (!manuscript) return;
    setBusy(format);
    try {
      if (format === "text") await downloadText(manuscript);
      else await downloadDocx(manuscript);
    } catch (err) {
      console.error("compile failed", err);
      toast.error("No se pudo compilar la obra");
    } finally {
      setBusy(null);
    }
  }

  const manifest = MEDIUM_CONFIG[manuscript?.medium ?? "novel"];
  const textLabel =
    manifest.exportExtension === "fountain" ? "Fountain (.fountain)" : "Markdown (.md)";
  const pending = busy !== null || (open && !preloaded && isLoading);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Compilar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          La obra entera en un archivo, con portada
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!manuscript || pending} onSelect={() => run("text")}>
          <FileText className="size-4" />
          {textLabel}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!manuscript || pending} onSelect={() => run("docx")}>
          <FileText className="size-4" />
          Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={`/systems/${systemId}/folders/${folderId}/lectura?print=1`}>
            <Printer className="size-4" />
            PDF (imprimir)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function metaOf(manuscript: Manuscript): CompileMeta {
  return {
    title: manuscript.title,
    author: manuscript.author,
    medium: manuscript.medium,
    totalWords: manuscript.totalWords,
    chapterCount: manuscript.chapters.length,
    date: new Date().toISOString().slice(0, 10),
  };
}

async function downloadText(manuscript: Manuscript): Promise<void> {
  // turndown pesa; se carga solo al compilar, no al pintar el botón.
  const { htmlToMarkdown } = await import("@/features/pages/export/html-to-markdown");
  const text = compileManuscript(
    metaOf(manuscript),
    manuscript.chapters.map((c) => ({ title: c.title, body: c.content ?? "" })),
    (html) => htmlToMarkdown(html, { medium: manuscript.medium }),
  );
  const extension = MEDIUM_CONFIG[manuscript.medium].exportExtension;
  downloadBlob(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
    `${slugify(manuscript.title)}.${extension}`,
  );
}

async function downloadDocx(manuscript: Manuscript): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const meta = metaOf(manuscript);
  const manifest = MEDIUM_CONFIG[manuscript.medium];

  const blocks: DocxBlock[] = [...coverBlocks(meta)];
  for (const chapter of manuscript.chapters) {
    // Cada capítulo empieza en página nueva, como en un manuscrito de verdad.
    blocks.push({ kind: "pageBreak" });
    blocks.push({
      kind: "heading",
      runs: [
        {
          text:
            chapter.title?.trim() ||
            `${manifest.unit.noun.charAt(0).toUpperCase()}${manifest.unit.noun.slice(1)} ${
              manuscript.chapters.indexOf(chapter) + 1
            }`,
        },
      ],
    });
    blocks.push(...htmlToDocxBlocks(chapter.content ?? "", domParse));
  }

  const zip = new JSZip();
  for (const [path, xml] of Object.entries(buildDocxParts(blocks))) {
    zip.file(path, xml);
  }
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  downloadBlob(blob, `${slugify(manuscript.title)}.docx`);
}
