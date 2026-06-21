import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getAuthContext } from "@/shared/utils/auth-context";
import { getUsersSystems } from "@/features/systems/systems.service";
import { getTasksBySystem } from "@/features/tasks/tasks.service";
import { getFoldersBySystem } from "@/features/folders/folders.service";
import { getPagesBySystemForExport } from "@/features/pages/pages.service";
import { htmlToMarkdown } from "@/features/pages/export/html-to-markdown";

function slugify(str: string): string {
  return (str || "sin-nombre")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const systems = await getUsersSystems(ctx.userId);
  const zip = new JSZip();

  for (const system of systems) {
    const folder = zip.folder(slugify(system.name))!;

    const [tasks, folders, pages] = await Promise.all([
      getTasksBySystem(system.id, ctx.userId),
      getFoldersBySystem(system.id, ctx.userId),
      getPagesBySystemForExport(system.id, ctx.userId),
    ]);

    folder.file("system.json", JSON.stringify(system, null, 2));
    folder.file("tasks.json", JSON.stringify(tasks, null, 2));
    folder.file("folders.json", JSON.stringify(folders, null, 2));

    const pagesFolder = folder.folder("pages")!;
    for (const page of pages) {
      const slug = slugify(page.title ?? "sin-titulo");
      pagesFolder.file(`${slug}.json`, JSON.stringify(page, null, 2));
      if (page.content) {
        pagesFolder.file(`${slug}.md`, htmlToMarkdown(page.content));
      }
    }
  }

  const uint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const buffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="kino-workspace.zip"',
    },
  });
}
