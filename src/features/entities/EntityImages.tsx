"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadImageFile } from "@/features/uploads/uploads.client";
import { useUpdateEntity } from "./entities.hooks";
import type { EntityDetailTransport } from "./entities.types";

/**
 * Cover + galería de referencias de una entidad (Writing W2, §5.3). Sube WebP
 * comprimido en el cliente y persiste la URL al instante. Si el almacenamiento no
 * está configurado, muestra el error sin romper la ficha.
 */
export function EntityImages({
  entity,
  systemId,
}: {
  entity: EntityDetailTransport;
  systemId: string;
}) {
  const update = useUpdateEntity(entity.id, systemId);
  const [busy, setBusy] = useState<null | "cover" | "gallery">(null);
  const [error, setError] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  async function onCover(file: File | undefined) {
    if (!file) return;
    setBusy("cover");
    setError(null);
    try {
      const url = await uploadImageFile(file);
      update.mutate({ coverImageUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusy(null);
    }
  }

  async function onGallery(file: File | undefined) {
    if (!file) return;
    setBusy("gallery");
    setError(null);
    try {
      const url = await uploadImageFile(file);
      update.mutate({ images: [...entity.images, url] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={coverInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onCover(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onGallery(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {/* Cover */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
        {entity.coverImageUrl ? (
          <div className="group relative aspect-[3/1] w-full">
            <Image
              src={entity.coverImageUrl}
              alt={entity.name}
              fill
              sizes="512px"
              className="object-cover"
              unoptimized
            />
            {/* Con ratón asoma al pasar por encima; en el teléfono no hay
                encima, así que se ve siempre y mide 2.85rem. */}
            <button
              type="button"
              onClick={() => update.mutate({ coverImageUrl: null })}
              className="absolute right-1.5 top-1.5 flex items-center justify-center rounded-full bg-background/85 p-1 text-muted-foreground transition-opacity hover:text-destructive focus-ring pointer-coarse:size-[2.85rem] pointer-coarse:right-1 pointer-coarse:top-1 md:pointer-fine:opacity-0 md:pointer-fine:group-hover:opacity-100 md:pointer-fine:focus-visible:opacity-100"
              aria-label="Quitar portada"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            disabled={busy === "cover"}
            className="flex aspect-[3/1] w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
          >
            <ImagePlus aria-hidden className="size-4" />
            {busy === "cover" ? "Subiendo" : "Subir portada"}
          </button>
        )}
      </div>

      {/* Galería */}
      <div className="flex flex-wrap gap-2">
        {entity.images.map((url) => (
          <div
            key={url}
            className="group relative size-14 rounded-md border border-border pointer-coarse:size-[4.5rem]"
          >
            <span className="absolute inset-0 overflow-hidden rounded-[inherit]">
              <Image src={url} alt="" fill sizes="72px" className="object-cover" unoptimized />
            </span>
            {/* El aspa se ve pequeña pero el botón llega a 2.85rem en el
                teléfono: sale un poco de la miniatura para no taparla entera. */}
            <button
              type="button"
              onClick={() =>
                update.mutate({ images: entity.images.filter((u) => u !== url) })
              }
              className="absolute right-0.5 top-0.5 flex items-center justify-center rounded bg-background/80 p-0.5 text-muted-foreground transition-opacity hover:text-destructive focus-ring pointer-coarse:-right-2 pointer-coarse:-top-2 pointer-coarse:size-[2.85rem] pointer-coarse:items-start pointer-coarse:justify-end pointer-coarse:bg-transparent pointer-coarse:p-2.5 md:pointer-fine:opacity-0 md:pointer-fine:group-hover:opacity-100 md:pointer-fine:focus-visible:opacity-100"
              aria-label="Quitar imagen"
            >
              <X aria-hidden className="size-3 pointer-coarse:size-5 pointer-coarse:rounded-full pointer-coarse:bg-background/90 pointer-coarse:p-0.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => galleryInput.current?.click()}
          disabled={busy === "gallery"}
          className={cn(
            "flex size-14 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:bg-accent/40 focus-ring pointer-coarse:size-[4.5rem]",
          )}
          title="Añadir referencia"
        >
          {busy === "gallery" ? (
            <span className="text-xs font-semibold">Subiendo</span>
          ) : (
            <ImagePlus aria-hidden className="size-4" />
          )}
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
