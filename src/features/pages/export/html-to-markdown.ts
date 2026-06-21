import TurndownService from "turndown";

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Strip sticky-anchor <span data-anchor-id="…"> — keep the inner text
td.addRule("stickyAnchor", {
  filter: (node) =>
    node.nodeName === "SPAN" && node.hasAttribute("data-anchor-id"),
  replacement: (content) => content,
});

// Tiptap task lists render as <ul data-type="taskList"><li data-checked="…">
td.addRule("taskList", {
  filter: (node) =>
    node.nodeName === "LI" && node.hasAttribute("data-checked"),
  replacement: (content, node) => {
    const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
    return `- [${checked ? "x" : " "}] ${content.trim()}\n`;
  },
});

export function htmlToMarkdown(html: string): string {
  return td.turndown(html);
}
