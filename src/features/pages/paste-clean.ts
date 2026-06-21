/**
 * Sanitizes HTML pasted from the web before ProseMirror parses it (KIN-68).
 *
 * Goal: keep the *structure* (headings, lists, links, tables, bold/italic/strike)
 * and drop the noise (classes, colors, font-family/size, margins, MS-Office and
 * Google-Docs cruft). ProseMirror's schema already discards unknown nodes/marks;
 * this pre-pass mainly removes attribute soup that would otherwise leak through.
 *
 * Inline styles are dropped *except* the few that carry semantics ProseMirror's
 * marks read from `style` — font-weight (bold), font-style (italic),
 * text-decoration (strike) — so bold/italic/strike from sources like Google Docs
 * (which use styled <span>s instead of <b>/<i>) survive.
 *
 * Plain-text paste (Shift+paste) goes through `transformPastedText`, not this, so
 * it is unaffected.
 */

const KEEP_STYLE_PROPS = new Set([
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
]);

/** Attributes preserved per tag (everything else, except the data-* below, is dropped). */
const ATTR_ALLOWLIST: Record<string, Set<string>> = {
  A: new Set(["href", "target", "rel"]),
  IMG: new Set(["src", "alt", "title"]),
  TD: new Set(["colspan", "rowspan"]),
  TH: new Set(["colspan", "rowspan"]),
};

/** data-* attributes that carry editor semantics and must survive a paste. */
const KEEP_DATA_ATTRS = new Set(["data-anchor-id", "data-type", "data-checked"]);

function cleanStyle(value: string): string {
  return value
    .split(";")
    .map((decl) => decl.trim())
    .filter(Boolean)
    .filter((decl) => {
      const prop = decl.split(":")[0]?.trim().toLowerCase();
      return prop ? KEEP_STYLE_PROPS.has(prop) : false;
    })
    .join("; ");
}

export function cleanPastedHtml(html: string): string {
  // SSR / non-DOM environments: leave the payload untouched.
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");

  // Drop non-content elements wholesale.
  doc.querySelectorAll("style, script, meta, link, title").forEach((n) => n.remove());

  // Strip HTML comments (e.g. <!--StartFragment--> from Office/Docs).
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode as Comment);
  comments.forEach((c) => c.remove());

  doc.body.querySelectorAll("*").forEach((el) => {
    const allow = ATTR_ALLOWLIST[el.tagName];
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name === "style") {
        const cleaned = cleanStyle(attr.value);
        if (cleaned) el.setAttribute("style", cleaned);
        else el.removeAttribute("style");
        continue;
      }
      if (KEEP_DATA_ATTRS.has(name)) continue;
      if (allow?.has(name)) continue;
      el.removeAttribute(name);
    }
  });

  return doc.body.innerHTML;
}
