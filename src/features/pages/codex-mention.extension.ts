import { Node, mergeAttributes, ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";
import {
  MentionList,
  type MentionItem,
  type MentionListProps,
  type MentionListRef,
} from "@/features/entities/MentionList";
import {
  fetchSystemEntities,
  createEntityApi,
} from "@/features/entities/entities.client";
import type { EntityListItemTransport } from "@/features/entities/entities.types";

/**
 * Nodo Mention del Codex (Writing W2). Trigger `@`: sugiere entidades del universo
 * (fuzzy por name + aliases) y ofrece crear personaje/lugar/objeto inline si no
 * existe. El nodo guarda `entityId`: renombrar la entidad no rompe el enlace, y el
 * texto renderizado (`@nombre`) alimenta la auto-detección determinística al guardar.
 */

/** Propia y distinta de la del menú de barra: ver `addProseMirrorPlugins`. */
const CODEX_MENTION_KEY = new PluginKey("codexMention");

export interface CodexMentionOptions {
  /** Sistema (universo) del que se sugieren/crean entidades. null → mención inerte. */
  systemId: string | null;
  HTMLAttributes: Record<string, unknown>;
}

// Cache corto por sistema para no golpear la API en cada tecla dentro de un `@`.
const CACHE_TTL_MS = 4000;
let cache: { systemId: string; at: number; data: EntityListItemTransport[] } | null = null;

async function getEntities(systemId: string): Promise<EntityListItemTransport[]> {
  const now = Date.now();
  if (cache && cache.systemId === systemId && now - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }
  const data = await fetchSystemEntities(systemId);
  cache = { systemId, at: now, data };
  return data;
}

function bustCache() {
  cache = null;
}

const CREATE_TYPES = ["character", "location", "object"] as const;

async function buildItems(systemId: string, query: string): Promise<MentionItem[]> {
  const all = await getEntities(systemId);
  const q = query.toLowerCase().trim();

  const matches = q
    ? all.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
      )
    : all.slice(0, 8);

  const items: MentionItem[] = matches
    .slice(0, 8)
    .map((e) => ({ kind: "entity", id: e.id, name: e.name, type: e.type }));

  // Ofrecer crear si hay texto y no hay match exacto de nombre.
  if (q && !all.some((e) => e.name.toLowerCase() === q)) {
    for (const type of CREATE_TYPES) {
      items.push({ kind: "create", name: query.trim(), type });
    }
  }
  return items;
}

/** Popover anclado al caret con flip vertical simple (idéntico al slash menu). */
function renderMentionMenu() {
  let renderer: ReactRenderer<MentionListRef, MentionListProps> | null = null;
  let el: HTMLDivElement | null = null;
  let hidden = false;

  const position = (clientRect?: (() => DOMRect | null) | null) => {
    if (!el || !clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    const menuHeight = el.offsetHeight || 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < menuHeight + 16 ? rect.top - menuHeight - 6 : rect.bottom + 6;
    el.style.position = "fixed";
    el.style.left = `${Math.round(rect.left)}px`;
    el.style.top = `${Math.round(Math.max(8, top))}px`;
    el.style.zIndex = "50";
  };

  return {
    onStart: (props: SuggestionProps<MentionItem, MentionItem>) => {
      renderer = new ReactRenderer(MentionList, {
        props: { items: props.items, command: props.command },
        editor: props.editor,
      });
      el = renderer.element as HTMLDivElement;
      document.body.appendChild(el);
      hidden = false;
      position(props.clientRect);
    },
    onUpdate: (props: SuggestionProps<MentionItem, MentionItem>) => {
      if (el && hidden) {
        document.body.appendChild(el);
        hidden = false;
      }
      renderer?.updateProps({ items: props.items, command: props.command });
      position(props.clientRect);
    },
    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === "Escape") {
        el?.remove();
        hidden = true;
        return true;
      }
      return renderer?.ref?.onKeyDown(props) ?? false;
    },
    onExit: () => {
      el?.remove();
      el = null;
      renderer?.destroy();
      renderer = null;
    },
  };
}

export const CodexMention = Node.create<CodexMentionOptions>({
  name: "codexMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { systemId: null, HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      entityId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-entity-id"),
        renderHTML: (attrs) =>
          attrs.entityId ? { "data-entity-id": attrs.entityId } : {},
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-label"),
        renderHTML: (attrs) => (attrs.label ? { "data-label": attrs.label } : {}),
      },
      entityType: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-entity-type"),
        renderHTML: (attrs) =>
          attrs.entityType ? { "data-entity-type": attrs.entityType } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-entity-id]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        { "data-mention": "", class: "codex-mention" },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      `@${node.attrs.label ?? ""}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.label ?? ""}`;
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      Suggestion<MentionItem, MentionItem>({
        // `@tiptap/suggestion` registra su plugin bajo `PluginKey("suggestion")`
        // si no le das uno. Con dos extensiones de sugerencia en el mismo editor
        // (esta y el menú de barra) ProseMirror ve dos plugins distintos con la
        // misma clave y se niega a montar el editor entero.
        pluginKey: CODEX_MENTION_KEY,
        editor: this.editor,
        char: "@",
        allowSpaces: false,
        startOfLine: false,
        // Sin menciones dentro de bloques de código.
        allow: ({ editor }) => !editor.isActive("codeBlock"),
        items: async ({ query }) => {
          if (!options.systemId) return [];
          try {
            return await buildItems(options.systemId, query);
          } catch {
            return [];
          }
        },
        command: async ({ editor, range, props }) => {
          const item = props;
          let entityId: string;
          let label: string;
          let entityType: string;

          if (item.kind === "create") {
            if (!options.systemId) return;
            const created = await createEntityApi(options.systemId, {
              name: item.name,
              type: item.type,
            });
            bustCache();
            entityId = created.id;
            label = created.name;
            entityType = created.type;
          } else {
            entityId = item.id;
            label = item.name;
            entityType = item.type;
          }

          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              { type: "codexMention", attrs: { entityId, label, entityType } },
              { type: "text", text: " " },
            ])
            .run();
        },
        render: renderMentionMenu,
      }),
    ];
  },
});
