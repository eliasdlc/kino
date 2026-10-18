"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { ENTITY_TYPE_ICON, ENTITY_TYPE_LABEL } from "@/features/entities/entities.ui";
import { createEntityApi } from "@/features/entities/entities.client";
import type { EntityType } from "@/features/entities/entities.attributes";
import { BUBBLE_BUTTON } from "./bubble-styles";

const OFFER_TYPES: EntityType[] = ["character", "location", "object"];

/**
 * Botones "añadir al codex" para el bubble menu de selección (PLAN-11 §8, flujo #2,
 * el patrón de Novelcrafter): seleccionas un nombre → eliges tipo → nace la entidad
 * y la selección se convierte en una mención enlazada. Se renderiza dentro del
 * bubble menu existente, solo en editores de escritura.
 */
export function CodexSelectionActions({
  editor,
  systemId,
}: {
  editor: Editor;
  systemId: string;
}) {
  const [busy, setBusy] = useState(false);

  async function addToCodex(type: EntityType) {
    const { from, to, empty } = editor.state.selection;
    if (empty || busy) return;
    if (editor.isActive("codeBlock") || editor.isActive("codexMention")) return;
    const name = editor.state.doc.textBetween(from, to, " ").trim();
    if (!name) return;

    setBusy(true);
    try {
      const created = await createEntityApi(systemId, { name, type });
      editor
        .chain()
        .focus()
        .insertContentAt(
          { from, to },
          {
            type: "codexMention",
            attrs: {
              entityId: created.id,
              label: created.name,
              entityType: created.type,
            },
          },
        )
        .run();
    } catch {
      // best-effort: si falla, la selección se queda intacta.
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
      <span className="px-1 text-xs font-semibold text-muted-foreground">Codex</span>
      {OFFER_TYPES.map((type) => {
        const Icon = ENTITY_TYPE_ICON[type];
        return (
          <button
            key={type}
            type="button"
            disabled={busy}
            title={`Añadir al codex como ${ENTITY_TYPE_LABEL[type].toLowerCase()}`}
            aria-label={`Añadir al codex como ${ENTITY_TYPE_LABEL[type].toLowerCase()}`}
            onClick={() => addToCodex(type)}
            className={BUBBLE_BUTTON}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </>
  );
}
