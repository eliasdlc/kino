import { describe, it, expect } from "vitest";
import { cleanPastedHtml } from "./paste-clean";

describe("cleanPastedHtml", () => {
  it("strips class attributes and keeps the tag/structure", () => {
    const out = cleanPastedHtml('<p class="x y z">hola</p>');
    expect(out).toBe("<p>hola</p>");
  });

  it("drops noisy inline styles but keeps font-weight/style/decoration", () => {
    const out = cleanPastedHtml(
      '<span style="color:#f00;font-size:42px;font-weight:700;font-style:italic">t</span>'
    );
    expect(out).toContain("font-weight:700");
    expect(out).toContain("font-style:italic");
    expect(out).not.toContain("color");
    expect(out).not.toContain("font-size");
  });

  it("removes the style attribute entirely when nothing survives", () => {
    const out = cleanPastedHtml('<p style="margin:0;color:blue">t</p>');
    expect(out).toBe("<p>t</p>");
  });

  it("removes <style>/<script> and HTML comments (Office/Docs cruft)", () => {
    const out = cleanPastedHtml(
      "<style>.a{}</style><!--StartFragment--><p>t</p><!--EndFragment--><script>x()</script>"
    );
    expect(out).toBe("<p>t</p>");
  });

  it("keeps link href and image src/alt", () => {
    const out = cleanPastedHtml(
      '<a href="https://x.com" class="link" data-x="1">l</a>'
    );
    expect(out).toContain('href="https://x.com"');
    expect(out).not.toContain("data-x");
    expect(out).not.toContain("class");

    const img = cleanPastedHtml('<img src="https://x.com/a.png" alt="a" width="9">');
    expect(img).toContain('src="https://x.com/a.png"');
    expect(img).toContain('alt="a"');
    expect(img).not.toContain("width");
  });

  it("keeps table colspan/rowspan", () => {
    const out = cleanPastedHtml(
      '<table><tr><td colspan="2" class="c" style="border:1px">x</td></tr></table>'
    );
    expect(out).toContain('colspan="2"');
    expect(out).not.toContain("class");
    expect(out).not.toContain("border");
  });

  it("preserves editor data-* (sticky anchor + task list)", () => {
    const out = cleanPastedHtml(
      '<span data-anchor-id="abc" class="noise">t</span>'
    );
    expect(out).toContain('data-anchor-id="abc"');
    expect(out).not.toContain("noise");

    const task = cleanPastedHtml(
      '<ul data-type="taskList"><li data-checked="true" class="x">t</li></ul>'
    );
    expect(task).toContain('data-type="taskList"');
    expect(task).toContain('data-checked="true"');
  });

  it("keeps heading and list structure", () => {
    const out = cleanPastedHtml(
      '<h2 style="color:red">T</h2><ul><li style="margin:0">a</li><li>b</li></ul>'
    );
    expect(out).toContain("<h2>T</h2>");
    expect(out).toContain("<ul><li>a</li><li>b</li></ul>");
  });
});
