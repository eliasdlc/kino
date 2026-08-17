import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, markdownToHtml } from './markdown.js';

describe('MCP page content conversion', () => {
  it('round trips the structures used by learning sessions', () => {
    const markdown = `# Gradient descent

- [x] Understand the derivative
- [ ] Apply the update rule

| Symbol | Meaning |
| --- | --- |
| x | Input |

\`\`\`ts
const rate = 0.1;
\`\`\``;

    const html = markdownToHtml(markdown);
    const result = htmlToMarkdown(html);

    expect(result).toContain('# Gradient descent');
    expect(result).toContain('[x] Understand the derivative');
    expect(result).toContain('| Symbol | Meaning |');
    expect(result).toContain('```ts');
    expect(result).toContain('const rate = 0.1;');
  });

  it('preserves the nullable page content contract', () => {
    expect(markdownToHtml(null)).toBeNull();
    expect(markdownToHtml('  ')).toBeNull();
    expect(htmlToMarkdown(null)).toBeNull();
    expect(htmlToMarkdown('  ')).toBeNull();
  });
});
