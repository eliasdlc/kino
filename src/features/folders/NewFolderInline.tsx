"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Plus, Target, type LucideProps } from "lucide-react";
import { useCreateFolder } from "./folders.hooks";

interface NewFolderInlineProps {
  systemId: string;
  /** Texto del botón disparador, p.ej. "Nuevo milestone" / "Nuevo proyecto". */
  label: string;
  placeholder: string;
  /** Icono mostrado junto al input. Por defecto Target. */
  icon?: ComponentType<LucideProps>;
}

/**
 * Control inline para crear un folder (milestone/proyecto) siguiendo el patrón
 * de SystemTreeItem: botón → input con Enter/Escape/blur → useCreateFolder.
 */
export function NewFolderInline({ systemId, label, placeholder, icon: Icon = Target }: NewFolderInlineProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: createFolder, isPending } = useCreateFolder(systemId);

  useEffect(() => {
    if (isCreating) inputRef.current?.focus();
  }, [isCreating]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setIsCreating(false);
      return;
    }
    try {
      await createFolder({ name: trimmed });
    } finally {
      setName("");
      setIsCreating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") {
      setIsCreating(false);
      setName("");
    }
  }

  if (isCreating) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary/50 px-3 py-2">
        <Icon size={16} className="shrink-0 text-primary" />
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (isPending) return;
            if (!name.trim()) setIsCreating(false);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsCreating(true)}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <Plus size={15} className="shrink-0" />
      {label}
    </button>
  );
}
