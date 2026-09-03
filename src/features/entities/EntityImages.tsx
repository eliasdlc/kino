"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X, Loader2 } from "lucide-react";
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
            <button
              type="button"
              onClick={() => update.mutate({ coverImageUrl: null })}
              className="absolute right-1.5 top-1.5 rounded bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              title="Quitar portada"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            disabled={busy === "cover"}
            className="flex aspect-[3/1] w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
          >
            {busy === "cover" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            Subir portada
          </button>
        )}
      </div>

      {/* Galería */}
      <div className="flex flex-wrap gap-2">
        {entity.images.map((url) => (
          <div
            key={url}
            className="group relative size-14 overflow-hidden rounded-md border border-border"
          >
            <Image src={url} alt="" fill sizes="56px" className="object-cover" unoptimized />
            <button
              type="button"
              onClick={() =>
                update.mutate({ images: entity.images.filter((u) => u !== url) })
              }
              className="absolute right-0.5 top-0.5 rounded bg-background/80 p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              title="Quitar imagen"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => galleryInput.current?.click()}
          disabled={busy === "gallery"}
          className={cn(
            "flex size-14 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:bg-accent/40",
          )}
          title="Añadir referencia"
        >
          {busy === "gallery" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
