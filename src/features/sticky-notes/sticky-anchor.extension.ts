import { Mark } from "@tiptap/react";

export const StickyAnchorMark = Mark.create({
  name: "stickyAnchor",
  // Don't extend the mark when typing adjacent text
  inclusive: false,
  excludes: "",

  addAttributes() {
    return {
      anchorId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-anchor-id"),
        renderHTML: (attrs: { anchorId: string | null }) =>
          attrs.anchorId ? { "data-anchor-id": attrs.anchorId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-anchor-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, class: "sticky-anchor-mark" }, 0];
  },
});
